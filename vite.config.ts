import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      // Use Vite default-ish dev port to avoid collisions with other tools on :3000.
      port: 5173,
      // Do not silently switch ports; fail fast so users always know the correct URL.
      strictPort: true,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: env.VITE_BACKEND_URL || 'http://localhost:8787',
          changeOrigin: true,
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
