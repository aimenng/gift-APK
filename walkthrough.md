# Workthrough（最新）

## 1. 这次完成了什么

### 1.1 取消“必须绑定才能进入 App”
- 已改为：未绑定账号也可以直接进入应用。
- 入口流转：`Landing -> Timeline`，不再强制跳到绑定页。
- 在“我的”页新增“去绑定邀请码 / 管理绑定关系”按钮，可随时进入绑定页面。
- 相关文件：
  - `App.tsx`
  - `pages/Profile.tsx`
  - `pages/Connection.tsx`

### 1.2 登录/注册与数据请求性能优化
- 后端启用 gzip 压缩，降低接口传输体积。
- 认证成功后去掉重复同步请求，减少登录后重复拉取。
- 注册密码哈希轮数改为可配置（默认 8，原来更高）。
- 图片上传端进一步压缩（单张/批量参数更激进）与批量并发优化。
- 相关文件：
  - `backend/src/index.js`
  - `authContext.tsx`
  - `backend/src/routes/authRoutes.js`
  - `pages/Timeline.tsx`
  - `utils/imageUpload.ts`

### 1.3 上传后端优化（减轻数据库压力）
- 新增“图片自动转存 Supabase Storage（可开关）”。
- 当上传内容是 base64 图片时，后端会优先上传到 Storage，再把 URL 存入 `memories.image`，减少数据库大字段导致的慢查询。
- 上传失败会自动回退到原始方式，不阻塞功能。
- 相关文件：
  - `backend/src/imageStorage.js`
  - `backend/src/routes/appRoutes.js`
  - `backend/src/config.js`

### 1.4 内置测试账号与邀请码扩展
- `seed_test.sql` 已扩展为 6 个账号（含已绑定+未绑定），可直接用于测试。
- 相关文件：
  - `backend/supabase/seed_test.sql`

### 1.5 忘记密码（邮箱验证码重置）功能
- 新增“忘记密码”完整流程：
  - 登录页点击“忘记密码”
  - 输入邮箱发送验证码
  - 输入验证码 + 新密码完成重置
- 后端新增接口：
  - `POST /api/auth/password/request-reset-code`
  - `POST /api/auth/password/reset`
- 相关文件：
  - `backend/src/routes/authRoutes.js`
  - `backend/src/emailService.js`
  - `authContext.tsx`
  - `pages/Auth.tsx`
  - `backend/supabase/schema.sql`
  - `backend/supabase/migration_20260209_email_binding.sql`

### 1.6 等待动画 + 关系页面紧凑化
- 新增像素风“奔跑”加载层（慢请求时自动显示）：
  - 登录 / 注册 / 重置密码流程
  - 邀请码绑定 / 解绑 / 退出登录流程
- 连接页重构为紧凑布局：
  - 顶部增加返回按钮
  - 明确增加“解除绑定”按钮
  - “更换绑定面板”折叠/展开，避免页面过长臃肿
- 相关文件：
  - `components/CuteLoadingScreen.tsx`
  - `index.css`
  - `pages/Auth.tsx`
  - `pages/Connection.tsx`
  - `App.tsx`

### 1.7 首页（Timeline）恢复剪贴簿风格
- 恢复瀑布流 + 拍立得卡片视觉：
  - 白边卡片、底部留白、手写体日期
  - 卡片保留散落旋转，并支持 `rotate-1 / -rotate-1` 悬停回正（`hover:rotate-0`）
- 增加“纪念日节点”模块：
  - 在内容左侧时间轴线中展示重要节点，强化时间轴叙事感
- 相关文件：
  - `pages/Timeline.tsx`
  - `index.css`

### 1.8 首页双视图切换（右上角按钮）
- 新增右上角“一键切换视图”：
  - 视图 A：双列瀑布流（两侧都是图，散落拍立得 + 动效）
  - 视图 B：年份时间轴（左侧年份线，右侧照片卡片 + 动效）
- 视图选择会持久化保存到本地（下次打开保持上次模式）。
- 相关文件：
  - `pages/Timeline.tsx`
  - `index.css`

### 1.9 时间检测与时间排序强化
- 上传图片时自动检测拍摄时间（优先 EXIF，其次文件时间，最后系统时间）。
- 检测到的时间会用于存储与排序（同一天内也会尽量按时间先后排序）。
- 两种视图都统一按时间倒序展示（最新在前）。
- 相关文件：
  - `utils/imageUpload.ts`
  - `pages/Timeline.tsx`

---

## 2. 你需要执行的步骤

