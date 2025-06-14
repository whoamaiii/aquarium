import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@assets': path.resolve(__dirname, './src/assets'),
      '@components': path.resolve(__dirname, './src/components'),
      '@data': path.resolve(__dirname, './src/data'),
      '@engine': path.resolve(__dirname, './src/engine'),
      '@gpu': path.resolve(__dirname, './src/gpu'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@shaders': path.resolve(__dirname, './src/shaders'),
      '@util': path.resolve(__dirname, './src/util'),
      '@': path.resolve(__dirname, './src'),
    },
  },
})
