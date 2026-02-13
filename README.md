# XLGift

XLGift 是一个面向情侣关系的「记录 + 同步 + 陪伴」应用。
它把回忆时间线、纪念日、专注计时、经期与情绪记录、关系绑定和消息中心整合到同一个 App（Web + Android）。

## 界面预览

> 说明：你仓库里原本就有 `README.md`，本次是在这个现有文件上继续增强展示内容，并没有新增第二份 README。

<p align="center">
  <img width="1200" alt="XLGift Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</p>

### 截图展示位（可直接替换为你的真实链接）

| 登录与注册 | 关系绑定 | 我的主页 |
|---|---|---|
| `TODO: 登录页截图链接` | `TODO: 绑定页截图链接` | `TODO: 个人页截图链接` |

| 时间线 | 纪念日 | 专注计时 |
|---|---|---|
| `TODO: 时间线截图链接` | `TODO: 纪念日截图链接` | `TODO: 专注页截图链接` |

### 如何快速补截图到 README

1. 在 GitHub 任意 Issue 评论区拖拽上传图片。
2. 复制生成的 `https://github.com/user-attachments/assets/...` 链接。
3. 将上方 `TODO` 文本替换成标准 Markdown 图片语法，例如：

```md
![登录页](https://github.com/user-attachments/assets/xxxxx)
```

## 项目定位

- 核心目标：帮助情侣长期、稳定地记录共同生活。
- 数据策略：以云端为主（Supabase），本地缓存为辅，支持跨设备同步。
- 运行形态：
  - Web：Vite + React
  - Backend：Node.js + Express
  - Data：Supabase（Postgres + Storage）
  - Mobile：Capacitor Android（支持 APK 打包）

## 核心玩法（用户视角）

### 1. 第一次使用

1. 打开应用，进入账号安全页。
2. 使用邮箱注册，输入验证码完成验证。
3. 登录后系统会生成你的专属邀请码。
4. 将邀请码发给对方，在“关系绑定”页完成绑定。
5. 绑定成功后，双方将共享时间线、纪念日、专注统计等关系数据。

### 2. 日常使用路径

1. 在“首页/时间线”上传你们的照片回忆。
2. 在“纪念日”添加重要节点（生日、旅行、节日、第一次等）。
3. 在“专注”页开启倒计时或正计时，完成后生成专注统计。
4. 在“我的”页查看关系状态、消息中心、主题切换和更多功能。
5. 通过消息中心接收绑定请求、系统通知、同步反馈。

## 页面与功能说明

### 首页 / 时间线

- 回忆卡片展示（按时间排序）。
- 单图上传与批量上传。
- 图片压缩与时间信息提取（提升上传效率）。
- 支持不同展示模式（瀑布/故事流）。
- 年度统计（按年汇总回忆数量）。

### 纪念日

- 可新增、编辑、删除纪念日。
- 支持事件类型和副标题。
- 自动计算距离今天的天数与下一个发生日。
- 卡片化展示，突出近期事件与进度感。

### 专注

- 倒计时模式与正计时模式。
- 常用时长快捷选择 + 自定义时长。
- 完成后震动提醒 + 完成动效（替代音频打断）。
- 专注统计云端同步（今日时长、次数、连续天数、累计次数）。
- 计时状态云端持久化（切换页面后不丢失）。

### 我的

- 个人信息编辑（昵称、性别、头像）。
- 头像支持自定义上传并同步到云端。
- 邀请码状态、绑定状态、关系管理入口。
- 消息中心：
  - 时间精确到“日期 + 分钟”
  - 单条已读
  - 一键已读
  - 清空消息
- 主题切换与更多功能入口。

### 关系绑定

- 邀请码输入自动标准化（大小写、符号处理）。
- 绑定请求支持“发起 -> 对方确认/拒绝”。
- 支持解除绑定与重新绑定。
- 支持待确认请求列表与快捷处理。

### 账号安全

- 邮箱注册验证码。
- 邮箱登录。
- 忘记密码/重置密码验证码。
- 登录态恢复与会话同步。

## 特色能力（适合 GitHub 展示）

- 云端优先：核心数据上云，跨设备一致。
- 双人关系模型：情侣绑定后共享关键数据域。
- 高可用同步：前后端均有同步与容错策略（缓存、重试、去重、降级）。
- 移动端可交付：一套代码支持 Web + Android APK。
- 多渠道构建：`official` / `xiaomi` / `huawei` 风味包。
- 启动体验优化：Android 启动过渡与应用内启动动画。

## 技术架构

### 前端

- React + TypeScript + Vite
- Context 状态管理（`context.tsx` + `authContext.tsx`）
- 组件化页面：Timeline、Anniversary、Focus、Profile、Auth、Connection

### 后端