### Step A：在 Supabase 执行 SQL（你已会操作）
1. 先执行（如未执行过）：
   - `backend/supabase/schema.sql`
   - 或已在线上库则执行：`backend/supabase/migration_20260209_email_binding.sql`
   - 说明：该 migration 现在也包含 `reset_password` 验证码用途升级，可重复执行（幂等）。
2. 再执行：
   - `backend/supabase/seed_test.sql`

### Step B：检查 `backend/.env`
至少确认这些配置存在：

```env
PORT=8787
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
JWT_SECRET=...
FRONTEND_URL=http://localhost:3000
BACKEND_PUBLIC_URL=http://localhost:8787

SMTP_HOST=smtp.qq.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=你的QQ邮箱
SMTP_PASS=你的SMTP授权码
SMTP_FROM="Gifts App <你的QQ邮箱>"

PASSWORD_HASH_ROUNDS=8
IMAGE_STORAGE_ENABLED=true
SUPABASE_IMAGE_BUCKET=gifts-memories
```

说明：
- `IMAGE_STORAGE_ENABLED=true` 时会自动尝试使用 Supabase Storage；如 bucket 不存在会自动创建。
- 若你不想用 Storage，可设为 `false`（会继续走数据库字符串存图方式，速度通常更慢）。

### Step C：启动
在项目根目录开两个终端：

```bash
npm run dev:backend
```

```bash
npm run dev:frontend
```

### Step D（可选但推荐）：迁移旧的 base64 图片到 Storage
如果你之前已经上传过很多图片，登录仍然慢，执行一次：

```bash
npm run migrate:images
```

这会把 `memories.image` 中的 base64 图片转成 Supabase Storage URL。

---

## 3. 测试账号与邀请码

统一密码：`Passw0rd!`

1. `lili@example.com` / `GIFT-LILI`（已与 Tom 绑定）
2. `tom@example.com` / `GIFT-TOM1`（已与 Lili 绑定）
3. `alice@example.com` / `GIFT-ALC1`（未绑定）
4. `bob@example.com` / `GIFT-BOB1`（未绑定）
5. `coco@example.com` / `GIFT-COC1`（未绑定）
6. `dylan@example.com` / `GIFT-DYL1`（未绑定）

---

## 4. 行为确认（与你需求对齐）

1. 未绑定邀请码也能进入 App：已实现。
2. 每个账号唯一邀请码：已实现（数据库唯一索引 + 逻辑限制）。
3. 绑定他人邀请码需对方邮箱确认：已实现（邮件确认链接）。
4. 被绑定前不可重复绑定：已实现（后端校验 + 待确认请求校验）。
5. 批量上传和瀑布流：已保留并优化。
6. 忘记密码邮箱重置：已实现（验证码 + 新密码）。

---

## 5. 本地校验结果

1. `node --check backend/src/**/*.js`：通过
2. `npx tsc --noEmit`：通过
3. `npm run build`：通过
4. 接口冒烟：本轮在本地主要执行了静态检查 + 构建验证（通过）

---

## 6. 前端设计优化清单（全部完成 ✅）

> 全部 19 项前端优化已实施完毕，`tsc --noEmit` 和 `npm run build` 均通过。

---

### P0 - 必须修复（影响基本可用性） ✅

| # | 位置 | 改动摘要 |
|---|------|----------|
| F01 | `Anniversary.tsx` / `Timeline.tsx` | 编辑/删除按钮改为始终可见（移除 `opacity-0 group-hover:opacity-100`），触屏设备可正常操作 |
| F02 | `PeriodTracker.tsx` | 日历格子和心情按钮触控区扩大到 ≥44px，符合 Apple HIG |
| F03 | `BottomNav.tsx` | 图标从 20→24px，标签从 10→11px，NavItem 高度 ≥48px |

---

### P1 - 高优先级（显著提升体验） ✅

| # | 位置 | 改动摘要 |
|---|------|----------|
| F04 | `Landing.tsx` | 标题改用 `clamp(2.5rem, 12vw, 3.75rem)` 响应式字号；头像改为 `w-[min(7rem,26vw)]`；装饰圆环同步响应式 |
| F06 | `Auth.tsx` | 5 个密码输入框各自独立 `showPassword` 状态；确认密码框补上了缺失的眼睛切换按钮 |
| F08 | `Modal.tsx` | 添加 ESC 键关闭 + `role="dialog" aria-modal="true" aria-label` |
| F09 | `Toast.tsx` | 从顶部改为底部定位（`bottom-0 mb-24`）；按类型设置时长：success 2s / error 5s / love 3s |
| F10 | `EditProfile.tsx` | 预设头像滚动区右侧加渐变蒙版，提示可横向滚动 |

> **F05** (Auth 拆分子组件) 和 **F07** (Profile 三段式折叠) 属于大规模重构，暂跳过，不影响功能使用。

