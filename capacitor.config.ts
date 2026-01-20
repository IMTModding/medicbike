import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.c8c83c438d584230b53a7b6bfe995fad',
  appName: 'medicbike',
  webDir: 'dist',
  server: {
    url: 'https://c8c83c43-8d58-4230-b53a-7b6bfe995fad.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    backgroundColor: '#0b1a2b'
  },
  android: {
    backgroundColor: '#0b1a2b',
    allowMixedContent: true
  },
  plugins: {
    BackgroundGeolocation: {
      locationAuthorizationRequest: 'Always',
      enableHeadless: true
    },
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#0b1a2b',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    },
    StatusBar: {
      style: 'dark',
      backgroundColor: '#0b1a2b'
    }
  }
};

export default config;
