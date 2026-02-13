import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Settings, Play, Pause, RotateCcw, Timer, Clock, Zap, Target, Flame, Sparkles } from 'lucide-react';
import { COLOR_THEMES } from '../components/focus/constants';
import { TimerDisplay } from '../components/focus/TimerDisplay';
import { SettingsPanel } from '../components/focus/SettingsPanel';
import { useAuth } from '../authContext';
import { apiPatch } from '../utils/apiClient';
import {
  type CloudFocusStats,
  fetchFocusStats,
  getCachedFocusStats,
  updateFocusStatsCache,
} from '../utils/focusStatsCache';
import {
  type CloudFocusTimerState,
  fetchFocusTimerState,
  getCachedFocusTimerState,
  getDefaultFocusTimerState,
  persistFocusTimerState,
  updateFocusTimerStateCache,
} from '../utils/focusTimerStateCache';

type TimerMode = 'countdown' | 'countup';

interface TimerStats {
  todayFocusTime: number;
  todaySessions: number;
  streak: number;
  totalSessions: number;
}

interface CompleteFocusStatsResponse {
  ok: boolean;
  stats: {
    todayFocusTime: number;
    todaySessions: number;
    streak: number;
    totalSessions: number;
    lastFocusDate?: string | null;
  };
}

const CIRCLE_LENGTH = 283;
const TIMER_MIN_SECONDS = 60;
const TIMER_MAX_SECONDS = 2 * 60 * 60;
const TIMER_MAX_CURRENT_SECONDS = 24 * 60 * 60;
const EMPTY_STATS: TimerStats = {
  todayFocusTime: 0,
  todaySessions: 0,
  streak: 0,
  totalSessions: 0,
};

const normalizeStats = (stats?: Partial<CloudFocusStats> | null): TimerStats => {
  const toNum = (value: unknown) => {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };

  return {
    todayFocusTime: toNum(stats?.todayFocusTime),
    todaySessions: toNum(stats?.todaySessions),
    streak: toNum(stats?.streak),
    totalSessions: toNum(stats?.totalSessions),
  };
};

