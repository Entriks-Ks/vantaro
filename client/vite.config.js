import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['libphonenumber-js'],
  },
  optimizeDeps: {
    include: ['react-phone-number-input', 'libphonenumber-js', 'libphonenumber-js/min/metadata'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
