import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:4173/trainer/',
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: 'pnpm run build && pnpm run preview --port 4173',
    url: 'http://localhost:4173/trainer/',
    reuseExistingServer: true,
    timeout: 60000,
  },
})
