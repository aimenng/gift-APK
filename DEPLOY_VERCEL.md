# Vercel 部署操作文档

> 本文档面向第一次在 Vercel 上部署本项目的操作者，按顺序完成即可。
>
> **架构说明**：本项目前端（Vite + React）和后端（Express API）合并为一个 Vercel 项目部署。
> - 前端：Vite 构建为静态文件 → Vercel 静态托管
> - 后端：`api/index.js` 作为 Vercel Serverless Function 入口 → 自动引用 `backend/src/app.js` 中的 Express 应用

---

## 前置准备

在开始之前，请确认你已有：

- [x] GitHub 仓库：`https://github.com/aimenng/gifts---couple-connection`（代码已推送到 `main` 分支）
- [x] Supabase 项目（已获取 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`）
- [x] JWT 密钥（至少 32 位随机字符串）
- [x] （可选）SMTP 邮箱信息，用于发送验证码邮件

---

## 第一步：注册 / 登录 Vercel

1. 打开 [https://vercel.com](https://vercel.com)
2. 点击右上角 **Sign Up**（已有账号点 **Log In**）
3. 选择 **Continue with GitHub**，授权 GitHub 账号登录

---

## 第二步：导入 GitHub 仓库创建项目

1. 登录后进入 Vercel Dashboard，点击 **Add New → Project**

   ![Add New Project](https://vercel.com/docs/static/add-new-project.png)

2. 在 **Import Git Repository** 页面，找到仓库 `aimenng/gifts---couple-connection`

   > 如果列表中没有看到该仓库，点击 **Adjust GitHub App Permissions** → 勾选该仓库 → Save

3. 点击仓库右侧的 **Import** 按钮

---

## 第三步：配置构建设置

进入项目配置页面后，按以下内容填写：

| 配置项 | 填写值 |
|--------|--------|
| **Framework Preset** | `Vite` |
| **Root Directory** | `./ `（默认，不需要修改） |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |
| **Install Command** | `npm install`（默认） |

> **注意**：Framework Preset 选择 `Vite` 后，Build Command 和 Output Directory 通常会自动填上正确值，确认无误即可。

---

## 第四步：配置环境变量

在同一个配置页面下方，展开 **Environment Variables** 区域，逐一添加以下变量：

### 4.1 必填变量（不填无法启动）

| 变量名 | 示例值 | 说明 |
|--------|--------|------|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` | Supabase 项目 URL |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJI...` | Supabase Service Role Key（在 Project Settings → API 中） |
| `JWT_SECRET` | `your-random-string-at-least-32-chars` | JWT 签名密钥，**至少 32 个字符** |
| `JWT_EXPIRES_IN` | `7d` | Token 过期时间 |
| `JWT_ISSUER` | `gifts-backend` | JWT 签发方标识 |
| `JWT_AUDIENCE` | `gifts-app` | JWT 受众标识 |

> 添加方式：在 Key 输入框输入变量名 → Value 输入框输入值 → 点击 **Add** → 重复操作

### 4.2 可选变量（有合理默认值，按需添加）

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `DEFAULT_TOGETHER_DATE` | `2021-10-12` | 在一起的日期 |
| `BODY_LIMIT` | `12mb` | 请求体大小限制 |
| `MAX_IMAGE_BYTES` | `10485760` | 单张图片最大 10MB |
| `PASSWORD_HASH_ROUNDS` | `10` | bcrypt 哈希轮数 |
| `IMAGE_STORAGE_ENABLED` | `true` | 启用图片云存储 |
| `SUPABASE_IMAGE_BUCKET` | `gifts-memories` | Supabase Storage Bucket 名 |
| `SUPABASE_IMAGE_BUCKET_PUBLIC` | `false` | Bucket 是否公开 |
| `IMAGE_SIGNED_URL_TTL_SECONDS` | `3600` | 图片签名 URL 有效期（秒） |

### 4.3 邮件功能变量（需要邮箱验证码功能时才填）

| 变量名 | 示例值 | 说明 |
|--------|--------|------|
| `SMTP_HOST` | `smtp.qq.com` | SMTP 服务器地址 |
| `SMTP_PORT` | `465` | SMTP 端口 |
| `SMTP_SECURE` | `true` | 是否使用 SSL |
| `SMTP_USER` | `your-email@qq.com` | 发件人邮箱 |
| `SMTP_PASS` | `your-smtp-auth-code` | SMTP 授权码（非登录密码） |
| `SMTP_FROM` | `Gifts App <your-email@qq.com>` | 发件人显示名称 |

### 4.4 前端变量

- **不需要** 添加 `VITE_API_BASE_URL`。前端代码默认请求 `/api`，由 `vercel.json` 路由转发到 Serverless Function，同域名零配置。

---

## 第五步：点击部署

所有配置填写完毕后，点击页面底部的 **Deploy** 按钮。

Vercel 将自动执行：
1. `npm install` — 安装所有依赖
2. `npm run build` — Vite 构建前端到 `dist/` 目录
3. 自动识别 `api/index.js` 作为 Serverless Function
4. 根据 `vercel.json` 配置路由规则

部署过程约 1-3 分钟，可以在页面上实时查看构建日志。

---

## 第六步：验证部署是否成功

部署完成后，Vercel 会分配一个域名，如 `https://gifts-couple-connection.vercel.app`。

