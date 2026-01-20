import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.c8c83c438d584230b53a7b6bfe995fad',
  appName: 'medicbike',
  webDir: 'dist',
  server: {
    url: 'https://c8c83c43-8d58-4230-b53a-7b6bfe995fad.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    BackgroundGeolocation: {
      // iOS specific
      locationAuthorizationRequest: 'Always',
      // Android specific  
      enableHeadless: true
    }
  }
};

export default config;
