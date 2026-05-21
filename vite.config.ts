import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // 카메라 권한은 HTTPS 또는 localhost에서만 작동합니다.
    // Camera permissions only work on HTTPS or localhost.
    host: true,
  },
  optimizeDeps: {
    exclude: ['@mediapipe/tasks-vision'],
  },
});
