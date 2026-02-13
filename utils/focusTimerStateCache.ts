import { apiGet, apiPatch } from './apiClient';

export type FocusTimerMode = 'countdown' | 'countup';

export interface CloudFocusTimerState {
  mode: FocusTimerMode;
  initialSeconds: number;
  currentSeconds: number;
  isActive: boolean;
  startedAt: string | null;
  updatedAt?: string | null;
}

interface FocusTimerStateResponse {
  timerState?: CloudFocusTimerState;
}

interface FetchOptions {
  userId: string | null | undefined;
  force?: boolean;
}

const DEFAULT_TIMER_STATE: CloudFocusTimerState = {
  mode: 'countdown',
  initialSeconds: 25 * 60,
  currentSeconds: 25 * 60,
  isActive: false,
  startedAt: null,
  updatedAt: null,
};

const CACHE_TTL_MS = 20 * 1000;

let cacheUserId = '';
let cachedState: CloudFocusTimerState | null = null;
let cachedAt = 0;
let inFlightUserId = '';
let inFlightPromise: Promise<CloudFocusTimerState> | null = null;

const hasFreshCache = (userId: string) =>
  cacheUserId === userId && cachedState !== null && Date.now() - cachedAt < CACHE_TTL_MS;

const normalizeTimerState = (state?: Partial<CloudFocusTimerState> | null): CloudFocusTimerState => {
  const mode = state?.mode === 'countup' ? 'countup' : 'countdown';
  const initialSecondsRaw = Number(state?.initialSeconds);
  const currentSecondsRaw = Number(state?.currentSeconds);

  const initialSeconds =
    Number.isFinite(initialSecondsRaw) && initialSecondsRaw > 0
      ? Math.max(60, Math.min(2 * 60 * 60, Math.round(initialSecondsRaw)))
      : DEFAULT_TIMER_STATE.initialSeconds;

  let currentSeconds =
    Number.isFinite(currentSecondsRaw) && currentSecondsRaw >= 0
      ? Math.max(0, Math.min(24 * 60 * 60, Math.round(currentSecondsRaw)))
      : mode === 'countdown'
        ? initialSeconds
        : 0;

  if (mode === 'countdown') {
    currentSeconds = Math.min(currentSeconds, initialSeconds);
  }

  const isActive = state?.isActive === true;
  const startedAt = isActive && state?.startedAt ? String(state.startedAt) : null;

  return {
    mode,
    initialSeconds,
    currentSeconds,
    isActive,
    startedAt,
    updatedAt: state?.updatedAt || null,
  };
};

export const getCachedFocusTimerState = (
  userId: string | null | undefined
): CloudFocusTimerState | null => {
  if (!userId || cacheUserId !== userId || cachedState === null) return null;
  return cachedState;
};

export const fetchFocusTimerState = async ({
  userId,
  force = false,
}: FetchOptions): Promise<CloudFocusTimerState> => {
  if (!userId) return DEFAULT_TIMER_STATE;
  if (!force && hasFreshCache(userId)) {
    return cachedState as CloudFocusTimerState;
  }
  if (inFlightPromise && inFlightUserId === userId) {
    return inFlightPromise;
  }

  cacheUserId = userId;
  inFlightUserId = userId;

  const request = apiGet<FocusTimerStateResponse>('/focus/timer-state')
    .then((result) => {
      const next = normalizeTimerState(result.timerState || DEFAULT_TIMER_STATE);
      cachedState = next;
      cachedAt = Date.now();
      return next;
    })
    .catch((error) => {
      if (cacheUserId === userId && cachedState) {
        return cachedState;
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

export const persistFocusTimerState = async (
  userId: string | null | undefined,
  nextState: CloudFocusTimerState
): Promise<CloudFocusTimerState> => {
  if (!userId) return DEFAULT_TIMER_STATE;
  const payload = normalizeTimerState(nextState);
  const result = await apiPatch<FocusTimerStateResponse>('/focus/timer-state', payload);
  const normalized = normalizeTimerState(result.timerState || payload);
  cacheUserId = userId;
  cachedState = normalized;
  cachedAt = Date.now();
  return normalized;
};

export const prefetchFocusTimerState = async (userId: string | null | undefined) => {
  if (!userId) return;
  try {
    await fetchFocusTimerState({ userId, force: false });
  } catch (error) {
    console.warn('Prefetch focus timer state failed:', error);
  }
};

export const updateFocusTimerStateCache = (
  userId: string | null | undefined,
  state: CloudFocusTimerState | null | undefined
) => {
  if (!userId || !state) return;
  cacheUserId = userId;
  cachedState = normalizeTimerState(state);
  cachedAt = Date.now();
};

export const clearFocusTimerStateCache = () => {
  cacheUserId = '';
  cachedState = null;
  cachedAt = 0;
  inFlightUserId = '';
  inFlightPromise = null;
};

export const getDefaultFocusTimerState = (): CloudFocusTimerState => ({ ...DEFAULT_TIMER_STATE });
