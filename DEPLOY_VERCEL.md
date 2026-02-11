# Vercel 单项目部署文档（按当前代码）

目标：只在 Vercel 建 1 个项目，一次部署同时包含前端和后端 API。

## 1. 这次代码改动要点

1. 新增 `api/index.js`，把 `/api` 请求交给 Express。
2. 新增 `vercel.json`，实现：
   - `/api/*` -> `api/index.js`
   - 静态文件优先
   - 前端路由回退到 `index.html`
3. 后端拆分为可复用 app：
   - `backend/src/app.js`：导出 Express `app`
   - `backend/src/index.js`：仅用于本地 `listen`

## 2. Vercel 里只建一个项目

在 Vercel 中：`Add New -> Project`，选择仓库 `gifts---couple-connection`，填写：

1. `Framework Preset`: `Vite`
2. `Root Directory`: `./`
3. `Build Command`: `npm run build`
4. `Output Directory`: `dist`
5. `Install Command`: `npm install`

## 3. 环境变量（同一个项目里一次性填完）

必填：

```env
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
JWT_SECRET=<at-least-32-char-random-string>
JWT_EXPIRES_IN=7d
JWT_ISSUER=gifts-backend
JWT_AUDIENCE=gifts-app
```

推荐（可先不填，后续再加）：

```env
DEFAULT_TOGETHER_DATE=2021-10-12
BODY_LIMIT=12mb
MAX_IMAGE_BYTES=10485760
MEMORIES_PAGE_DEFAULT_LIMIT=50
MEMORIES_PAGE_MAX_LIMIT=100
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_API=100
RATE_LIMIT_MAX_AUTH=30
RATE_LIMIT_MAX_SENSITIVE=5
PASSWORD_HASH_ROUNDS=8
IMAGE_STORAGE_ENABLED=true
SUPABASE_IMAGE_BUCKET=gifts-memories
SUPABASE_IMAGE_BUCKET_PUBLIC=false
IMAGE_SIGNED_URL_TTL_SECONDS=3600
SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=<your-email>
SMTP_PASS=<your-smtp-auth-code>
SMTP_FROM=Gifts App <your-email>
```

前端变量：

1. 单项目部署默认不需要 `VITE_API_BASE_URL`（代码默认用 `/api`）。
2. 只有你要连外部独立后端时才需要填 `VITE_API_BASE_URL`。

## 4. 一次部署后的验证

部署完成后，使用同一个域名验证：

1. 前端：`https://<your-app>.vercel.app`
2. 健康检查：`https://<your-app>.vercel.app/api/health`
3. 功能检查：
   - 登录/注册
   - 上传回忆（单张/批量）
   - 纪念日新增和列表同步

## 5. 常见问题

1. `/api/*` 404：
   - 检查仓库里是否包含 `api/index.js` 和 `vercel.json`
2. 后端启动失败：
   - 检查必填环境变量是否完整
3. 修改了环境变量不生效：
   - 在 Vercel 里重新触发一次部署
4. 未来绑定自定义域名：
   - 不需要改架构，只要在同一项目里加域名即可

