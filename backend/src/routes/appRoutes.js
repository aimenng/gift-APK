import { Router } from 'express';
import crypto from 'node:crypto';
import { requireAuth } from '../auth.js';
import { mapEvent, mapMemory, mapNotification, mapSettings } from '../mappers.js';
import { supabase } from '../supabaseClient.js';
import {
  addHoursIso,
  addNotification,
  assertDateString,
  assertInviteCode,
  buildHttpError,
  createRandomToken,
  ensureUserSettings,
  getUserById,
  getUserByInviteCode,
  nowIso,
  syncConnectionSettings,
  withAsync,
} from '../helpers.js';
import { config } from '../config.js';
import {
  extractStorageKeyFromImage,
  persistMemoryImageDetailed,
  removeStoredMemoryImages,
  resolveMemoryImageUrl,
  validateMemoryImageInput,
} from '../imageStorage.js';

const router = Router();
const RANDOM_ROTATIONS = ['rotate-1', '-rotate-1'];
const MEMORY_TITLE_MAX_LENGTH = 120;
const EVENT_TITLE_MAX_LENGTH = 120;
const EVENT_SUBTITLE_MAX_LENGTH = 160;
const EVENT_TYPE_MAX_LENGTH = 32;
const MEMORY_CREATE_DEDUP_TTL_MS = 12_000;
const EVENT_CREATE_DEDUP_TTL_MS = 12_000;
const memoryCreateInFlight = new Map();
const memoryCreateRecent = new Map();
const eventCreateInFlight = new Map();
const eventCreateRecent = new Map();

const fireAndForget = (task, label) => {
  try {
    Promise.resolve(task).catch((error) => {
      console.error(`[${label}]`, error?.message || error);
    });
  } catch (error) {
    console.error(`[${label}]`, error?.message || error);
  }
};

const isPendingBindingConflict = (error) => {
  const code = String(error?.code || '');
  const message = String(error?.message || '').toLowerCase();
  const details = String(error?.details || '').toLowerCase();
  if (code !== '23505') return false;
  return (
    message.includes('idx_binding_requests_requester_pending_unique') ||
    message.includes('idx_binding_requests_target_pending_unique') ||
    details.includes('requester_user_id') ||
    details.includes('target_user_id')
  );
};

const isLikelySupabaseNetworkError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return (
    error?.name === 'AbortError' ||
    message.includes('fetch failed') ||
    message.includes('connect timeout') ||
    message.includes('econnreset')
  );
};

const pickRandomRotation = () => RANDOM_ROTATIONS[Math.floor(Math.random() * RANDOM_ROTATIONS.length)];

const normalizeMemoryRotation = (rotation) => {
  if (typeof rotation !== 'string') return null;
  const normalized = rotation.trim();
  if (!normalized) return null;
  if (!RANDOM_ROTATIONS.includes(normalized)) {
    throw buildHttpError(400, 'rotation is invalid');
  }
  return normalized;
};

const normalizeRequiredText = (value, fieldName, maxLength) => {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw buildHttpError(400, `${fieldName} is required`);
  }
  if (normalized.length > maxLength) {
    throw buildHttpError(400, `${fieldName} must be at most ${maxLength} characters`);
  }
  return normalized;
};

const normalizeOptionalText = (value, fieldName, maxLength) => {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (normalized.length > maxLength) {
    throw buildHttpError(400, `${fieldName} must be at most ${maxLength} characters`);
  }
  return normalized;
};

const normalizeDateOnlyString = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  const ymdMatch = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  const parsed = Date.parse(raw);
  if (!Number.isNaN(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }

  return raw;
};

const buildMemoryCreateDedupKey = (userId, title, date, image) => {
  const imageDigest = crypto.createHash('sha1').update(String(image || '')).digest('hex');
  return `${userId}:${date}:${title}:${imageDigest}`;
};

const pruneRecentMemoryCreateMap = () => {
  const now = Date.now();
  for (const [key, item] of memoryCreateRecent.entries()) {
    if (now - item.at > MEMORY_CREATE_DEDUP_TTL_MS) {
      memoryCreateRecent.delete(key);
    }
  }
};

const buildEventCreateDedupKey = (userId, title, subtitle, date, type) =>
  `${userId}:${date}:${type}:${title}:${subtitle || ''}`;

const pruneRecentEventCreateMap = () => {
  const now = Date.now();
  for (const [key, item] of eventCreateRecent.entries()) {
    if (now - item.at > EVENT_CREATE_DEDUP_TTL_MS) {
      eventCreateRecent.delete(key);
    }
  }
};

/**
 * Compute per-year statistics from a list of memory rows.
 * Returns an array of { year, count, coverMemoryId } sorted newest-first.
 */
const computeYearStats = (memoriesData) => {
  const groups = {};
  for (const m of memoriesData) {
    const year = (m.date || '').slice(0, 4);
    if (!year) continue;
    if (!groups[year]) {
      groups[year] = { year, count: 0, coverMemoryId: m.id };
    }
    groups[year].count++;
  }
  return Object.values(groups).sort((a, b) => (b.year || '').localeCompare(a.year || ''));
};

const mapWithConcurrency = async (items, limit, worker) => {
  if (!Array.isArray(items) || items.length === 0) return [];

  const results = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      // eslint-disable-next-line no-await-in-loop
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
};