const normalizeTimerState = (state?: Partial<CloudFocusTimerState> | null): CloudFocusTimerState => {
  const mode: TimerMode = state?.mode === 'countup' ? 'countup' : 'countdown';
  const initialSecondsRaw = Number(state?.initialSeconds);
  const currentSecondsRaw = Number(state?.currentSeconds);

  const initialSeconds =
    Number.isFinite(initialSecondsRaw) && initialSecondsRaw > 0
      ? Math.max(TIMER_MIN_SECONDS, Math.min(TIMER_MAX_SECONDS, Math.round(initialSecondsRaw)))
      : 25 * 60;

  let currentSeconds =
    Number.isFinite(currentSecondsRaw) && currentSecondsRaw >= 0
      ? Math.max(0, Math.min(TIMER_MAX_CURRENT_SECONDS, Math.round(currentSecondsRaw)))
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

const computeLiveCurrentSeconds = (state: CloudFocusTimerState, nowMs = Date.now()): number => {
  const base = Math.max(0, Math.min(TIMER_MAX_CURRENT_SECONDS, Math.round(Number(state.currentSeconds) || 0)));
  if (!state.isActive || !state.startedAt) {
    return state.mode === 'countdown' ? Math.min(base, state.initialSeconds) : base;
  }

  const startedAtMs = Date.parse(state.startedAt);
  if (!Number.isFinite(startedAtMs)) {
    return state.mode === 'countdown' ? Math.min(base, state.initialSeconds) : base;
  }

  const diffSeconds = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
  if (state.mode === 'countdown') {
    return Math.max(0, Math.min(state.initialSeconds, base - diffSeconds));
  }

  return Math.min(TIMER_MAX_CURRENT_SECONDS, base + diffSeconds);
};

const mapFocusStatsErrorMessage = (error: any, fallback: string): string => {
  const message = String(error?.message || '').trim();
  if (!message) return fallback;
  if (message.includes('Route not found') && message.includes('/api/focus/stats')) {
    return '后端缺少专注统计接口，请重启并部署最新后端服务。';
  }
  return message;
};

const mapFocusTimerErrorMessage = (error: any, fallback: string): string => {
  const message = String(error?.message || '').trim();
  if (!message) return fallback;
  if (message.includes('Route not found') && message.includes('/api/focus/timer-state')) {
    return '后端缺少计时状态接口，请重启并部署最新后端服务。';
  }
  return message;
};

export const FocusPage: React.FC = () => {
  const { currentUser } = useAuth();

  const [timerState, setTimerState] = useState<CloudFocusTimerState>(() =>
    normalizeTimerState(getDefaultFocusTimerState())
  );
  const [clockStyle, setClockStyle] = useState<'ring' | 'digital' | 'minimal'>('ring');
  const [colorTheme, setColorTheme] = useState(COLOR_THEMES[0]);
  const [showSettings, setShowSettings] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [timerStateLoading, setTimerStateLoading] = useState(false);
  const [timerStateError, setTimerStateError] = useState('');

  const [stats, setStats] = useState<TimerStats>(EMPTY_STATS);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');

  const [tickNow, setTickNow] = useState(Date.now());
  const [showCelebrate, setShowCelebrate] = useState(false);
  const [completedMinutes, setCompletedMinutes] = useState(0);

  const completionInFlightRef = useRef(false);
  const timerSyncVersionRef = useRef(0);
  const timerStateRef = useRef(timerState);
  const celebrateTimerRef = useRef<number | null>(null);

  timerStateRef.current = timerState;

  const isSciTheme = ['neon_cyan', 'electric', 'plasma', 'matrix', 'aurora', 'fire', 'galaxy'].includes(
    colorTheme.id
  );
  const isDark =
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const currentBg = isSciTheme ? colorTheme.pageBg : isDark ? colorTheme.pageBgDark : colorTheme.pageBg;
  // Use explicit light-theme colors to avoid blank/low-contrast rendering on some webviews.
  const textColor = isSciTheme ? '#ffffff' : '#2f3a24';
  const textSecondary = isSciTheme ? 'rgba(255,255,255,0.72)' : '#65724f';
  const cardBg = isSciTheme ? 'rgba(255,255,255,0.1)' : 'rgba(255, 255, 255, 0.72)';
  const borderColor = isSciTheme ? 'rgba(255,255,255,0.22)' : 'rgba(125, 145, 88, 0.28)';

  const liveCurrentSeconds = useMemo(
    () => computeLiveCurrentSeconds(timerState, tickNow),
    [timerState, tickNow]
  );

  const minutes = Math.floor(liveCurrentSeconds / 60);
  const seconds = liveCurrentSeconds % 60;
  const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const progress =
    timerState.mode === 'countup'
      ? Math.min((liveCurrentSeconds / (timerState.initialSeconds || 1)) * CIRCLE_LENGTH, CIRCLE_LENGTH)
      : timerState.initialSeconds > 0
        ? ((timerState.initialSeconds - liveCurrentSeconds) / timerState.initialSeconds) * CIRCLE_LENGTH
        : 0;

  const persistTimerState = useCallback(
    async (next: CloudFocusTimerState, options: { silent?: boolean } = {}) => {
      const normalized = normalizeTimerState(next);
      setTimerState(normalized);

      if (!currentUser?.id) {
        if (!options.silent) {
          setTimerStateError('请先登录后使用云端计时同步');
        }
        return normalized;
      }

      updateFocusTimerStateCache(currentUser.id, normalized);
      const currentVersion = ++timerSyncVersionRef.current;

      try {
        const saved = await persistFocusTimerState(currentUser.id, normalized);
        if (currentVersion !== timerSyncVersionRef.current) {
          return saved;
        }
        setTimerState(saved);
        updateFocusTimerStateCache(currentUser.id, saved);
        setTimerStateError('');
        return saved;
      } catch (error: any) {
        if (currentVersion !== timerSyncVersionRef.current) {
          return normalized;
        }
        console.error('Failed to sync focus timer state:', error);
        if (!options.silent) {
          setTimerStateError(mapFocusTimerErrorMessage(error, '同步计时状态失败'));
        }
        return normalized;
      }
    },
    [currentUser?.id]
  );

  useEffect(() => {
    let cancelled = false;

    const loadCloudStats = async () => {
      if (!currentUser?.id) {
        setStats(EMPTY_STATS);
        setStatsError('请先登录后使用云端专注统计');
        return;
      }

      const userId = currentUser.id;
      const cached = getCachedFocusStats(userId);
      if (cached) {
        setStats(normalizeStats(cached));
      }

      setStatsLoading(!cached);
      setStatsError('');
      try {
        const latest = await fetchFocusStats({ userId, force: Boolean(cached) });
        if (cancelled) return;
        setStats(normalizeStats(latest));
      } catch (error: any) {
        if (cancelled) return;
        console.error('Failed to load focus stats:', error);
        if (!cached) {
          setStatsError(mapFocusStatsErrorMessage(error, '加载专注统计失败'));
          setStats(EMPTY_STATS);
        }
      } finally {
        if (!cancelled) {
          setStatsLoading(false);
        }
      }
    };

    void loadCloudStats();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    let cancelled = false;

    const loadCloudTimerState = async () => {
      if (!currentUser?.id) {
        setTimerState(normalizeTimerState(getDefaultFocusTimerState()));
        setTimerStateError('请先登录后使用云端计时同步');
        return;
      }

      const userId = currentUser.id;
      const cached = getCachedFocusTimerState(userId);
      if (cached) {
        setTimerState(normalizeTimerState(cached));
      }

      setTimerStateLoading(!cached);
      setTimerStateError('');
      try {
        const latest = await fetchFocusTimerState({ userId, force: Boolean(cached) });
        if (cancelled) return;
        setTimerState(normalizeTimerState(latest));
      } catch (error: any) {
        if (cancelled) return;
        console.error('Failed to load focus timer state:', error);
        if (!cached) {
          setTimerStateError(mapFocusTimerErrorMessage(error, '加载计时状态失败'));
          setTimerState(normalizeTimerState(getDefaultFocusTimerState()));
        }
      } finally {
        if (!cancelled) {
          setTimerStateLoading(false);
        }
      }
    };

    void loadCloudTimerState();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id]);

  useEffect(() => {
    setTickNow(Date.now());
    if (!timerState.isActive) {
      return;
    }
    const interval = window.setInterval(() => setTickNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [timerState.isActive, timerState.mode, timerState.startedAt]);

  useEffect(() => {
    if (!currentUser?.id) return;
    if (timerState.mode !== 'countdown') return;
    if (!timerState.isActive) return;
    if (liveCurrentSeconds > 0) return;
    if (completionInFlightRef.current) return;

    completionInFlightRef.current = true;

    const finalizeSession = async () => {
      const snapshot = timerStateRef.current;
      const sessionMinutes = Math.max(1, Math.round(snapshot.initialSeconds / 60));

      await persistTimerState(
        {
          ...snapshot,
          currentSeconds: 0,
          isActive: false,
          startedAt: null,
        },
        { silent: true }
      );

      try {
        const result = await apiPatch<CompleteFocusStatsResponse>('/focus/stats/complete-session', {
          focusMinutes: sessionMinutes,
        });
        setStats(normalizeStats(result.stats));
        updateFocusStatsCache(currentUser.id, result.stats);
        setStatsError('');
      } catch (error: any) {
        console.error('Failed to sync focus stats:', error);
        setStatsError(mapFocusStatsErrorMessage(error, '同步专注统计失败'));
      }

      if ('vibrate' in navigator) {
        navigator.vibrate([120, 80, 160, 80, 220]);
      }

      setCompletedMinutes(sessionMinutes);
      setShowCelebrate(true);
      if (celebrateTimerRef.current != null) {
        window.clearTimeout(celebrateTimerRef.current);
      }
      celebrateTimerRef.current = window.setTimeout(() => {
        setShowCelebrate(false);
      }, 2600);

      completionInFlightRef.current = false;
    };

    void finalizeSession();
  }, [currentUser?.id, liveCurrentSeconds, persistTimerState, timerState.isActive, timerState.mode]);

  useEffect(() => {
    return () => {
      if (celebrateTimerRef.current != null) {
        window.clearTimeout(celebrateTimerRef.current);
      }
    };
  }, []);

  const toggleTimer = async () => {
    const snapshot = timerStateRef.current;

    if (snapshot.isActive) {
      const pausedCurrent = computeLiveCurrentSeconds(snapshot, Date.now());
      await persistTimerState({
        ...snapshot,
        currentSeconds: pausedCurrent,
        isActive: false,
        startedAt: null,
      });
      return;
    }

    let nextCurrent = snapshot.currentSeconds;
    if (snapshot.mode === 'countdown') {
      if (nextCurrent <= 0) {
        nextCurrent = snapshot.initialSeconds;
      }
      nextCurrent = Math.min(nextCurrent, snapshot.initialSeconds);
    }

    await persistTimerState({
      ...snapshot,
      currentSeconds: Math.max(0, nextCurrent),
      isActive: true,
      startedAt: new Date().toISOString(),
    });
  };

  const switchMode = async (nextMode: TimerMode) => {
    const snapshot = timerStateRef.current;
    const initialSeconds = Math.max(TIMER_MIN_SECONDS, Math.min(TIMER_MAX_SECONDS, snapshot.initialSeconds));

    await persistTimerState({
      mode: nextMode,
      initialSeconds,
      currentSeconds: nextMode === 'countdown' ? initialSeconds : 0,
      isActive: false,
      startedAt: null,
      updatedAt: snapshot.updatedAt || null,
    });
  };

  const handleTimeChange = async (mins: number) => {
    const snapshot = timerStateRef.current;
    if (snapshot.isActive) return;

    const secondsValue = Math.max(TIMER_MIN_SECONDS, Math.min(TIMER_MAX_SECONDS, Math.round(mins * 60)));
    const nextCurrent = snapshot.mode === 'countdown' ? secondsValue : Math.min(snapshot.currentSeconds, secondsValue);

    await persistTimerState({
      ...snapshot,
      initialSeconds: secondsValue,
      currentSeconds: nextCurrent,
      isActive: false,
      startedAt: null,
    });
  };

  const resetTimer = async () => {
    const snapshot = timerStateRef.current;
    await persistTimerState({
      ...snapshot,
      currentSeconds: snapshot.mode === 'countdown' ? snapshot.initialSeconds : 0,
      isActive: false,
      startedAt: null,
    });
  };

  const adjustTime = async (delta: number) => {
    const currentMinutes = Math.round(timerStateRef.current.initialSeconds / 60);
    const nextMinutes = Math.max(1, Math.min(120, currentMinutes + delta));
    await handleTimeChange(nextMinutes);
  };

  return (
    <div
      className="flex flex-col h-full w-full transition-colors duration-500"
      style={
        { backgroundColor: currentBg, color: textColor, '--focus-accent': colorTheme.primary } as React.CSSProperties
      }
    >

      <header className="flex items-center p-4 pb-2 pt-safe-top justify-between z-10 shrink-0">
        <div className="size-12" />
        <h2 className="text-lg font-bold leading-tight flex-1 text-center transition-colors" style={{ color: textColor }}>
          专注时钟
        </h2>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-white/10 transition-colors"
          style={{ color: textColor }}
        >
          <Settings className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center w-full px-4 pt-2 overflow-y-auto hide-scrollbar">
        <div className="pb-32 w-full flex flex-col items-center max-w-md mx-auto">
          <div
            className="flex items-center gap-2 p-1 rounded-2xl mb-6 border transition-colors"
            style={{ backgroundColor: cardBg, borderColor }}
          >
            {[
              { id: 'countdown', label: '倒计时', icon: Timer },
              { id: 'countup', label: '正计时', icon: Clock },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => void switchMode(id as TimerMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  timerState.mode === id ? `${colorTheme.bg} text-white shadow-md` : ''
                }`}
                style={timerState.mode !== id ? { color: textSecondary } : {}}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          <TimerDisplay
            clockStyle={clockStyle}
            mode={timerState.mode}
            formattedTime={formattedTime}
            progress={progress}
            initialTime={timerState.initialSeconds}
            isActive={timerState.isActive}
            isSciTheme={isSciTheme}
            colorTheme={colorTheme}
            cardBg={cardBg}
            borderColor={borderColor}
            textColor={textColor}
            textSecondary={textSecondary}
            adjustTime={(delta) => {
              void adjustTime(delta);
            }}
          />

          {timerState.mode === 'countdown' && (
            <div className="flex flex-col items-center gap-4 mb-6">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                {[15, 25, 45, 60, 90].map((time) => (
                  <button
                    key={time}
                    onClick={() => void handleTimeChange(time)}
                    disabled={timerState.isActive}
                    className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${
                      Math.ceil(timerState.initialSeconds / 60) === time && !showTimePicker
                        ? `${colorTheme.bg} text-white shadow-lg scale-105`
                        : 'hover:scale-105'
                    } disabled:opacity-50`}
                    style={
                      Math.ceil(timerState.initialSeconds / 60) !== time || showTimePicker
                        ? { backgroundColor: cardBg, color: textSecondary }
                        : {}
                    }
                  >
                    {time} 分钟
                  </button>
                ))}
                <button
                  onClick={() => setShowTimePicker(!showTimePicker)}
                  disabled={timerState.isActive}
                  className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${
                    showTimePicker ? `${colorTheme.bg} text-white shadow-lg scale-105` : 'hover:scale-105'
                  } disabled:opacity-50`}
                  style={!showTimePicker ? { backgroundColor: cardBg, color: textSecondary } : {}}
                >
                  自定义
                </button>
              </div>

              {showTimePicker && !timerState.isActive && (
                <div
                  className="flex items-center gap-4 p-4 rounded-2xl border transition-colors"
                  style={{ backgroundColor: cardBg, borderColor }}
                >
                  <button
                    onClick={() => void adjustTime(-5)}
                    className={`w-10 h-10 rounded-xl ${colorTheme.bg} text-white font-bold text-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all`}
                  >
                    -5
                  </button>
                  <button
                    onClick={() => void adjustTime(-1)}
                    className="w-10 h-10 rounded-xl font-bold text-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                    style={{ backgroundColor: borderColor, color: textColor }}
                  >
                    -1
                  </button>
                  <div className="flex flex-col items-center px-4">
                    <span className="text-3xl font-bold tabular-nums" style={{ color: textColor }}>
                      {Math.round(timerState.initialSeconds / 60)}
                    </span>
                    <span className="text-xs" style={{ color: textSecondary }}>
                      分钟
                    </span>
                  </div>
                  <button
                    onClick={() => void adjustTime(1)}
                    className="w-10 h-10 rounded-xl font-bold text-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all"
                    style={{ backgroundColor: borderColor, color: textColor }}
                  >
                    +1
                  </button>
                  <button
                    onClick={() => void adjustTime(5)}
                    className={`w-10 h-10 rounded-xl ${colorTheme.bg} text-white font-bold text-xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all`}
                  >
                    +5
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center gap-4 mb-6">
            {(timerState.isActive || liveCurrentSeconds > 0 || timerState.mode === 'countup') && (
              <button
                onClick={() => void resetTimer()}
                className="flex items-center justify-center w-14 h-14 rounded-full hover:scale-105 transition-all border"
                style={{ backgroundColor: cardBg, color: textSecondary, borderColor }}
              >
                <RotateCcw className="w-6 h-6" />
              </button>
            )}

            <button
              onClick={() => void toggleTimer()}
              className={`flex items-center justify-center gap-2 px-8 h-14 rounded-full ${colorTheme.bg} text-white font-bold text-lg shadow-lg hover:scale-105 active:scale-95 transition-all ${
                isSciTheme ? colorTheme.glow : ''
              }`}
            >
              {timerState.isActive ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
              <span>{timerState.isActive ? '暂停' : '开始'}</span>
            </button>
          </div>

          {(statsLoading || statsError || timerStateLoading || timerStateError) && (
            <div className="w-full mb-3 px-2">
              {(statsLoading || timerStateLoading) && (
                <p className="text-xs" style={{ color: textSecondary }}>
                  云端数据同步中...
                </p>
              )}
              {statsError && <p className="text-xs text-red-500 mt-1">{statsError}</p>}
              {timerStateError && <p className="text-xs text-red-500 mt-1">{timerStateError}</p>}
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 w-full mb-6">
            <div className="flex flex-col items-center p-3 rounded-2xl border transition-colors" style={{ backgroundColor: cardBg, borderColor }}>
              <Zap className={`w-5 h-5 mb-1 ${colorTheme.ring}`} />
              <span className="text-xl font-bold" style={{ color: textColor }}>
                {stats.todaySessions}
              </span>
              <span className="text-[10px]" style={{ color: textSecondary }}>
                今日专注
              </span>
            </div>
            <div className="flex flex-col items-center p-3 rounded-2xl border transition-colors" style={{ backgroundColor: cardBg, borderColor }}>
              <Timer className={`w-5 h-5 mb-1 ${colorTheme.ring}`} />
              <span className="text-xl font-bold" style={{ color: textColor }}>
                {stats.todayFocusTime}
              </span>
              <span className="text-[10px]" style={{ color: textSecondary }}>
                分钟
              </span>
            </div>
            <div className="flex flex-col items-center p-3 rounded-2xl border transition-colors" style={{ backgroundColor: cardBg, borderColor }}>
              <Flame className={`w-5 h-5 mb-1 ${colorTheme.ring}`} />
              <span className="text-xl font-bold" style={{ color: textColor }}>
                {stats.streak}
              </span>
              <span className="text-[10px]" style={{ color: textSecondary }}>
                连续完成
              </span>
            </div>
          </div>

          <div
            className="flex items-center gap-3 px-4 py-3 rounded-2xl border w-full"
            style={{ borderColor: colorTheme.primary, backgroundColor: `${colorTheme.primary}20` }}
          >
            <Target className="w-5 h-5" style={{ color: colorTheme.primary }} />
            <p className="text-sm" style={{ color: textColor }}>
              {timerState.isActive ? '保持专注，你们都在为共同的未来努力。' : '每一次专注，都会成为关系里的稳定力量。'}
            </p>
          </div>
        </div>
      </main>

      <SettingsPanel
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        isSciTheme={isSciTheme}
        colorTheme={colorTheme}
        setColorTheme={setColorTheme}
        clockStyle={clockStyle}
        setClockStyle={setClockStyle}
      />

      {showCelebrate && (
        <div className="focus-complete-overlay" role="status" aria-live="polite">
          <div className="focus-complete-burst" />
          <div className="focus-complete-card">
            <Sparkles className="w-7 h-7 text-white" />
            <h3>专注完成</h3>
            <p>本次完成 {completedMinutes} 分钟，太棒了。</p>
          </div>
          <div className="focus-confetti focus-confetti-a" />
          <div className="focus-confetti focus-confetti-b" />
          <div className="focus-confetti focus-confetti-c" />
        </div>
      )}
    </div>
  );
};
