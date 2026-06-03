import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/users': 'http://localhost:8080',
      '/friends': 'http://localhost:8080',
      '/posts': 'http://localhost:8080',
      '/cctvs': 'http://localhost:8080',
      '/danger-zones': 'http://localhost:8080',
      '/emergency-reports': 'http://localhost:8080',
      '/street-lamps': 'http://localhost:8080',
      '/safe-places': 'http://localhost:8080',
      '/safe-routes': 'http://localhost:8080',
      '/route-history': 'http://localhost:8080',
      '/favorite-places': 'http://localhost:8080',
    }
  }
})