const parsePaginationQuery = (query) => {
  const hasPageOrLimit = query?.page != null || query?.limit != null;

  const pageRaw = Number.parseInt(String(query?.page ?? ''), 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;

  const limitRaw = Number.parseInt(String(query?.limit ?? ''), 10);
  const requestedLimit =
    Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : config.memoryPageDefaultLimit;
  const limit = Math.min(requestedLimit, config.memoryPageMaxLimit);

  return {
    enabled: hasPageOrLimit,
    page,
    limit,
    from: (page - 1) * limit,
    to: page * limit - 1,
  };
};

const buildPaginationMeta = (page, limit, total) => {
  const totalSafe = Math.max(0, Number(total) || 0);
  const totalPages = totalSafe > 0 ? Math.ceil(totalSafe / limit) : 1;
  return {
    page,
    limit,
    total: totalSafe,
    totalPages,
    hasMore: page < totalPages,
  };
};

const buildSharedUserIds = (userRow) => {
  const ids = [userRow?.id].filter(Boolean);
  if (userRow?.partner_id) ids.push(userRow.partner_id);
  return Array.from(new Set(ids));
};

const loadUserMapByIds = async (userIds) => {
  const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [];
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from('users')
    .select('id,name,email,avatar,gender')
    .in('id', ids);
  if (error) throw error;
  return new Map((data || []).map((row) => [row.id, row]));
};

const loadMemoriesByUsers = async (userIds, pagination) => {
  const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [];
  if (ids.length === 0) {
    return {
      rows: [],
      pagination: buildPaginationMeta(1, config.memoryPageDefaultLimit, 0),
    };
  }

  if (pagination?.enabled) {
    const { data, error, count } = await supabase
      .from('memories')
      .select('*', { count: 'exact' })
      .in('user_id', ids)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(pagination.from, pagination.to);
    if (error) throw error;
    const rows = data || [];
    return {
      rows,
      pagination: buildPaginationMeta(pagination.page, pagination.limit, count ?? rows.length),
    };
  }

  const { data, error } = await supabase
    .from('memories')
    .select('*')
    .in('user_id', ids)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw error;

  const rows = data || [];
  return {
    rows,
    pagination: buildPaginationMeta(1, rows.length || config.memoryPageDefaultLimit, rows.length),
  };
};

const loadYearStatsByUsers = async (userIds) => {
  const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [];
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('memories')
    .select('id,date')
    .in('user_id', ids)
    .order('date', { ascending: false })
    .order('id', { ascending: false });
  if (error) throw error;
  return computeYearStats(data || []);
};

const loadEventsByUsers = async (userIds) => {
  const ids = Array.isArray(userIds) ? userIds.filter(Boolean) : [];
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .in('user_id', ids)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

const PERIOD_FLOW_LEVELS = new Set(['light', 'medium', 'heavy']);
const PERIOD_MOOD_CANONICAL = new Set(['开心', '幸福', '平静', '难过', '焦虑']);
const DAY_MS = 24 * 60 * 60 * 1000;

const clampNonNegativeInt = (value) => {
  const parsed = Number.parseInt(String(value ?? 0), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

const toDateOnly = (value = new Date()) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString().slice(0, 10);
  }
  return date.toISOString().slice(0, 10);
};

const dateDiffInDays = (fromDate, toDate) => {
  if (!fromDate || !toDate) return null;
  const fromTs = Date.parse(`${fromDate}T00:00:00Z`);
  const toTs = Date.parse(`${toDate}T00:00:00Z`);
  if (!Number.isFinite(fromTs) || !Number.isFinite(toTs)) return null;
  return Math.round((toTs - fromTs) / DAY_MS);
};

const normalizePeriodMood = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (PERIOD_MOOD_CANONICAL.has(raw)) return raw;

  // Compatibility: handle historical mojibake and partial legacy values.
  if (
    raw.includes('\u5f00') || raw.includes('\u5fc3') ||
    raw.includes('\u5bee') || raw.includes('\u8e47') || raw.includes('\u7035')
  ) {
    return '开心';
  }
  if (
    raw.includes('\u5e78') || raw.includes('\u798f') ||
    raw.includes('\u9a9e\u54e5') || raw.includes('\u6960\u70b2\u645c')
  ) {
    return '幸福';
  }
  if (
    raw.includes('\u5e73') || raw.includes('\u9759') ||
    raw.includes('\u9a9e\u62bd') || raw.includes('\u6960\u70b4\u5a0a')
  ) {
    return '平静';
  }
  if (
    raw.includes('\u96be') || raw.includes('\u8fc7') ||
    raw.includes('\u95c5') || raw.includes('\u95c3') || raw.includes('\u95c2')
  ) {
    return '难过';
  }
  if (
    raw.includes('\u7126') || raw.includes('\u8651') ||
    raw.includes('\u9412') || raw.includes('\u95bb')
  ) {
    return '焦虑';
  }
  return null;
};

const mapFocusStats = (row) => ({
  userId: row.user_id,
  todayFocusTime: clampNonNegativeInt(row.today_focus_minutes),
  todaySessions: clampNonNegativeInt(row.today_sessions),
  streak: clampNonNegativeInt(row.streak),
  totalSessions: clampNonNegativeInt(row.total_sessions),
  lastFocusDate: row.last_focus_date || null,
  updatedAt: row.updated_at,
});

const ensureFocusStatsRow = async (userId) => {
  const { data: existing, error: selectError } = await supabase
    .from('focus_stats')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) return existing;

  const { data: created, error: createError } = await supabase
    .from('focus_stats')
    .insert({
      user_id: userId,
      today_focus_minutes: 0,
      today_sessions: 0,
      streak: 0,
      total_sessions: 0,
      last_focus_date: null,
    })
    .select('*')
    .single();
  if (createError) throw createError;
  return created;
};

const mapPeriodAuthor = (authorRow) => {
  if (!authorRow) return null;
  return {
    id: authorRow.id,
    name: authorRow.name || '',
    email: authorRow.email || '',
    avatar: authorRow.avatar || '',
    gender: authorRow.gender || 'male',
  };
};

const mapPeriodEntry = (row, authorRow = null) => ({
  id: row.id,
  date: row.entry_date,
  userId: row.user_id,
  isPeriod: Boolean(row.is_period),
  mood: normalizePeriodMood(row.mood),
  flow: row.flow || null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  author: mapPeriodAuthor(authorRow),
});

const cleanupUploadedImages = async (storageKeys, label) => {
  const keys = (Array.isArray(storageKeys) ? storageKeys : []).filter(Boolean);
  if (keys.length === 0) return;
  try {
    await removeStoredMemoryImages(keys);
  } catch (error) {
    console.error(`[${label}] failed to cleanup uploaded files`, error?.message || error);
  }
};

const mapMemoryForResponse = async (row, authorRow = null) => {
  const mapped = mapMemory(row, authorRow);
  if (!mapped?.image) return mapped;
  return {
    ...mapped,
    image: await resolveMemoryImageUrl(mapped.image),
  };
};

const mapMemoriesForResponse = async (rows, authorMap = null) =>
  mapWithConcurrency(rows || [], 6, async (row) => mapMemoryForResponse(row, authorMap?.get(row.user_id)));

const htmlResponse = (title, message, buttonText = 'Open App') => `
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      body { font-family: Arial, sans-serif; background: #f8f8f6; color: #1f2937; margin: 0; padding: 24px; }
      .card { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 14px; padding: 24px; box-shadow: 0 10px 30px rgba(0,0,0,0.08);}
      h1 { margin: 0 0 12px; font-size: 24px; }
      p { margin: 0 0 14px; line-height: 1.7; }
      a { display: inline-block; padding: 10px 16px; border-radius: 8px; text-decoration: none; color: #fff; background: #64723f; font-weight: 600; }
      .muted { color: #6b7280; font-size: 12px; margin-top: 12px; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${title}</h1>
      <p>${message}</p>
      <a href="${config.frontendUrl}">${buttonText}</a>
      <p class="muted">If the button does not open the app, copy this URL: ${config.frontendUrl}</p>
    </div>
  </body>
</html>
`;

