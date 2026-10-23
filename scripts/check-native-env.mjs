import { loadEnv } from 'vite';

const ROOT = process.cwd();
const MODE = 'production';

// Hosts that only resolve on the developer machine or the Android emulator.
// A real phone cannot reach any of these, so an APK built against them is dead on arrival.
const UNREACHABLE_HOSTS = new Set([
  '10.0.2.2', // emulator alias for the host loopback
  'localhost',
  '127.0.0.1',
  '::1',
  '[::1]',
]);

const fail = (lines) => {
  console.error('\n\x1b[31m✗ 原生构建环境校验失败\x1b[0m\n');
  lines.forEach((line) => console.error(`  ${line}`));
  console.error('');
  process.exit(1);
};

const env = loadEnv(MODE, ROOT, '');
const rawUrl = env.VITE_API_BASE_URL_MOBILE || env.VITE_API_BASE_URL || '';
const allowEmulatorUrl = String(process.env.ALLOW_EMULATOR_API_URL || '').toLowerCase();
const emulatorBypass = ['1', 'true', 'yes', 'on'].includes(allowEmulatorUrl);

if (!rawUrl.trim()) {
  fail([
    `vite build 使用 production 模式，但没有任何环境变量提供接口地址。`,
    `当前生效值会退回到 apiClient.ts 里的 http://10.0.2.2:8787/api（仅安卓模拟器可用）。`,
    ``,
    `解决办法：新建 .env.production（参考 .env.production.example），至少填写：`,
    `  VITE_API_BASE_URL_MOBILE=https://你的后端域名/api`,
    ``,
    `注意 .env.production 会被提交进仓库，只放公开域名，不要放任何密钥。`,
    `如果你确实只是在模拟器里调试，可以用 ALLOW_EMULATOR_API_URL=1 跳过本校验。`,
  ]);
}

let parsed;
try {
  parsed = new URL(rawUrl);
} catch {
  fail([
    `接口地址不是合法的绝对 URL：${rawUrl}`,
    `原生环境里没有 web 服务器兜底，"/api" 这种相对路径无法工作。`,
    `请改成完整地址，例如 https://你的后端域名/api`,
  ]);
}

if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
  fail([`接口地址协议必须是 http 或 https，当前是 ${parsed.protocol}`]);
}

const PLACEHOLDER_HOSTS = ['your-backend-domain.com', 'example.com', 'your-domain.com'];
if (PLACEHOLDER_HOSTS.includes(parsed.hostname.toLowerCase())) {
  fail([
    `接口地址还是模板里的占位域名：${rawUrl}`,
    `请把它换成你真实的后端地址（Vercel 部署域名或你自己的服务器）。`,
  ]);
}

if (UNREACHABLE_HOSTS.has(parsed.hostname.toLowerCase()) && !emulatorBypass) {
  fail([
    `接口地址 ${rawUrl} 指向 ${parsed.hostname}，真机上访问不到。`,
    ``,
    `请改成手机能访问到的地址：`,
    `  · 线上后端：https://你的后端域名/api`,
    `  · 局域网联调：http://你电脑的局域网IP:8787/api（手机需与电脑同一 WiFi）`,
    ``,
    `只在安卓模拟器里调试时可跳过：ALLOW_EMULATOR_API_URL=1`,
  ]);
}

if (parsed.protocol === 'http:') {
  console.warn(
    `\x1b[33m⚠ 接口地址使用明文 HTTP（${rawUrl}）。\x1b[0m\n` +
      '  AndroidManifest 已开启 usesCleartextTraffic，局域网联调可用；\n' +
      '  正式发布请换成 HTTPS，否则登录令牌会在网络上明文传输。\n'
  );
}

console.log(`✓ 原生构建接口地址校验通过：${rawUrl}`);
