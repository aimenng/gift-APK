import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Lock,
  LogIn,
  LogOut,
  Mail,
  RefreshCw,
  Shield,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../authContext';
import { CuteLoadingScreen } from '../components/CuteLoadingScreen';
import { ConfirmDialog } from '../components/ConfirmDialog';

interface AuthPageProps {
  onBack: () => void;
}

type RegisterStep = 'form' | 'verify';
type ResetStep = 'none' | 'request' | 'verify';

export const AuthPage: React.FC<AuthPageProps> = ({ onBack }) => {
  const {
    currentUser,
    login,
    requestRegisterCode,
    verifyRegisterCode,
    requestPasswordResetCode,
    resetPasswordWithCode,
    logout,
    lastError,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [switchingAccount, setSwitchingAccount] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [registerStep, setRegisterStep] = useState<RegisterStep>('form');
  const [resetStep, setResetStep] = useState<ResetStep>('none');
  const [resetCode, setResetCode] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [resetResendCountdown, setResetResendCountdown] = useState(0);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegConfirmPassword, setShowRegConfirmPassword] = useState(false);
  const [showResetNewPassword, setShowResetNewPassword] = useState(false);
  const [showResetConfirmNewPassword, setShowResetConfirmNewPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showSlowLoader, setShowSlowLoader] = useState(false);
  const [loadingText, setLoadingText] = useState('正在处理中...');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = window.setTimeout(() => setResendCountdown((x) => x - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendCountdown]);

  useEffect(() => {
    if (resetResendCountdown <= 0) return;
    const timer = window.setTimeout(() => setResetResendCountdown((x) => x - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resetResendCountdown]);

  useEffect(() => {
    if (lastError) setError(lastError);
  }, [lastError]);

  useEffect(() => {
    if (!submitting) {
      setShowSlowLoader(false);
      return;
    }
    const timer = window.setTimeout(() => setShowSlowLoader(true), 380);
    return () => window.clearTimeout(timer);
  }, [submitting]);

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setVerificationCode('');
    setRegisterStep('form');
    setResetStep('none');
    setResetCode('');
    setResetPassword('');
    setResetConfirmPassword('');
    setResendCountdown(0);
    setResetResendCountdown(0);
    setError('');
    setSuccess('');
    setSubmitting(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password) {
      setError('请输入邮箱和密码');
      return;
    }

    setLoadingText('正在登录并同步数据...');
    setSubmitting(true);
    try {
      const ok = await login(email, password);
      if (!ok) {
        setError('邮箱或密码错误，或邮箱尚未验证');
        return;
      }
      setSuccess('登录成功，正在同步数据...');
      setSwitchingAccount(false);
      setTimeout(() => onBack(), 400);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email || !password || !confirmPassword) {
      setError('请填写完整信息');
      return;
    }
    if (password.length < 6) {
      setError('密码至少 6 位');
      return;
    }
    if (password !== confirmPassword) {
      setError('两次输入的密码不一致');
      return;
    }

    setLoadingText('正在发送验证码...');
    setSubmitting(true);
    try {
      const result = await requestRegisterCode(email, password);
      if (!result.ok) {
        setError(result.message || '验证码发送失败');
        return;
      }
      setRegisterStep('verify');
      setSuccess(result.message || '验证码已发送');
      setResendCountdown(60);
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!verificationCode || verificationCode.length !== 6) {
      setError('请输入 6 位验证码');
      return;
    }

    setLoadingText('正在验证注册信息...');
    setSubmitting(true);
    try {
      const ok = await verifyRegisterCode(email, verificationCode, password);
      if (!ok) {
        setError('验证码错误或已过期，请重试');
        return;
      }
      setSuccess('注册完成，已自动登录');
      setSwitchingAccount(false);
      setTimeout(() => onBack(), 400);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendCode = async () => {
    if (resendCountdown > 0 || submitting) return;
    setError('');
    setSuccess('');
    setLoadingText('正在重新发送验证码...');
    setSubmitting(true);
    try {
      const result = await requestRegisterCode(email, password);
      if (!result.ok) {
        setError(result.message || '发送失败');
        return;
      }
      setSuccess('验证码已重新发送');
      setResendCountdown(60);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRequestResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email) {
      setError('请输入邮箱地址');
      return;
    }

    setLoadingText('正在发送重置验证码...');
    setSubmitting(true);
    try {
      const result = await requestPasswordResetCode(email);
      if (!result.ok) {
        setError(result.message || '发送失败');
        return;
      }
      setResetStep('verify');
      setResetResendCountdown(60);
      setSuccess(result.message || '验证码已发送');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!resetCode || resetCode.length !== 6) {
      setError('请输入 6 位验证码');
      return;
    }
    if (resetPassword.length < 6) {
      setError('新密码至少 6 位');
      return;
    }
    if (resetPassword !== resetConfirmPassword) {
      setError('两次输入的新密码不一致');
      return;
    }

    setLoadingText('正在重置密码...');
    setSubmitting(true);
    try {
      const ok = await resetPasswordWithCode(email, resetCode, resetPassword);
      if (!ok) {
        setError('重置失败，请检查验证码后重试');
        return;
      }

      setSuccess('密码已重置，请使用新密码登录');
      setPassword(resetPassword);
      setResetStep('none');
      setResetCode('');
      setResetPassword('');
      setResetConfirmPassword('');
      setResetResendCountdown(0);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendResetCode = async () => {
    if (resetResendCountdown > 0 || submitting) return;
    setError('');
    setSuccess('');
    setLoadingText('正在重新发送重置验证码...');
    setSubmitting(true);
    try {
      const result = await requestPasswordResetCode(email);
      if (!result.ok) {
        setError(result.message || '发送失败');
        return;
      }
      setSuccess('验证码已重新发送');
      setResetResendCountdown(60);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    setShowLogoutConfirm(false);
    await logout();
    resetForm();
  };

  const handleSwitchAccount = async () => {
    await logout();
    resetForm();
    setActiveTab('login');
    setShowForm(true);
    setSwitchingAccount(true);
  };

  if (currentUser && !switchingAccount) {
    return (
      <div className="flex flex-col h-full w-full bg-[var(--eye-bg-primary)] px-4 pt-safe-top animate-fade-in-up overflow-y-auto hide-scrollbar">
        <div className="flex items-center gap-4 py-4 mb-4">
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-[var(--eye-bg-secondary)] transition-colors text-[var(--eye-text-primary)]"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-xl font-bold text-[var(--eye-text-primary)]">账号与安全</h1>
        </div>

        <div className="flex flex-col items-center mb-8">
          <div className="size-20 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
            <Shield className="w-10 h-10" />
          </div>
          <h2 className="text-xl font-bold text-[var(--eye-text-primary)]">已登录</h2>
          <p className="text-[var(--eye-text-secondary)] mt-1">{currentUser.email}</p>
        </div>

        <div className="w-full space-y-4 pb-12">
          <div className="bg-[var(--eye-bg-secondary)] rounded-2xl p-4 border border-[var(--eye-border)]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-[var(--eye-text-secondary)]">我的邀请码</span>
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">唯一</span>
            </div>
            <p className="text-lg font-mono font-bold tracking-widest text-[var(--eye-text-primary)]">
              {currentUser.invitationCode || '生成中'}
            </p>
          </div>

          <div className="bg-[var(--eye-bg-secondary)] rounded-2xl p-4 border border-[var(--eye-border)]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-[var(--eye-text-secondary)]">已绑定的邀请码</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  currentUser.boundInvitationCode ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {currentUser.boundInvitationCode ? '已绑定' : '未绑定'}
              </span>
            </div>
            <p className="text-lg font-mono font-bold tracking-widest text-[var(--eye-text-primary)]">
              {currentUser.boundInvitationCode || '暂无'}
            </p>
          </div>

          <div className="bg-[var(--eye-bg-secondary)] rounded-2xl p-4 border border-[var(--eye-border)]">
            <h3 className="text-[var(--eye-text-primary)] font-medium mb-2">账号信息</h3>
            <div className="flex justify-between items-center py-2 border-b border-[var(--eye-border)]">
              <span className="text-sm text-[var(--eye-text-secondary)]">注册时间</span>
              <span className="text-sm text-[var(--eye-text-primary)]">
                {new Date(currentUser.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-[var(--eye-text-secondary)]">安全等级</span>
              <span className="text-sm text-green-500 font-medium">高</span>
            </div>
          </div>

          <button
            onClick={onBack}
            className="w-full h-12 rounded-xl bg-primary text-white font-bold hover:bg-[#7a8a4b] transition-all flex items-center justify-center"
          >
            进入应用
          </button>

          <button
            onClick={handleSwitchAccount}
            className="w-full h-12 rounded-xl bg-[var(--eye-bg-secondary)] border border-[var(--eye-border)] text-[var(--eye-text-primary)] font-medium hover:bg-primary/5 hover:border-primary/30 transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            切换账号
          </button>

          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full h-12 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 font-bold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center justify-center gap-2"
          >
            <LogOut className="w-5 h-5" />
            退出登录
          </button>
        </div>

        <ConfirmDialog
          isOpen={showLogoutConfirm}
          title="确定要退出登录吗？"
          description="退出后仍可使用原邮箱重新登录并恢复云端数据。"
          cancelText="我再看看"
          confirmText="退出登录"
          confirmTone="danger"
          onCancel={() => setShowLogoutConfirm(false)}
          onConfirm={handleLogout}
        />
      </div>
    );
  }

  if (!showForm && !switchingAccount) {
    return (
      <div className="flex flex-col h-full w-full bg-[var(--eye-bg-primary)] px-4 pt-safe-top animate-fade-in-up overflow-y-auto hide-scrollbar">
        <div className="flex items-center gap-4 py-4">
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-[var(--eye-bg-secondary)] transition-colors text-[var(--eye-text-primary)]"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center pb-20">
          <div className="size-24 rounded-full bg-gradient-to-br from-primary/20 to-sage/10 flex items-center justify-center mb-6">
            <Shield className="w-12 h-12 text-primary" />
          </div>

          <h1 className="text-2xl font-bold text-[var(--eye-text-primary)] mb-2 text-center">登录保护你的回忆</h1>
          <p className="text-[var(--eye-text-secondary)] text-sm text-center max-w-[260px] leading-relaxed mb-10">
            登录后数据会保存到云端，换设备也不会丢失
          </p>

          <button
            onClick={() => {
              setActiveTab('login');
              setShowForm(true);
            }}
            className="w-full max-w-xs h-13 rounded-2xl bg-primary text-white font-bold text-lg shadow-lg shadow-primary/20 active:scale-[0.97] transition-all hover:bg-[#7a8a4b] flex items-center justify-center gap-2.5 mb-4"
          >
            <LogIn className="w-5 h-5" />
            立即登录
          </button>

          <button
            onClick={() => {
              setActiveTab('register');
              setShowForm(true);
              setRegisterStep('form');
            }}
            className="w-full max-w-xs h-12 rounded-2xl bg-[var(--eye-bg-secondary)] border border-[var(--eye-border)] text-[var(--eye-text-primary)] font-medium text-base active:scale-[0.97] transition-all hover:border-primary/30 flex items-center justify-center gap-2"
          >
            <UserPlus className="w-4.5 h-4.5" />
            注册新账号
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[var(--eye-bg-primary)] px-4 pt-safe-top animate-fade-in-up overflow-y-auto hide-scrollbar">
      <div className="flex items-center gap-4 py-4 mb-4">
        <button
          onClick={() => {
            if (switchingAccount) {
              setSwitchingAccount(false);
            }
            if (showForm && !switchingAccount) {
              setShowForm(false);
              resetForm();
              return;
            }
            onBack();
          }}
          className="p-2 rounded-full hover:bg-[var(--eye-bg-secondary)] transition-colors text-[var(--eye-text-primary)]"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        <div className="flex-1 flex justify-center bg-[var(--eye-bg-secondary)] p-1 rounded-xl">
          <button
            onClick={() => {
              setActiveTab('login');
              resetForm();
            }}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'login'
                ? 'bg-white dark:bg-[#344026] text-primary shadow-sm'
                : 'text-[var(--eye-text-secondary)]'
            }`}
          >
            登录
          </button>
          <button
            onClick={() => {
              setActiveTab('register');
              resetForm();
            }}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${
              activeTab === 'register'
                ? 'bg-white dark:bg-[#344026] text-primary shadow-sm'
                : 'text-[var(--eye-text-secondary)]'
            }`}
          >
            注册
          </button>
        </div>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 flex flex-col pt-4 pb-12">
        {switchingAccount && (
          <div className="flex items-center gap-2 p-3 mb-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-sm">
            <RefreshCw className="w-4 h-4 shrink-0" />
            <span>已退出原账号，请登录新账号</span>
          </div>
        )}

        <h2 className="text-2xl font-bold text-[var(--eye-text-primary)] mb-2">
          {activeTab === 'register' ? '创建账号' : '欢迎回来'}
        </h2>
        <p className="text-[var(--eye-text-secondary)] mb-8">
          {activeTab === 'register'
            ? registerStep === 'form'
              ? '先发送验证码到你的邮箱，验证后完成注册'
              : `验证码已发送到 ${email}`
            : resetStep === 'request'
              ? '输入注册邮箱，我们会发送重置验证码'
              : resetStep === 'verify'
                ? `验证码已发送到 ${email}，请设置新密码`
                : '登录以恢复你的云端数据和绑定信息'}
        </p>

        {error && (
          <div className="flex items-center gap-2 p-3 mb-6 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 p-3 mb-6 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm">
            <Check className="w-5 h-5 shrink-0" />
            {success}
          </div>
        )}

        {activeTab === 'login' ? (
          resetStep === 'none' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-[var(--eye-text-secondary)] ml-1">邮箱地址</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 w-5 h-5 text-[var(--eye-text-secondary)]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    className="w-full h-12 rounded-xl bg-[var(--eye-bg-secondary)] border-2 border-transparent focus:border-primary focus:bg-white dark:focus:bg-black/20 focus:ring-0 pl-10 text-[var(--eye-text-primary)] transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-[var(--eye-text-secondary)] ml-1">密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 w-5 h-5 text-[var(--eye-text-secondary)]" />
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="至少 6 位"
                    className="w-full h-12 rounded-xl bg-[var(--eye-bg-secondary)] border-2 border-transparent focus:border-primary focus:bg-white dark:focus:bg-black/20 focus:ring-0 pl-10 pr-10 text-[var(--eye-text-primary)] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword(!showLoginPassword)}
                    className="absolute right-3 top-3.5 text-[var(--eye-text-secondary)] hover:text-[var(--eye-text-primary)]"
                  >
                    {showLoginPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setResetStep('request');
                    setError('');
                    setSuccess('');
                  }}
                  className="text-sm text-primary hover:text-[#7a8a4b]"
                >
                  忘记密码？
                </button>
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 rounded-xl bg-primary text-white font-bold text-lg shadow-lg active:scale-[0.98] transition-all hover:bg-[#7a8a4b] disabled:opacity-60"
                >
                  {submitting ? '登录中...' : '立即登录'}
                </button>
              </div>
            </form>
          ) : resetStep === 'request' ? (
            <form onSubmit={handleRequestResetCode} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-[var(--eye-text-secondary)] ml-1">邮箱地址</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3.5 w-5 h-5 text-[var(--eye-text-secondary)]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="example@email.com"
                    className="w-full h-12 rounded-xl bg-[var(--eye-bg-secondary)] border-2 border-transparent focus:border-primary focus:bg-white dark:focus:bg-black/20 focus:ring-0 pl-10 text-[var(--eye-text-primary)] transition-all"
                  />
                </div>
              </div>

              <div className="pt-3">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 rounded-xl bg-primary text-white font-bold text-lg shadow-lg active:scale-[0.98] transition-all hover:bg-[#7a8a4b] disabled:opacity-60"
                >
                  {submitting ? '发送中...' : '发送重置验证码'}
                </button>
              </div>

              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setResetStep('none');
                    setError('');
                    setSuccess('');
                  }}
                  className="text-sm text-[var(--eye-text-secondary)] hover:text-[var(--eye-text-primary)]"
                >
                  返回登录
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-[var(--eye-text-secondary)] ml-1">邮箱验证码</label>
                <input
                  type="text"
                  maxLength={6}
                  inputMode="numeric"
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="请输入 6 位验证码"
                  className="w-full h-12 rounded-xl bg-[var(--eye-bg-secondary)] border-2 border-transparent focus:border-primary focus:bg-white dark:focus:bg-black/20 focus:ring-0 px-4 text-[var(--eye-text-primary)] tracking-[0.25em] text-center font-mono transition-all"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-[var(--eye-text-secondary)] ml-1">新密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 w-5 h-5 text-[var(--eye-text-secondary)]" />
                  <input
                    type={showResetNewPassword ? 'text' : 'password'}
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    placeholder="至少 6 位"
                    className="w-full h-12 rounded-xl bg-[var(--eye-bg-secondary)] border-2 border-transparent focus:border-primary focus:bg-white dark:focus:bg-black/20 focus:ring-0 pl-10 pr-10 text-[var(--eye-text-primary)] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetNewPassword(!showResetNewPassword)}
                    className="absolute right-3 top-3.5 text-[var(--eye-text-secondary)] hover:text-[var(--eye-text-primary)]"
                  >
                    {showResetNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-[var(--eye-text-secondary)] ml-1">确认新密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3.5 w-5 h-5 text-[var(--eye-text-secondary)]" />
                  <input
                    type={showResetConfirmNewPassword ? 'text' : 'password'}
                    value={resetConfirmPassword}
                    onChange={(e) => setResetConfirmPassword(e.target.value)}
                    placeholder="再次输入新密码"
                    className="w-full h-12 rounded-xl bg-[var(--eye-bg-secondary)] border-2 border-transparent focus:border-primary focus:bg-white dark:focus:bg-black/20 focus:ring-0 pl-10 pr-10 text-[var(--eye-text-primary)] transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetConfirmNewPassword(!showResetConfirmNewPassword)}
                    className="absolute right-3 top-3.5 text-[var(--eye-text-secondary)] hover:text-[var(--eye-text-primary)]"
                  >
                    {showResetConfirmNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={handleResendResetCode}
                  disabled={resetResendCountdown > 0 || submitting}
                  className="text-primary disabled:text-[var(--eye-text-secondary)]"
                >
                  {resetResendCountdown > 0 ? `${resetResendCountdown}s 后可重发` : '重新发送验证码'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResetStep('request');
                    setResetCode('');
                    setResetPassword('');
                    setResetConfirmPassword('');
                    setError('');
                  }}
                  className="text-[var(--eye-text-secondary)] hover:text-[var(--eye-text-primary)]"
                >
                  返回上一步
                </button>
              </div>

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-12 rounded-xl bg-primary text-white font-bold text-lg shadow-lg active:scale-[0.98] transition-all hover:bg-[#7a8a4b] disabled:opacity-60"
                >
                  {submitting ? '重置中...' : '确认重置密码'}
                </button>
              </div>
            </form>
          )
        ) : registerStep === 'form' ? (
          <form onSubmit={handleRequestCode} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--eye-text-secondary)] ml-1">邮箱地址</label>
              <div className="relative">
                <Mail className="absolute left-3 top-3.5 w-5 h-5 text-[var(--eye-text-secondary)]" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="example@email.com"
                  className="w-full h-12 rounded-xl bg-[var(--eye-bg-secondary)] border-2 border-transparent focus:border-primary focus:bg-white dark:focus:bg-black/20 focus:ring-0 pl-10 text-[var(--eye-text-primary)] transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--eye-text-secondary)] ml-1">密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 w-5 h-5 text-[var(--eye-text-secondary)]" />
                <input
                  type={showRegPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 位"
                  className="w-full h-12 rounded-xl bg-[var(--eye-bg-secondary)] border-2 border-transparent focus:border-primary focus:bg-white dark:focus:bg-black/20 focus:ring-0 pl-10 pr-10 text-[var(--eye-text-primary)] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowRegPassword(!showRegPassword)}
                  className="absolute right-3 top-3.5 text-[var(--eye-text-secondary)] hover:text-[var(--eye-text-primary)]"
                >
                  {showRegPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--eye-text-secondary)] ml-1">确认密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3.5 w-5 h-5 text-[var(--eye-text-secondary)]" />
                <input
                  type={showRegConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入密码"
                  className="w-full h-12 rounded-xl bg-[var(--eye-bg-secondary)] border-2 border-transparent focus:border-primary focus:bg-white dark:focus:bg-black/20 focus:ring-0 pl-10 pr-10 text-[var(--eye-text-primary)] transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowRegConfirmPassword(!showRegConfirmPassword)}
                  className="absolute right-3 top-3.5 text-[var(--eye-text-secondary)] hover:text-[var(--eye-text-primary)]"
                >
                  {showRegConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 rounded-xl bg-primary text-white font-bold text-lg shadow-lg active:scale-[0.98] transition-all hover:bg-[#7a8a4b] disabled:opacity-60"
              >
                {submitting ? '发送中...' : '发送验证码'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium text-[var(--eye-text-secondary)] ml-1">邮箱验证码</label>
              <input
                type="text"
                maxLength={6}
                inputMode="numeric"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="请输入 6 位验证码"
                className="w-full h-12 rounded-xl bg-[var(--eye-bg-secondary)] border-2 border-transparent focus:border-primary focus:bg-white dark:focus:bg-black/20 focus:ring-0 px-4 text-[var(--eye-text-primary)] tracking-[0.25em] text-center font-mono transition-all"
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resendCountdown > 0 || submitting}
                className="text-primary disabled:text-[var(--eye-text-secondary)]"
              >
                {resendCountdown > 0 ? `${resendCountdown}s 后可重发` : '重新发送验证码'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRegisterStep('form');
                  setVerificationCode('');
                  setError('');
                }}
                className="text-[var(--eye-text-secondary)] hover:text-[var(--eye-text-primary)]"
              >
                返回上一步
              </button>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="w-full h-12 rounded-xl bg-primary text-white font-bold text-lg shadow-lg active:scale-[0.98] transition-all hover:bg-[#7a8a4b] disabled:opacity-60"
              >
                {submitting ? '验证中...' : '验证并完成注册'}
              </button>
            </div>
          </form>
        )}
      </div>
      <CuteLoadingScreen show={showSlowLoader} text={loadingText} />
    </div>
  );
};