const createBindingRequest = async (requester, target, inviteCode) => {
  const token = createRandomToken(32);
  const expiresAt = addHoursIso(config.bindingRequestTtlHours);

  const { data, error } = await supabase
    .from('binding_requests')
    .insert({
      requester_user_id: requester.id,
      target_user_id: target.id,
      invite_code: inviteCode,
      confirm_token: token,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
};

const loadLatestPendingByRequester = async (requesterUserId) => {
  const { data, error } = await supabase
    .from('binding_requests')
    .select('id,requester_user_id,target_user_id,expires_at,created_at')
    .eq('requester_user_id', requesterUserId)
    .eq('status', 'pending')
    .gte('expires_at', nowIso())
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
};

const loadLatestPendingByTarget = async (targetUserId) => {
  const { data, error } = await supabase
    .from('binding_requests')
    .select('id,requester_user_id,target_user_id,expires_at,created_at')
    .eq('target_user_id', targetUserId)
    .eq('status', 'pending')
    .gte('expires_at', nowIso())
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
};

const expireStalePendingBindingsForPair = async (requesterUserId, targetUserId) => {
  const now = nowIso();
  const { error } = await supabase
    .from('binding_requests')
    .update({ status: 'expired' })
    .eq('status', 'pending')
    .lt('expires_at', now)
    .or(`requester_user_id.eq.${requesterUserId},target_user_id.eq.${targetUserId}`);
  if (error) throw error;
};

const getConnectPendingState = (requesterPending, targetPending, requesterUserId, targetUserId) => {
  const samePairPending =
    (requesterPending && requesterPending.target_user_id === targetUserId) ||
    (targetPending && targetPending.requester_user_id === requesterUserId);
  if (samePairPending) return 'same_pair';
  if (requesterPending) return 'requester_busy';
  if (targetPending) return 'target_busy';
  return 'none';
};

const expirePendingBindingsForRequester = async (requesterUserId) => {
  const now = nowIso();
  const { error } = await supabase
    .from('binding_requests')
    .update({ status: 'expired' })
    .eq('requester_user_id', requesterUserId)
    .eq('status', 'pending')
    .lt('expires_at', now);
  if (error) throw error;
};

const expirePendingBindingsForTarget = async (targetUserId) => {
  const now = nowIso();
  const { error } = await supabase
    .from('binding_requests')
    .update({ status: 'expired' })
    .eq('target_user_id', targetUserId)
    .eq('status', 'pending')
    .lt('expires_at', now);
  if (error) throw error;
};

const applyBindingAcceptance = async (bindRequest) => {
  const [requester, target] = await Promise.all([
    getUserById(bindRequest.requester_user_id),
    getUserById(bindRequest.target_user_id),
  ]);

  if (!requester || !target) {
    await supabase.from('binding_requests').update({ status: 'expired' }).eq('id', bindRequest.id);
    throw buildHttpError(404, 'User not found');
  }

  if (
    requester.partner_id ||
    requester.bound_invitation_code ||
    target.partner_id ||
    target.bound_invitation_code
  ) {
    await supabase.from('binding_requests').update({ status: 'rejected' }).eq('id', bindRequest.id);
    throw buildHttpError(409, 'At least one account is already connected');
  }

  const rollbackPairBinding = async () => {
    const { error: rollbackError } = await supabase
      .from('users')
      .update({
        partner_id: null,
        bound_invitation_code: null,
      })
      .in('id', [requester.id, target.id]);
    if (rollbackError) {
      console.error('[binding-accept-rollback] failed to rollback paired users', rollbackError?.message || rollbackError);
    }
  };

  const { data: requesterUpdated, error: requesterUpdateError } = await supabase
    .from('users')
    .update({
      partner_id: target.id,
      bound_invitation_code: target.invitation_code,
    })
    .eq('id', requester.id)
    .is('partner_id', null)
    .is('bound_invitation_code', null)
    .select('*')
    .maybeSingle();
  if (requesterUpdateError) throw requesterUpdateError;
  if (!requesterUpdated) {
    await supabase.from('binding_requests').update({ status: 'rejected' }).eq('id', bindRequest.id);
    throw buildHttpError(409, 'At least one account is already connected');
  }

  const { data: targetUpdated, error: targetUpdateError } = await supabase
    .from('users')
    .update({
      partner_id: requester.id,
      bound_invitation_code: requester.invitation_code,
    })
    .eq('id', target.id)
    .is('partner_id', null)
    .is('bound_invitation_code', null)
    .select('*')
    .maybeSingle();
  if (targetUpdateError) {
    await rollbackPairBinding();
    throw targetUpdateError;
  }
  if (!targetUpdated) {
    await rollbackPairBinding();
    await supabase.from('binding_requests').update({ status: 'rejected' }).eq('id', bindRequest.id);
    throw buildHttpError(409, 'At least one account is already connected');
  }

  const { error: bindingUpdateError } = await supabase
    .from('binding_requests')
    .update({ status: 'accepted', confirmed_at: nowIso() })
    .eq('id', bindRequest.id);
  if (bindingUpdateError) {
    await rollbackPairBinding();
    throw bindingUpdateError;
  }

  const settingsSyncResults = await Promise.allSettled([
    syncConnectionSettings(requesterUpdated.id, true),
    syncConnectionSettings(targetUpdated.id, true),
  ]);
  settingsSyncResults.forEach((result, index) => {
    if (result.status === 'rejected') {
      const userId = index === 0 ? requesterUpdated.id : targetUpdated.id;
      console.error(`[binding-settings-sync] user=${userId}`, result.reason?.message || result.reason);
    }
  });

  fireAndForget(
    addNotification(
      requesterUpdated.id,
      'Binding confirmed',
      `${targetUpdated.name || targetUpdated.email} accepted your binding request.`,
      'interaction'
    ),
    'notify-bind-requester'
  );
  fireAndForget(
    addNotification(
      targetUpdated.id,
      'Binding completed',
      `You have connected with ${requesterUpdated.name || requesterUpdated.email}.`,
      'interaction'
    ),
    'notify-bind-target'
  );

  return {
    requester: requesterUpdated,
    target: targetUpdated,
  };
};

router.get(
  '/bindings/pending',
  requireAuth,
  withAsync(async (req, res) => {
    fireAndForget(expirePendingBindingsForTarget(req.userId), 'expire-target-pending-bindings');

    const { data: pendingRows, error: pendingError } = await supabase
      .from('binding_requests')
      .select('id,requester_user_id,invite_code,created_at,expires_at')
      .eq('target_user_id', req.userId)
      .eq('status', 'pending')
      .gte('expires_at', nowIso())
      .order('created_at', { ascending: false })
      .limit(30);
    if (pendingError) throw pendingError;

    const dedupedRows = [];
    const seenRequesterIds = new Set();
    for (const row of pendingRows || []) {
      if (seenRequesterIds.has(row.requester_user_id)) continue;
      seenRequesterIds.add(row.requester_user_id);
      dedupedRows.push(row);
    }

    const requesterIds = Array.from(new Set(dedupedRows.map((x) => x.requester_user_id)));
    let requesterMap = new Map();
    if (requesterIds.length > 0) {
      const { data: requesterRows, error: requesterError } = await supabase
        .from('users')
        .select('id,name,email,invitation_code')
        .in('id', requesterIds);
      if (requesterError) throw requesterError;
      requesterMap = new Map((requesterRows || []).map((row) => [row.id, row]));
    }

    const requests = dedupedRows
      .map((row) => {
        const requester = requesterMap.get(row.requester_user_id);
        if (!requester) return null;
        return {
          id: row.id,
          inviteCode: row.invite_code,
          createdAt: row.created_at,
          expiresAt: row.expires_at,
          requester: {
            id: requester.id,
            name: requester.name || '',
            email: requester.email,
            invitationCode: requester.invitation_code || '',
          },
        };
      })
      .filter(Boolean);

    return res.json({ requests });
  })
);

router.post(
  '/bindings/:id/respond',
  requireAuth,
  withAsync(async (req, res) => {
    const requestId = String(req.params?.id || '').trim();
    const action = String(req.body?.action || '')
      .trim()
      .toLowerCase();

    if (!requestId) throw buildHttpError(400, 'Missing request id');
    if (!['accept', 'reject'].includes(action)) {
      throw buildHttpError(400, 'action must be accept or reject');
    }

    const { data: bindRequest, error: bindRequestError } = await supabase
      .from('binding_requests')
      .select('*')
      .eq('id', requestId)
      .eq('target_user_id', req.userId)
      .eq('status', 'pending')
      .maybeSingle();
    if (bindRequestError) throw bindRequestError;
    if (!bindRequest) {
      throw buildHttpError(404, 'Binding request not found or already processed');
    }

    if (new Date(bindRequest.expires_at).getTime() < Date.now()) {
      await supabase.from('binding_requests').update({ status: 'expired' }).eq('id', bindRequest.id);
      throw buildHttpError(400, 'Binding request expired');
    }

    if (action === 'reject') {
      const { error: rejectError } = await supabase
        .from('binding_requests')
        .update({ status: 'rejected', confirmed_at: nowIso() })
        .eq('id', bindRequest.id);
      if (rejectError) throw rejectError;

      const [requester, target] = await Promise.all([
        getUserById(bindRequest.requester_user_id),
        getUserById(bindRequest.target_user_id),
      ]);

      if (requester && target) {
        fireAndForget(
          addNotification(
            requester.id,
            'Binding request rejected',
            `${target.name || target.email} rejected your binding request.`,
            'interaction'
          ),
          'notify-bind-reject-requester'
        );
      }

      const currentUser = await getUserById(req.userId);
      const settings = await ensureUserSettings(req.userId, Boolean(currentUser?.partner_id));

      return res.json({
        ok: true,
        action,
        message: 'Request rejected',
        settings: mapSettings(settings, currentUser),
      });
    }

    const { target } = await applyBindingAcceptance(bindRequest);
    const settings = await ensureUserSettings(target.id, true);

    return res.json({
      ok: true,
      action,
      message: 'Binding accepted',
      settings: mapSettings(settings, target),
    });
  })
);

router.get(
  '/bindings/confirm',
  withAsync(async (req, res) => {
    const token = String(req.query?.token || '').trim();
    if (!token) {
      return res
        .status(400)
        .send(htmlResponse('Confirmation Failed', 'Missing confirmation token. Please retry.', 'Back to App'));
    }

    const { data: bindRequest, error: requestError } = await supabase
      .from('binding_requests')
      .select('*')
      .eq('confirm_token', token)
      .eq('status', 'pending')
      .maybeSingle();
    if (requestError) throw requestError;
    if (!bindRequest) {
      return res
        .status(404)
        .send(htmlResponse('Request Not Found', 'This binding request does not exist or is already handled.'));
    }

    if (new Date(bindRequest.expires_at).getTime() < Date.now()) {
      await supabase.from('binding_requests').update({ status: 'expired' }).eq('id', bindRequest.id);
      return res
        .status(400)
        .send(htmlResponse('Request Expired', 'The confirmation link has expired. Ask your partner to retry.'));
    }

    try {
      await applyBindingAcceptance(bindRequest);
    } catch (error) {
      if ((error?.status || 500) === 404) {
        return res
          .status(404)
          .send(htmlResponse('User Not Found', 'One side of this binding request no longer exists.'));
      }
      if ((error?.status || 500) === 409) {
        return res
          .status(409)
          .send(htmlResponse('Cannot Bind', 'At least one account is already connected.'));
      }
      throw error;
    }

    return res
      .status(200)
      .send(htmlResponse('Binding Success', 'You have successfully confirmed the connection.'));
  })
);

router.get(
  '/app/state',
  requireAuth,
  withAsync(async (req, res) => {
    const user = await getUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const sharedUserIds = buildSharedUserIds(user);

    const pagination = parsePaginationQuery(req.query);
    const includeYearStats = String(req.query?.includeYearStats || '').trim() !== '0';
    const [
      memoriesResult,
      events,
      { data: settings, error: settingsError },
      yearStats,
      authorMap,
    ] = await Promise.all([
      loadMemoriesByUsers(sharedUserIds, pagination),
      loadEventsByUsers(sharedUserIds),
      supabase.from('user_settings').select('*').eq('user_id', req.userId).maybeSingle(),
      includeYearStats ? (pagination.enabled ? loadYearStatsByUsers(sharedUserIds) : Promise.resolve(null)) : Promise.resolve(null),
      loadUserMapByIds(sharedUserIds),
    ]);

    if (settingsError) throw settingsError;

    const memories = memoriesResult.rows || [];
    const finalSettings =
      settings || {
        together_date: config.defaultTogetherDate,
        is_connected: Boolean(user.partner_id),
      };

    const mappedMemories = await mapMemoriesForResponse(memories, authorMap);

    fireAndForget(ensureUserSettings(req.userId, Boolean(user.partner_id)), 'ensure-settings-app-state');

    const response = {
      memories: mappedMemories,
      events: (events || []).map((row) => mapEvent(row, authorMap.get(row.user_id))),
      settings: mapSettings(finalSettings, user),
      memoryPagination: memoriesResult.pagination,
    };

    if (includeYearStats) {
      response.yearStats = yearStats || computeYearStats(memories);
    }

    return res.json(response);
  })
);

router.patch(
  '/settings',
  requireAuth,
  withAsync(async (req, res) => {
    const { togetherDate } = req.body || {};
    if (!togetherDate) {
      throw buildHttpError(400, 'togetherDate is required');
    }
    assertDateString(togetherDate, 'togetherDate');

    const user = await getUserById(req.userId);
    if (!user) throw buildHttpError(404, 'User not found');

    const isConnected = Boolean(user.partner_id);
    const targetUserIds = isConnected ? [req.userId, user.partner_id] : [req.userId];
    const upsertRows = targetUserIds.map((userId) => ({
      user_id: userId,
      together_date: togetherDate,
      is_connected: isConnected,
      updated_at: nowIso(),
    }));

    const { data: settingsRows, error } = await supabase
      .from('user_settings')
      .upsert(upsertRows, { onConflict: 'user_id' })
      .select('*');
    if (error) throw error;

    const selfSettings =
      (settingsRows || []).find((row) => row.user_id === req.userId) || {
        user_id: req.userId,
        together_date: togetherDate,
        is_connected: isConnected,
      };

    return res.json({ settings: mapSettings(selfSettings, user) });
  })
);

router.get(
  '/period-tracker',
  requireAuth,
  withAsync(async (req, res) => {
    const user = await getUserById(req.userId);
    if (!user) throw buildHttpError(404, 'User not found');

    const start = String(req.query?.start || '').trim();
    const end = String(req.query?.end || '').trim();
    if (start) assertDateString(start, 'start');
    if (end) assertDateString(end, 'end');

    const sharedUserIds = buildSharedUserIds(user);

    let query = supabase
      .from('period_tracker_entries')
      .select('*')
      .in('user_id', sharedUserIds)
      .order('entry_date', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(1500);

    if (start) query = query.gte('entry_date', start);
    if (end) query = query.lte('entry_date', end);

    const [{ data, error }, authorMap] = await Promise.all([query, loadUserMapByIds(sharedUserIds)]);
    if (error) throw error;

    return res.json({
      entries: (data || []).map((row) => mapPeriodEntry(row, authorMap.get(row.user_id))),
    });
  })
);

router.patch(
  '/period-tracker/:date',
  requireAuth,
  withAsync(async (req, res) => {
    const user = await getUserById(req.userId);
    if (!user) throw buildHttpError(404, 'User not found');

    const entryDate = String(req.params?.date || '').trim();
    assertDateString(entryDate, 'date');

    const isPeriod = req.body?.isPeriod === true;
    const moodRaw = typeof req.body?.mood === 'string' ? req.body.mood.trim() : '';
    const mood = normalizePeriodMood(moodRaw);
    const flowRaw = typeof req.body?.flow === 'string' ? req.body.flow.trim().toLowerCase() : '';
    const flow = PERIOD_FLOW_LEVELS.has(flowRaw) ? flowRaw : null;

    if ((user.gender || 'male') === 'male' && isPeriod) {
      throw buildHttpError(400, 'Male account cannot mark period status');
    }

    const effectiveFlow = isPeriod ? flow : null;

    if (!isPeriod && !mood && !effectiveFlow) {
      const { error: deleteError } = await supabase
        .from('period_tracker_entries')
        .delete()
        .eq('user_id', req.userId)
        .eq('entry_date', entryDate);
      if (deleteError) throw deleteError;
      return res.json({ ok: true, entry: null });
    }

    const { data, error } = await supabase
      .from('period_tracker_entries')
      .upsert(
        {
          user_id: req.userId,
          entry_date: entryDate,
          is_period: isPeriod,
          mood,
          flow: effectiveFlow,
        },
        { onConflict: 'user_id,entry_date' }
      )
      .select('*')
      .single();
    if (error) throw error;

    return res.json({
      ok: true,
      entry: mapPeriodEntry(data, user),
    });
  })
);

router.get(
  '/focus/stats',
  requireAuth,
  withAsync(async (req, res) => {
    const today = toDateOnly();
    let row = await ensureFocusStatsRow(req.userId);

    const staleTodayCounters =
      row.last_focus_date &&
      row.last_focus_date !== today &&
      (clampNonNegativeInt(row.today_focus_minutes) > 0 || clampNonNegativeInt(row.today_sessions) > 0);

    if (staleTodayCounters) {
      const { data: resetRow, error: resetError } = await supabase
        .from('focus_stats')
        .update({
          today_focus_minutes: 0,
          today_sessions: 0,
          updated_at: nowIso(),
        })
        .eq('user_id', req.userId)
        .select('*')
        .single();
      if (resetError) throw resetError;
      row = resetRow;
    }

    return res.json({ stats: mapFocusStats(row) });
  })
);

router.patch(
  '/focus/stats/complete-session',
  requireAuth,
  withAsync(async (req, res) => {
    const focusMinutesRaw = Number.parseInt(String(req.body?.focusMinutes ?? ''), 10);
    if (!Number.isFinite(focusMinutesRaw) || focusMinutesRaw < 1 || focusMinutesRaw > 240) {
      throw buildHttpError(400, 'focusMinutes must be between 1 and 240');
    }
    const focusMinutes = focusMinutesRaw;

    const row = await ensureFocusStatsRow(req.userId);
    const today = toDateOnly();
    const previousDate = row.last_focus_date || null;
    const previousStreak = clampNonNegativeInt(row.streak);

    let nextTodayFocus = focusMinutes;
    let nextTodaySessions = 1;
    let nextStreak = 1;

    if (previousDate === today) {
      nextTodayFocus = clampNonNegativeInt(row.today_focus_minutes) + focusMinutes;
      nextTodaySessions = clampNonNegativeInt(row.today_sessions) + 1;
      nextStreak = previousStreak > 0 ? previousStreak : 1;
    } else {
      const dayDiff = dateDiffInDays(previousDate, today);
      nextStreak = dayDiff === 1 ? Math.max(1, previousStreak + 1) : 1;
    }

    const { data: updatedRow, error: updateError } = await supabase
      .from('focus_stats')
      .update({
        today_focus_minutes: nextTodayFocus,
        today_sessions: nextTodaySessions,
        streak: nextStreak,
        total_sessions: clampNonNegativeInt(row.total_sessions) + 1,
        last_focus_date: today,
        updated_at: nowIso(),
      })
      .eq('user_id', req.userId)
      .select('*')
      .single();
    if (updateError) throw updateError;

    return res.json({ ok: true, stats: mapFocusStats(updatedRow) });
  })
);

router.post(
  '/settings/connect',
  requireAuth,
  withAsync(async (req, res) => {
    const startedAt = Date.now();
    const inviteCode = assertInviteCode(req.body?.inviteCode);

    const [requester, target] = await Promise.all([getUserById(req.userId), getUserByInviteCode(inviteCode)]);
    if (!requester) throw buildHttpError(404, 'User not found');
    if (!requester.email_verified) throw buildHttpError(403, 'Please verify your email first');

    if (requester.partner_id || requester.bound_invitation_code) {
      throw buildHttpError(409, 'You are already connected. Disconnect first.');
    }
    if (inviteCode === requester.invitation_code) {
      throw buildHttpError(400, 'Cannot connect to your own invite code');
    }

    if (!target || !target.email_verified) {
      throw buildHttpError(404, 'Invite code does not exist');
    }
    if (target.partner_id || target.bound_invitation_code) {
      throw buildHttpError(409, 'Target account is already connected');
    }

    const resolvePendingState = async () => {
      const [requesterPending, targetPending] = await Promise.all([
        loadLatestPendingByRequester(req.userId),
        loadLatestPendingByTarget(target.id),
      ]);
      return getConnectPendingState(requesterPending, targetPending, req.userId, target.id);
    };

    const throwPendingStateError = (state) => {
      if (state === 'requester_busy') {
        throw buildHttpError(409, 'You already have a pending binding request. Please resolve it first.');
      }
      if (state === 'target_busy') {
        throw buildHttpError(409, 'Target account already has another pending request. Please try later.');
      }
    };

    const initialPendingState = await resolvePendingState();
    if (initialPendingState === 'same_pair') {
      return res.status(202).json({
        ok: true,
        pending: true,
        message: 'Connect request already sent. Please ask your partner to confirm inside the app.',
      });
    }
    if (initialPendingState !== 'none') {
      throwPendingStateError(initialPendingState);
    }

    let bindRequest;
    try {
      bindRequest = await createBindingRequest(requester, target, inviteCode);
    } catch (error) {
      if (isPendingBindingConflict(error)) {
        await expireStalePendingBindingsForPair(req.userId, target.id);
        const retryPendingState = await resolvePendingState();
        if (retryPendingState === 'same_pair') {
          return res.status(202).json({
            ok: true,
            pending: true,
            message: 'Connect request already sent. Please ask your partner to confirm inside the app.',
          });
        }
        if (retryPendingState !== 'none') {
          throwPendingStateError(retryPendingState);
        }
        try {
          bindRequest = await createBindingRequest(requester, target, inviteCode);
        } catch (retryError) {
          if (isPendingBindingConflict(retryError)) {
            throw buildHttpError(409, 'There is already a pending binding request. Please wait for confirmation.');
          }
          throw retryError;
        }
      } else if (isLikelySupabaseNetworkError(error)) {
        const recoveryPendingState = await resolvePendingState();
        if (recoveryPendingState === 'same_pair') {
          return res.status(202).json({
            ok: true,
            pending: true,
            message: 'Connect request received. Please ask your partner to confirm inside the app.',
          });
        }
        if (recoveryPendingState !== 'none') {
          throwPendingStateError(recoveryPendingState);
        }
        throw error;
      }
      throw error;
    }

    fireAndForget(
      addNotification(
        req.userId,
        'Connect request sent',
        `A binding request has been sent to ${target.email}.`,
        'system'
      ),
      'notify-bind-request'
    );
    fireAndForget(
      addNotification(
        target.id,
        'Pending binding request',
        `${requester.name || requester.email} wants to connect with you. Open the Relationship page to accept or reject.`,
        'interaction'
      ),
      'notify-bind-target-pending'
    );

    fireAndForget(ensureUserSettings(req.userId, false), 'ensure-settings-connect');

    console.info(
      `[settings/connect] requester=${req.userId} target=${target.id} request=${bindRequest.id} totalMs=${
        Date.now() - startedAt
      }`
    );

    return res.status(202).json({
      ok: true,
      pending: true,
      message: 'Connect request sent. Please ask your partner to confirm inside the app.',
    });
  })
);

router.post(
  '/settings/disconnect',
  requireAuth,
  withAsync(async (req, res) => {
    const user = await getUserById(req.userId);
    if (!user) throw buildHttpError(404, 'User not found');

    const partner = user.partner_id ? await getUserById(user.partner_id) : null;
    const clearPayload = {
      partner_id: null,
      bound_invitation_code: null,
    };

    const targetUserIds = partner ? [user.id, partner.id] : [user.id];
    const { data: updatedUsers, error: updateError } = await supabase
      .from('users')
      .update(clearPayload)
      .in('id', targetUserIds)
      .select('*');
    if (updateError) throw updateError;

    const selfUpdated = (updatedUsers || []).find((row) => row.id === user.id);
    if (!selfUpdated) {
      throw buildHttpError(500, 'Failed to update disconnect state');
    }

    const settingsSyncResults = await Promise.allSettled(
      targetUserIds.map((userId) => syncConnectionSettings(userId, false))
    );
    settingsSyncResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(
          `[disconnect-settings-sync] user=${targetUserIds[index]}`,
          result.reason?.message || result.reason
        );
      }
    });

    if (partner) {
      fireAndForget(
        addNotification(
          partner.id,
          'Relationship disconnected',
          `${user.name || user.email} removed the binding relationship.`,
          'interaction'
        ),
        'notify-partner-disconnect'
      );
    }

    fireAndForget(
      addNotification(user.id, 'Disconnected', 'You have disconnected the current relationship.', 'system'),
      'notify-self-disconnect'
    );

    const settings = await ensureUserSettings(user.id, false);
    return res.json({ settings: mapSettings(settings, selfUpdated) });
  })
);

