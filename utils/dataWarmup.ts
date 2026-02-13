import { prefetchFocusStats } from './focusStatsCache';
import { prefetchFocusTimerState } from './focusTimerStateCache';
import { prefetchPeriodTrackerEntries } from './periodTrackerCache';

let warmupEpoch = 0;

const schedule = (delayMs: number, cb: () => void) => {
  if (typeof window !== 'undefined') {
    window.setTimeout(cb, delayMs);
    return;
  }
  setTimeout(cb, delayMs);
};

export const cancelCloudWarmup = () => {
  warmupEpoch += 1;
};

export const warmupCloudDataByPriority = (userId: string | null | undefined, partnerId?: string | null) => {
  if (!userId) return;

  warmupEpoch += 1;
  const currentEpoch = warmupEpoch;

  // P0: Relationship key data (period + mood) for immediate modal open.
  void prefetchPeriodTrackerEntries(userId, partnerId || null);

  // P1: Focus stats for Focus tab instant paint.
  schedule(120, () => {
    if (currentEpoch !== warmupEpoch) return;
    void prefetchFocusStats(userId);
  });

  // P1.5: Focus timer running state for restoring in-progress sessions.
  schedule(220, () => {
    if (currentEpoch !== warmupEpoch) return;
    void prefetchFocusTimerState(userId);
  });
};

