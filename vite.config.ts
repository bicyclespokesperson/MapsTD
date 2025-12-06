import { defineConfig } from 'vite';

export default defineConfig({
  base: '/MapsTD/',
  build: {
    chunkSizeWarningLimit: 2000,
  },
});