router.get(
  '/memories',
  requireAuth,
  withAsync(async (req, res) => {
    const user = await getUserById(req.userId);
    if (!user) throw buildHttpError(404, 'User not found');
    const sharedUserIds = buildSharedUserIds(user);

    const pagination = parsePaginationQuery(req.query);
    const includeYearStats =
      !pagination.enabled || String(req.query?.includeYearStats || '').trim() === '1';

    const [memoriesResult, yearStats, authorMap] = await Promise.all([
      loadMemoriesByUsers(sharedUserIds, pagination),
      includeYearStats ? loadYearStatsByUsers(sharedUserIds) : Promise.resolve(null),
      loadUserMapByIds(sharedUserIds),
    ]);

    const mappedMemories = await mapMemoriesForResponse(memoriesResult.rows || [], authorMap);

    const response = {
      memories: mappedMemories,
      memoryPagination: memoriesResult.pagination,
    };

    if (includeYearStats) {
      response.yearStats = yearStats || [];
    }

    return res.json(response);
  })
);

router.post(
  '/memories',
  requireAuth,
  withAsync(async (req, res) => {
    const { title, date, image, rotation } = req.body || {};
    if (!title || !date || !image) {
      throw buildHttpError(400, 'title, date and image are required');
    }

    const normalizedTitle = normalizeRequiredText(title, 'title', MEMORY_TITLE_MAX_LENGTH);
    const normalizedDate = normalizeDateOnlyString(date);
    assertDateString(normalizedDate, 'date');
    const normalizedRotation = normalizeMemoryRotation(rotation);

    validateMemoryImageInput(image);

    pruneRecentMemoryCreateMap();
    const dedupKey = buildMemoryCreateDedupKey(req.userId, normalizedTitle, normalizedDate, image);
    const recent = memoryCreateRecent.get(dedupKey);
    if (recent && Date.now() - recent.at <= MEMORY_CREATE_DEDUP_TTL_MS) {
      return res.status(200).json({ memory: recent.memory, deduped: true });
    }

    if (memoryCreateInFlight.has(dedupKey)) {
      const inFlightMemory = await memoryCreateInFlight.get(dedupKey);
      return res.status(200).json({ memory: inFlightMemory, deduped: true });
    }

    const createMemoryTask = (async () => {
      let imageValue = image;
      let uploadedStorageKey = null;
      try {
        const persisted = await persistMemoryImageDetailed(image, req.userId);
        imageValue = persisted.image;
        uploadedStorageKey = persisted.storageKey;
      } catch (error) {
        if (error?.status) {
          throw error;
        }
        console.warn('[memory-image-upload] fallback to inline image:', error?.message || error);
      }

      const memoryPayload = {
        user_id: req.userId,
        title: normalizedTitle,
        date: normalizedDate,
        image: imageValue,
        rotation: normalizedRotation || pickRandomRotation(),
      };

      try {
        const { data, error } = await supabase.from('memories').insert(memoryPayload).select('*').single();
        if (error) throw error;
        return await mapMemoryForResponse(data);
      } catch (error) {
        await cleanupUploadedImages([uploadedStorageKey], 'memory-create-cleanup');
        throw error;
      }
    })();

    memoryCreateInFlight.set(dedupKey, createMemoryTask);
    try {
      const createdMemory = await createMemoryTask;
      memoryCreateRecent.set(dedupKey, { at: Date.now(), memory: createdMemory });
      return res.status(201).json({ memory: createdMemory });
    } finally {
      memoryCreateInFlight.delete(dedupKey);
    }
  })
);

