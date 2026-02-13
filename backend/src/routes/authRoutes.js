import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { requireAuth, signToken } from '../auth.js';
import { mapUser } from '../mappers.js';
import { supabase } from '../supabaseClient.js';
import {
  addMinutesIso,
  addNotification,
  assertEmail,
  assertPassword,
  assertVerificationCode,
  buildHttpError,
  createUniqueInviteCode,
  ensureUserInvitationCode,
  ensureUserSettings,
  generateVerificationCode,
  getFixedInviteCodeForEmail,
  getUserByEmail,
  hashValue,
  nowIso,
  withAsync,
} from '../helpers.js';
import { config } from '../config.js';
import { sendPasswordResetCodeEmail, sendSignupCodeEmail } from '../emailService.js';
import {
  extractStorageKeyFromImage,
  persistAvatarImageDetailed,
  removeStoredMemoryImages,
  resolveMemoryImageUrl,
} from '../imageStorage.js';

const router = Router();

const SIGNUP_PURPOSE = 'signup';
const RESET_PASSWORD_PURPOSE = 'reset_password';
const SIGNUP_RESEND_COOLDOWN_SECONDS = config.signupCodeCooldownSeconds;
const RESET_RESEND_COOLDOWN_SECONDS = config.resetCodeCooldownSeconds;
const MAX_VERIFY_ATTEMPTS = config.verificationMaxAttempts;
const PASSWORD_HASH_ROUNDS = config.passwordHashRounds;
const AUTH_MIN_LATENCY_MS = config.authUniformMinLatencyMs;
const AUTH_USER_COLUMNS =
  'id,email,password_hash,invitation_code,bound_invitation_code,email_verified,created_at,name,avatar,gender,partner_id,token_version';
const AUTH_USER_PUBLIC_COLUMNS =
  'id,email,invitation_code,bound_invitation_code,email_verified,created_at,name,avatar,gender,partner_id,token_version';
const REGISTER_CODE_RESPONSE_MESSAGE =
  '如果邮箱可用于注册，验证码将发送到该邮箱；若已注册，请直接登录或使用忘记密码。';
const RESET_CODE_RESPONSE_MESSAGE = '如果邮箱已注册，验证码将发送到该邮箱';
const VERIFY_CODE_FAILED_MESSAGE = '验证码错误或已失效，请重新发送验证码。';
const TOO_FREQUENT_MESSAGE = '请求过于频繁，请稍后重试。';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitForUniformLatency = async (startedAt) => {
  const elapsed = Date.now() - startedAt;
  if (elapsed >= AUTH_MIN_LATENCY_MS) return;
  await sleep(AUTH_MIN_LATENCY_MS - elapsed);
};

const failAfterUniformLatency = async (startedAt, status, message) => {
  await waitForUniformLatency(startedAt);
  throw buildHttpError(status, message);
};

const respondAfterUniformLatency = async (res, startedAt, payload, status = 200) => {
  await waitForUniformLatency(startedAt);
  return res.status(status).json(payload);
};

const fireAndForget = (task, label) => {
  try {
    Promise.resolve(task).catch((error) => {
      console.error(`[${label}]`, error?.message || error);
    });
  } catch (error) {
    console.error(`[${label}]`, error?.message || error);
  }
};

const cleanupStoredAvatars = async (keys, label) => {
  const validKeys = (Array.isArray(keys) ? keys : []).filter(Boolean);
  if (validKeys.length === 0) return;
  try {
    await removeStoredMemoryImages(validKeys);
  } catch (error) {
    console.error(`[${label}] failed to cleanup stored avatars`, error?.message || error);
  }
};

const getEmailVerification = async (email, purpose) => {
  const { data, error } = await supabase
    .from('email_verifications')
    .select('*')
    .eq('email', email)
    .eq('purpose', purpose)
    .maybeSingle();
  if (error) throw error;
  return data;
};

const ensureNotFrequent = (lastSentAt, cooldownSeconds) => {
  if (!lastSentAt) return;
  const elapsed = Date.now() - new Date(lastSentAt).getTime();
  if (elapsed < cooldownSeconds * 1000) {
    throw buildHttpError(429, TOO_FREQUENT_MESSAGE);
  }
};

