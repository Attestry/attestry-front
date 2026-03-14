import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = env.VITE_API_URL || 'http://localhost:8080';
  const ledgerUrl = env.VITE_LEDGER_API_URL || 'http://localhost:8081';

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/auth': apiUrl,
        '/api-v1/auth': apiUrl,
        '/onboarding': apiUrl,
        '/me': apiUrl,
        '/memberships': apiUrl,
        '/tenants': apiUrl,
        '/workflows': apiUrl,
        '/products': {
          target: apiUrl,
          bypass: (req, res, proxyOptions) => {
            if (req.headers.accept?.indexOf('text/html') !== -1) {
              return '/index.html';
            }
          }
        },
        '/ledgers': ledgerUrl,
        '/admin': {
          target: apiUrl,
          bypass: (req, res, proxyOptions) => {
            if (req.headers.accept?.indexOf('text/html') !== -1) {
              return '/index.html';
            }
          }
        },
        '/invitations': {
          target: apiUrl,
          bypass: (req, res, proxyOptions) => {
            if (req.headers.accept?.indexOf('text/html') !== -1) {
              return '/index.html';
            }
          }
        },
        '/api/invitations': {
          target: apiUrl,
          rewrite: (path) => path.replace(/^\/api/, '')
        },
      }
    }
  };
})
