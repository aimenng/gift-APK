import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Droplet,
  Frown,
  Heart,
  Lock,
  Meh,
  Smile,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '../authContext';
import { apiPatch } from '../utils/apiClient';
import {
  fetchPeriodTrackerEntries,
  getCachedPeriodTrackerEntries,
  type PeriodTrackerEntry as TrackerEntry,
  upsertPeriodTrackerCacheEntry,
} from '../utils/periodTrackerCache';

interface PeriodTrackerProps {
  isOpen: boolean;
  onClose: () => void;
}

type FlowLevel = 'light' | 'medium' | 'heavy' | null;

interface DayRecord {
  isPeriod: boolean;
  mood: string | null;
  flow: FlowLevel;
}

type DayMap = Record<string, DayRecord>;

const DAYS = ['\u65e5', '\u4e00', '\u4e8c', '\u4e09', '\u56db', '\u4e94', '\u516d'];
const MOOD_HAPPY = '\u5f00\u5fc3';
const MOOD_HAPPY_LIFE = '\u5e78\u798f';
const MOOD_CALM = '\u5e73\u9759';
const MOOD_SAD = '\u96be\u8fc7';
const MOOD_ANXIOUS = '\u7126\u8651';

const CANONICAL_MOOD_LABELS = new Set([
  MOOD_HAPPY,
  MOOD_HAPPY_LIFE,
  MOOD_CALM,
  MOOD_SAD,
  MOOD_ANXIOUS,
]);

const MOODS = [
  {
    icon: Smile,
    label: MOOD_HAPPY,
    color: 'text-yellow-500 bg-yellow-50',
    activeColor: 'bg-yellow-100 ring-2 ring-yellow-400',
    dotColor: 'bg-yellow-400',
  },
  {
    icon: Heart,
    label: MOOD_HAPPY_LIFE,
    color: 'text-pink-500 bg-pink-50',
    activeColor: 'bg-pink-100 ring-2 ring-pink-400',
    dotColor: 'bg-pink-500',
  },
  {
    icon: Meh,
    label: MOOD_CALM,
    color: 'text-blue-400 bg-blue-50',
    activeColor: 'bg-blue-100 ring-2 ring-blue-400',
    dotColor: 'bg-blue-400',
  },
  {
    icon: Frown,
    label: MOOD_SAD,
    color: 'text-gray-500 bg-gray-100',
    activeColor: 'bg-gray-200 ring-2 ring-gray-400',
    dotColor: 'bg-gray-500',
  },
  {
    icon: Zap,
    label: MOOD_ANXIOUS,
    color: 'text-purple-500 bg-purple-50',
    activeColor: 'bg-purple-100 ring-2 ring-purple-400',
    dotColor: 'bg-purple-500',
  },
];

const toDateKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const isFutureDate = (date: Date) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return target > today;
};

const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
const firstWeekDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();

const normalizeMoodLabel = (value?: string | null): string | null => {
  const raw = String(value || '').trim();
  if (!raw) return null;
  if (CANONICAL_MOOD_LABELS.has(raw)) return raw;

  // Compatibility: handle historical mojibake and partial legacy mood values.
  if (
    raw.includes('\\u5f00') || raw.includes('\\u5fc3') ||
    raw.includes('\u5bee') || raw.includes('\u8e47') || raw.includes('\u7035')
  ) {
    return MOOD_HAPPY;
  }
  if (
    raw.includes('\\u5e78') || raw.includes('\\u798f') ||
    raw.includes('\u9a9e\u54e5') || raw.includes('\u6960\u70b2\u645c')
  ) {
    return MOOD_HAPPY_LIFE;
  }
  if (
    raw.includes('\\u5e73') || raw.includes('\\u9759') ||
    raw.includes('\u9a9e\u62bd') || raw.includes('\u6960\u70b4\u5a0a')
  ) {
    return MOOD_CALM;
  }
  if (
    raw.includes('\\u96be') || raw.includes('\\u8fc7') ||
    raw.includes('\u95c5') || raw.includes('\u95c3') || raw.includes('\u95c2')
  ) {
    return MOOD_SAD;
  }
  if (
    raw.includes('\\u7126') || raw.includes('\\u8651') ||
    raw.includes('\u9412') || raw.includes('\u95bb')
  ) {
    return MOOD_ANXIOUS;
  }
  return null;
};

