# Gifts Couple Connection - Vercel 部署文档

本说明基于当前仓库结构编写：

- 前端：Vite + React，位于仓库根目录（`./`）
- 后端：Express，入口文件 `backend/src/index.js`
- API 前缀：`/api`

## 1. 部署架构

建议在 Vercel 建立 2 个项目（同一个 GitHub 仓库）：

1. 前端项目（Root Directory: `./`）
2. 后端项目（Root Directory: `backend`）

前端通过环境变量请求后端：

```env
VITE_API_BASE_URL=https://<你的后端域名>/api
```

代码位置：`utils/apiClient.ts`

## 2. 部署前准备

1. GitHub 仓库已连接 Vercel。
2. Supabase 的迁移 SQL（`backend/supabase/`）已执行。
3. 不要把密钥提交到仓库（尤其是 `SUPABASE_SERVICE_ROLE_KEY`、`JWT_SECRET`）。
4. 如果密钥曾经泄露，先轮换再部署。

## 3. 前端项目配置（Vite）

在 Vercel 新建项目时填写：

1. Framework Preset: `Vite`
2. Root Directory: `./`
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Install Command: `npm install`

前端环境变量：

```env
VITE_API_BASE_URL=https://<你的后端域名>/api
```

说明：
- 这个变量不填时，前端会默认请求 `/api`，线上通常会出现 404 或请求到错误服务。

## 4. 后端项目配置（Express）

后端入口是 `backend/src/index.js`。

### 4.1 backend/package.json

本仓库已补充 `backend/package.json`，可直接用于后端独立部署。

### 4.2 Vercel 后端项目字段

1. Framework Preset: `Other`（若自动识别到 Express 也可以）
2. Root Directory: `backend`
3. Install Command: `npm install`
4. Build Command: 留空
5. Output Directory: 留空

### 4.3 后端环境变量

必填（代码启动会校验，见 `backend/src/config.js`）：

```env
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
JWT_SECRET=<至少32位随机密钥>
JWT_EXPIRES_IN=7d
JWT_ISSUER=gifts-backend
JWT_AUDIENCE=gifts-app
```

强烈建议：

```env
CORS_ORIGIN=https://<你的前端域名>.vercel.app
FRONTEND_URL=https://<你的前端域名>.vercel.app
BACKEND_PUBLIC_URL=https://<你的后端域名>.vercel.app
```

可选（按需，来源于 `backend/.env.example`）：

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
SMTP_USER=<你的邮箱>
SMTP_PASS=<SMTP授权码>
SMTP_FROM=Gifts App <你的邮箱>
```

## 5. 推荐部署顺序

1. 先部署后端，拿到后端域名。
2. 在前端项目配置 `VITE_API_BASE_URL=https://<后端域名>/api`。
3. 部署前端，拿到前端域名。
4. 回到后端更新 `CORS_ORIGIN` 和 `FRONTEND_URL` 为前端域名。
5. 重新部署后端。

## 6. 上线后检查

1. 健康检查：
   - `https://<后端域名>/api/health`
   - 预期返回：`"ok": true`
2. 前端功能冒烟：
   - 登录
   - 时间线加载
   - 上传回忆
   - 新增纪念日
3. 浏览器控制台无 CORS 报错。
4. 后端日志无环境变量缺失报错。

## 7. 常见问题

### 7.1 前端能打开，但接口 404

优先检查前端 `VITE_API_BASE_URL`，并确认末尾包含 `/api`。

### 7.2 CORS 报错

后端 `CORS_ORIGIN` 需要和前端域名完全一致（协议 + 域名）。

### 7.3 后端启动失败

通常是缺少必填环境变量，请检查：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `JWT_EXPIRES_IN`
- `JWT_ISSUER`
- `JWT_AUDIENCE`

### 7.4 Preview 能用，Production 不能用（或反过来）

检查 Vercel 环境变量是否加在正确环境范围（Production / Preview / Development），然后重新部署。

## 8. 官方参考

1. Express on Vercel  
   `https://vercel.com/docs/frameworks/backend/express`
2. Build Configuration  
   `https://vercel.com/docs/builds/configure-a-build`

