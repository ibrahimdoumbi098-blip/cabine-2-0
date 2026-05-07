import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      // Capacitor packages are only available in native APK builds — not in web/PWA bundles
      external: [
        '@capacitor/app',
        '@capacitor/core',
        '@capacitor/haptics',
        '@capacitor/keyboard',
        '@capacitor/network',
        '@capacitor/share',
        '@capacitor/splash-screen',
        '@capacitor/status-bar',
      ]
    }
  }
})
