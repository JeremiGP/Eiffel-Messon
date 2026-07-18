// @ts-check
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    // El sitio ahora detecta el idioma del navegador y redirige a /en/ o
    // /fr/ en la primera visita. Los tests validan el flujo en español,
    // así que fijamos el locale para que no nos saque de la raíz.
    locale: 'es-ES',
  },
  // Sirve el sitio estático durante los tests
  webServer: {
    command: 'npx http-server Messon_Eiffel -p 5173 --silent',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'movil',    use: { ...devices['iPhone 13'] } },
  ],
});
