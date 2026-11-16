import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1,
  use: { baseURL: 'http://127.0.0.1:5175', browserName: 'chromium', channel: 'chrome', trace: 'retain-on-failure' },
  projects: [{ name: 'desktop', testIgnore: /cloud\.spec\.ts/, use: { viewport: { width: 1440, height: 900 } } }, { name: 'mobile', testIgnore: /cloud\.spec\.ts/, use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 } }, { name: 'cloud-simulado', testMatch: /cloud\.spec\.ts/, use: { baseURL: 'http://127.0.0.1:5176', viewport: { width: 1440, height: 900 } } }],
  webServer: [
    { command: 'npm.cmd run dev -- --port 5175 --strictPort', url: 'http://127.0.0.1:5175', reuseExistingServer: false, env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_PUBLISHABLE_KEY: '', VITE_SUPABASE_ANON_KEY: '' } },
    { command: 'npm.cmd run dev -- --port 5176 --strictPort', url: 'http://127.0.0.1:5176', reuseExistingServer: false, env: { VITE_SUPABASE_URL: 'https://rosalie-test.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_test_only', VITE_SUPABASE_ANON_KEY: '' } },
  ],
});