- Express 路由分层：`authRoutes` + `appRoutes`
- JWT 鉴权 + 访问控制
- 邮件验证码（SMTP）
- 图片上传链路（Supabase Storage）

### 数据层

- Supabase Postgres（用户、回忆、纪念日、通知、专注、经期、绑定请求等）
- Supabase Storage（头像与图片资源）

## 本地开发（完整步骤）

### 环境要求

- Node.js 18+
- npm 9+
- Supabase 项目（含 URL 与 Service Role Key）

### 1) 安装依赖

```bash
npm install
```

### 2) 配置后端环境变量

复制并编辑：

```bash
cp backend/.env.example backend/.env
```

最低必填：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`（至少 32 位）
- `JWT_EXPIRES_IN`
- `JWT_ISSUER`
- `JWT_AUDIENCE`

常用默认端口：

- Backend：`8787`
- Frontend：`5173`

### 3) 配置前端环境变量

本地开发建议：

```env
# .env.development
VITE_API_BASE_URL=/api
```

Vite 会通过 `vite.config.ts` 将 `/api` 代理到 `http://localhost:8787`。

### 4) 一键启动前后端

```bash
npm run dev:full
```

访问地址：

- 前端：`http://localhost:5173`
- 健康检查：`http://localhost:8787/api/health`

## Supabase 初始化

新项目首次初始化：

1. 打开 Supabase SQL Editor。
2. 执行 `backend/supabase/schema.sql`。

已有旧项目升级：

1. 执行 `backend/supabase/` 下对应迁移文件。
2. 建议按文件名日期顺序执行（`migration_YYYYMMDD_*.sql`）。

## 常用脚本

| 命令 | 说明 |
|---|---|
| `npm run dev` | 启动前端（Vite） |
| `npm run dev:backend` | 启动后端（Express） |
| `npm run dev:full` | 同时启动前后端 |
| `npm run build` | 前端生产构建 |
| `npm run check:text-encoding` | 检查文本编码与乱码 |
| `npm run build:mobile` | 构建 Web 并同步到 Android 工程 |
| `npm run android:sync` | 仅同步 Capacitor 到 Android |
| `npm run android:open` | 用 Android Studio 打开工程 |

## 部署（Vercel）

本仓库支持前后端同域部署，详细文档见：

- `DEPLOY_VERCEL.md`

关键点：

- `vercel.json` 已配置 `/api` 路由到 `api/index.js`
- 前端采用 SPA fallback 到 `index.html`
- 生产环境变量必须在 Vercel 项目中配置

## Android 打包（XLGift）

> 当前 Android 应用展示名已统一为：`XLGift`

### Debug APK

```bash
npm run build:mobile
cd android
./gradlew assembleDebug
```

Windows PowerShell 可用：

```powershell
npm run build:mobile
cd android
.\gradlew assembleDebug
```

输出示例：

- `android/app/build/outputs/apk/official/debug/app-official-universal-debug.apk`
- `android/app/build/outputs/apk/huawei/debug/app-huawei-universal-debug.apk`
- `android/app/build/outputs/apk/xiaomi/debug/app-xiaomi-universal-debug.apk`

### Release APK

```bash
npm run build:mobile
cd android
./gradlew assembleOfficialRelease
```

输出示例：

- `android/app/build/outputs/apk/official/release/app-official-universal-release.apk`

## 常见问题排查

### `Cannot GET /`

这是后端根路由现象，不是前端地址。请访问前端 `http://localhost:5173`。

### 登录时报 500

优先检查：

1. 后端是否运行在 `8787`。
2. `backend/.env` 是否缺少必填变量。
3. Supabase 表结构是否已执行。

### 头像改了但刷新后恢复

1. 确认后端启用了图片存储：`IMAGE_STORAGE_ENABLED=true`。
2. 确认 Supabase Storage bucket 存在。
3. 确认后端日志没有上传失败报错。

### 前端连不上后端

1. 确认 `vite.config.ts` 代理目标是 `http://localhost:8787`。
2. 确认前端实际访问的是 `http://localhost:5173`。
3. 如果改过端口，需同时改前端代理和后端 `PORT`。

## 仓库结构（简要）

```text
.
├─ api/                      # Vercel Serverless 入口
├─ backend/                  # Express + Supabase
│  ├─ src/
│  └─ supabase/
├─ components/               # 通用组件
├─ pages/                    # 页面层
├─ utils/                    # 工具与缓存
├─ android/                  # Capacitor Android 工程
├─ App.tsx                   # 应用入口
├─ context.tsx               # 业务数据上下文
├─ authContext.tsx           # 认证与通知上下文
└─ README.md
```

## 说明

- 该项目当前以私有业务场景迭代为主，文档会持续更新。
- 如用于商店上架，请先完成签名、隐私政策、合规与压力测试。