const mapUserForResponse = async (userRow) => {
  if (!userRow) return null;
  const avatar = await resolveMemoryImageUrl(userRow.avatar || '');
  return mapUser({
    ...userRow,
    avatar,
  });
};

const buildAuthPayload = async (userRow) => {
  const normalizedUser = await ensureUserInvitationCode(userRow);
  const partner = await getPartnerForAuth(normalizedUser, 'auth-build-payload');
  const [mappedUser, mappedPartner] = await Promise.all([
    mapUserForResponse(normalizedUser),
    mapUserForResponse(partner),
  ]);
  return {
    token: signToken(normalizedUser.id, normalizedUser.token_version),
    user: mappedUser,
    partner: mappedPartner,
  };
};

const isUsersEmailUniqueViolation = (error) => {
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  return (
    String(error?.code || '') === '23505' &&
    (message.includes('users_email_key') ||
      message.includes('duplicate key value') ||
      details.includes('(email)'))
  );
};

const isTransientSupabaseError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  return (
    message.includes('aborterror') ||
    details.includes('aborterror') ||
    message.includes('fetch failed') ||
    details.includes('fetch failed') ||
    message.includes('connect timeout') ||
    details.includes('connect timeout') ||
    message.includes('und_err_connect_timeout') ||
    details.includes('und_err_connect_timeout')
  );
};

const getPartnerForAuth = async (userRow, contextLabel) => {
  try {
    if (!userRow?.partner_id) return null;
    return await getAuthUserById(userRow.partner_id);
  } catch (error) {
    if (isTransientSupabaseError(error)) {
      console.warn(`[${contextLabel}] partner lookup skipped due transient backend error`);
      return null;
    }
    throw error;
  }
};

const getAuthUserByEmail = async (email) => {
  const { data, error } = await supabase
    .from('users')
    .select(AUTH_USER_COLUMNS)
    .eq('email', email)
    .maybeSingle();
  if (error) throw error;
  return data;
};

const getAuthUserById = async (userId) => {
  const { data, error } = await supabase
    .from('users')
    .select(AUTH_USER_PUBLIC_COLUMNS)
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
};