### 6.1 检查前端

在浏览器打开：
```
https://<你的域名>.vercel.app
```
应能看到登录/注册页面。

### 6.2 检查后端 API 健康接口

在浏览器打开：
```
https://<你的域名>.vercel.app/api/health
```
应返回类似：
```json
{
  "ok": true,
  "service": "gifts-backend",
  "time": "2026-02-11T12:00:00.000Z"
}
```

### 6.3 功能验证清单

- [ ] 注册新账号（收到验证码邮件）
- [ ] 登录成功跳转到主页
- [ ] 上传回忆（图片能正常显示）
- [ ] 纪念日时间轴正常加载
- [ ] 两个账号之间的情侣绑定功能

---

## 项目关键文件说明

以下是与 Vercel 部署直接相关的文件：

```
├── vercel.json                  ← Vercel 路由配置
├── api/
│   └── index.js                 ← Serverless Function 入口（引用 backend/src/app.js）
├── backend/
│   └── src/
│       ├── app.js               ← Express 应用主体（导出 app 对象）
│       ├── index.js             ← 仅用于本地开发的 listen 启动
│       ├── config.js            ← 环境变量读取与校验
│       └── routes/              ← API 路由文件
├── vite.config.ts               ← Vite 前端构建配置
└── package.json                 ← 构建脚本和依赖声明
```

**路由规则**（`vercel.json`）：
- `/api` 和 `/api/*` → 交给 `api/index.js`（Express Serverless Function）
- 静态文件（JS/CSS/图片等）→ 直接从 `dist/` 目录返回
- 其他所有路径 → 返回 `index.html`（前端 SPA 路由）

---

## 后续更新部署

代码推送到 GitHub `main` 分支后，Vercel 会**自动触发重新部署**，无需手动操作。

```bash
git add -A
git commit -m "你的提交说明"
git push origin main
```

---

## 常见问题排查

### Q1：`/api/health` 返回 404
- 确认仓库根目录有 `api/index.js` 和 `vercel.json` 两个文件
- 在 Vercel Dashboard → 项目 → Functions 选项卡中检查是否识别到 `api/index.js`

### Q2：API 返回 500 Internal Server Error
- 进入 Vercel Dashboard → 项目 → Logs 选项卡，查看 Function 运行日志
- 最常见原因：**必填环境变量缺失**（`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`JWT_SECRET` 等）
- 错误信息类似 `Missing required environment variables: XXX`

### Q3：修改了环境变量但没生效
- Vercel 修改环境变量后需要**重新部署**才会生效
- 进入项目 → Deployments 选项卡 → 点击最近一次部署右侧的 `...` → **Redeploy**

### Q4：前端页面白屏
- 检查浏览器控制台是否有 JS 错误
- 确认 `Build Command` 是 `npm run build`，`Output Directory` 是 `dist`
- 查看 Vercel 构建日志是否有编译错误

### Q5：图片上传失败
- 确认 Supabase 中已创建名为 `gifts-memories` 的 Storage Bucket
- 确认 `IMAGE_STORAGE_ENABLED` 为 `true`
- 检查 `SUPABASE_SERVICE_ROLE_KEY` 是否有 Storage 权限

### Q6：邮件发送失败
- 确认 SMTP 相关 6 个变量全部填写
- QQ 邮箱需使用**授权码**（非登录密码），在 QQ 邮箱 → 设置 → 账户 → POP3/SMTP 服务 中生成

### Q7：想绑定自定义域名
- 进入项目 → Settings → Domains → 添加你的域名
- 按 Vercel 提示在域名 DNS 中添加 CNAME 记录即可，不需要改代码

