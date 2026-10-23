import { Settings, Plus, Calendar, Edit2, Trash2, AlertCircle, Leaf, Clock, Wifi, WifiOff } from 'lucide-react';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp, calculateRelativeDays, calculateNextOccurrence, dedupeRecentDuplicateEvents } from '../context';
import { useAuth } from '../authContext';
import { Modal } from '../components/Modal';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { PublisherBadge } from '../components/PublisherBadge';
import { useToast } from '../components/Toast';
import { EventType, AnniversaryEvent } from '../types';
import { getDateValidationError, getMinDate, getMaxDate } from '../utils/dateValidation';
import { EVENT_TYPE_Config, DEFAULT_CONFIG } from '../components/anniversary/constants';
import { getNow, isSynced, onSyncChange } from '../utils/timeService';

// Use a consistent name for the config
const EVENT_TYPE_CONFIG = EVENT_TYPE_Config;

// Get config for event type
const getEventConfig = (type: string) => {
  return EVENT_TYPE_CONFIG[type] || DEFAULT_CONFIG;
};

export const AnniversaryPage: React.FC = () => {
  const { events, addEvent, updateEvent, deleteEvent } = useApp();
  const { currentUser, partner } = useAuth();
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<string | null>(null);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setTick((t) => t + 1);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const [timeSynced, setTimeSynced] = useState(isSynced());
  useEffect(() => {
    const unsub = onSyncChange((synced) => {
      setTimeSynced(synced);
      setTick((t) => t + 1);
    });
    return unsub;
  }, []);

  // 当前标准时间（用于显示）
  const currentTimeStr = useMemo(() => {
    return getNow().format('YYYY-MM-DD HH:mm');
  }, [tick]);

  // Form State
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState<EventType>('纪念日');
  const [dateError, setDateError] = useState<string | null>(null);
  const [isSavingEvent, setIsSavingEvent] = useState(false);
  const [pendingDeleteEventId, setPendingDeleteEventId] = useState<string | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const submitLockRef = useRef(false);
  const recentSubmitRef = useRef<{ signature: string; at: number }>({ signature: '', at: 0 });

  const resetForm = () => {
    submitLockRef.current = false;
    recentSubmitRef.current = { signature: '', at: 0 };
    setTitle('');
    setSubtitle('');
    setDate('');
    setType('纪念日');
    setEditingEvent(null);
    setDateError(null);
  };

  // Validate date on change
  const handleDateChange = (value: string) => {
    setDate(value);
    const error = getDateValidationError(value);
    setDateError(error);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current || isSavingEvent) return;
    submitLockRef.current = true;
    setIsSavingEvent(true);

    try {
      const dateValidationError = getDateValidationError(date);
      if (dateValidationError) {
        setDateError(dateValidationError);
        return;
      }

      const normalizedTitle = title.trim();
      const normalizedSubtitle = subtitle.trim();
      const normalizedType = type.trim();

      if (!normalizedTitle || !date || !normalizedType) {
        return;
      }

      const signature = `${editingEvent || 'new'}|${normalizedTitle}|${normalizedSubtitle}|${date}|${normalizedType}`;
      const nowMs = Date.now();
      if (
        recentSubmitRef.current.signature === signature &&
        nowMs - recentSubmitRef.current.at < 8000
      ) {
        return;
      }
      recentSubmitRef.current = { signature, at: nowMs };

      const eventConfig = getEventConfig(normalizedType);
      const eventData = {
        title: normalizedTitle,
        subtitle: normalizedSubtitle,
        date,
        type: normalizedType,
        image: eventConfig.defaultImage,
      };

      if (editingEvent) {
        await updateEvent(editingEvent, eventData);
      } else {
        await addEvent(eventData);
      }

      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      recentSubmitRef.current = { signature: '', at: 0 };
      console.error('Failed to save event:', error);
      showToast(
        error instanceof Error && error.message ? error.message : '保存失败，请稍后重试',
        'error'
      );
    } finally {
      submitLockRef.current = false;
      setIsSavingEvent(false);
    }
  };

  const startEdit = (event: AnniversaryEvent) => {
    setTitle(event.title);
    setSubtitle(event.subtitle || '');
    setDate(event.date);
    setType(event.type);
    setEditingEvent(event.id);
    setIsModalOpen(true);
  };

  const handleDelete = (eventId: string) => {
    setPendingDeleteEventId(eventId);
  };

  const confirmDelete = async () => {
    if (!pendingDeleteEventId) return;
    const eventId = pendingDeleteEventId;
    setDeletingEventId(eventId);
    try {
      await deleteEvent(eventId);
      setPendingDeleteEventId(null);
    } catch (error) {
      console.error('Failed to delete event:', error);
      showToast(
        error instanceof Error && error.message ? error.message : '删除失败，请稍后重试',
        'error'
      );
    } finally {
      setDeletingEventId(null);
    }
  };

  // Memoize sorted events
  const sortedEvents = useMemo(() => {
    return dedupeRecentDuplicateEvents(events).sort((a, b) => {
      const nextA = calculateNextOccurrence(a.date);
      const nextB = calculateNextOccurrence(b.date);
      return nextA - nextB;
    });
  }, [events, tick]);

  const resolvePublisher = (event: AnniversaryEvent) => {
    const isPartner = Boolean(partner?.id && event.userId && event.userId === partner.id);
    const isOwn = !event.userId || event.userId === currentUser?.id;
    const fallbackUser = isPartner ? partner : currentUser;
    const fallbackName = fallbackUser?.name || fallbackUser?.email?.split('@')[0] || (isPartner ? '对方' : '我');
    return {
      isOwn,
      tag: isPartner ? 'Ta' : '我',
      name: event.author?.name || fallbackName,
      avatar: event.author?.avatar || fallbackUser?.avatar || '',
      gender: event.author?.gender || fallbackUser?.gender || 'male',
    };
  };

  return (
    <div className="flex flex-col h-full w-full">
      <header className="flex items-center justify-between p-4 pb-2 pt-safe-top sticky top-0 z-10 bg-[var(--eye-bg-primary)]/80 backdrop-blur-2xl border-b border-[var(--eye-border)] shrink-0">
        <div className="size-10 flex items-center justify-center" title={timeSynced ? '时间已校准' : '使用本地时间'}>
          {timeSynced ? (
            <Wifi className="w-4 h-4 text-green-500" />
          ) : (
            <WifiOff className="w-4 h-4 text-sage/40" />
          )}
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <h2 className="text-lg font-bold leading-tight tracking-tight text-center flex-1 text-text-main dark:text-white">纪念时刻</h2>
          <p className="text-[10px] text-sage font-medium tracking-wider flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{currentTimeStr}</span>
            {timeSynced && <span className="text-green-500">· 已校准</span>}
          </p>
        </div>
        <button title="设置" className="flex size-10 shrink-0 items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-text-main dark:text-white">
          <Settings className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 flex flex-col px-4 pt-2 overflow-y-auto hide-scrollbar w-full">
        <div className="py-1">
          <p className="text-sage dark:text-gray-400 text-sm font-medium">即将到来的日子</p>
        </div>

        {sortedEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 animate-fade-in">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/10 to-sage/5 flex items-center justify-center mb-5 animate-float">
              <Calendar className="w-12 h-12 text-primary/40" />
            </div>
            <h3 className="text-text-main dark:text-white text-xl font-bold mb-2">还没有纪念日</h3>
            <p className="text-sage text-sm text-center mb-6 leading-relaxed">
              点击下方按钮<br />添加你们的重要日子 🎉
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4 pb-32 stagger-children">
            {sortedEvents.map((event) => {
              // 真实天数差：正=未来，负=过去
              const realDiff = calculateRelativeDays(event.date);
              // 下一次出现（用于年度循环）>= 0
              const nextDays = calculateNextOccurrence(event.date);

              const isOriginalPast = realDiff < 0;
              const originalAbsDays = Math.abs(realDiff);

              const progress =
                nextDays === 0
                  ? 100
                  : Math.min(100, Math.max(5, Math.round((1 - nextDays / 365) * 100)));
              const config = getEventConfig(event.type);
              const IconComponent = config.icon;
              const displayImage = event.image || config.defaultImage;

              return (
                <div key={event.id} className="relative overflow-hidden rounded-3xl bg-white dark:bg-[#2a3020] p-5 shadow-card transition-all duration-300 hover:shadow-soft hover:-translate-y-0.5 shrink-0 border border-white/50 dark:border-white/5">
                  {/* Subtle gradient overlay */}
                  <div className="absolute top-0 right-0 w-40 h-40 rounded-full bg-gradient-to-br from-primary/5 to-transparent blur-2xl pointer-events-none"></div>

                  <div className="flex items-stretch justify-between gap-4 min-w-0">
                    <div className="flex flex-col justify-between py-1 flex-1 min-w-0">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center justify-center ${config.bgColor} ${config.iconColor} rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider`}>
                            {config.label}
                          </span>
                          {/* 显示第几年 */}
                          {isOriginalPast && originalAbsDays >= 365 && (
                            <span className="text-[10px] text-sage/70 font-medium">
                              第 {Math.floor(originalAbsDays / 365)} 年
                            </span>
                          )}
                        </div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-xl font-bold leading-tight text-text-main dark:text-white break-words">
                            {event.title}
                          </h3>
                          {(() => {
                            const publisher = resolvePublisher(event);
                            return (
                              <PublisherBadge
                                tag={publisher.tag}
                                name={publisher.name}
                                avatar={publisher.avatar}
                                gender={publisher.gender}
                                isOwn={publisher.isOwn}
                              />
                            );
                          })()}
                        </div>
                        {event.subtitle && (
                          <p className="text-sage dark:text-gray-400 text-sm line-clamp-2">{event.subtitle}</p>
                        )}
                        <p className="mt-1 inline-flex items-center rounded-full bg-sage-light/35 dark:bg-white/10 px-2.5 py-1 text-[12px] font-mono font-semibold tracking-wide text-sage/90 dark:text-gray-300">
                          {event.date}
                        </p>
                      </div>

                      {/* 核心信息区 */}
                      <div className="mt-3 space-y-1">
                        {nextDays === 0 ? (
                          /* === 今天 === */
                          <div className="flex flex-col">
                            <span className="text-2xl font-bold gradient-text">🎉 就是今天！</span>
                            <span className="text-xs text-sage mt-0.5 animate-pulse">此刻值得纪念 ✨</span>
                            {isOriginalPast && (
                              <span className="text-[11px] text-sage/60 mt-1">距离原日期已 {originalAbsDays} 天</span>
                            )}
                          </div>
                        ) : (
                          /* === 非今天 === */
                          <>
                            {/* 原日期相对今天（主信息） */}
                            {isOriginalPast ? (
                              <>
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="relative overflow-hidden rounded-2xl bg-primary/10 dark:bg-primary/15 px-3 py-2.5 border border-primary/15">
                                    <span className="pointer-events-none absolute -right-1 -bottom-1 text-[44px] leading-none font-black text-primary/10 tabular-nums select-none">
                                      {originalAbsDays}
                                    </span>
                                    <p className="text-[12px] text-sage/80 dark:text-gray-300 font-semibold">已过</p>
                                    <p className="relative mt-1 flex items-end gap-1.5 leading-none">
                                      <span className="text-[30px] sm:text-[34px] font-bold gradient-text tabular-nums">{originalAbsDays}</span>
                                      <span className="text-sm font-semibold text-sage dark:text-gray-300 pb-0.5">天</span>
                                    </p>
                                  </div>
                                  <div className="relative overflow-hidden rounded-2xl bg-white/70 dark:bg-white/5 px-3 py-2.5 border border-sage/15 dark:border-white/10">
                                    <span className="pointer-events-none absolute -right-1 -bottom-1 text-[44px] leading-none font-black text-primary/10 tabular-nums select-none">
                                      {nextDays}
                                    </span>
                                    <p className="text-[12px] text-sage/80 dark:text-gray-300 font-semibold flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      下次
                                    </p>
                                    <p className="relative mt-1 flex items-end gap-1.5 leading-none">
                                      <span className={`text-[30px] sm:text-[34px] font-bold tabular-nums ${
                                        nextDays <= 7 ? 'text-rose-500' : 'text-primary'
                                      }`}>{nextDays}</span>
                                      <span className="text-sm font-semibold text-sage dark:text-gray-300 pb-0.5">
                                        天{nextDays <= 7 ? ' 🔥' : ''}
                                      </span>
                                    </p>
                                  </div>
                                </div>
                              </>
                            ) : (
                              /* 未来事件（一次性） */
                              <div className="relative overflow-hidden rounded-2xl bg-primary/10 dark:bg-primary/15 px-3 py-2.5 border border-primary/15">
                                <span className="pointer-events-none absolute -right-1 -bottom-1 text-[46px] leading-none font-black text-primary/10 tabular-nums select-none">
                                  {nextDays}
                                </span>
                                <p className="text-[12px] text-sage/80 dark:text-gray-300 font-semibold">距离当天</p>
                                <p className="relative mt-1 flex items-end gap-1.5 leading-none">
                                  <span className={`text-[32px] sm:text-[36px] font-bold tabular-nums ${
                                    nextDays <= 7
                                      ? 'text-rose-500 animate-pulse'
                                      : 'gradient-text'
                                  }`}>{nextDays}</span>
                                  <span className="text-sm font-semibold text-sage dark:text-gray-300 pb-0.5">
                                    天{nextDays <= 7 ? ' 🔥' : ''}
                                  </span>
                                </p>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="mt-3 flex flex-col gap-1.5">
                        <div className="flex justify-between items-end text-[13px] text-sage dark:text-gray-300">
                          <span className="flex items-center gap-1">
                            <Leaf className="w-3.5 h-3.5 text-primary" />
                            <span className="font-semibold">{nextDays === 0 ? '今天' : '倒计时'}</span>
                          </span>
                          <span className="font-bold text-primary/80">{progress}%</span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-sage-light/30 dark:bg-white/10 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary/70 via-primary to-[#9aad67] transition-all duration-700 ease-out"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Image/Icon area */}
                    <div className={`w-20 h-20 rounded-2xl ${config.bgColor} flex items-center justify-center ${config.iconColor} overflow-hidden relative shrink-0 self-center shadow-sm`}>
                      {displayImage ? (
                        <img
                          src={displayImage}
                          alt={event.title}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <IconComponent className="w-8 h-8" />
                      )}
                    </div>
                  </div>

                  {resolvePublisher(event).isOwn && (
                    <div className="mt-3 pt-2 border-t border-black/5 dark:border-white/5 flex justify-end gap-2">
                      <button
                        onClick={() => startEdit(event)}
                        className="p-2 bg-primary/10 text-primary rounded-full hover:bg-primary hover:text-white transition-all active:scale-90"
                        title="编辑"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(event.id)}
                        disabled={Boolean(deletingEventId)}
                        className="p-2 bg-red-100 text-red-500 rounded-full hover:bg-red-500 hover:text-white transition-all active:scale-90"
                        title="删除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <div className="absolute right-4 bottom-24 z-20">
        <button
          onClick={() => {
            resetForm();
            setIsModalOpen(true);
          }}
          className="group relative flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-sage to-primary hover:from-[#4a5236] hover:to-[#7a8a4b] active:from-[#3a4228] active:to-[#5c6b38] active:scale-[0.93] text-white shadow-[0_8px_30px_rgb(127,137,97,0.35)] px-5 h-14 transition-all duration-200 hover:shadow-glow overflow-hidden"
        >
          <div className="absolute inset-0 animate-shimmer opacity-20"></div>
          <Plus className="w-6 h-6 relative z-10" />
          <span className="text-base font-bold tracking-wide relative z-10">添加纪念日</span>
        </button>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm(); }} title={editingEvent ? '编辑纪念日' : '添加新纪念日'}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Event Type Selector with Icons */}
          <div>
            <label className="block text-sm font-medium text-sage mb-2">选择类型</label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(EVENT_TYPE_CONFIG).filter(([key]) => !['anniversary', 'birthday', 'trip'].includes(key)).slice(0, 8).map(([key, config]) => {
                const IconComponent = config.icon;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setType(key as EventType)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${type === key
                      ? 'bg-primary/20 ring-2 ring-primary'
                      : 'bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10'
                      }`}
                  >
                    <div className={`w-8 h-8 rounded-full ${config.bgColor} flex items-center justify-center ${config.iconColor}`}>
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <span className="text-[10px] text-text-main dark:text-white font-medium">{key}</span>
                  </button>
                );
              })}
            </div>
            {/* Custom type input */}
            <div className="mt-2">
              <input
                type="text"
                value={type}
                onChange={(e) => setType(e.target.value)}
                placeholder="或输入自定义类型"
                className="w-full rounded-xl bg-gray-50 dark:bg-white/5 border-none p-3 text-text-main dark:text-white focus:ring-2 focus:ring-primary/50 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-sage mb-1">事件名称</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：结婚纪念日"
              className="w-full rounded-xl bg-gray-50 dark:bg-white/5 border-none p-3 text-text-main dark:text-white focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-sage mb-1">副标题（可选）</label>
            <input
              type="text"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="例如：最重要的一天"
              className="w-full rounded-xl bg-gray-50 dark:bg-white/5 border-none p-3 text-text-main dark:text-white focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-sage mb-1">日期</label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              min={getMinDate()}
              max={getMaxDate()}
              className={`w-full rounded-xl bg-gray-50 dark:bg-white/5 border-none p-3 text-text-main dark:text-white focus:ring-2 ${dateError ? 'focus:ring-red-500/50 ring-2 ring-red-500/50' : 'focus:ring-primary/50'}`}
            />
            {dateError && (
              <p className="text-red-500 text-xs mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {dateError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSavingEvent}
            className="w-full mt-4 bg-primary hover:bg-[#7a8a4b] active:bg-[#5c6b38] text-white font-bold h-12 rounded-xl shadow-lg shadow-primary/30 active:scale-[0.96] transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSavingEvent ? '\u4fdd\u5b58\u4e2d...' : editingEvent ? '\u4fdd\u5b58\u4fee\u6539' : '\u4fdd\u5b58\u7eaa\u5ff5\u65e5'}
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(pendingDeleteEventId)}
        title="确定要删除这个纪念日吗？"
        description="删除后将无法恢复，请确认是否继续。"
        confirmText="确认删除"
        cancelText="先保留"
        confirmTone="danger"
        loading={Boolean(deletingEventId)}
        onCancel={() => setPendingDeleteEventId(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
};
