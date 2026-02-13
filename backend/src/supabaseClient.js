import { createClient } from '@supabase/supabase-js';
import { config } from './config.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const withTimeout = (promise, timeoutMs, timeoutMessage) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });

const isRetriableNetworkError = (error) => {
  const message = String(error?.message || error || '').toLowerCase();
  if (error?.name === 'AbortError') return true;
  if (message.includes('und_err_connect_timeout')) return true;
  if (message.includes('connect timeout error')) return true;
  if (message.includes('fetch failed')) return true;
  if (message.includes('econnreset')) return true;
  if (message.includes('terminated')) return true;
  if (message.includes('body timeout')) return true;
  if (message.includes('supabase_body_timeout')) return true;
  return false;
};

const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

const robustFetch = async (url, options = {}) => {
  const method = String(options?.method || 'GET').toUpperCase();
  const isIdempotent = IDEMPOTENT_METHODS.has(method);
  const maxAttempts = isIdempotent ? config.supabaseReadMaxAttempts : config.supabaseWriteMaxAttempts;
  const timeoutMs = isIdempotent ? config.supabaseReadTimeoutMs : config.supabaseWriteTimeoutMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const externalSignal = options.signal;
    const onAbort = () => controller.abort();

    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener('abort', onAbort, { once: true });
    }

    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      const bodyText = await withTimeout(
        response.text(),
        timeoutMs,
        `SUPABASE_BODY_TIMEOUT_${timeoutMs}`
      );
      return new Response(bodyText, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (error) {
      if (attempt === maxAttempts || !isRetriableNetworkError(error)) {
        throw error;
      }
      await sleep(250 * attempt);
    } finally {
      clearTimeout(timeout);
      if (externalSignal) {
        externalSignal.removeEventListener('abort', onAbort);
      }
    }
  }

  throw new Error('Unexpected fetch retry state');
};

export const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  global: {
    fetch: robustFetch,
  },
});
