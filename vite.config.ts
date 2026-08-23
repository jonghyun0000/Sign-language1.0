import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vite config — keeps things simple. MediaPipe loads its WASM/model from a CDN
// at runtime, so we don't need to bundle the heavy assets ourselves.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
  },
});
