import { apiGet } from './apiClient';

export interface CloudFocusStats {
  todayFocusTime: number;
  todaySessions: number;
  streak: number;
  totalSessions: number;
  lastFocusDate?: string | null;
}

interface FocusStatsResponse {
  stats?: CloudFocusStats;
}

interface FetchOptions {
  userId: string | null | undefined;
  force?: boolean;
}

const CACHE_TTL_MS = 3 * 60 * 1000;

let cacheUserId = '';
let cachedStats: CloudFocusStats | null = null;
let cachedAt = 0;
let inFlightUserId = '';
let inFlightPromise: Promise<CloudFocusStats> | null = null;

const hasFreshCache = (userId: string) =>
  cacheUserId === userId && cachedStats !== null && Date.now() - cachedAt < CACHE_TTL_MS;

export const getCachedFocusStats = (userId: string | null | undefined): CloudFocusStats | null => {
  if (!userId || cacheUserId !== userId || cachedStats === null) return null;
  return cachedStats;
};

export const fetchFocusStats = async ({
  userId,
  force = false,
}: FetchOptions): Promise<CloudFocusStats> => {
  if (!userId) {
    return {
      todayFocusTime: 0,
      todaySessions: 0,
      streak: 0,
      totalSessions: 0,
      lastFocusDate: null,
    };
  }

  if (!force && hasFreshCache(userId)) {
    return cachedStats as CloudFocusStats;
  }

  if (inFlightPromise && inFlightUserId === userId) {
    return inFlightPromise;
  }

  if (cacheUserId !== userId) {
    // Switching account must drop the previous stats immediately. Assigning only the id
    // while the old data is still cached would let getCachedFocusStats and the .catch
    // fallback serve one user's focus stats under another user's id.
    cacheUserId = userId;
    cachedStats = null;
    cachedAt = 0;
  }
  inFlightUserId = userId;

  const request = apiGet<FocusStatsResponse>('/focus/stats')
    .then((result) => {
      const stats = result.stats || {
        todayFocusTime: 0,
        todaySessions: 0,
        streak: 0,
        totalSessions: 0,
        lastFocusDate: null,
      };
      if (cacheUserId === userId) {
        cachedStats = stats;
        cachedAt = Date.now();
      }
      return stats;
    })
    .catch((error) => {
      if (cacheUserId === userId && cachedStats) {
        return cachedStats;
      }
      throw error;
    })
    .finally(() => {
      if (inFlightPromise === request) {
        inFlightPromise = null;
        inFlightUserId = '';
      }
    });

  inFlightPromise = request;
  return request;
};

export const prefetchFocusStats = async (userId: string | null | undefined) => {
  if (!userId) return;
  try {
    await fetchFocusStats({ userId, force: false });
  } catch (error) {
    console.warn('Prefetch focus stats failed:', error);
  }
};

export const updateFocusStatsCache = (
  userId: string | null | undefined,
  stats: CloudFocusStats | null | undefined
) => {
  if (!userId || !stats) return;
  cacheUserId = userId;
  cachedStats = stats;
  cachedAt = Date.now();
};

export const clearFocusStatsCache = () => {
  cacheUserId = '';
  cachedStats = null;
  cachedAt = 0;
  inFlightUserId = '';
  inFlightPromise = null;
};