router.post(
  '/memories/batch',
  requireAuth,
  withAsync(async (req, res) => {
    const items = Array.isArray(req.body?.memories) ? req.body.memories : [];
    if (items.length === 0) {
      throw buildHttpError(400, 'memories is required');
    }
    if (items.length > 30) {
      throw buildHttpError(400, 'You can upload up to 30 images per batch');
    }

    const uploadedStorageKeys = [];
    let rows = [];

    try {
      // Keep concurrency conservative to reduce Supabase storage timeout probability on mobile networks.
      rows = await mapWithConcurrency(items, 2, async (item, index) => {
        const title = normalizeRequiredText(item?.title, 'title', MEMORY_TITLE_MAX_LENGTH);
        const date = normalizeDateOnlyString(item?.date);
        const image = String(item?.image || '');
        const rotation = normalizeMemoryRotation(item?.rotation);
        if (!title || !date || !image) {
          throw buildHttpError(400, `第 ${index + 1} 项缺少 title/date/image`);
        }
        assertDateString(date, 'date');

        validateMemoryImageInput(image);

        let imageValue = image;
        try {
          const persisted = await persistMemoryImageDetailed(image, req.userId);
          imageValue = persisted.image;
          if (persisted.storageKey) {
            uploadedStorageKeys.push(persisted.storageKey);
          }
        } catch (error) {
          if (error?.status) {
            throw error;
          }
          console.warn('[memory-image-upload-batch] fallback to inline image:', error?.message || error);
        }

        return {
          user_id: req.userId,
          title,
          date,
          image: imageValue,
          rotation: rotation || pickRandomRotation(),
        };
      });
    } catch (error) {
      await cleanupUploadedImages(uploadedStorageKeys, 'memory-batch-preprocess-cleanup');
      throw error;
    }

    try {
      const { data, error } = await supabase.from('memories').insert(rows).select('*');
      if (error) throw error;
      const mappedMemories = await mapMemoriesForResponse(data || []);
      return res.status(201).json({
        memories: mappedMemories,
      });
    } catch (error) {
      await cleanupUploadedImages(uploadedStorageKeys, 'memory-batch-create-cleanup');
      throw error;
    }
  })
);

