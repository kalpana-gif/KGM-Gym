import { defineConfig } from '@playwright/test';

const existingServer = process.env.AI_TEST_BASE_URL;

export default defineConfig({
  testDir: './tests',
  testMatch: 'photo-live.pw.ts',
  timeout: 90_000,
  workers: 1,
  use: {
    baseURL: existingServer ?? 'http://127.0.0.1:5175',
    viewport: { width: 390, height: 844 },
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  webServer: existingServer ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1 --port 5175 --strictPort',
    url: 'http://127.0.0.1:5175',
    reuseExistingServer: false,
  },
});
