# Android 上架前最后一步（版本号 / 图标 / 启动图 / 包名渠道）

## 0) 你现在要改的 4 个核心位置

> 兼容约束：仓库按“**不支持二进制文件**”维护，图标/启动图使用 XML 资源，`gradle-wrapper.jar` 通过脚本自动下载。

1. **版本号**：`android/gradle.properties`
2. **包名（渠道策略）**：`android/gradle.properties` + `android/app/build.gradle`
3. **应用图标**：`android/app/src/main/res/mipmap-*` + `mipmap-anydpi-v26`
4. **启动图（Splash）**：`android/app/src/main/res/values/styles.xml` + `values/colors.xml` + `drawable/splash_background.xml`

---

## 1) versionCode / versionName（统一管理）

在 `android/gradle.properties` 修改：

```properties
APP_VERSION_CODE=10001
APP_VERSION_NAME=1.0.1
```

规则建议：
- 每次提审 `APP_VERSION_CODE` 必须递增。
- `APP_VERSION_NAME` 用语义版本（如 `1.0.1` / `1.1.0`）。

`android/app/build.gradle` 已自动读取这两个值，无需多处重复改。

---

## 2) 包名渠道策略（小米 / 华为 / 官方）

在 `android/gradle.properties` 统一配置：

```properties
APP_ID_BASE=com.gifts.coupleconnection
APP_ID_XIAOMI=com.gifts.coupleconnection.mi
APP_ID_HUAWEI=com.gifts.coupleconnection.hw
```

`android/app/build.gradle` 已配置 3 个 flavor：
- `official`：官方包（通用）
- `xiaomi`：小米市场包（独立包名）
- `huawei`：华为市场包（独立包名）

这样做的好处：
- 各渠道独立审核与发布节奏。
- 渠道热修复互不影响。
- 便于灰度和分渠道统计。

---

## 3) 应用图标（Launcher Icon）

### 当前工程已就绪
- 已包含 adaptive icon 配置（`mipmap-anydpi-v26`）。
- 已有默认图标资源，可直接构建。

### 上架前建议替换
- 使用 Android Studio：`New -> Image Asset`
- 生成并覆盖：
  - `mipmap-mdpi/ic_launcher.png`
  - `mipmap-hdpi/ic_launcher.png`
  - `mipmap-xhdpi/ic_launcher.png`
  - `mipmap-xxhdpi/ic_launcher.png`
  - `mipmap-xxxhdpi/ic_launcher.png`
  - 对应 `ic_launcher_round` 与 `ic_launcher_foreground`

建议导出规格：1024x1024 源图（PNG，透明背景）。

---

## 4) 启动图（Splash）

当前已整理为可配置结构：
- 背景色：`@color/splashBackground`（`values/colors.xml`）
- 启动主题：`AppTheme.NoActionBarLaunch`（`values/styles.xml`）
- 背景层：`drawable/splash_background.xml`

你可按品牌更新：
1. `colors.xml` 改 `splashBackground`
2. `drawable/splash.png` 换你的启动图
3. 若需纯 Logo 启动，可替换 `windowSplashScreenAnimatedIcon`

---

## 5) 构建命令（不强制现在生成 APK）

```bash
npm run android:sdk:setup
npm run build:mobile
npm run android:apk:release
npm run android:bundle:release
```

### keystore 自动配置与验证（已可直接执行）

你可以直接执行：

```bash
bash scripts/create-android-keystore.sh /tmp/test-release.jks testalias testStorePass123 testKeyPass123 30 "CN=Test, OU=QA, O=QA, L=SZ, ST=GD, C=CN" JKS
```

脚本会自动生成/更新：
- `android/keystore.properties`
- `storeFile` 将自动转换为相对 `android/` 的路径，Gradle 可直接识别。

渠道包（可选）：

```bash
cd android
./gradlew assembleXiaomiRelease
./gradlew assembleHuaweiRelease
```

---

## 6) 兼容性清单（提审前）

### 通用
- [ ] Android 10~14 真机覆盖。
- [ ] 首启权限文案与隐私协议齐全。
- [ ] 弱网/断网/后台恢复流程正常。

### 小米
- [ ] 自启动允许。
- [ ] 电池策略设为“无限制”（如有保活需求）。
- [ ] 通知权限、锁屏通知、悬浮通知开启指引。

### 华为
- [ ] 启动管理设置为“手动管理”。
- [ ] 电池优化加入白名单（如有保活需求）。
- [ ] 若使用华为推送/账号能力，补 HMS 合规材料。

---

## 7) 安全提醒（非常重要）

- `SUPABASE_SERVICE_ROLE_KEY` 只允许后端保存。
- 前端与 APK 仅可放公开配置（如 API Base URL）。
- 若密钥曾泄露，请立即在 Supabase 控制台轮换。
