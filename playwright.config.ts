import { defineConfig, devices } from '@playwright/test';

const publicBaseURL = process.env.PLAYWRIGHT_BASE_URL;

const chromiumExecutablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: publicBaseURL ?? 'http://127.0.0.1:5178',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    launchOptions: {
      ...(chromiumExecutablePath
        ? { executablePath: chromiumExecutablePath }
        : {}),
      // Supply Chromium's deterministic test camera. The application still has
      // to call getUserMedia from an explicit user action before it can start.
      args: [
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
      ],
    },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: publicBaseURL ? undefined : {
    command: 'npm run preview',
    port: 5178,
    reuseExistingServer: false,
  },
});