router.patch(
  '/memories/:id',
  requireAuth,
  withAsync(async (req, res) => {
    const payload = {};
    const { title, date, image, rotation } = req.body || {};

    const { data: existingMemory, error: existingError } = await supabase
      .from('memories')
      .select('id,user_id,image')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existingMemory) throw buildHttpError(404, 'Memory not found');

    if (typeof title === 'string') {
      payload.title = normalizeRequiredText(title, 'title', MEMORY_TITLE_MAX_LENGTH);
    }
    if (typeof date === 'string') {
      const normalizedDate = normalizeDateOnlyString(date);
      assertDateString(normalizedDate, 'date');
      payload.date = normalizedDate;
    }
    let uploadedStorageKey = null;
    if (typeof image === 'string') {
      validateMemoryImageInput(image);
      try {
        const persisted = await persistMemoryImageDetailed(image, req.userId);
        payload.image = persisted.image;
        uploadedStorageKey = persisted.storageKey;
      } catch (error) {
        if (error?.status) {
          throw error;
        }
        console.warn('[memory-image-update] fallback to inline image:', error?.message || error);
        payload.image = image;
      }
    }
    if (typeof rotation === 'string') {
      const normalizedRotation = normalizeMemoryRotation(rotation);
      if (!normalizedRotation) {
        throw buildHttpError(400, 'rotation is invalid');
      }
      payload.rotation = normalizedRotation;
    }
    if (Object.keys(payload).length === 0) throw buildHttpError(400, 'No fields to update');

    const previousStorageKey = extractStorageKeyFromImage(existingMemory.image);

    try {
      const { data, error } = await supabase
        .from('memories')
        .update(payload)
        .eq('id', req.params.id)
        .eq('user_id', req.userId)
        .select('*')
        .single();

      if (error) throw error;
      const nextStorageKey = extractStorageKeyFromImage(data.image);
      if (previousStorageKey && previousStorageKey !== nextStorageKey) {
        fireAndForget(
          cleanupUploadedImages([previousStorageKey], 'memory-update-previous-image-cleanup'),
          'memory-update-previous-image-cleanup'
        );
      }
      return res.json({ memory: await mapMemoryForResponse(data) });
    } catch (error) {
      await cleanupUploadedImages([uploadedStorageKey], 'memory-update-cleanup');
      throw error;
    }
  })
);

