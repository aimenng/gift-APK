import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { User } from './types';
import { apiDelete, apiGet, apiPatch, apiPost, ApiError } from './utils/apiClient';
import { clearAuthToken, getAuthToken, setAuthToken } from './utils/authToken';
import { cancelCloudWarmup, warmupCloudDataByPriority } from './utils/dataWarmup';
import { clearFocusStatsCache } from './utils/focusStatsCache';
import { clearFocusTimerStateCache } from './utils/focusTimerStateCache';
import { clearPeriodTrackerCache } from './utils/periodTrackerCache';
import { onSessionSync, triggerSessionSync } from './utils/sessionSync';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'system' | 'interaction';
  read: boolean;
  createdAt: string;
}

interface AuthResponse {
  token: string;
  user: User;
  partner: User | null;
}

interface CodeRequestResult {
  ok: boolean;
  message?: string;
  expiresInMinutes?: number;
}

interface AuthContextType {
  currentUser: User | null;
  partner: User | null;
  users: User[];
  refreshAuthData: () => Promise<void>;
  requestRegisterCode: (email: string, password: string) => Promise<CodeRequestResult>;
  verifyRegisterCode: (email: string, code: string, password?: string) => Promise<boolean>;
  requestPasswordResetCode: (email: string) => Promise<CodeRequestResult>;
  resetPasswordWithCode: (email: string, code: string, newPassword: string) => Promise<boolean>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isEmailTaken: (email: string) => boolean;
  updateProfile: (updates: Partial<User>) => Promise<void>;
  notifications: Notification[];
  addNotification: (
    title: string,
    message: string,
    type?: 'system' | 'interaction'
  ) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  clearNotifications: () => Promise<void>;
  unreadCount: number;
  lastError: string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [partner, setPartner] = useState<User | null>(null);
  const [allNotifications, setAllNotifications] = useState<Notification[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);
  const refreshInFlightRef = useRef<Promise<void> | null>(null);

  const notifications = useMemo(
    () =>
      allNotifications
        .filter((n) => n.userId === currentUser?.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [allNotifications, currentUser?.id]
  );

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);

  const resetAuthState = useCallback(() => {
    setCurrentUser(null);
    setPartner(null);
    setUsers([]);
    setAllNotifications([]);
    cancelCloudWarmup();
    clearFocusStatsCache();
    clearFocusTimerStateCache();
    clearPeriodTrackerCache();
  }, []);

  const refreshAuthData = useCallback(async () => {
    if (refreshInFlightRef.current) {
      return refreshInFlightRef.current;
    }

    const refreshTask = (async () => {
      const token = getAuthToken();
      if (!token) {
        resetAuthState();
        return;
      }

      try {
        const [me, notificationsResult] = await Promise.all([
          apiGet<{ user: User; partner: User | null }>('/auth/me'),
          apiGet<{ notifications: Notification[] }>('/notifications?limit=200'),
        ]);

        const nextUsers: User[] = me.partner ? [me.user, me.partner] : [me.user];
        setUsers(nextUsers);
        setCurrentUser(me.user);
        setPartner(me.partner);
        setAllNotifications(notificationsResult.notifications || []);
        setLastError(null);
        warmupCloudDataByPriority(me.user.id, me.partner?.id || null);
      } catch (error) {
        console.error('Failed to refresh auth data:', error);
        if (error instanceof ApiError && error.status === 401) {
          clearAuthToken();
          resetAuthState();
        }
      }
    })().finally(() => {
      refreshInFlightRef.current = null;
    });

    refreshInFlightRef.current = refreshTask;
    return refreshTask;
  }, [resetAuthState]);

  useEffect(() => {
    refreshAuthData();
    return onSessionSync(() => {
      refreshAuthData();
    });
  }, [refreshAuthData]);

  /**
   * Local-only check: returns true when `email` matches a user already loaded
   * into the auth state (current user or their partner).  This does NOT query
   * the backend, so it cannot detect emails registered by other accounts.
   */
  const isEmailTaken = (email: string) =>
    users.some((u) => u.email.toLowerCase() === email.toLowerCase());

  const handleAuthSuccess = useCallback(async (result: AuthResponse) => {
    setAuthToken(result.token);
    setCurrentUser(result.user);
    setPartner(result.partner);
    setUsers(result.partner ? [result.user, result.partner] : [result.user]);
    warmupCloudDataByPriority(result.user.id, result.partner?.id || null);
    triggerSessionSync();
    if (!result.user?.invitationCode) {
      await refreshAuthData();
    }
  }, [refreshAuthData]);

  const requestRegisterCode = async (email: string, password: string): Promise<CodeRequestResult> => {
    try {
      const result = await apiPost<{
        ok: boolean;
        message: string;
        expiresInMinutes: number;
      }>('/auth/register/request-code', {
        email,
        password,
      });
      setLastError(null);
      return {
        ok: result.ok,
        message: result.message,
        expiresInMinutes: result.expiresInMinutes,
      };
    } catch (error: any) {
      const message = error?.message || '发送验证码失败';
      setLastError(message);
      console.error('requestRegisterCode failed:', error);
      return { ok: false, message };
    }
  };

