import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          table: ['@tanstack/react-table', 'react-hook-form', '@hookform/resolvers', 'zod'],
          icons: ['lucide-react'],
          math: ['decimal.js', 'date-fns'],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