router.delete(
  '/memories/:id',
  requireAuth,
  withAsync(async (req, res) => {
    const { data: existingMemory, error: existingError } = await supabase
      .from('memories')
      .select('id,image')
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (!existingMemory) throw buildHttpError(404, 'Memory not found');

    const previousStorageKey = extractStorageKeyFromImage(existingMemory.image);

    const { error } = await supabase.from('memories').delete().eq('id', req.params.id).eq('user_id', req.userId);
    if (error) throw error;
    await cleanupUploadedImages([previousStorageKey], 'memory-delete-cleanup');
    return res.status(204).send();
  })
);

router.get(
  '/events',
  requireAuth,
  withAsync(async (req, res) => {
    const user = await getUserById(req.userId);
    if (!user) throw buildHttpError(404, 'User not found');
    const sharedUserIds = buildSharedUserIds(user);

    const [events, authorMap] = await Promise.all([
      loadEventsByUsers(sharedUserIds),
      loadUserMapByIds(sharedUserIds),
    ]);

    return res.json({ events: events.map((row) => mapEvent(row, authorMap.get(row.user_id))) });
  })
);

router.post(
  '/events',
  requireAuth,
  withAsync(async (req, res) => {
    const { title, subtitle, date, type, image } = req.body || {};
    if (!title || !date || !type) {
      throw buildHttpError(400, 'title, date and type are required');
    }

    const normalizedTitle = normalizeRequiredText(title, 'title', EVENT_TITLE_MAX_LENGTH);
    const normalizedDate = normalizeDateOnlyString(date);
    const normalizedType = normalizeRequiredText(type, 'type', EVENT_TYPE_MAX_LENGTH);
    const normalizedSubtitle = normalizeOptionalText(subtitle, 'subtitle', EVENT_SUBTITLE_MAX_LENGTH);
    assertDateString(normalizedDate, 'date');

    pruneRecentEventCreateMap();
    const dedupKey = buildEventCreateDedupKey(
      req.userId,
      normalizedTitle,
      normalizedSubtitle,
      normalizedDate,
      normalizedType
    );

    const recent = eventCreateRecent.get(dedupKey);
    if (recent && Date.now() - recent.at <= EVENT_CREATE_DEDUP_TTL_MS) {
      return res.status(200).json({ event: recent.event, deduped: true });
    }

    if (eventCreateInFlight.has(dedupKey)) {
      const inFlightEvent = await eventCreateInFlight.get(dedupKey);
      return res.status(200).json({ event: inFlightEvent, deduped: true });
    }

    const createEventTask = (async () => {
      const payload = {
        user_id: req.userId,
        title: normalizedTitle,
        subtitle: normalizedSubtitle,
        date: normalizedDate,
        type: normalizedType,
        image: image || '',
      };

      const { data, error } = await supabase.from('events').insert(payload).select('*').single();
      if (error) throw error;
      return mapEvent(data);
    })();

    eventCreateInFlight.set(dedupKey, createEventTask);
    try {
      const createdEvent = await createEventTask;
      eventCreateRecent.set(dedupKey, { at: Date.now(), event: createdEvent });
      return res.status(201).json({ event: createdEvent });
    } finally {
      eventCreateInFlight.delete(dedupKey);
    }
  })
);