const normalizeDayRecord = (entry?: Partial<DayRecord>): DayRecord => ({
  isPeriod: entry?.isPeriod === true,
  mood: normalizeMoodLabel(entry?.mood),
  flow: entry?.isPeriod ? entry?.flow || null : null,
});

const toDayMap = (entries: TrackerEntry[], targetUserId: string): DayMap => {
  const map: DayMap = {};
  for (const entry of entries) {
    if (entry.userId !== targetUserId) continue;
    map[entry.date] = normalizeDayRecord({
      isPeriod: entry.isPeriod,
      mood: entry.mood,
      flow: entry.flow,
    });
  }
  return map;
};

const sameDayRecord = (a: DayRecord | undefined, b: DayRecord | undefined) =>
  Boolean(a?.isPeriod) === Boolean(b?.isPeriod) &&
  (a?.mood || null) === (b?.mood || null) &&
  (a?.flow || null) === (b?.flow || null);

export const PeriodTracker: React.FC<PeriodTrackerProps> = ({ isOpen, onClose }) => {
  const { currentUser, partner } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [ownData, setOwnData] = useState<DayMap>({});
  const [partnerData, setPartnerData] = useState<DayMap>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const selectedDateKey = toDateKey(selectedDate);
  const ownSelected = ownData[selectedDateKey] || { isPeriod: false, mood: null, flow: null };
  const partnerSelected = partnerData[selectedDateKey] || null;
  const hasCloudAccount = Boolean(currentUser?.id);
  const canMarkPeriod = hasCloudAccount && (currentUser?.gender || 'male') !== 'male';

  useEffect(() => {
    if (!isOpen) return;

    const loadCloud = async () => {
      if (!currentUser?.id) {
        setOwnData({});
        setPartnerData({});
        setError('\u8bf7\u5148\u767b\u5f55\u540e\u4f7f\u7528\u7ecf\u671f\u4e0e\u60c5\u7eea\u540c\u6b65');
        return;
      }

      const userId = currentUser.id;
      const partnerId = partner?.id || null;
      const cachedEntries = getCachedPeriodTrackerEntries(userId, partnerId);

      if (cachedEntries) {
        setOwnData(toDayMap(cachedEntries, userId));
        setPartnerData(partnerId ? toDayMap(cachedEntries, partnerId) : {});
      }

      setLoading(!cachedEntries);
      setError('');
      try {
        const entries = await fetchPeriodTrackerEntries({
          userId,
          partnerId,
          force: Boolean(cachedEntries),
        });
        setOwnData(toDayMap(entries, userId));
        setPartnerData(partnerId ? toDayMap(entries, partnerId) : {});
      } catch (loadError: any) {
        console.error('Failed to load period tracker from cloud:', loadError);
        if (!cachedEntries) {
          setError(loadError?.message || '\u52a0\u8f7d\u540c\u6b65\u6570\u636e\u5931\u8d25');
          setOwnData({});
          setPartnerData({});
        }
      } finally {
        setLoading(false);
      }
    };

    loadCloud();
  }, [isOpen, currentUser?.id, partner?.id]);

  const persistOwnRecord = async (dateKey: string, next: DayRecord, previous: DayRecord | undefined) => {
    if (!currentUser?.id) return;
    setSaving(true);
    setError('');
    try {
      const result = await apiPatch<{ ok: boolean; entry: TrackerEntry | null }>(`/period-tracker/${dateKey}`, {
        isPeriod: next.isPeriod,
        mood: next.mood,
        flow: next.flow,
      });
      setOwnData((prev) => {
        const updated = { ...prev };
        if (!result.entry) {
          delete updated[dateKey];
          return updated;
        }
        updated[dateKey] = normalizeDayRecord({
          isPeriod: result.entry.isPeriod,
          mood: result.entry.mood,
          flow: result.entry.flow,
        });
        return updated;
      });
      upsertPeriodTrackerCacheEntry({
        userId: currentUser.id,
        partnerId: partner?.id || null,
        dateKey,
        entry: result.entry,
      });
    } catch (saveError: any) {
      setOwnData((prev) => {
        const rollback = { ...prev };
        if (previous) rollback[dateKey] = previous;
        else delete rollback[dateKey];
        return rollback;
      });
      setError(saveError?.message || '\u4fdd\u5b58\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5');
    } finally {
      setSaving(false);
    }
  };

  const updateOwnRecord = (date: Date, updater: (prev: DayRecord) => DayRecord) => {
    if (!hasCloudAccount) {
      setError('\u8bf7\u5148\u767b\u5f55\u540e\u518d\u8bb0\u5f55\u7ecf\u671f\u4e0e\u60c5\u7eea');
      return;
    }
    if (isFutureDate(date)) return;
    const dateKey = toDateKey(date);

    const previous = ownData[dateKey];
    const next = normalizeDayRecord(updater(previous || { isPeriod: false, mood: null, flow: null }));
    if (sameDayRecord(previous, next)) return;

    setOwnData((prev) => {
      const updated = { ...prev };
      if (!next.isPeriod && !next.mood && !next.flow) {
        delete updated[dateKey];
      } else {
        updated[dateKey] = next;
      }
      return updated;
    });

    void persistOwnRecord(dateKey, next, previous);
  };

  const changeMonth = (delta: number) =>
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1));

  const togglePeriod = () => {
    if (!canMarkPeriod) return;
    updateOwnRecord(selectedDate, (prev) => ({
      ...prev,
      isPeriod: !prev.isPeriod,
      flow: !prev.isPeriod ? 'medium' : null,
    }));
  };

  const setMood = (moodLabel: string) => {
    updateOwnRecord(selectedDate, (prev) => ({
      ...prev,
      mood: prev.mood === moodLabel ? null : moodLabel,
    }));
  };

  const moodColorMap = useMemo(() => {
    const map: Record<string, string> = {};
    MOODS.forEach((m) => {
      map[m.label] = m.dotColor;
    });
    return map;
  }, []);

  const renderCalendar = () => {
    const totalDays = daysInMonth(currentMonth);
    const firstDay = firstWeekDay(currentMonth);
    const cells: React.ReactNode[] = [];

    for (let i = 0; i < firstDay; i += 1) {
      cells.push(<div key={`empty-${i}`} className="h-11" />);
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const dateKey = toDateKey(date);
      const ownDay = ownData[dateKey];
      const partnerDay = partnerData[dateKey];
      const isToday = toDateKey(new Date()) === dateKey;
      const isSelected = selectedDateKey === dateKey;
      const ownMoodColor = ownDay?.mood ? moodColorMap[ownDay.mood] : null;
      const partnerMoodColor = partnerDay?.mood ? moodColorMap[partnerDay.mood] : null;

      cells.push(
        <div
          key={day}
          onClick={() => setSelectedDate(date)}
          className="h-11 flex flex-col items-center justify-center cursor-pointer relative"
        >
          <div
            className={`
              w-9 h-9 flex items-center justify-center rounded-full text-sm font-medium transition-all relative
              ${isSelected ? 'ring-2 ring-primary ring-offset-1 z-10' : ''}
              ${isToday && !isSelected ? 'bg-black/5 text-black font-bold' : ''}
              ${ownDay?.isPeriod ? 'bg-rose-100 text-rose-600 dark:bg-rose-900/30 dark:text-rose-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10'}
              ${isSelected && ownDay?.isPeriod ? 'bg-rose-200 ring-rose-400' : ''}
            `}
          >
            {day}
            <div className="absolute bottom-0.5 right-0.5 flex gap-0.5">
              {ownMoodColor && (
                <div className={`w-1.5 h-1.5 rounded-full ${ownMoodColor} ring-1 ring-white dark:ring-[#1C1C1E]`} />
              )}
              {partnerMoodColor && (
                <div
                  className={`w-1.5 h-1.5 rounded-full ${partnerMoodColor} ring-1 ring-white dark:ring-[#1C1C1E] opacity-60`}
                />
              )}
            </div>
            {partnerDay?.isPeriod && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-sky-500 border border-white dark:border-[#1C1C1E]" />
            )}
          </div>
        </div>
      );
    }

    return cells;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div
        className="w-[90%] max-w-sm bg-white dark:bg-[#1C1C1E] rounded-3xl p-6 shadow-2xl transform transition-all animate-scale-up border border-gray-100 dark:border-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">{'\u8eab\u4f53\u4e0e\u60c5\u7eea'}</h3>
            <p className="text-xs text-gray-500">
              {selectedDate.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })} {'\u00b7'} {'\u53cc\u65b9\u540c\u6b65'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex items-center justify-between mb-2 px-2">
          <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-500">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="font-bold text-gray-800 dark:text-gray-200">
            {currentMonth.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })}
          </span>
          <button onClick={() => changeMonth(1)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-500">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 text-red-500 px-3 py-2 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-7 gap-1 mb-4 text-center">
          {DAYS.map((day) => (
            <div key={day} className="text-xs font-medium text-gray-400 mb-2">
              {day}
            </div>
          ))}
          {renderCalendar()}
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="rounded-2xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5 p-4 text-sm text-gray-500 text-center">
              {'\u6b63\u5728\u52a0\u8f7d\u540c\u6b65\u6570\u636e...'}
            </div>
          ) : (
            <>
              {isFutureDate(selectedDate) ? (
                <div className="flex flex-col items-center justify-center py-6 text-gray-400 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5">
                  <Lock className="w-6 h-6 mb-2 opacity-50" />
                  <p className="text-xs font-medium">{'\u672a\u6765\u65e5\u671f\u4e0d\u53ef\u8bb0\u5f55'}</p>
                </div>
              ) : (
                <>
                  {canMarkPeriod ? (
                    <div
                      onClick={togglePeriod}
                      className={`
                        flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all border
                        ${ownSelected.isPeriod ? 'bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800' : 'bg-gray-50 border-gray-100 hover:bg-gray-100 dark:bg-white/5 dark:border-white/10'}
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${ownSelected.isPeriod ? 'bg-rose-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                          <Droplet className="w-4 h-4 fill-current" />
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${ownSelected.isPeriod ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                            {ownSelected.isPeriod ? '\u6211\uff1a\u7ecf\u671f\u4e2d' : '\u6211\uff1a\u672a\u8bb0\u5f55\u7ecf\u671f'}
                          </p>
                          <p className="text-xs text-sage">{'\u70b9\u51fb\u5207\u6362\u72b6\u6001'}</p>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${ownSelected.isPeriod ? 'border-rose-500' : 'border-gray-300'}`}>
                        {ownSelected.isPeriod && <div className="w-3 h-3 rounded-full bg-rose-500" />}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-gray-100 dark:border-white/10 bg-gray-50 dark:bg-white/5 px-3 py-2 text-xs text-gray-500">
                      {'\u7537\u751f\u8d26\u53f7\u4e0d\u8bb0\u5f55\u7ecf\u671f\uff0c\u53ef\u8bb0\u5f55\u60c5\u7eea\u5e76\u67e5\u770b\u4f34\u4fa3\u7ecf\u671f/\u60c5\u7eea\u3002'}
                    </div>
                  )}

                  <div className="pt-1">
                    <p className="text-xs font-medium text-gray-500 mb-3 px-1">{'\u6211\u7684\u5fc3\u60c5'}</p>
                    <div className="flex justify-between items-center px-1">
                      {MOODS.map((mood) => (
                        <button
                          key={mood.label}
                          onClick={() => setMood(mood.label)}
                          className={`flex flex-col items-center gap-1 transition-all ${
                            ownSelected.mood === mood.label ? 'scale-110' : 'scale-100 opacity-70 hover:opacity-100'
                          }`}
                        >
                          <div
                            className={`
                              w-12 h-12 rounded-full flex items-center justify-center shadow-sm border border-black/5 transition-all
                              ${ownSelected.mood === mood.label ? mood.activeColor : mood.color}
                            `}
                          >
                            <mood.icon className="w-5 h-5" />
                          </div>
                          <span className={`text-[10px] ${ownSelected.mood === mood.label ? 'text-primary font-bold' : 'text-gray-500'}`}>
                            {mood.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="rounded-2xl border border-sky-100 dark:border-sky-900/40 bg-sky-50/70 dark:bg-sky-900/10 p-3">
                <p className="text-xs text-sky-700 dark:text-sky-300 font-semibold mb-1">
                  {'\u5bf9\u65b9\u5f53\u65e5\u8bb0\u5f55'}{partner?.name ? ` \u00b7 ${partner.name}` : ''}
                </p>
                {partnerSelected ? (
                  <p className="text-xs text-sky-800 dark:text-sky-200">
                    {'\u7ecf\u671f\uff1a'}{partnerSelected.isPeriod ? '\u662f' : '\u5426'}
                    {'\uff0c\u5fc3\u60c5\uff1a'}{partnerSelected.mood || '\u672a\u8bb0\u5f55'}
                  </p>
                ) : (
                  <p className="text-xs text-sky-700/80 dark:text-sky-300/80">{'\u5bf9\u65b9\u5f53\u5929\u8fd8\u672a\u8bb0\u5f55'}</p>
                )}
              </div>
            </>
          )}
        </div>

        {saving && <p className="mt-3 text-[11px] text-sage text-right">{'\u6b63\u5728\u540c\u6b65...'}</p>}
      </div>
    </div>
  );
};

