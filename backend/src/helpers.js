import crypto from 'node:crypto';
import { config } from './config.js';
import { supabase } from './supabaseClient.js';

const INVITE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OTP_RE = /^\d{6}$/;
const INVITE_CODE_RE = /^GIFT-[A-Z0-9]{4}$/;
const FIXED_INVITE_CODE_BY_EMAIL = Object.freeze({
  '2305427577@qq.com': 'XHB-LLQ',
  '1057289305@qq.com': 'LLQ-XHB',
});
const SPECIAL_INVITE_CODES = new Set(Object.values(FIXED_INVITE_CODE_BY_EMAIL));

export const buildHttpError = (status, message) => {
  const error = new Error(message);
  error.status = status;
  return error;
};

export const withAsync = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    next(error);
  }
};

export const assertEmail = (email) => {
  if (!email || !SIMPLE_EMAIL_RE.test(email)) {
    throw buildHttpError(400, '邮箱格式不正确');
  }
};

export const assertPassword = (password) => {
  if (!password || password.length < 6) {
    throw buildHttpError(400, '密码至少 6 位');
  }
};

export const assertInviteCode = (code) => {
  const normalized = String(code || '').trim().toUpperCase();
  if (!INVITE_CODE_RE.test(normalized) && !SPECIAL_INVITE_CODES.has(normalized)) {
    throw buildHttpError(400, '邀请码格式不正确');
  }
  return normalized;
};

export const getFixedInviteCodeForEmail = (email) =>
  FIXED_INVITE_CODE_BY_EMAIL[String(email || '').trim().toLowerCase()] || null;

export const assertVerificationCode = (code) => {
  if (!OTP_RE.test(String(code || '').trim())) {
    throw buildHttpError(400, '验证码格式不正确');
  }
};

export const assertDateString = (dateString, fieldName = 'date') => {
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(dateString);
  if (!valid) {
    throw buildHttpError(400, `${fieldName} 必须是 YYYY-MM-DD 格式`);
  }
};

export const generateInviteCode = () => {
  let code = '';
  for (let i = 0; i < 4; i += 1) {
    const index = Math.floor(Math.random() * INVITE_CHARS.length);
    code += INVITE_CHARS[index];
  }
  return `GIFT-${code}`;
};

export const generateVerificationCode = () => String(Math.floor(100000 + Math.random() * 900000));
export const createRandomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');
export const hashValue = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
export const nowIso = () => new Date().toISOString();
export const addMinutesIso = (minutes) => new Date(Date.now() + minutes * 60 * 1000).toISOString();
export const addHoursIso = (hours) => new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

export const getUserById = async (userId) => {
  const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data;
};

export const getUserByEmail = async (email) => {
  const { data, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
  if (error) throw error;
  return data;
};

export const getUserByInviteCode = async (inviteCode) => {
  const { data, error } = await supabase.from('users').select('*').eq('invitation_code', inviteCode).maybeSingle();
  if (error) throw error;
  return data;
};

export const getPartnerByUser = async (userRow) => {
  if (!userRow?.partner_id) return null;
  return getUserById(userRow.partner_id);
};

export const ensureUserSettings = async (userId, isConnected = false) => {
  const { data: existing, error: selectError } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing;

  const { data: inserted, error: insertError } = await supabase
    .from('user_settings')
    .insert({
      user_id: userId,
      together_date: config.defaultTogetherDate,
      is_connected: isConnected,
    })
    .select('*')
    .single();

  if (insertError) throw insertError;
  return inserted;
};

export const createUniqueInviteCode = async () => {
  for (let attempts = 0; attempts < 12; attempts += 1) {
    const candidate = generateInviteCode();
    const existed = await getUserByInviteCode(candidate);
    if (!existed) return candidate;
  }
  throw buildHttpError(500, '生成邀请码失败，请稍后重试');
};

export const ensureUserInvitationCode = async (userRow) => {
  if (!userRow?.id) return userRow;
  if (userRow.invitation_code) return userRow;

  const fixedCode = getFixedInviteCodeForEmail(userRow.email);

  for (let attempts = 0; attempts < 6; attempts += 1) {
    const candidate = fixedCode || (await createUniqueInviteCode());
    const { data, error } = await supabase
      .from('users')
      .update({ invitation_code: candidate })
      .eq('id', userRow.id)
      .is('invitation_code', null)
      .select('*')
      .maybeSingle();

    if (!error && data) {
      return data;
    }
    if (!error && !data) {
      const latest = await getUserById(userRow.id);
      return latest || userRow;
    }

    const isUniqueViolation = String(error?.code || '') === '23505';
    if (!fixedCode && isUniqueViolation) {
      continue;
    }
    throw error;
  }

  throw buildHttpError(500, '邀请码生成失败，请稍后重试');
};

export const addNotification = async (userId, title, message, type = 'system') => {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    title,
    message,
    type,
    read: false,
  });
  if (error) throw error;
};

export const syncConnectionSettings = async (userId, isConnected) => {
  const { error } = await supabase
    .from('user_settings')
    .upsert(
      {
        user_id: userId,
        is_connected: Boolean(isConnected),
      },
      { onConflict: 'user_id' }
    );
  if (error) throw error;
};
