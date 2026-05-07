import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ci.cabine.app',
  appName: 'Cabine 2.0',
  webDir: 'dist',

  // Production: l'app pointe vers le serveur live — mises à jour sans rebuild APK
  server: {
    url: 'https://cabine.ci',
    androidScheme: 'https',
    cleartext: false,
    allowNavigation: ['cabine.ci', '*.cabine.ci'],
  },

  android: {
    backgroundColor: '#f5f6fa',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    // Kiosk: empêche l'accès aux autres apps depuis l'APK
    appendUserAgent: 'Cabine2Terminal/1.0',
  },

  plugins: {
    SplashScreen: {
      launchShowDuration: 2500,
      launchAutoHide: true,
      backgroundColor: '#6366f1',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#6366f1',
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
      style: 'light',
    },
    // Désactive le bouton retour Android sur les écrans racine (kiosque)
    App: {
      exitDelay: 2000,
    },
  },
};

export default config;