router.post(
  '/register/request-code',
  withAsync(async (req, res) => {
    const startedAt = Date.now();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    assertEmail(email);
    assertPassword(password);

    const [existedUser, existingCode] = await Promise.all([
      getUserByEmail(email),
      getEmailVerification(email, SIGNUP_PURPOSE),
    ]);

    try {
      ensureNotFrequent(existingCode?.last_sent_at, SIGNUP_RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      await failAfterUniformLatency(startedAt, error.status || 429, TOO_FREQUENT_MESSAGE);
    }

    const code = generateVerificationCode();
    const [passwordHash] = await Promise.all([bcrypt.hash(password, PASSWORD_HASH_ROUNDS)]);
    const shouldSendSignupCode = !existedUser?.email_verified;

    const { error: upsertError } = await supabase.from('email_verifications').upsert(
      {
        email,
        purpose: SIGNUP_PURPOSE,
        code_hash: hashValue(shouldSendSignupCode ? code : generateVerificationCode()),
        password_hash: passwordHash,
        expires_at: addMinutesIso(config.verificationCodeTtlMinutes),
        attempts: 0,
        last_sent_at: nowIso(),
      },
      { onConflict: 'email,purpose' }
    );
    if (upsertError) throw upsertError;

    if (shouldSendSignupCode) {
      try {
        await sendSignupCodeEmail(email, code);
      } catch (error) {
        console.error('[send-signup-code]', error?.message || error);
      }
    }

    return respondAfterUniformLatency(res, startedAt, {
      ok: true,
      message: REGISTER_CODE_RESPONSE_MESSAGE,
      expiresInMinutes: config.verificationCodeTtlMinutes,
    });
  })
);

router.post(
  '/register/verify',
  withAsync(async (req, res) => {
    const startedAt = Date.now();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim();

    assertEmail(email);
    assertVerificationCode(code);

    const verifyRow = await getEmailVerification(email, SIGNUP_PURPOSE);
    if (!verifyRow) {
      await failAfterUniformLatency(startedAt, 400, VERIFY_CODE_FAILED_MESSAGE);
    }

    if (new Date(verifyRow.expires_at).getTime() < Date.now()) {
      await supabase.from('email_verifications').delete().eq('id', verifyRow.id);
      await failAfterUniformLatency(startedAt, 400, VERIFY_CODE_FAILED_MESSAGE);
    }

    if ((verifyRow.attempts || 0) >= MAX_VERIFY_ATTEMPTS) {
      await failAfterUniformLatency(startedAt, 400, VERIFY_CODE_FAILED_MESSAGE);
    }

    const isValid = hashValue(code) === verifyRow.code_hash;
    if (!isValid) {
      await supabase
        .from('email_verifications')
        .update({ attempts: (verifyRow.attempts || 0) + 1 })
        .eq('id', verifyRow.id);
      await failAfterUniformLatency(startedAt, 400, VERIFY_CODE_FAILED_MESSAGE);
    }

    const existedUser = await getUserByEmail(email);
    let userRow;

    if (existedUser?.email_verified) {
      fireAndForget(supabase.from('email_verifications').delete().eq('id', verifyRow.id), 'cleanup-signup-code');
      fireAndForget(
        ensureUserSettings(existedUser.id, Boolean(existedUser.partner_id)),
        'ensure-settings-register-duplicate-verify'
      );
      return respondAfterUniformLatency(res, startedAt, await buildAuthPayload(existedUser));
    }

    // Special email → fixed invitation code mapping (must match DB constraint)
    const getInviteCodeForEmail = async (targetEmail) =>
      getFixedInviteCodeForEmail(targetEmail) || (await createUniqueInviteCode());

    if (existedUser) {
      const invitationCode = existedUser.invitation_code || (await getInviteCodeForEmail(email));
      const { data, error } = await supabase
        .from('users')
        .update({
          password_hash: verifyRow.password_hash,
          email_verified: true,
          invitation_code: invitationCode,
          name: existedUser.name || email.split('@')[0],
        })
        .eq('id', existedUser.id)
        .select('*')
        .single();
      if (error) throw error;
      userRow = data;
    } else {
      const invitationCode = await getInviteCodeForEmail(email);
      const { data, error } = await supabase
        .from('users')
        .insert({
          email,
          password_hash: verifyRow.password_hash,
          invitation_code: invitationCode,
          bound_invitation_code: null,
          email_verified: true,
          name: email.split('@')[0],
          gender: 'male',
        })
        .select('*')
        .single();
      if (!error) {
        userRow = data;
      } else if (isUsersEmailUniqueViolation(error)) {
        // 并发重复验证时，另一个请求可能已先创建成功；回读后继续自动登录。
        const conflictUser = await getUserByEmail(email);
        if (!conflictUser?.email_verified) {
          throw error;
        }
        userRow = conflictUser;
      } else {
        throw error;
      }
    }

    fireAndForget(
      ensureUserSettings(userRow.id, Boolean(userRow.partner_id)),
      'ensure-settings-register-verify'
    );
    fireAndForget(supabase.from('email_verifications').delete().eq('id', verifyRow.id), 'cleanup-signup-code');

    const authPayload = await buildAuthPayload(userRow);

    fireAndForget(
      addNotification(
        userRow.id,
        '注册成功',
        `邮箱验证完成。你的专属邀请码是 ${userRow.invitation_code}。`,
        'system'
      ),
      'notify-register'
    );

    return respondAfterUniformLatency(res, startedAt, authPayload, 201);
  })
);

router.post(
  '/register',
  withAsync(async (_req, res) => {
    return res.status(400).json({
      error: '注册流程已升级，请先调用 /api/auth/register/request-code 再调用 /api/auth/register/verify。',
    });
  })
);

router.post(
  '/password/request-reset-code',
  withAsync(async (req, res) => {
    const startedAt = Date.now();
    const email = String(req.body?.email || '').trim().toLowerCase();
    assertEmail(email);

    const [userRow, existingCode] = await Promise.all([
      getUserByEmail(email),
      getEmailVerification(email, RESET_PASSWORD_PURPOSE),
    ]);

    try {
      ensureNotFrequent(existingCode?.last_sent_at, RESET_RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      await failAfterUniformLatency(startedAt, error.status || 429, TOO_FREQUENT_MESSAGE);
    }

    const code = generateVerificationCode();
    const shouldSendResetCode = Boolean(userRow?.email_verified);
    const { error: upsertError } = await supabase.from('email_verifications').upsert(
      {
        email,
        purpose: RESET_PASSWORD_PURPOSE,
        code_hash: hashValue(shouldSendResetCode ? code : generateVerificationCode()),
        password_hash: shouldSendResetCode ? userRow.password_hash : hashValue(nowIso()),
        expires_at: addMinutesIso(config.verificationCodeTtlMinutes),
        attempts: 0,
        last_sent_at: nowIso(),
      },
      { onConflict: 'email,purpose' }
    );
    if (upsertError) throw upsertError;

    if (shouldSendResetCode) {
      try {
        await sendPasswordResetCodeEmail(email, code);
      } catch (error) {
        console.error('[send-reset-password-code]', error?.message || error);
      }
    }

    return respondAfterUniformLatency(res, startedAt, {
      ok: true,
      message: RESET_CODE_RESPONSE_MESSAGE,
      expiresInMinutes: config.verificationCodeTtlMinutes,
    });
  })
);

router.post(
  '/password/reset',
  withAsync(async (req, res) => {
    const startedAt = Date.now();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim();
    const newPassword = String(req.body?.newPassword || '');

    assertEmail(email);
    assertVerificationCode(code);
    assertPassword(newPassword);

    const verifyRow = await getEmailVerification(email, RESET_PASSWORD_PURPOSE);
    if (!verifyRow) {
      await failAfterUniformLatency(startedAt, 400, VERIFY_CODE_FAILED_MESSAGE);
    }

    if (new Date(verifyRow.expires_at).getTime() < Date.now()) {
      await supabase.from('email_verifications').delete().eq('id', verifyRow.id);
      await failAfterUniformLatency(startedAt, 400, VERIFY_CODE_FAILED_MESSAGE);
    }

    if ((verifyRow.attempts || 0) >= MAX_VERIFY_ATTEMPTS) {
      await failAfterUniformLatency(startedAt, 400, VERIFY_CODE_FAILED_MESSAGE);
    }

    const isValid = hashValue(code) === verifyRow.code_hash;
    if (!isValid) {
      await supabase
        .from('email_verifications')
        .update({ attempts: (verifyRow.attempts || 0) + 1 })
        .eq('id', verifyRow.id);
      await failAfterUniformLatency(startedAt, 400, VERIFY_CODE_FAILED_MESSAGE);
    }

    const userRow = await getAuthUserByEmail(email);
    if (!userRow?.email_verified) {
      await failAfterUniformLatency(startedAt, 400, VERIFY_CODE_FAILED_MESSAGE);
    }

    const newPasswordHash = await bcrypt.hash(newPassword, PASSWORD_HASH_ROUNDS);
    const currentTokenVersion = Number.parseInt(String(userRow.token_version ?? 0), 10) || 0;
    const nextTokenVersion = currentTokenVersion + 1;

    const [{ error: updateError }, { error: deleteError }] = await Promise.all([
      supabase
        .from('users')
        .update({
          password_hash: newPasswordHash,
          token_version: nextTokenVersion,
        })
        .eq('id', userRow.id),
      supabase.from('email_verifications').delete().eq('id', verifyRow.id),
    ]);
    if (updateError) throw updateError;
    if (deleteError) throw deleteError;

    fireAndForget(
      addNotification(userRow.id, '密码已重置', '你已成功重置登录密码。', 'system'),
      'notify-reset-password'
    );

    return respondAfterUniformLatency(res, startedAt, {
      ok: true,
      message: '密码重置成功，请使用新密码登录',
    });
  })
);

router.post(
  '/login',
  withAsync(async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');

    assertEmail(email);
    assertPassword(password);

    const userRow = await getAuthUserByEmail(email);
    if (!userRow?.email_verified) {
      throw buildHttpError(401, '邮箱或密码错误');
    }

    const isPasswordValid = await bcrypt.compare(password, userRow.password_hash);
    if (!isPasswordValid) {
      throw buildHttpError(401, '邮箱或密码错误');
    }

    const normalizedUser = await ensureUserInvitationCode(userRow);

    const token = signToken(normalizedUser.id, normalizedUser.token_version);
    const partner = await getPartnerForAuth(normalizedUser, 'auth-login');
    const [mappedUser, mappedPartner] = await Promise.all([
      mapUserForResponse(normalizedUser),
      mapUserForResponse(partner),
    ]);

    fireAndForget(ensureUserSettings(normalizedUser.id, Boolean(normalizedUser.partner_id)), 'ensure-settings-login');
    fireAndForget(addNotification(userRow.id, '登录成功', '欢迎回来，数据已同步。', 'system'), 'notify-login');

    return res.json({
      token,
      user: mappedUser,
      partner: mappedPartner,
    });
  })
);

router.get(
  '/me',
  requireAuth,
  withAsync(async (req, res) => {
    const rawUserRow = await getAuthUserById(req.userId);
    if (!rawUserRow) {
      throw buildHttpError(404, '用户不存在');
    }

    const userRow = await ensureUserInvitationCode(rawUserRow);
    const partner = await getPartnerForAuth(userRow, 'auth-me');
    const [mappedUser, mappedPartner] = await Promise.all([
      mapUserForResponse(userRow),
      mapUserForResponse(partner),
    ]);

    fireAndForget(ensureUserSettings(userRow.id, Boolean(userRow.partner_id)), 'ensure-settings-me');

    return res.json({
      user: mappedUser,
      partner: mappedPartner,
    });
  })
);

router.patch(
  '/profile',
  requireAuth,
  withAsync(async (req, res) => {
    const { name, avatar, gender } = req.body || {};
    const payload = {};
    const { data: existingUser, error: existingUserError } = await supabase
      .from('users')
      .select('id,avatar')
      .eq('id', req.userId)
      .maybeSingle();
    if (existingUserError) throw existingUserError;
    if (!existingUser) {
      throw buildHttpError(404, '用户不存在');
    }

    let uploadedStorageKey = null;

    if (typeof name === 'string') payload.name = name.trim().slice(0, 64);
    if (typeof avatar === 'string') {
      const normalizedAvatar = avatar.trim();
      if (!normalizedAvatar) {
        payload.avatar = '';
      } else {
        if (!normalizedAvatar.startsWith('data:') && normalizedAvatar.length > config.maxAvatarLength) {
          throw buildHttpError(400, '头像地址过长，请重新上传');
        }
        if (normalizedAvatar.startsWith('data:') && normalizedAvatar.length > config.maxAvatarLength) {
          throw buildHttpError(400, '头像图片过大，请压缩后再上传');
        }

        const persisted = await persistAvatarImageDetailed(normalizedAvatar, req.userId);
        payload.avatar = persisted.avatar;
        uploadedStorageKey = persisted.storageKey;
      }
    }
    if (gender === 'male' || gender === 'female') payload.gender = gender;

    if (Object.keys(payload).length === 0) {
      throw buildHttpError(400, '没有可更新的字段');
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .update(payload)
        .eq('id', req.userId)
        .select('*')
        .single();
      if (error) throw error;

      const previousStorageKey = extractStorageKeyFromImage(existingUser.avatar);
      const nextStorageKey = extractStorageKeyFromImage(data.avatar);
      if (previousStorageKey && previousStorageKey !== nextStorageKey) {
        fireAndForget(
          cleanupStoredAvatars([previousStorageKey], 'avatar-update-previous-cleanup'),
          'avatar-update-previous-cleanup'
        );
      }

      return res.json({ user: await mapUserForResponse(data) });
    } catch (error) {
      await cleanupStoredAvatars([uploadedStorageKey], 'avatar-update-cleanup');
      throw error;
    }
  })
);

export default router;
