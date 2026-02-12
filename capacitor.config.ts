import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gifts.coupleconnection',
  appName: 'Couple Connection',
  webDir: 'dist',
  android: {
    allowMixedContent: true,
    captureInput: true,
  },
  server: {
    androidScheme: 'https',
  },
};

export default config;
