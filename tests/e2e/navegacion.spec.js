// @ts-check
/* E2E — Intro de la home y navegación básica */
const { test, expect } = require('@playwright/test');

test('la intro se muestra una vez y da paso al hero', async ({ page }) => {
  await page.goto('/');

  // Overlay visible con su botón de entrada
  const intro = page.locator('#introOverlay');
  await expect(intro).toBeVisible();
  await page.locator('#introBtn').click();

  // La cortina sube y el hero queda accesible
  await expect(intro).toBeHidden({ timeout: 3000 });
  await expect(page.locator('.hero-title')).toBeVisible();

  // En la misma sesión, recargar NO vuelve a mostrar la intro
  await page.reload();
  await expect(intro).toBeHidden();
});

test('navegación entre páginas y enlace activo', async ({ page }) => {
  await page.goto('/pages/carta.html');
  await expect(page.locator('.nav-links a.active')).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('h1')).toContainText('carta');
});
