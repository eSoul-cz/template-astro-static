import { defineConfig, devices } from '@playwright/test';

// E2E smoke over the static build (`pnpm build` first). Against a running or deployed site:
// E2E_BASE_URL=https://staging.example pnpm test:e2e
const port = Number(process.env.E2E_PORT ?? 4330);
const baseURL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${port}`;

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
    use: {
        baseURL,
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [
        { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
        { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    ],
    webServer: process.env.E2E_BASE_URL
        ? undefined
        : {
              command: `node e2e/serve.mjs ${port}`,
              url: `${baseURL}/`,
              reuseExistingServer: !process.env.CI,
              timeout: 30_000,
          },
});
