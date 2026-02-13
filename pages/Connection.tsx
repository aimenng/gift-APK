import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  Copy,
  Link2,
  Loader2,
  LogOut,
  Mail,
  Shield,
  Unlink2,
} from 'lucide-react';
import { useApp } from '../context';
import { useAuth } from '../authContext';
import { IMAGES } from '../constants';
import { useToast } from '../components/Toast';
import { CuteLoadingScreen } from '../components/CuteLoadingScreen';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface ConnectionProps {
  onComplete: () => void;
  onLogin: () => void;
  onBack: () => void;
}

export const ConnectionPage: React.FC<ConnectionProps> = ({ onComplete, onLogin, onBack }) => {
  const {
    connect,
    disconnect,
    inviteCode: appInviteCode,
    boundInviteCode,
    isConnected,
    pendingBindingRequests,
    refreshPendingBindingRequests,
    respondBindingRequest,
  } = useApp();
  const { currentUser, partner, logout } = useAuth();
  const { showToast } = useToast();

  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [error, setError] = useState('');
  const [expandedManage, setExpandedManage] = useState(!isConnected);
  const [busyAction, setBusyAction] = useState<
    'connect' | 'disconnect' | 'logout' | 'accept' | 'reject' | null
  >(null);
  const [showSlowLoader, setShowSlowLoader] = useState(false);
  const [loadingText, setLoadingText] = useState('正在处理中...');
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const normalizeInviteCodeInput = (value: string) =>
    value
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/_/g, '-')
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, 24);

  const displayInviteCode = currentUser?.invitationCode || appInviteCode;
  const inviteCodeReady = !currentUser || Boolean(displayInviteCode);
  const normalizedInviteCodeInput = normalizeInviteCodeInput(inviteCodeInput);

  useEffect(() => {
    if (!currentUser) return;
    refreshPendingBindingRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  useEffect(() => {
    if (!busyAction) {
      setShowSlowLoader(false);
      return;
    }
    const timer = window.setTimeout(() => setShowSlowLoader(true), 320);
    return () => window.clearTimeout(timer);
  }, [busyAction]);

  const connectionStatusText = useMemo(() => {
    if (currentUser && !displayInviteCode) return '账号初始化中，邀请码将自动生成';
    if (partner && isConnected) return `已与 ${partner.name || '对方'} 连接`;
    if (currentUser) return '尚未绑定，随时可连接';
    return '登录后可绑定邀请码';
  }, [currentUser, displayInviteCode, isConnected, partner]);

  const handleJoin = async () => {
    if (!currentUser) {
      setError('请先登录账号后再绑定邀请码');
      return;
    }
    if (busyAction) return;
    if (isConnected) {
      setError('请先解除当前绑定，再绑定新的邀请码');
      return;
    }

    setError('');
    setLoadingText('正在发送绑定请求...');
    setBusyAction('connect');

    try {
      const result = await connect(normalizedInviteCodeInput);
      if (result.ok) {
        showToast(result.message || '绑定请求已发送', 'success');
        if (!result.pending) {
          onComplete();
        } else {
          setInviteCodeInput('');
        }
      } else {
        setError(result.message || '邀请码格式不正确');
      }
    } finally {
      setBusyAction(null);
    }
  };

  const requestDisconnect = () => {
    if (!isConnected) return;
    setShowDisconnectConfirm(true);
  };

  const handleDisconnect = async () => {
    if (!isConnected) return;
    if (busyAction) return;
    setShowDisconnectConfirm(false);

    setLoadingText('正在解除绑定...');
    setBusyAction('disconnect');
    try {
      await disconnect();
      setExpandedManage(true);
      setError('');
      setInviteCodeInput('');
      showToast('已解除绑定，现在可以绑定新的邀请码', 'success');
    } catch (error: any) {
      setError(error?.message || '解绑失败，请稍后重试');
    } finally {
      setBusyAction(null);
    }
  };
  const handleLogout = async () => {
    if (busyAction) return;
    setLoadingText('正在退出登录...');
    setBusyAction('logout');
    try {
      await logout();
      showToast('已退出登录', 'success');
    } finally {
      setBusyAction(null);
    }
  };

  const handleRespondBindingRequest = async (requestId: string, action: 'accept' | 'reject') => {
    if (busyAction) return;
    setError('');
    setLoadingText(action === 'accept' ? '正在确认绑定...' : '正在拒绝请求...');
    setBusyAction(action);
    try {
      const result = await respondBindingRequest(requestId, action);
      if (!result.ok) {
        setError(result.message || '处理失败，请稍后重试');
        return;
      }
      showToast(result.message || (action === 'accept' ? '已同意绑定请求' : '已拒绝绑定请求'), 'success');
      if (action === 'accept') {
        onComplete();
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleCopyInviteCode = () => {
    if (!displayInviteCode) {
      showToast('邀请码仍在生成中，请稍后重试', 'error');
      return;
    }
    navigator.clipboard.writeText(displayInviteCode);
    showToast('邀请码已复制', 'love');
  };

  return (
    <div className="flex flex-col h-full w-full px-4 pt-safe-top pb-6 animate-fade-in-up overflow-y-auto hide-scrollbar relative">
      <div className="absolute top-12 -right-16 w-44 h-44 rounded-full bg-primary/8 blur-3xl pointer-events-none" />
      <div className="absolute bottom-16 -left-16 w-40 h-40 rounded-full bg-rose-400/8 blur-3xl pointer-events-none" />

      <header className="relative z-10 flex items-center justify-between py-3">
        <button
          onClick={onBack}
          className="size-10 rounded-xl bg-[var(--eye-bg-secondary)] border border-[var(--eye-border)] text-[var(--eye-text-primary)] flex items-center justify-center hover:border-primary/30 transition-all"
          title="返回"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="text-center">
          <h1 className="text-[18px] font-bold text-[var(--eye-text-primary)]">关系绑定</h1>
          <p className="text-xs text-[var(--eye-text-secondary)] mt-0.5">{connectionStatusText}</p>
        </div>

        <button
          onClick={onLogin}
          className="h-10 px-3 rounded-xl bg-[var(--eye-bg-secondary)] border border-[var(--eye-border)] text-[var(--eye-text-secondary)] text-xs font-medium hover:text-primary hover:border-primary/30 transition-all"
          title="账号设置"
        >
          账号
        </button>
      </header>

      <section className="relative z-10 rounded-2xl border border-[var(--eye-border)] bg-[var(--eye-bg-secondary)]/70 p-3 mt-2">
        {currentUser ? (
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full border-2 border-white shadow-sm bg-stone-200 overflow-hidden relative shrink-0">
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url('${currentUser.avatar || IMAGES.COFFEE}')` }}
              />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[var(--eye-text-primary)] font-bold text-sm truncate">
                {currentUser.name || currentUser.email.split('@')[0]}
              </p>
              <p className="text-[var(--eye-text-secondary)] text-xs truncate">{currentUser.email}</p>
            </div>

            <button
              onClick={handleLogout}
              disabled={Boolean(busyAction)}
              className="size-9 rounded-xl bg-white/80 dark:bg-white/10 text-sage hover:text-red-500 transition-all flex items-center justify-center border border-[var(--eye-border)]"
              title="退出登录"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[var(--eye-text-primary)] font-bold text-sm">登录后开启关系绑定</p>
              <p className="text-[var(--eye-text-secondary)] text-xs">支持邮箱验证码注册、登录与重置密码</p>
            </div>
            <button
              onClick={onLogin}
              className="h-9 px-3 rounded-xl bg-primary text-white text-xs font-bold hover:bg-[#7a8a4b] transition-all"
            >
              登录
            </button>
          </div>
        )}
      </section>

      <section className="relative z-10 rounded-2xl border border-[var(--eye-border)] bg-white/70 dark:bg-black/20 p-4 mt-3">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[var(--eye-text-primary)] font-bold text-base">邀请码状态</p>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              isConnected ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {isConnected ? '已绑定' : '未绑定'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-[var(--eye-border)] bg-[var(--eye-bg-primary)]/70 p-3">
            <p className="text-[11px] text-[var(--eye-text-secondary)] mb-1">我的邀请码</p>
            <p className="font-mono font-bold text-[var(--eye-text-primary)] tracking-[0.16em] text-sm">
              {displayInviteCode || '生成中...'}
            </p>
          </div>
          <div className="rounded-xl border border-[var(--eye-border)] bg-[var(--eye-bg-primary)]/70 p-3">
            <p className="text-[11px] text-[var(--eye-text-secondary)] mb-1">已绑定邀请码</p>
            <p className="font-mono font-bold text-[var(--eye-text-primary)] tracking-[0.16em] text-sm">
              {boundInviteCode || '暂无'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <button
            onClick={handleCopyInviteCode}
            disabled={!displayInviteCode}
            className="h-10 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-[#7a8a4b] transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Copy className="w-4 h-4" />
            复制邀请码
          </button>
          <button
            onClick={requestDisconnect}
            disabled={!isConnected}
            className="h-10 rounded-xl border border-red-200 bg-red-50 text-red-500 font-semibold text-sm hover:bg-red-100 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Unlink2 className="w-4 h-4" />
            解除绑定
          </button>
        </div>
      </section>

      {currentUser && pendingBindingRequests.length > 0 && (
        <section className="relative z-10 rounded-2xl border border-[var(--eye-border)] bg-white/70 dark:bg-black/20 p-4 mt-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[var(--eye-text-primary)] font-bold text-base">待你确认的绑定请求</p>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
              {pendingBindingRequests.length}
            </span>
          </div>

          {pendingBindingRequests.map((request) => (
            <div
              key={request.id}
              className="rounded-xl border border-[var(--eye-border)] bg-[var(--eye-bg-primary)]/70 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[var(--eye-text-primary)] truncate">
                    {request.requester.name || request.requester.email}
                  </p>
                  <p className="text-xs text-[var(--eye-text-secondary)] truncate">{request.requester.email}</p>
                </div>
                <span className="text-[10px] text-[var(--eye-text-secondary)] whitespace-nowrap">
                  {new Date(request.createdAt).toLocaleString()}
                </span>
              </div>

              <div className="mt-2 text-xs text-[var(--eye-text-secondary)]">
                对方输入的邀请码：<span className="font-mono tracking-[0.15em]">{request.inviteCode}</span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleRespondBindingRequest(request.id, 'reject')}
                  disabled={Boolean(busyAction)}
                  className="h-10 rounded-xl border border-red-200 bg-red-50 text-red-500 font-semibold text-sm hover:bg-red-100 transition-all disabled:opacity-50"
                >
                  拒绝
                </button>
                <button
                  type="button"
                  onClick={() => handleRespondBindingRequest(request.id, 'accept')}
                  disabled={Boolean(busyAction)}
                  className="h-10 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-[#7a8a4b] transition-all disabled:opacity-50"
                >
                  同意绑定
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="relative z-10 mt-3">
        <button
          onClick={() => setExpandedManage((x) => !x)}
          className="w-full h-11 rounded-xl border border-[var(--eye-border)] bg-[var(--eye-bg-secondary)] text-[var(--eye-text-primary)] font-medium flex items-center justify-center gap-2"
        >
          <Link2 className="w-4 h-4 text-primary" />
          {expandedManage ? '收起更换绑定面板' : '展开更换绑定面板'}
          <ChevronDown className={`w-4 h-4 transition-transform ${expandedManage ? 'rotate-180' : ''}`} />
        </button>

        {expandedManage && (
          <div className="rounded-2xl border border-[var(--eye-border)] bg-white/70 dark:bg-black/20 p-4 mt-2">
            <div className="flex items-start gap-3 mb-3">
              <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[var(--eye-text-primary)] font-bold">绑定新的邀请码</p>
                <p className="text-[var(--eye-text-secondary)] text-xs mt-0.5">
                  输入对方邀请码后，会在对方应用的消息中心显示确认请求
                </p>
              </div>
            </div>

            {isConnected && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs p-3 mb-3">
                你当前已绑定，请先点击上方“解除绑定”，再绑定下一个邀请码。
              </div>
            )}

            {!inviteCodeReady && currentUser && (
              <div className="rounded-xl bg-blue-50 border border-blue-200 text-blue-700 text-xs p-3 mb-3">
                账号信息仍在同步中，你仍可直接发起绑定请求；邀请码将自动补齐。
              </div>
            )}

            <div className="relative">
              <input
                className={`w-full h-12 rounded-xl bg-[var(--eye-bg-primary)] border-2 ${
                  error ? 'border-red-500' : 'border-transparent'
                } focus:border-primary focus:ring-0 text-[var(--eye-text-primary)] text-center font-mono placeholder:font-sans transition-all placeholder:text-sage/40`}
                placeholder={isConnected ? '请先解除绑定' : '输入邀请码'}
                type="text"
                value={inviteCodeInput}
                disabled={isConnected || Boolean(busyAction)}
                onChange={(e) => {
                  setInviteCodeInput(normalizeInviteCodeInput(e.target.value));
                  setError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !busyAction) handleJoin();
                }}
              />

              <button
                onClick={handleJoin}
                className="absolute right-2 top-2 bottom-2 aspect-square rounded-lg bg-white dark:bg-[#344026] text-sage hover:text-primary hover:bg-primary/10 active:bg-primary active:text-white transition-all duration-200 flex items-center justify-center shadow-sm disabled:opacity-50"
                disabled={!normalizedInviteCodeInput || isConnected || Boolean(busyAction)}
                title="发送请求"
              >
                {busyAction === 'connect' ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <ArrowRight className="w-5 h-5" />
                )}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 mt-2 text-red-500 text-sm">
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}

            {!currentUser && (
              <button
                onClick={onLogin}
                className="w-full h-11 mt-3 rounded-xl bg-primary text-white font-semibold hover:bg-[#7a8a4b] transition-all"
              >
                先去登录账号
              </button>
            )}
          </div>
        )}
      </section>

      {!partner && (
        <section className="relative z-10 mt-3">
          <button
            onClick={onComplete}
            className="w-full h-11 rounded-xl border border-[var(--eye-border)] bg-[var(--eye-bg-secondary)] text-[var(--eye-text-secondary)] font-medium hover:border-primary/30 hover:text-primary transition-all"
          >
            暂不绑定，先进入应用
          </button>
        </section>
      )}

      <ConfirmDialog
        isOpen={showDisconnectConfirm}
        title="确认解除当前绑定关系吗？"
        description="解绑后你们将停止关系同步，后续可以重新绑定。"
        confirmText="确认解绑"
        cancelText="先不解绑"
        confirmTone="danger"
        loading={busyAction === 'disconnect'}
        onCancel={() => setShowDisconnectConfirm(false)}
        onConfirm={handleDisconnect}
      />
      <CuteLoadingScreen show={showSlowLoader} text={loadingText} />
    </div>
  );
};

