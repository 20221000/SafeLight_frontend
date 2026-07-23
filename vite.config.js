import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // 기본값은 IPv6 루프백([::1])만 열어 adb reverse(IPv4 127.0.0.1)가 닿지 못한다.
    host: '127.0.0.1',
    proxy: {
      '/users': 'http://localhost:8080',
      '/friends': 'http://localhost:8080',
      '/messages': 'http://localhost:8080',
      '/posts': 'http://localhost:8080',
      '/cctvs': 'http://localhost:8080',
      '/danger-zones': 'http://localhost:8080',
      '/emergency-reports': 'http://localhost:8080',
      '/street-lamps': 'http://localhost:8080',
      '/safe-places': 'http://localhost:8080',
      '/safe-routes': 'http://localhost:8080',
      '/route-history': 'http://localhost:8080',
      '/favorite-places': 'http://localhost:8080',
      '/routes': 'http://localhost:8080',
      '/bookmarks': 'http://localhost:8080',
    }
  }
})