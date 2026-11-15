import { defineConfig, devices } from '@playwright/test';
import { writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000';
// The UI defaults to English; the e2e suite asserts Ukrainian copy, so pin the language for tests.
const storageState = join(tmpdir(), 'agrosas-e2e-lang-uk.json');
writeFileSync(storageState, JSON.stringify({ cookies: [], origins: [{ origin: new URL(baseURL).origin, localStorage: [{ name: 'fieldshift-language', value: 'uk' }] }] }));

export default defineConfig({
  testDir: './tests',
  testMatch: /.*\.spec\.ts/,
  fullyParallel: false,
  retries: 0,
  workers: 1,
  use: {
    baseURL,
    storageState,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
