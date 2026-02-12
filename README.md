<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Couple Connection

本仓库包含：
- 前端（Vite + React）
- 后端（Node + Express）
- Supabase（数据库 + Storage）
- Android 打包能力（Capacitor）

## 本地开发

**Prerequisites:** Node.js

1. 安装依赖：
   ```bash
   npm install
   ```
2. 启动前端：
   ```bash
   npm run dev
   ```
3. 启动后端：
   ```bash
   npm run dev:backend
   ```

## Supabase 配置（重要）

后端需要以下环境变量（放在后端运行环境，不要暴露到前端）：

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` 是高权限密钥，绝对不能写进前端 `.env` 或 APK。

## 打包 Android APK（手机安装）

> 说明：仓库已按“**不支持二进制文件**”要求移除图标/启动图 PNG 与 `gradle-wrapper.jar`。
> - 图标与启动图改为 XML 资源；
> - `gradle-wrapper.jar` 在执行 Android 打包命令时通过 `scripts/bootstrap-gradle-wrapper.sh` 自动下载。

### 1) 先修复 Android SDK 环境

```bash
npm run android:sdk:setup
```

### 2) 配置移动端 API 地址

复制并填写：

```bash
cp .env.android.example .env
```

至少配置：

```bash
VITE_API_BASE_URL=https://你的后端域名/api
```

### 3) 同步并生成 Android 工程

```bash
npm run build:mobile
```

### 4) 构建 Debug APK

```bash
npm run android:apk
```

APK 默认输出目录：

```text
android/app/build/outputs/apk/official/debug/app-official-universal-debug.apk
```

### 5) 安装到手机（小米/华为等）

```bash
adb install -r android/app/build/outputs/apk/official/debug/app-official-universal-debug.apk
```

> 若是首次安装，需在手机上允许“安装未知应用”。

## Release 签名与渠道包

```bash
npm run android:keystore:create -- android/app/release-keystore.jks coupleconnection <storePassword> <keyPassword> 3650 "CN=YourApp, OU=Mobile, O=YourOrg, L=Shenzhen, ST=Guangdong, C=CN" JKS   # 生成 release keystore 和 keystore.properties
npm run android:apk:release       # 输出 official 渠道 release APK
npm run android:bundle:release    # 输出 official 渠道 release AAB
```

## 多渠道 / 多 ABI

已配置：
- 渠道：`official` / `xiaomi` / `huawei`
- ABI：`armeabi-v7a` / `arm64-v8a` / `x86_64`（含 universalApk）

## 常用移动端命令

```bash
npm run android:sync        # 仅同步 Web 资源和插件
npm run android:open        # 用 Android Studio 打开原生工程
npm run android:apk         # 构建 debug APK
npm run android:apk:release # 构建 official 渠道 release APK
```


## 上架前最后一步（版本号/图标/启动图/包名渠道）

请直接按该文档操作：

- [docs/ANDROID_RELEASE_GUIDE.md](docs/ANDROID_RELEASE_GUIDE.md)

文档已把以下内容整合为一套流程：
- versionCode / versionName
- 应用图标与启动图替换
- 小米/华为/官方包名渠道策略

## 真机兼容清单（小米/华为）

请查看完整文档：

- [docs/ANDROID_RELEASE_GUIDE.md](docs/ANDROID_RELEASE_GUIDE.md)

## AI Code Review

This repository has GPT-powered automated code review enabled. See [setup instructions](.github/GPT_CODE_REVIEW_SETUP.md) ([English](.github/GPT_CODE_REVIEW_SETUP_EN.md)) for configuration details.
