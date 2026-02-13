import path from 'node:path';
import dotenv from 'dotenv';

const envPath = process.env.BACKEND_ENV_FILE || path.resolve(process.cwd(), 'backend/.env');
dotenv.config({ path: envPath, override: true });

const parseNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBoundedInt = (value, fallback, min, max) => {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
};

const parseBoolean = (value, fallback = false) => {
  if (value == null) return fallback;
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
};

const runtimeVercelUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '';

export const config = {
  port: parseNumber(process.env.PORT, 8787),
  corsOrigin: process.env.CORS_ORIGIN || (runtimeVercelUrl ? '*' : 'http://localhost:5173,http://localhost:3000'),
  jwtSecret: String(process.env.JWT_SECRET || '').trim(),
  jwtExpiresIn: String(process.env.JWT_EXPIRES_IN || '7d').trim() || '7d',
  jwtIssuer: String(process.env.JWT_ISSUER || 'gifts-backend').trim() || 'gifts-backend',
  jwtAudience: String(process.env.JWT_AUDIENCE || 'gifts-app').trim() || 'gifts-app',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  passwordHashRounds: parseBoundedInt(process.env.PASSWORD_HASH_ROUNDS, 10, 8, 14),
  defaultTogetherDate: process.env.DEFAULT_TOGETHER_DATE || '2021-10-12',
  bodyLimit: process.env.BODY_LIMIT || '12mb',
  maxImageBytes: parseBoundedInt(process.env.MAX_IMAGE_BYTES, 10 * 1024 * 1024, 256 * 1024, 50 * 1024 * 1024),
  maxAvatarLength: parseBoundedInt(process.env.MAX_AVATAR_LENGTH, 240_000, 8_000, 2_000_000),
  memoryPageDefaultLimit: parseBoundedInt(process.env.MEMORIES_PAGE_DEFAULT_LIMIT, 50, 1, 200),
  memoryPageMaxLimit: parseBoundedInt(process.env.MEMORIES_PAGE_MAX_LIMIT, 100, 10, 500),
  frontendUrl: process.env.FRONTEND_URL || runtimeVercelUrl || 'http://localhost:5173',
  backendPublicUrl:
    process.env.BACKEND_PUBLIC_URL || runtimeVercelUrl || `http://localhost:${parseNumber(process.env.PORT, 8787)}`,
  verificationCodeTtlMinutes: parseNumber(process.env.VERIFICATION_CODE_TTL_MINUTES, 10),
  verificationMaxAttempts: parseBoundedInt(process.env.VERIFICATION_MAX_ATTEMPTS, 5, 1, 20),
  authUniformMinLatencyMs: parseBoundedInt(process.env.AUTH_UNIFORM_MIN_LATENCY_MS, 650, 200, 5000),
  bindingRequestTtlHours: parseNumber(process.env.BINDING_REQUEST_TTL_HOURS, 24),
  signupCodeCooldownSeconds: parseBoundedInt(process.env.SIGNUP_RESEND_COOLDOWN_SECONDS, 45, 10, 3600),
  resetCodeCooldownSeconds: parseBoundedInt(process.env.RESET_CODE_COOLDOWN_SECONDS, 300, 30, 3600),
  rateLimitWindowMs: parseBoundedInt(process.env.RATE_LIMIT_WINDOW_MS, 60_000, 10_000, 60 * 60 * 1000),
  rateLimitApiMax: parseBoundedInt(process.env.RATE_LIMIT_MAX_API, 100, 1, 10_000),
  rateLimitAuthMax: parseBoundedInt(process.env.RATE_LIMIT_MAX_AUTH, 30, 1, 1000),
  rateLimitSensitiveMax: parseBoundedInt(process.env.RATE_LIMIT_MAX_SENSITIVE, 5, 1, 100),
  supabaseReadTimeoutMs: parseBoundedInt(process.env.SUPABASE_READ_TIMEOUT_MS, 12_000, 2_000, 120_000),
  supabaseWriteTimeoutMs: parseBoundedInt(process.env.SUPABASE_WRITE_TIMEOUT_MS, 18_000, 2_000, 120_000),
  supabaseReadMaxAttempts: parseBoundedInt(process.env.SUPABASE_READ_MAX_ATTEMPTS, 2, 1, 5),
  supabaseWriteMaxAttempts: parseBoundedInt(process.env.SUPABASE_WRITE_MAX_ATTEMPTS, 1, 1, 5),
  imageStorageEnabled: parseBoolean(process.env.IMAGE_STORAGE_ENABLED, true),
  imageBucket: process.env.SUPABASE_IMAGE_BUCKET || 'gifts-memories',
  imageBucketPublic: parseBoolean(process.env.SUPABASE_IMAGE_BUCKET_PUBLIC, false),
  imageSignedUrlTtlSeconds: parseBoundedInt(
    process.env.IMAGE_SIGNED_URL_TTL_SECONDS,
    3600,
    60,
    86400
  ),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseNumber(process.env.SMTP_PORT, 587),
    secure: parseBoolean(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: (process.env.SMTP_FROM || '').replace(/^["']|["']$/g, ''),
  },
};

export const requireConfig = () => {
  const missing = [];
  if (!config.supabaseUrl) missing.push('SUPABASE_URL');
  if (!config.supabaseServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  if (!config.jwtSecret) missing.push('JWT_SECRET');
  if (!config.jwtExpiresIn) missing.push('JWT_EXPIRES_IN');
  if (!config.jwtIssuer) missing.push('JWT_ISSUER');
  if (!config.jwtAudience) missing.push('JWT_AUDIENCE');

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (config.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET is too weak. Please use a random string with at least 32 characters.');
  }
};
