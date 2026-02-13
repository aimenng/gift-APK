import React, { useState } from 'react';
import {
  Bell,
  BrushCleaning,
  Copy,
  Edit2,
  Grid,
  HelpCircle,
  Heart,
  Link2,
  Mail,
  MessageSquare,
  Palette,
  Send,
  Settings,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import { IMAGES } from '../constants';
import { Modal } from '../components/Modal';
import { ThemeToggle } from '../components/ThemeToggle';
import { calculateDaysTogether, useApp } from '../context';
import { useAuth } from '../authContext';
import { LoveTimer } from '../components/LoveTimer';
import { useToast } from '../components/Toast';
import { PeriodTracker } from '../components/PeriodTracker';
import { PixelAvatarShowcase } from '../components/PixelAvatar';
import { AnimatedAvatarShowcase } from '../components/AnimatedAvatar';

interface ProfilePageProps {
  onNavigateToAuth: () => void;
  onEditProfile: () => void;
  onManageConnection: () => void;
}

interface SettingsCardProps {
  icon: React.ReactNode;
  gradient: string;
  title: string;
  subtitle: string;
  dot?: boolean;
  onClick?: () => void;
}

const SettingsCard: React.FC<SettingsCardProps> = ({
  icon,
  gradient,
  title,
  subtitle,
  dot = false,
  onClick,
}) => (
  <button
    onClick={onClick}
    className="relative w-full min-h-[126px] rounded-2xl bg-[var(--eye-bg-secondary)] p-4 text-left shadow-sm border border-[var(--eye-border)] transition-all hover:-translate-y-0.5 hover:shadow-soft active:scale-[0.99] flex flex-col"
  >
    {dot && <span className="absolute top-3 right-3 size-2 rounded-full bg-red-500 animate-pulse" />}

    <div className={`mb-3 size-11 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-md shrink-0`}>
      {icon}
    </div>

    <p className="text-[var(--eye-text-primary)] text-base font-bold leading-tight break-words">
      {title}
    </p>
    <p className="text-[var(--eye-text-secondary)] text-xs mt-1 leading-tight truncate">
      {subtitle}
    </p>
  </button>
);

const formatNotificationDateTime = (value?: string | null) => {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
};

const PixelLanPreviewIcon: React.FC = () => (
  <svg viewBox="0 0 44 44" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="2" y="2" width="40" height="40" rx="12" fill="url(#pixel-card-bg)" />
    <defs>
      <linearGradient id="pixel-card-bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#ffb35a" />
        <stop offset="100%" stopColor="#ff7d25" />
      </linearGradient>
    </defs>
    <g transform="translate(8 8)" fill="#6d3f7d">
      <rect x="7" y="2" width="2" height="2" />
      <rect x="19" y="2" width="2" height="2" />
      <rect x="5" y="4" width="2" height="2" />
      <rect x="9" y="4" width="2" height="2" />
      <rect x="17" y="4" width="2" height="2" />
      <rect x="21" y="4" width="2" height="2" />
      <rect x="3" y="6" width="2" height="2" />
      <rect x="23" y="6" width="2" height="2" />
      <rect x="3" y="8" width="2" height="2" />
      <rect x="23" y="8" width="2" height="2" />
      <rect x="5" y="10" width="2" height="2" />
      <rect x="9" y="10" width="2" height="2" />
      <rect x="17" y="10" width="2" height="2" />
      <rect x="21" y="10" width="2" height="2" />
      <rect x="7" y="12" width="2" height="2" />
      <rect x="19" y="12" width="2" height="2" />
      <rect x="9" y="14" width="10" height="2" />
      <rect x="11" y="16" width="6" height="2" />
      <rect x="11" y="8" width="2" height="2" fill="#ffffff" />
      <rect x="15" y="8" width="2" height="2" fill="#ffffff" />
    </g>
  </svg>
);

const AnimatedLanPreviewIcon: React.FC = () => (
  <svg viewBox="0 0 44 44" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="2" y="2" width="40" height="40" rx="12" fill="url(#animated-card-bg)" />
    <defs>
      <linearGradient id="animated-card-bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#34d7df" />
        <stop offset="100%" stopColor="#0aa7af" />
      </linearGradient>
    </defs>
    <circle cx="22" cy="21" r="9.5" fill="#ffe3c9" />
    <path d="M12.5 20.2C12.5 13.6 17.5 10 22 10c4.7 0 9.5 3.6 9.5 10.1c-2.4-2.6-6-4.2-9.5-4.2c-3.5 0-7.1 1.6-9.5 4.3Z" fill="#2f4f77" />
    <circle cx="18.8" cy="21.2" r="1.1" fill="#2f4f77" />
    <circle cx="25.2" cy="21.2" r="1.1" fill="#2f4f77" />
    <path d="M18 25.1c1.2 1.5 2.3 2.2 4 2.2c1.8 0 2.9-0.7 4.1-2.2" stroke="#d17886" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    <path d="M13.4 29.8c1.9-2.2 4.9-3.7 8.6-3.7s6.7 1.5 8.6 3.7" stroke="#ffffff" strokeOpacity="0.72" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const ProfilePage: React.FC<ProfilePageProps> = ({
  onNavigateToAuth,
  onEditProfile,
  onManageConnection,
}) => {
  const {
    inviteCode,
    boundInviteCode,
    togetherDate,
    updateTogetherDate,
    isConnected,
    pendingBindingRequests,
    refreshPendingBindingRequests,
    respondBindingRequest,
  } = useApp();
  const { currentUser, partner, unreadCount, notifications, markAsRead, markAllAsRead, clearNotifications } = useAuth();
  const { showToast } = useToast();

  const [showNotifications, setShowNotifications] = useState(false);
  const [isDateModalOpen, setIsDateModalOpen] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [showPeriodTracker, setShowPeriodTracker] = useState(false);
  const [showPixelAvatar, setShowPixelAvatar] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showAnimatedAvatar, setShowAnimatedAvatar] = useState(false);
  const [markAllReadBusy, setMarkAllReadBusy] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [tempDate, setTempDate] = useState(togetherDate);
  const [bindingActionBusyId, setBindingActionBusyId] = useState<string | null>(null);
  const effectiveInviteCode = inviteCode || currentUser?.invitationCode || '';
  const inviteCodeReady = !currentUser || Boolean(effectiveInviteCode);

  const daysTogether = calculateDaysTogether(togetherDate);
  const currentUserGender = currentUser?.gender === 'female' ? 'female' : 'male';
  const currentAvatar =
    currentUser?.avatar ||
    (currentUserGender === 'female' ? IMAGES.AVATAR_FEMALE : IMAGES.AVATAR_MALE);
  const partnerFallbackGender = currentUserGender === 'female' ? 'male' : 'female';
  const partnerAvatar =
    partner?.avatar ||
    (partner?.gender === 'female'
      ? IMAGES.AVATAR_FEMALE
      : partner?.gender === 'male'
        ? IMAGES.AVATAR_MALE
        : partnerFallbackGender === 'female'
          ? IMAGES.AVATAR_FEMALE
          : IMAGES.AVATAR_MALE);

  const onEditDate = () => {
    setTempDate(togetherDate);
    setIsDateModalOpen(true);
  };

  const saveDate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempDate) return;
    try {
      await updateTogetherDate(tempDate);
      setIsDateModalOpen(false);
      showToast('已更新纪念日', 'success');
    } catch (error: any) {
      showToast(error?.message || '更新失败，请稍后重试', 'error');
    }
  };

  const handleCopyCode = () => {
    if (!effectiveInviteCode) return;
    navigator.clipboard.writeText(effectiveInviteCode);
    showToast('邀请码已复制', 'love');
  };

  const handleNotificationClick = () => {
    setShowNotifications(true);
    refreshPendingBindingRequests();
  };

  const handleMarkAllRead = async () => {
    if (markAllReadBusy || unreadCount <= 0) return;
    setMarkAllReadBusy(true);
    try {
      await markAllAsRead();
      showToast('全部消息已标记为已读', 'success');
    } finally {
      setMarkAllReadBusy(false);
    }
  };

  const handleFeedbackClick = () => {
    setShowFeedback(true);
  };

  const handleOpenPeriodTracker = () => {
    if (!currentUser) {
      showToast('请先登录账号后再使用该功能', 'error');
      return;
    }
    setShowPeriodTracker(true);
  };

  const handleSendFeedback = () => {
    if (!feedbackText.trim()) {
      showToast('请输入反馈内容', 'error');
      return;
    }
    const subject = encodeURIComponent('【Gifts应用反馈】来自用户');
    const body = encodeURIComponent(feedbackText);
    window.open(`mailto:2305427577@qq.com?subject=${subject}&body=${body}`, '_blank');
    showToast('已打开邮件客户端', 'success');
    setFeedbackText('');
    setShowFeedback(false);
  };

  const handleBindingRequestAction = async (requestId: string, action: 'accept' | 'reject') => {
    if (bindingActionBusyId) return;
    setBindingActionBusyId(requestId);
    try {
      const result = await respondBindingRequest(requestId, action);
      if (!result.ok) {
        showToast(result.message || '处理失败，请稍后重试', 'error');
        return;
      }
      showToast(result.message || (action === 'accept' ? '已同意绑定请求' : '已拒绝绑定请求'), 'success');
    } finally {
      setBindingActionBusyId(null);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-[var(--eye-bg-primary)]">
      <header className="flex items-center p-4 pb-2 pt-safe-top justify-between sticky top-0 z-50 bg-[var(--eye-bg-primary)]/80 backdrop-blur-2xl border-b border-[var(--eye-border)]/50">
        <div className="w-12" />
        <h2 className="text-[var(--eye-text-primary)] text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center">
          我的
        </h2>
        <button
          onClick={onNavigateToAuth}
          className="flex size-12 cursor-pointer items-center justify-center overflow-hidden rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-[var(--eye-text-primary)] relative"
        >
          <Settings className="w-5 h-5" />
          {!currentUser && (
            <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[var(--eye-bg-primary)] animate-pulse" />
          )}
        </button>
      </header>

      <main className="flex-1 flex flex-col items-center pt-2 w-full px-4 overflow-y-auto hide-scrollbar">
        <div className="pb-32 w-full flex flex-col items-center max-w-md mx-auto">
          <div className="flex flex-col items-center justify-center pt-4 pb-1 relative group w-full">
            <button
              onClick={currentUser ? onEditProfile : onNavigateToAuth}
              className="absolute top-4 right-0 p-2 bg-primary/10 text-primary rounded-full md:hover:bg-primary md:hover:text-white transition-all active:scale-95 z-40"
            >
              <Edit2 className="w-4 h-4" />
            </button>

            <div className="relative flex items-center justify-center h-20 w-full mb-3">
              <div className="absolute left-1/2 -translate-x-[calc(50%+20px)] z-10">
                <div
                  className="w-16 h-16 rounded-full border-3 border-[var(--eye-bg-primary)] shadow-lg bg-gray-200 bg-cover bg-center ring-2 ring-primary/20"
                  style={{
                    backgroundImage: `url('${currentAvatar}')`,
                  }}
                />
              </div>
              <div className="z-30 flex items-center justify-center size-8 bg-gradient-to-br from-rose-400 to-pink-500 rounded-full shadow-lg text-white animate-heartbeat">
                <Heart className="w-4 h-4 fill-current" />
              </div>
              <div className="absolute left-1/2 -translate-x-[calc(50%-20px)] z-20">
                <div
                  className="w-16 h-16 rounded-full border-3 border-[var(--eye-bg-primary)] shadow-lg bg-gray-200 bg-cover bg-center ring-2 ring-primary/20"
                  style={{
                    backgroundImage: `url('${partnerAvatar}')`,
                  }}
                />
              </div>
            </div>

            <h3 className="text-[var(--eye-text-primary)] tracking-tight text-xl font-bold leading-tight text-center mb-3 max-w-full break-words">
              {currentUser?.name || (currentUser?.email ? currentUser.email.split('@')[0] : '情侣主页')}
            </h3>

            <div className="w-full px-8">
              <LoveTimer startDate={togetherDate} size="small" />
            </div>
            <p className="text-xs mt-2 text-[var(--eye-text-secondary)]">已在一起 {daysTogether} 天</p>
          </div>

          <div className="w-full mb-4 mt-6">
            <div className="flex items-start sm:items-center justify-between rounded-2xl bg-[var(--eye-bg-secondary)] p-3.5 sm:p-4 shadow-sm border border-[var(--eye-border)] gap-2.5 sm:gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="size-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white shadow-md shrink-0">
                  <Palette className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[var(--eye-text-primary)] text-[15px] sm:text-base font-bold leading-tight">主题切换</p>
                  <p className="text-[var(--eye-text-secondary)] text-[11px] sm:text-xs mt-1 leading-snug break-words line-clamp-2">
                    护眼模式已启用，可按需切换明暗主题
                  </p>
                </div>
              </div>
              <ThemeToggle className="shrink-0 scale-[0.9] sm:scale-100 origin-right" />
            </div>
          </div>

          <div className="w-full mb-4">
            <div className="rounded-2xl bg-[var(--eye-bg-secondary)] p-4 shadow-sm border border-[var(--eye-border)]">
              <div className="flex items-center justify-between mb-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-10 rounded-xl bg-gradient-to-br from-red-400 to-pink-500 flex items-center justify-center text-white shadow-md shrink-0">
                    <Heart className="w-5 h-5 fill-current" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[var(--eye-text-primary)] text-base font-bold leading-tight">在一起的时间</p>
                    <p className="text-[var(--eye-text-secondary)] text-xs mt-1 truncate">记录关系开始日期</p>
                  </div>
                </div>
                <button
                  onClick={onEditDate}
                  className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-primary transition-colors shrink-0"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between gap-2 bg-[var(--eye-bg-primary)]/50 rounded-xl p-3 border border-[var(--eye-border)]">
                <span className="text-[var(--eye-text-secondary)] text-sm">开始日期</span>
                <span className="text-[var(--eye-text-primary)] font-mono font-bold">{togetherDate}</span>
              </div>
            </div>
          </div>

          <div className="w-full mb-4">
            <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-sage/5 to-primary/5 p-4 border border-primary/15 shadow-sm">
              <div className="flex items-center justify-between mb-3 gap-3">
                <p className="text-[var(--eye-text-primary)] text-base font-bold leading-tight">邀请码绑定状态</p>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                    isConnected ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {isConnected ? '已绑定' : '未绑定'}
                </span>
              </div>
              <div className="space-y-2">
                <div className="bg-white/50 dark:bg-black/20 rounded-xl p-3 border border-[var(--eye-border)]">
                  <p className="text-[var(--eye-text-secondary)] text-xs mb-1">我的邀请码（唯一）</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[var(--eye-text-primary)] font-mono font-bold tracking-[0.14em] text-base break-all pr-2">
                      {effectiveInviteCode || '生成中'}
                    </p>
                    <button
                      onClick={handleCopyCode}
                      disabled={!effectiveInviteCode}
                      className="flex items-center justify-center size-9 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all active:scale-95 disabled:opacity-50 shrink-0"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="bg-white/50 dark:bg-black/20 rounded-xl p-3 border border-[var(--eye-border)]">
                  <p className="text-[var(--eye-text-secondary)] text-xs mb-1">我绑定的邀请码（对方）</p>
                  <p className="text-[var(--eye-text-primary)] font-mono font-bold tracking-[0.14em] text-base break-all">
                    {boundInviteCode || '暂无'}
                  </p>
                </div>
                <button
                  onClick={onManageConnection}
                  className="w-full h-11 rounded-xl bg-primary text-white font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all hover:bg-[#7a8a4b] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <Link2 className="w-4 h-4" />
                  {isConnected ? '管理绑定关系' : '去绑定邀请码'}
                </button>
                {!inviteCodeReady && (
                  <p className="text-[11px] text-[var(--eye-text-secondary)]">
                    邀请码仍在同步中，不影响应用使用；可先继续浏览，稍后再绑定。
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="w-full grid grid-cols-2 gap-3 mb-4 items-stretch">
            <SettingsCard
              icon={<Bell className="w-5 h-5" />}
              gradient="from-orange-400 to-orange-500"
              title="通知提醒"
              subtitle={unreadCount > 0 ? `${unreadCount} 条未读消息` : '暂无新消息'}
              dot={unreadCount > 0}
              onClick={handleNotificationClick}
            />

            <div className={`relative transition-all duration-300 ease-in-out ${showMore ? 'col-span-2' : ''}`}>
              {!showMore ? (
                <button
                  onClick={() => setShowMore(true)}
                  className="w-full min-h-[126px] rounded-2xl bg-[var(--eye-bg-secondary)] p-4 text-left shadow-sm border border-[var(--eye-border)] transition-all hover:-translate-y-0.5 hover:shadow-soft active:scale-[0.99] flex flex-col"
                >
                  <div className="mb-3 size-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white shadow-md shrink-0">
                    <Grid className="w-5 h-5" />
                  </div>
                  <p className="text-[var(--eye-text-primary)] text-base font-bold leading-tight break-words">
                    更多功能
                  </p>
                  <p className="text-[var(--eye-text-secondary)] text-xs mt-1 leading-tight truncate">
                    探索无限可能
                  </p>
                </button>
              ) : (
                <div className="rounded-2xl bg-[var(--eye-bg-secondary)] p-3 shadow-sm border border-[var(--eye-border)] animate-fade-in-up">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <span className="text-[var(--eye-text-primary)] text-sm font-bold">更多功能</span>
                    <button
                      onClick={() => setShowMore(false)}
                      className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                    >
                      <X className="w-4 h-4 text-[var(--eye-text-secondary)]" />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleOpenPeriodTracker}
                      className="rounded-2xl p-4 text-left border border-rose-200/60 dark:border-rose-500/20 bg-gradient-to-br from-pink-50 to-rose-50 dark:from-rose-900/30 dark:to-pink-900/20 transition-all hover:-translate-y-0.5 hover:shadow-soft min-h-[126px] flex flex-col disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <div className="mb-3 size-11 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 text-white flex items-center justify-center shadow-md shrink-0">
                        <Heart className="w-5 h-5" />
                      </div>
                      <p className="text-[var(--eye-text-primary)] text-base font-bold leading-tight">经期 & 情绪</p>
                      <p className="text-[var(--eye-text-secondary)] text-xs mt-1 leading-tight">同步身体状态</p>
                    </button>

                    <button
                      onClick={() => setShowPixelAvatar(true)}
                      className="relative rounded-2xl p-4 text-left border border-amber-200/70 dark:border-amber-500/25 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/20 transition-all hover:-translate-y-0.5 hover:shadow-soft min-h-[126px] flex flex-col overflow-hidden"
                    >
                      <div className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full bg-amber-300/30 blur-xl pointer-events-none" />
                      <span className="absolute top-3 right-3 rounded-full bg-amber-500/90 text-white text-[10px] px-2 py-0.5 font-semibold tracking-wide shadow">特典</span>
                      <div className="mb-3 size-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md shrink-0 ring-1 ring-white/40">
                        <PixelLanPreviewIcon />
                      </div>
                      <p className="text-[var(--eye-text-primary)] text-base font-bold leading-tight">像素小兰</p>
                      <p className="text-[var(--eye-text-secondary)] text-xs mt-1 leading-tight">可滑动查看形象</p>
                    </button>

                    <button
                      onClick={() => setShowAnimatedAvatar(true)}
                      className="relative rounded-2xl p-4 text-left border border-cyan-200/70 dark:border-cyan-500/25 bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-900/30 dark:to-teal-900/20 transition-all hover:-translate-y-0.5 hover:shadow-soft min-h-[126px] flex flex-col overflow-hidden"
                    >
                      <div className="absolute -right-8 -bottom-8 w-24 h-24 rounded-full bg-cyan-300/30 blur-xl pointer-events-none" />
                      <span className="absolute top-3 right-3 rounded-full bg-cyan-500/90 text-white text-[10px] px-2 py-0.5 font-semibold tracking-wide shadow">新功能</span>
                      <div className="mb-3 size-11 rounded-2xl bg-gradient-to-br from-cyan-500 to-teal-500 text-white flex items-center justify-center shadow-md shrink-0 ring-1 ring-white/40">
                        <AnimatedLanPreviewIcon />
                      </div>
                      <p className="text-[var(--eye-text-primary)] text-base font-bold leading-tight">动画小兰</p>
                      <p className="text-[var(--eye-text-secondary)] text-xs mt-1 leading-tight">五个形象卡通版</p>
                    </button>

                    <button
                      onClick={handleFeedbackClick}
                      className="rounded-2xl p-4 text-left border border-[var(--eye-border)] bg-[var(--eye-bg-primary)]/40 transition-all hover:-translate-y-0.5 hover:shadow-soft min-h-[126px] flex flex-col"
                    >
                      <div className="mb-3 size-11 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 text-white flex items-center justify-center shadow-md shrink-0">
                        <HelpCircle className="w-5 h-5" />
                      </div>
                      <p className="text-[var(--eye-text-primary)] text-base font-bold leading-tight">帮助反馈</p>
                      <p className="text-[var(--eye-text-secondary)] text-xs mt-1 leading-tight">联系我们</p>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {!showMore && (
              <SettingsCard
                icon={<HelpCircle className="w-5 h-5" />}
                gradient="from-violet-500 to-purple-500"
                title="帮助反馈"
                subtitle="联系我们"
                onClick={handleFeedbackClick}
              />
            )}
          </div>
        </div>
      </main>

      {showNotifications && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm h-[80vh] sm:h-auto sm:max-h-[600px] bg-[var(--eye-bg-primary)] rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl transform transition-transform animate-slide-up flex flex-col">
            <div className="flex items-center justify-between mb-6 shrink-0">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-bold text-[var(--eye-text-primary)]">消息中心</h3>
                {unreadCount > 0 && (
                  <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{unreadCount}</span>
                )}
                {pendingBindingRequests.length > 0 && (
                  <span className="bg-blue-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">
                    待确认 {pendingBindingRequests.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void handleMarkAllRead()}
                  disabled={markAllReadBusy || unreadCount === 0}
                  className="h-8 px-2.5 rounded-lg text-[11px] sm:text-xs text-[var(--eye-text-secondary)] hover:text-primary hover:bg-primary/10 transition-colors flex items-center gap-1 disabled:opacity-45 disabled:cursor-not-allowed"
                  title="一键标记已读"
                  aria-label="一键标记所有消息为已读"
                >
                  <BrushCleaning className="w-3.5 h-3.5" />
                  已读
                </button>
                <button
                  onClick={clearNotifications}
                  className="h-8 px-2.5 rounded-lg text-[11px] sm:text-xs text-[var(--eye-text-secondary)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  清空
                </button>
                <button
                  onClick={() => setShowNotifications(false)}
                  className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                >
                  <X className="w-5 h-5 text-[var(--eye-text-secondary)]" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-gray-200 hide-scrollbar">
              {pendingBindingRequests.length === 0 && notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-[var(--eye-text-secondary)] opacity-60">
                  <Bell className="w-12 h-12 mb-3 stroke-1" />
                  <p className="text-sm">暂无新消息</p>
                </div>
              ) : (
                <>
                  {pendingBindingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="p-4 rounded-2xl border bg-blue-50/70 dark:bg-blue-900/10 border-blue-200/60"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="p-1.5 rounded-full shrink-0 bg-blue-100 text-blue-500">
                            <Link2 className="w-3 h-3" />
                          </div>
                          <span className="text-sm font-bold text-[var(--eye-text-primary)] truncate">
                            绑定请求待确认
                          </span>
                        </div>
                        <span className="text-[10px] text-[var(--eye-text-secondary)] whitespace-nowrap ml-2">
                          {formatNotificationDateTime(request.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--eye-text-secondary)] leading-relaxed">
                        <span className="font-medium text-[var(--eye-text-primary)]">
                          {request.requester.name || request.requester.email}
                        </span>{' '}
                        想与你绑定，邀请码：{request.inviteCode}
                      </p>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => handleBindingRequestAction(request.id, 'reject')}
                          disabled={Boolean(bindingActionBusyId)}
                          className="h-9 rounded-xl border border-red-200 bg-red-50 text-red-500 text-sm font-semibold hover:bg-red-100 transition-colors disabled:opacity-50"
                        >
                          拒绝
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBindingRequestAction(request.id, 'accept')}
                          disabled={Boolean(bindingActionBusyId)}
                          className="h-9 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-[#7a8a4b] transition-colors disabled:opacity-50"
                        >
                          同意
                        </button>
                      </div>
                    </div>
                  ))}

                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      onClick={() => markAsRead(notification.id)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] ${
                        notification.read
                          ? 'bg-[var(--eye-bg-secondary)] border-transparent opacity-70'
                          : 'bg-white dark:bg-white/5 border-primary/20 shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            className={`p-1.5 rounded-full shrink-0 ${
                              notification.type === 'system'
                                ? 'bg-blue-100 text-blue-500'
                                : 'bg-pink-100 text-pink-500'
                            }`}
                          >
                            <Shield className="w-3 h-3" />
                          </div>
                          <span className="text-sm font-bold text-[var(--eye-text-primary)] truncate">
                            {notification.title}
                          </span>
                        </div>
                        <span className="text-[10px] text-[var(--eye-text-secondary)] whitespace-nowrap ml-2">
                          {formatNotificationDateTime(notification.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--eye-text-secondary)] leading-relaxed line-clamp-3">
                        {notification.message}
                      </p>
                      {!notification.read && (
                        <div className="mt-2 flex justify-end">
                          <span className="text-[10px] text-primary font-medium">点击标记已读</span>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <Modal isOpen={isDateModalOpen} onClose={() => setIsDateModalOpen(false)} title="设置开始日期">
        <form onSubmit={saveDate} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-sage mb-2">选择你们在一起的那一天</label>
            <input
              type="date"
              value={tempDate}
              onChange={(e) => setTempDate(e.target.value)}
              required
              className="w-full rounded-xl bg-gray-50 dark:bg-white/5 border-none p-3 text-text-main dark:text-white focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <p className="text-xs text-sage dark:text-gray-400">
            我们会从这一天开始计算你们在一起的时光。
          </p>
          <button
            type="submit"
            className="w-full bg-primary text-white font-bold h-12 rounded-xl shadow-lg shadow-primary/30 active:scale-[0.98] transition-all"
          >
            保存设置
          </button>
        </form>
      </Modal>

      <PeriodTracker isOpen={showPeriodTracker} onClose={() => setShowPeriodTracker(false)} />
      <PixelAvatarShowcase isOpen={showPixelAvatar} onClose={() => setShowPixelAvatar(false)} />
      <AnimatedAvatarShowcase isOpen={showAnimatedAvatar} onClose={() => setShowAnimatedAvatar(false)} />

      {/* Feedback Modal */}
      {showFeedback && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowFeedback(false)}
        >
          <div
            className="relative bg-[var(--eye-bg-primary)] rounded-3xl p-6 pb-8 shadow-2xl max-w-sm w-full mx-4 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={() => setShowFeedback(false)}
              aria-label="关闭"
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors z-10"
            >
              <X className="w-5 h-5 text-[var(--eye-text-secondary)]" />
            </button>

            {/* Header */}
            <div className="flex flex-col items-center mb-5">
              <div className="size-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-500 text-white flex items-center justify-center shadow-lg mb-3">
                <MessageSquare className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-[var(--eye-text-primary)]">帮助与反馈</h3>
              <p className="text-xs text-[var(--eye-text-secondary)] mt-1">我们会认真对待每一条反馈</p>
            </div>

            {/* Email display */}
            <div className="flex items-center gap-3 p-3 rounded-2xl bg-[var(--eye-bg-secondary)] border border-[var(--eye-border)] mb-4">
              <div className="size-9 rounded-xl bg-gradient-to-br from-blue-400 to-cyan-400 text-white flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-[var(--eye-text-secondary)]">开发者邮箱</p>
                <p className="text-sm font-semibold text-[var(--eye-text-primary)] truncate">2305427577@qq.com</p>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText('2305427577@qq.com');
                  showToast('邮箱已复制', 'success');
                }}
                className="p-2 rounded-xl hover:bg-black/5 dark:hover:bg-white/10 transition-colors shrink-0"
              >
                <Copy className="w-4 h-4 text-[var(--eye-text-secondary)]" />
              </button>
            </div>

            {/* Feedback textarea */}
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder="请描述你遇到的问题或建议..."
              rows={4}
              className="w-full rounded-2xl border border-[var(--eye-border)] bg-[var(--eye-bg-secondary)] p-3 text-sm text-[var(--eye-text-primary)] placeholder:text-[var(--eye-text-secondary)]/50 resize-none focus:outline-none focus:ring-2 focus:ring-violet-400/50 transition-all"
            />

            {/* Send button */}
            <button
              onClick={handleSendFeedback}
              className="w-full mt-4 h-11 rounded-xl bg-gradient-to-r from-violet-500 to-purple-500 text-white font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-all hover:opacity-90 shadow-md"
            >
              <Send className="w-4 h-4" />
              发送反馈邮件
            </button>

            {/* Direct mailto link */}
            <a
              href="mailto:2305427577@qq.com?subject=%E3%80%90Gifts%E5%BA%94%E7%94%A8%E5%8F%8D%E9%A6%88%E3%80%91"
              className="block text-center text-xs text-violet-500 mt-3 hover:underline"
            >
              或直接打开邮箱客户端发送
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

