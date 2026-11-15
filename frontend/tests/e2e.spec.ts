import { test, expect } from '@playwright/test';

test.describe('FieldShift: Earth OS Web App', () => {
  test('Landing page renders hero, pillars, and CTA', async ({ page }) => {
    await page.goto('/welcome');
    await expect(page).toHaveTitle(/AGROSAS/i);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByText(/From Space to Soil/i).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /До мого господарства/i }).first()).toBeVisible();
  });

  test('Main Dashboard loads farm, KPIs, and field information', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByText('AGROSAS Global Farms')).toBeVisible();
    await expect(page.locator('.map-card h2')).toBeVisible();
    await expect(page.locator('.kpi')).toHaveCount(4);
    // Verify KPI cards
    await expect(page.getByText('Стан рослинності', { exact: false })).toBeVisible();
    await expect(page.locator('.kpi').nth(1)).toBeVisible();
    await expect(page.getByText('Кліматичний ризик', { exact: false })).toBeVisible();
  });
});

test('AGROSAS branding, mobile landing and language carry through to the dashboard',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await expect(page.locator('.cosmic-nav img')).toHaveAttribute('alt',/AGROSAS OS/);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.getByRole('button',{name:'Change language'}).click();
 await expect(page.locator('h1')).toContainText('The future of your land');
 await page.getByRole('link',{name:'Open my farm',exact:false}).click();
 await expect(page).toHaveURL(/\/dashboard$/);await expect(page.locator('h1')).toHaveText('Farm overview');
 await expect(page.locator('.bottom-nav')).toBeVisible();
});
