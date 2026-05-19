import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.klevby.app',
  appName: 'Klevby',
  webDir: 'www',
  server: {
    url: 'https://klevby.com',
    cleartext: false
  }
};

export default config;
