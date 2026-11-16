import { defineConfig, loadEnv } from 'vite';
import { writeFileSync } from 'node:fs';
import { assertNoPrivateFrontendEnv, validatePublicBackend } from './src/security';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  assertNoPrivateFrontendEnv(env);
  const url = env.VITE_SUPABASE_URL || '', key = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '';
  validatePublicBackend(url, key);
  const origin = url ? new URL(url).origin : '';
  const csp = `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: ${origin}; font-src 'self'; connect-src 'self' ${origin} ${origin.replace('https:', 'wss:')}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`;
  const headers = { 'Content-Security-Policy': csp, 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()', 'Cache-Control': 'no-store' };
  return {
    plugins: [react(), tailwindcss(), { name: 'rosalie-security-headers', writeBundle() {
      writeFileSync('dist/_headers', '/*\n' + Object.entries({ ...headers, 'Content-Security-Policy': csp + '; upgrade-insecure-requests', 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' }).map(([k,v]) => `  ${k}: ${v}`).join('\n') + '\n');
    } }],
    // HMR do Vite usa scripts de desenvolvimento; a CSP estrita é validada no preview da build.
    server: { headers: { 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' } },
    preview: { headers },
    build: { rollupOptions: { output: { manualChunks: { charts: ['recharts'] } } } },
  };
});