  const verifyRegisterCode = async (
    email: string,
    code: string,
    password?: string
  ): Promise<boolean> => {
    try {
      const result = await apiPost<AuthResponse>('/auth/register/verify', {
        email,
        code,
        password,
      });
      await handleAuthSuccess(result);
      setLastError(null);
      return true;
    } catch (error: any) {
      const isTimeout = error instanceof ApiError ? error.status === 408 : Number(error?.status) === 408;
      if (password && isTimeout) {
        // Verification may have completed server-side; poll login briefly to recover session.
        for (let i = 0; i < 3; i += 1) {
          await sleep(700 * (i + 1));
          try {
            const loginResult = await apiPost<AuthResponse>('/auth/login', { email, password });
            await handleAuthSuccess(loginResult);
            setLastError(null);
            return true;
          } catch (_ignored) {
            // continue retry
          }
        }
      }
      const message = error?.message || '验证码校验失败';
      setLastError(message);
      console.error('verifyRegisterCode failed:', error);
      return false;
    }
  };

  const requestPasswordResetCode = async (email: string): Promise<CodeRequestResult> => {
    try {
      const result = await apiPost<{
        ok: boolean;
        message: string;
        expiresInMinutes: number;
      }>('/auth/password/request-reset-code', {
        email,
      });
      setLastError(null);
      return {
        ok: result.ok,
        message: result.message,
        expiresInMinutes: result.expiresInMinutes,
      };
    } catch (error: any) {
      const message = error?.message || '发送重置验证码失败';
      setLastError(message);
      console.error('requestPasswordResetCode failed:', error);
      return { ok: false, message };
    }
  };

  const resetPasswordWithCode = async (
    email: string,
    code: string,
    newPassword: string
  ): Promise<boolean> => {
    try {
      await apiPost<{ ok: boolean; message: string }>('/auth/password/reset', {
        email,
        code,
        newPassword,
      });
      setLastError(null);
      return true;
    } catch (error: any) {
      const message = error?.message || '重置密码失败';
      setLastError(message);
      console.error('resetPasswordWithCode failed:', error);
      return false;
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      const result = await apiPost<AuthResponse>('/auth/login', { email, password });
      await handleAuthSuccess(result);
      setLastError(null);
      return true;
    } catch (error: any) {
      const message = error?.message || '登录失败';
      setLastError(message);
      console.error('Login failed:', error);
      return false;
    }
  };

  const logout = async () => {
    clearAuthToken();
    setLastError(null);
    resetAuthState();
    triggerSessionSync();
  };

  const updateProfile = async (updates: Partial<User>) => {
    if (!currentUser) return;

    try {
      const result = await apiPatch<{ user: User }>('/auth/profile', updates);
      setCurrentUser(result.user);
      setUsers((prev) => {
        const exists = prev.some((u) => u.id === result.user.id);
        if (!exists) return [...prev, result.user];
        return prev.map((u) => (u.id === result.user.id ? result.user : u));
      });
      triggerSessionSync();
      setLastError(null);
    } catch (error: any) {
      console.error('updateProfile failed:', error);
      const message = error?.message || '更新资料失败';
      setLastError(message);
      throw error instanceof Error ? error : new Error(message);
    }
  };

  const addNotification = async (
    title: string,
    message: string,
    type: 'system' | 'interaction' = 'system'
  ) => {
    if (!currentUser) return;

    try {
      const result = await apiPost<{ notification: Notification }>('/notifications', {
        title,
        message,
        type,
      });
      setAllNotifications((prev) => [result.notification, ...prev]);
      setLastError(null);
    } catch (error: any) {
      console.error('addNotification failed:', error);
      setLastError(error?.message || '创建通知失败');
    }
  };

  const markAsRead = async (id: string) => {
    if (!currentUser) return;

    try {
      const result = await apiPatch<{ notification: Notification }>(`/notifications/${id}/read`, {});
      setAllNotifications((prev) => prev.map((n) => (n.id === id ? result.notification : n)));
      setLastError(null);
    } catch (error: any) {
      console.error('markAsRead failed:', error);
      setAllNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setLastError(error?.message || '标记已读失败');
    }
  };

  const markAllAsRead = async () => {
    if (!currentUser) return;

    try {
      await apiPatch<{ ok: boolean }>('/notifications/read-all', {});
      setAllNotifications((prev) =>
        prev.map((n) => (n.userId === currentUser.id ? { ...n, read: true } : n))
      );
      setLastError(null);
    } catch (error: any) {
      console.error('markAllAsRead failed:', error);
      setLastError(error?.message || '一键标记已读失败');
    }
  };

  const clearNotifications = async () => {
    if (!currentUser) return;

    try {
      await apiDelete('/notifications');
      setLastError(null);
    } catch (error: any) {
      console.error('clearNotifications failed:', error);
      setLastError(error?.message || '清空通知失败');
    }
    setAllNotifications((prev) => prev.filter((n) => n.userId !== currentUser.id));
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        partner,
        refreshAuthData,
        requestRegisterCode,
        verifyRegisterCode,
        requestPasswordResetCode,
        resetPasswordWithCode,
        login,
        logout,
        updateProfile,
        users,
        isEmailTaken,
        notifications,
        addNotification,
        markAsRead,
        markAllAsRead,
        clearNotifications,
        unreadCount,
        lastError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};