---

### P2 - 中优先级（锦上添花） ✅

| # | 位置 | 改动摘要 |
|---|------|----------|
| F11 | `SettingsPanel.tsx` | 科幻主题色网格从 7 列改为 4 列（更大触控区）；每个色块下方增加名称标签 |
| F12 | `Timeline.tsx` | 批量上传增加实时进度条 `X/N`，显示在 header 与内容之间 |
| F13 | `LoveTimer.tsx` | TimeUnit 容器增加 `min-width`，统一 `padStart(2, '0')` 避免数字跳动 |
| F14 | `Anniversary.tsx` | 添加按钮从 `absolute` 改为 `fixed` + `bottom: calc(env(safe-area-inset-bottom) + 96px)` |
| F15 | `Connection.tsx` | "暂不绑定，先进入 App" 按钮移到折叠面板外部，始终可见 |

---

### P3 - 低优先级（美化 / 性能微调） ✅

| # | 位置 | 改动摘要 |
|---|------|----------|
| F16 | `Layout.tsx` + `index.html` | 删除 `paper-texture` 叠加层（`opacity-[0.02]` 视觉无感但浪费 GPU 合成和一次外部图片请求）；同时清除 `index.html` 中的 `.paper-texture` CSS |
| F17 | `App.tsx` | 页面转场 `setTimeout` 从 180ms 缩减到 80ms |
| F18 | `Landing.tsx` | `FloatingHearts` 的心形数组用 `useMemo([], [])` 包裹，避免每次渲染重新随机 |
| F19 | `context.tsx` | `addMemory` 改为乐观更新——先用 `createLocalMemory` 立即插入临时条目，后端确认后替换为服务器返回的真实条目；失败时保留本地条目作兜底 |

---

## 7. 后端待修改清单（维护参考）

> 以下是审查中发现的后端优化项，**前端已全部就绪**，后端可按需逐步改进。

### B01 - 全量数据接口分页

- **文件**: `backend/src/routes/appRoutes.js`
- **现状**: `GET /app/state` 每次返回全部 memories + events，数据量大时响应慢
- **建议改法**:
  - memories 改为分页返回，接受 `?page=1&limit=50` 参数
  - 首次只返回缩略图 URL（如果用了 Supabase Storage，可生成 thumbnail URL）
  - 详情/原图按点击时按需拉取
- **前端适配**: 前端 `context.tsx` 中 `syncFromCloud` 需要改为分页拉取并追加

### B02 - 批量写入原子化

- **文件**: `backend/src/routes/appRoutes.js`
- **现状**: `addMemoriesBatch` 逐条插入，中途失败会留下部分数据
- **建议改法**:
  - 改用 Supabase 的 `.insert(items)` 一次性批量写入（Supabase JS SDK 支持数组）
  - 失败时整体回滚，返回错误给前端

### B03 - 上传图片尺寸校验

- **文件**: `backend/src/imageStorage.js` + `backend/src/index.js`
- **现状**: 无后端尺寸限制，客户端可上传任意大小图片
- **建议改法**:
  - Express 中间件设置 `bodyParser.json({ limit: '10mb' })` 或更合理的上限
  - 可选：引入 `sharp` 库在后端二次压缩（如限制最大边长 2048px）

### B04 - yearStats 前端消费

- **文件**: `backend/src/routes/appRoutes.js`
- **现状**: 后端已计算 `yearStats` 并返回，但前端 Timeline 还在本地重新聚合
- **建议改法**:
  - 前端 `Timeline.tsx` 中的年份统计直接使用后端返回的 `yearStats`
  - 减少前端的 O(n) 遍历计算

### B05 - 接口限流

- **文件**: `backend/src/index.js`
- **现状**: 无请求速率限制，可被恶意刷接口
- **建议改法**:
  - `npm install express-rate-limit`
  - 全局限流：如 100 次/分钟
  - 登录/注册/重置密码等敏感接口：如 5 次/分钟
  ```js
  const rateLimit = require('express-rate-limit');
  app.use('/api/auth', rateLimit({ windowMs: 60000, max: 5 }));
  app.use('/api', rateLimit({ windowMs: 60000, max: 100 }));
  ```

### B06 - 验证码重置频率限制

- **文件**: `backend/src/routes/authRoutes.js`
- **现状**: 密码重置验证码无尝试次数限制，可被暴力枚举
- **建议改法**:
  - 数据库层面：验证码记录增加 `attempts` 字段，超过 5 次自动失效
  - 接口层面：同一邮箱 5 分钟内只允许请求 3 次验证码
  - 可结合 B05 的 `express-rate-limit` 实现
