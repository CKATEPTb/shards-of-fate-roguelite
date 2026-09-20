import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './tests/browser',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  // Recording a continuous canvas screencast saturates software-rendered Chromium.
  // Retain action/DOM/source traces plus a still image on failure instead.
  use: { baseURL, trace: { mode: 'retain-on-failure', screenshots: false, snapshots: true, sources: true }, screenshot: 'only-on-failure' },
  // Exercise the shipped assets on an isolated server, independent of dev/HMR state.
  webServer: { command: 'npm run build && npm run preview -- --port 4173 --strictPort', url: baseURL, reuseExistingServer: false, timeout: 90_000 },
  projects: [ { name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } } ],
});
