import { getAuthToken } from './authToken';

const isNativePlatform =
  typeof window !== 'undefined' && typeof (window as any).Capacitor?.isNativePlatform === 'function'
    ? Boolean((window as any).Capacitor.isNativePlatform())
    : false;
const isBrowser = typeof window !== 'undefined';
const isLocalhostBrowser =
  isBrowser && ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);

const DEFAULT_NATIVE_API_BASE_URL = 'http://10.0.2.2:8787/api';
const DEFAULT_WEB_API_BASE_URL = '/api';

// Explicitly access import.meta.env properties so Vite can statically replace them
const resolveWebApiBaseUrl = () => {
  const explicitWebBaseUrl = import.meta.env.VITE_API_BASE_URL_WEB;
  if (explicitWebBaseUrl) return explicitWebBaseUrl;
  if (isLocalhostBrowser) return DEFAULT_WEB_API_BASE_URL;
  return import.meta.env.VITE_API_BASE_URL || DEFAULT_WEB_API_BASE_URL;
};

const API_BASE_URL = isNativePlatform
  ? import.meta.env.VITE_API_BASE_URL_MOBILE || import.meta.env.VITE_API_BASE_URL || DEFAULT_NATIVE_API_BASE_URL
  : resolveWebApiBaseUrl();

const REQUEST_TIMEOUT_MS = 60_000;
const WRITE_REQUEST_TIMEOUT_MS = 45_000;
const RETRY_TIMES = 1;
const RETRYABLE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const NETWORK_ERROR_PATTERNS = ['failed to fetch', 'fetch failed', 'networkerror', 'network error'];
const PROXY_BACKEND_DOWN_PATTERNS = ['econnrefused', 'proxy error', 'socket hang up', 'connect etimedout'];
const STATUS_ERROR_MESSAGES: Record<number, string> = {
  400: '请求参数有误，请检查后重试',
  401: '邮箱或密码错误，或邮箱尚未验证',
  403: '当前操作暂未授权',
  404: '接口不存在或服务未就绪',
  408: '请求超时，请稍后重试',
  409: '请求冲突，请刷新后重试',
  429: '请求过于频繁，请稍后再试',
  500: '服务器内部错误，请稍后重试',
  502: '网关异常，请稍后重试',
  503: '服务暂不可用，请稍后重试',
  504: '网关超时，请稍后重试',
};

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const buildHeaders = (hasBody: boolean): HeadersInit => {
  const token = getAuthToken();
  return {
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

const isLikelyNetworkError = (error: any): boolean => {
  const message = String(error?.message || '').toLowerCase();
  return error?.name === 'AbortError' || NETWORK_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
};

const extractErrorMessage = (status: number, payload: any): string => {
  const fromErrorField = typeof payload?.error === 'string' ? payload.error.trim() : '';
  if (fromErrorField) return fromErrorField;

  const fromMessageField = typeof payload?.message === 'string' ? payload.message.trim() : '';
  if (fromMessageField) return fromMessageField;

  const isLikelyEmptyProxy500 =
    status === 500 &&
    isLocalhostBrowser &&
    (!payload || (typeof payload?.raw === 'string' && payload.raw.trim() === ''));
  if (isLikelyEmptyProxy500) {
    return '后端服务不可用，请确认已启动后端（默认端口 8787）';
  }

  const rawText = String(payload?.raw || '').toLowerCase();
  const isProxyBackendDown =
    status >= 500 && PROXY_BACKEND_DOWN_PATTERNS.some((pattern) => rawText.includes(pattern));
  if (isProxyBackendDown) {
    return '后端服务不可用，请确认后端已启动且端口配置一致';
  }

  return STATUS_ERROR_MESSAGES[status] || `请求失败（${status}）`;
};

export const apiRequest = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const hasBody = Boolean(options.body);
  const method = String(options.method || 'GET').toUpperCase();
  const retryTimes = RETRYABLE_METHODS.has(method) ? RETRY_TIMES : 0;
  const timeoutMs = RETRYABLE_METHODS.has(method) ? REQUEST_TIMEOUT_MS : WRITE_REQUEST_TIMEOUT_MS;

  for (let attempt = 0; attempt <= retryTimes; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        ...options,
        headers: {
          ...buildHeaders(hasBody),
          ...(options.headers || {}),
        },
        signal: controller.signal,
      });

      const raw = await response.text();
      let payload: any = null;
      if (raw) {
        try {
          payload = JSON.parse(raw);
        } catch {
          payload = { raw };
        }
      }

      if (!response.ok) {
        const message = extractErrorMessage(response.status, payload);
        throw new ApiError(message, response.status, payload);
      }

      return payload as T;
    } catch (error: any) {
      const isNetworkError = isLikelyNetworkError(error);

      if (attempt >= retryTimes || !isNetworkError) {
        if (error instanceof ApiError) throw error;
        if (error?.name === 'AbortError') {
          throw new ApiError('请求超时，请稍后重试', 408);
        }
        if (isLikelyNetworkError(error)) {
          throw new ApiError('网络连接失败，请检查后端服务和网络后重试', 503);
        }
        throw new ApiError(error?.message || '网络请求失败', 500);
      }
      await sleep(180 * (attempt + 1));
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new ApiError('网络请求失败', 500);
};

export const apiGet = <T>(path: string): Promise<T> => apiRequest<T>(path, { method: 'GET' });

export const apiPost = <T>(path: string, body?: unknown): Promise<T> =>
  apiRequest<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });

export const apiPatch = <T>(path: string, body: unknown): Promise<T> =>
  apiRequest<T>(path, { method: 'PATCH', body: JSON.stringify(body) });

export const apiDelete = <T = void>(path: string): Promise<T> => apiRequest<T>(path, { method: 'DELETE' });
