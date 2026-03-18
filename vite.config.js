/* global process */
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const cwd = typeof process !== 'undefined' ? process.cwd() : undefined;

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, cwd ?? '', '');
  const apiUrl = env.VITE_API_URL || 'http://localhost:8080';
  const ledgerUrl = env.VITE_LEDGER_API_URL || 'http://localhost:8081';

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api/auth': {
          target: apiUrl,
          rewrite: (path) => path.replace(/^\/api/, '')
        },
        '/api/api-v1/auth': {
          target: apiUrl,
          rewrite: (path) => path.replace(/^\/api/, '')
        },
        '/api/onboarding': {
          target: apiUrl,
          rewrite: (path) => path.replace(/^\/api/, '')
        },
        '/api/me': {
          target: apiUrl,
          rewrite: (path) => path.replace(/^\/api/, '')
        },
        '/api/memberships': {
          target: apiUrl,
          rewrite: (path) => path.replace(/^\/api/, '')
        },
        '/api/tenants': {
          target: apiUrl,
          rewrite: (path) => path.replace(/^\/api/, '')
        },
        '/api/workflows': {
          target: apiUrl,
          rewrite: (path) => path.replace(/^\/api/, '')
        },
        '/api/products': {
          target: apiUrl,
          rewrite: (path) => path.replace(/^\/api/, '')
        },
        '/api/admin': {
          target: apiUrl,
          rewrite: (path) => path.replace(/^\/api/, '')
        },
        '/api/invitations': {
          target: apiUrl,
          rewrite: (path) => path.replace(/^\/api/, '')
        },
        '/api/ledgers': {
          target: ledgerUrl,
          rewrite: (path) => path.replace(/^\/api/, '')
        },
      }
    }
  };
})
