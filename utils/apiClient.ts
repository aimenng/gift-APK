import { getAuthToken } from './authToken';

const isNativePlatform =
  typeof window !== 'undefined' && typeof (window as any).Capacitor?.isNativePlatform === 'function'
    ? Boolean((window as any).Capacitor.isNativePlatform())
    : false;

const DEFAULT_NATIVE_API_BASE_URL = 'http://10.0.2.2:3001/api';
// Explicitly access import.meta.env properties so Vite can statically replace them
const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (isNativePlatform ? import.meta.env.VITE_API_BASE_URL_MOBILE || DEFAULT_NATIVE_API_BASE_URL : '/api');
const REQUEST_TIMEOUT_MS = 60_000;
const WRITE_REQUEST_TIMEOUT_MS = 45_000;
const RETRY_TIMES = 1;
const RETRYABLE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const NETWORK_ERROR_PATTERNS = ['failed to fetch', 'fetch failed', 'networkerror', 'network error'];

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
        const message = payload?.error || `Request failed with status ${response.status}`;
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
