// @ts-check
/* ============================================================
   E2E — Wizard de reservas (modo demo)
   ------------------------------------------------------------
   Los tests fuerzan SIEMPRE el modo demo interceptando config.js
   y sirviendo valores de ejemplo: aunque exista un config.js con
   claves reales (local) o lo genere Netlify, NUNCA se toca la
   base de datos real desde los tests.
   ============================================================ */
const { test, expect } = require('@playwright/test');

// config.js de ejemplo → reservas.js detecta 'TU-PROYECTO' y simula el envío
const CONFIG_DEMO = `
const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'clave-de-ejemplo';
`;

test.beforeEach(async ({ page }) => {
  await page.route('**/assets/js/config.js', route =>
    route.fulfill({ contentType: 'application/javascript', body: CONFIG_DEMO })
  );
});

test('flujo completo: fecha → hora → personas → datos → confirmación', async ({ page }) => {
  await page.goto('/pages/reservas.html');

  // Paso 1 — ir al mes siguiente (todos sus días son futuros y, en
  // demo, con disponibilidad) y elegir el día 15
  await page.getByLabel('Mes siguiente').click();
  await page.locator('.cal-day:not(.cal-day--disabled)', { hasText: /^15$/ }).click();

  // Hora: primera franja disponible
  await page.locator('.hora-pill:not(.hora-pill--disabled)').first().click();

  // Personas: mesa de 2
  await page.locator('.persona-btn[data-n="2"]').click();
  await page.locator('#next-1').click();

  // Paso 2 — datos de contacto
  await expect(page.locator('#step-2')).toHaveClass(/active/);
  await page.locator('#nombre').fill('Prueba');
  await page.locator('#apellidos').fill('E2E Playwright');
  await page.locator('#telefono').fill('600123456');
  await page.locator('#email').fill('prueba@example.com');
  await page.locator('#next-2').click();

  // Paso 3 — enviar (modo demo: envío simulado)
  await expect(page.locator('#step-3')).toHaveClass(/active/);
  await page.locator('.btn-submit').click();

  await expect(page.locator('#confirmado')).toHaveClass(/active/, { timeout: 5000 });
  await expect(page.locator('#confirmado')).toContainText('recibida');
});

test('validación: no se avanza sin fecha, hora y personas', async ({ page }) => {
  await page.goto('/pages/reservas.html');
  await page.locator('#next-1').click();

  // Mensajes de error accesibles (role=alert) y seguimos en el paso 1
  await expect(page.locator('#fecha-error')).toContainText('fecha');
  await expect(page.locator('#hora-error')).toContainText('hora');
  await expect(page.locator('#step-1')).toHaveClass(/active/);
});

test('validación: teléfono español debe tener 9 dígitos', async ({ page }) => {
  await page.goto('/pages/reservas.html');

  await page.getByLabel('Mes siguiente').click();
  await page.locator('.cal-day:not(.cal-day--disabled)', { hasText: /^15$/ }).click();
  await page.locator('.hora-pill:not(.hora-pill--disabled)').first().click();
  await page.locator('.persona-btn[data-n="4"]').click();
  await page.locator('#next-1').click();

  await page.locator('#nombre').fill('Prueba');
  await page.locator('#apellidos').fill('Teléfono corto');
  await page.locator('#telefono').fill('60012');
  await page.locator('#next-2').click();

  await expect(page.locator('#telefono-error')).toContainText('9 dígitos');
  await expect(page.locator('#step-2')).toHaveClass(/active/);
});