router.patch(
  '/events/:id',
  requireAuth,
  withAsync(async (req, res) => {
    const payload = {};
    const { title, subtitle, date, type, image } = req.body || {};
    if (typeof title === 'string') {
      payload.title = normalizeRequiredText(title, 'title', EVENT_TITLE_MAX_LENGTH);
    }
    if (typeof subtitle === 'string') {
      payload.subtitle = normalizeOptionalText(subtitle, 'subtitle', EVENT_SUBTITLE_MAX_LENGTH);
    }
    if (typeof date === 'string') {
      const normalizedDate = normalizeDateOnlyString(date);
      assertDateString(normalizedDate, 'date');
      payload.date = normalizedDate;
    }
    if (typeof type === 'string') {
      payload.type = normalizeRequiredText(type, 'type', EVENT_TYPE_MAX_LENGTH);
    }
    if (typeof image === 'string') payload.image = image;
    if (Object.keys(payload).length === 0) throw buildHttpError(400, 'No fields to update');

    const { data, error } = await supabase
      .from('events')
      .update(payload)
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select('*')
      .single();
    if (error) throw error;
    return res.json({ event: mapEvent(data) });
  })
);

router.delete(
  '/events/:id',
  requireAuth,
  withAsync(async (req, res) => {
    const { error } = await supabase.from('events').delete().eq('id', req.params.id).eq('user_id', req.userId);
    if (error) throw error;
    return res.status(204).send();
  })
);

router.get(
  '/notifications',
  requireAuth,
  withAsync(async (req, res) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.userId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json({ notifications: (data || []).map(mapNotification) });
  })
);

router.post(
  '/notifications',
  requireAuth,
  withAsync(async (req, res) => {
    const { title, message, type } = req.body || {};
    if (!title || !message) {
      throw buildHttpError(400, 'title and message are required');
    }
    const notificationType = type === 'interaction' ? 'interaction' : 'system';

    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: req.userId,
        title: String(title).trim(),
        message: String(message).trim(),
        type: notificationType,
      })
      .select('*')
      .single();
    if (error) throw error;
    return res.status(201).json({ notification: mapNotification(data) });
  })
);

router.patch(
  '/notifications/:id/read',
  requireAuth,
  withAsync(async (req, res) => {
    const { data, error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', req.params.id)
      .eq('user_id', req.userId)
      .select('*')
      .single();
    if (error) throw error;
    return res.json({ notification: mapNotification(data) });
  })
);

router.delete(
  '/notifications',
  requireAuth,
  withAsync(async (req, res) => {
    const { error } = await supabase.from('notifications').delete().eq('user_id', req.userId);
    if (error) throw error;
    return res.status(204).send();
  })
);

export default router;


