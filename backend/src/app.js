import cors from 'cors';
import express from 'express';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/authRoutes.js';
import appRoutes from './routes/appRoutes.js';
import { config, requireConfig } from './config.js';

requireConfig();

const app = express();

// Vercel sits behind a reverse proxy — trust it so express-rate-limit
// can read the real client IP from X-Forwarded-For.
if (process.env.VERCEL) {
  app.set('trust proxy', 1);
}

app.use(
  cors({
    origin: config.corsOrigin === '*' ? true : config.corsOrigin.split(',').map((x) => x.trim()),
    credentials: false,
  })
);
app.use(compression());
app.use(express.json({ limit: config.bodyLimit }));
app.use((req, res, next) => {
  const startedAt = Date.now();
  res.on('finish', () => {
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs >= 400) {
      console.info(`[api-slow] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${elapsedMs}ms)`);
    }
  });
  next();
});

const buildLimiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: message },
  });

const apiRateLimiter = buildLimiter(config.rateLimitWindowMs, config.rateLimitApiMax, '请求过于频繁，请稍后再试');
const authRateLimiter = buildLimiter(config.rateLimitWindowMs, config.rateLimitAuthMax, '认证请求过于频繁，请稍后再试');
const sensitiveAuthLimiter = buildLimiter(
  config.rateLimitWindowMs,
  config.rateLimitSensitiveMax,
  '敏感操作过于频繁，请 1 分钟后再试'
);

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'gifts-backend',
    time: new Date().toISOString(),
  });
});

app.get('/', (_req, res) => {
  res.status(200).send(
    `Backend is running. Frontend dev server: ${config.frontendUrl || 'http://localhost:5173'}`
  );
});

app.use('/api', apiRateLimiter);
app.use('/api/auth', authRateLimiter);
app.use('/api/auth/login', sensitiveAuthLimiter);
app.use('/api/auth/register/request-code', sensitiveAuthLimiter);
app.use('/api/auth/register/verify', sensitiveAuthLimiter);
app.use('/api/auth/password/request-reset-code', sensitiveAuthLimiter);
app.use('/api/auth/password/reset', sensitiveAuthLimiter);

app.use('/api/auth', authRoutes);
app.use('/api', appRoutes);

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  let message = error.message || 'Internal server error';

  if (typeof message === 'string' && message.includes("Could not find the table 'public.focus_stats'")) {
    message = '数据库缺少 focus_stats 表，请先执行 backend/supabase/migration_20260210_focus_stats_cloud.sql';
  }

  if (typeof message === 'string' && message.includes("Could not find the table 'public.focus_timer_state'")) {
    message = '数据库缺少 focus_timer_state 表，请先执行 backend/supabase/migration_20260213_focus_timer_state.sql';
  }

  if (
    typeof message === 'string' &&
    message.includes("Could not find the 'token_version' column of 'users'")
  ) {
    message =
      '数据库缺少 users.token_version 字段，请先执行 backend/supabase/migration_20260211_token_version.sql';
  }

  if (
    typeof message === 'string' &&
    message.includes('Could not find the') &&
    message.includes("column of 'users'")
  ) {
    message = '数据库缺少 users 新字段，请先执行 backend/supabase/migration_20260209_email_binding.sql';
  }

  if (typeof message === 'string' && message.includes("Could not find the table 'public.email_verifications'")) {
    message = '数据库缺少 email_verifications 表，请先执行 backend/supabase/migration_20260209_email_binding.sql';
  }

  if (typeof message === 'string' && message.includes("Could not find the table 'public.binding_requests'")) {
    message = '数据库缺少 binding_requests 表，请先执行 backend/supabase/migration_20260209_email_binding.sql';
  }

  if (typeof message === 'string' && message.includes("Could not find the table 'public.period_tracker_entries'")) {
    message = '数据库缺少 period_tracker_entries 表，请先执行 backend/supabase/migration_20260210_period_tracker_sync.sql';
  }

  if (
    typeof message === 'string' &&
    message.includes('duplicate key value violates unique constraint "users_email_key"')
  ) {
    message = '该邮箱已完成注册，请直接登录。';
  }

  if (
    typeof message === 'string' &&
    (message.toLowerCase().includes('fetch failed') || message.toLowerCase().includes('connect timeout'))
  ) {
    message = '后端与数据库通信异常，请稍后重试';
  }

  if (status >= 500) {
    console.error('[Backend Error]', error);
  }

  res.status(status).json({ error: message });
});

export default app;
