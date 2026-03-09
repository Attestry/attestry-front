import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/auth': 'http://localhost:8080',
      '/api-v1/auth': 'http://localhost:8080',
      '/onboarding': 'http://localhost:8080',
      '/me': 'http://localhost:8080',
      '/tenants': 'http://localhost:8080',
      '/workflows': 'http://localhost:8080',
      '/products': 'http://localhost:8080',
      '/ledgers': 'http://localhost:8080',
      '/admin': {
        target: 'http://localhost:8080',
        bypass: (req, res, proxyOptions) => {
          if (req.headers.accept?.indexOf('text/html') !== -1) {
            return '/index.html';
          }
        }
      },
      '/invitations': {
        target: 'http://localhost:8080',
        bypass: (req, res, proxyOptions) => {
          if (req.headers.accept?.indexOf('text/html') !== -1) {
            return '/index.html';
          }
        }
      },
      '/api/invitations': {
        target: 'http://localhost:8080',
        rewrite: (path) => path.replace(/^\/api/, '')
      },
    }
  }
})
