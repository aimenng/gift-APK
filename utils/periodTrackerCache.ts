import { apiGet } from './apiClient';

export type PeriodTrackerFlowLevel = 'light' | 'medium' | 'heavy' | null;

export interface PeriodTrackerEntry {
  id: string;
  date: string;
  userId: string;
  isPeriod: boolean;
  mood: string | null;
  flow: PeriodTrackerFlowLevel;
}

interface TrackerResponse {
  entries?: PeriodTrackerEntry[];
}

interface FetchOptions {
  userId: string | null | undefined;
  partnerId?: string | null;
  force?: boolean;
}

interface UpsertCacheEntryOptions {
  userId: string | null | undefined;
  partnerId?: string | null;
  dateKey: string;
  entry: PeriodTrackerEntry | null;
}

const CACHE_TTL_MS = 5 * 60 * 1000;

let cacheKey = '';
let cachedEntries: PeriodTrackerEntry[] | null = null;
let cachedAt = 0;
let inFlightKey = '';
let inFlightPromise: Promise<PeriodTrackerEntry[]> | null = null;

const buildCacheKey = (userId: string | null | undefined, partnerId?: string | null) =>
  `${userId || ''}:${partnerId || ''}`;

const hasFreshCache = (key: string) =>
  cacheKey === key && cachedEntries !== null && Date.now() - cachedAt < CACHE_TTL_MS;

export const getCachedPeriodTrackerEntries = (
  userId: string | null | undefined,
  partnerId?: string | null
): PeriodTrackerEntry[] | null => {
  const key = buildCacheKey(userId, partnerId);
  if (cacheKey !== key || cachedEntries === null) return null;
  return cachedEntries;
};

export const fetchPeriodTrackerEntries = async ({
  userId,
  partnerId = null,
  force = false,
}: FetchOptions): Promise<PeriodTrackerEntry[]> => {
  if (!userId) return [];

  const key = buildCacheKey(userId, partnerId);

  if (!force && hasFreshCache(key)) {
    return cachedEntries || [];
  }

  if (inFlightPromise && inFlightKey === key) {
    return inFlightPromise;
  }

  if (cacheKey !== key) {
    // Switching account (or partner pairing) must drop the previous entries immediately.
    // Assigning only the key while the old data is still cached would let
    // getCachedPeriodTrackerEntries and the .catch fallback serve one user's
    // period/mood records under another user's id.
    cacheKey = key;
    cachedEntries = null;
    cachedAt = 0;
  }
  inFlightKey = key;

  const request = apiGet<TrackerResponse>('/period-tracker')
    .then((result) => {
      const entries = Array.isArray(result.entries) ? result.entries : [];
      if (cacheKey === key) {
        cachedEntries = entries;
        cachedAt = Date.now();
      }
      return entries;
    })
    .catch((error) => {
      if (cacheKey === key && cachedEntries !== null) {
        return cachedEntries;
      }
      throw error;
    })
    .finally(() => {
      if (inFlightPromise === request) {
        inFlightPromise = null;
        inFlightKey = '';
      }
    });

  inFlightPromise = request;
  return request;
};

export const prefetchPeriodTrackerEntries = async (
  userId: string | null | undefined,
  partnerId?: string | null
) => {
  if (!userId) return;
  try {
    await fetchPeriodTrackerEntries({ userId, partnerId, force: false });
  } catch (error) {
    console.warn('Prefetch period tracker failed:', error);
  }
};

export const upsertPeriodTrackerCacheEntry = ({
  userId,
  partnerId = null,
  dateKey,
  entry,
}: UpsertCacheEntryOptions) => {
  if (!userId || cachedEntries === null) return;

  const key = buildCacheKey(userId, partnerId);
  if (cacheKey !== key) return;

  const next = [...cachedEntries];
  const index = next.findIndex((item) => item.userId === userId && item.date === dateKey);

  if (entry) {
    if (index >= 0) next[index] = entry;
    else next.unshift(entry);
  } else if (index >= 0) {
    next.splice(index, 1);
  }

  cachedEntries = next;
  cachedAt = Date.now();
};

export const clearPeriodTrackerCache = () => {
  cacheKey = '';
  cachedEntries = null;
  cachedAt = 0;
  inFlightKey = '';
  inFlightPromise = null;
};

