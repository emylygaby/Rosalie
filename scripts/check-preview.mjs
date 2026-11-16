import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';

const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', '5177', '--strictPort'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
let browser;
try {
  await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('preview_timeout')), 15000); child.once('exit', () => { clearTimeout(timer); reject(new Error('preview_failed')); }); child.stdout.on('data', chunk => { if (chunk.toString().includes('5177')) { clearTimeout(timer); resolve(); } }); });
  browser = await chromium.launch({ channel: 'chrome' }); const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message)); page.on('console', msg => { if (msg.type() === 'error' && /Content Security Policy|Refused to/i.test(msg.text())) errors.push(msg.text()); });
  const response = await page.goto('http://127.0.0.1:5177/login'); const headers = response.headers();
  assert.match(headers['content-security-policy'], /script-src 'self';/); assert.match(headers['content-security-policy'], /object-src 'none'/); assert.match(headers['content-security-policy'], /frame-ancestors 'none'/);
  assert.equal(headers['referrer-policy'], 'no-referrer'); assert.equal(headers['x-content-type-options'], 'nosniff'); assert.equal(headers['cache-control'], 'no-store');
  await page.getByRole('link', { name: 'Aviso de privacidade e seus direitos' }).click(); await page.getByRole('heading', { name: 'Aviso de privacidade', exact: true }).waitFor();
  await page.screenshot({ path: 'docs/evidence/mobile-privacidade.png', fullPage: true });
  await page.goto('http://127.0.0.1:5177/login'); await page.getByRole('button', { name: 'Conhecer a demonstração', exact: true }).click(); await page.locator('.balance').waitFor();
  await page.goto('http://127.0.0.1:5177/planner'); await page.getByRole('button', { name: 'Criar cofre do ciclo', exact: true }).waitFor(); await page.screenshot({ path: 'docs/evidence/mobile-cofre.png', fullPage: true });
  await page.goto('http://127.0.0.1:5177/analises'); await page.locator('.recharts-wrapper').first().waitFor();
  assert.deepEqual(errors, []); console.log('Preview de produção: CSP, cabeçalhos, rotas, gráficos e cofre verificados no Chrome.');
} finally { await browser?.close(); child.kill(); }
