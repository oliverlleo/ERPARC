import { test, expect } from '@playwright/test';

test('Frontend Verification', async ({ page }) => {
  // Increase the overall timeout for the test
  test.setTimeout(120000); // 2 minutes

  console.log('Navigating to the application...');
  await page.goto('http://localhost:8000', { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('Navigation complete.');

  // 1. Wait for the login page to be fully visible
  console.log('Waiting for the login page to become visible...');
  const loginPage = page.locator('#login-page');
  await expect(loginPage).toBeVisible({ timeout: 30000 });
  console.log('Login page is visible.');

  // 2. Log in using the special test user
  console.log('Filling in login credentials...');
  // Click the admin link to show the admin login form
  await page.locator('#admin-login-link').click();

  // Wait for the admin modal to appear
  const adminModal = page.locator('#admin-login-modal');
  await expect(adminModal).toBeVisible({ timeout: 10000 });
  console.log('Admin login modal is visible.');

  await page.locator('#admin-login-email').fill('test.user@email.com');
  await page.locator('#admin-login-password').fill('anypassword');

  console.log('Submitting login form...');
  // Click the submit button inside the modal
  await page.locator('#admin-login-form button[type="submit"]').click();

  // 3. Wait for the main page to be visible after login
  console.log('Waiting for the main page to load after login...');
  const mainPage = page.locator('#main-page');
  await expect(mainPage).toBeVisible({ timeout: 30000 });
  console.log('Main page is visible.');

  // 4. Navigate to the Relatórios page
  console.log('Navigating to the Relatórios page...');
  // Click the main "Financeiro" dropdown in the header
  await page.locator('#financeiro-nav-link').click();

  // Wait for the dropdown to appear and then click the "Relatórios" link
  // Use a more specific locator to target the link within the main page's visible dropdown
  const relatoriosLink = page.locator('#main-page #financeiro-dropdown a.nav-link[data-target="relatorios-page"]');
  await expect(relatoriosLink).toBeVisible({ timeout: 10000 });
  await relatoriosLink.click();
  console.log('Clicked on Relatórios link.');

  // 5. Verify the Relatórios page is visible
  console.log('Waiting for the Relatórios page to become visible...');
  const relatoriosPage = page.locator('#relatorios-page');
  await expect(relatoriosPage).toBeVisible({ timeout: 30000 });
  console.log('Relatórios page is visible.');

  // 6. Verify a key element on the reports page
  console.log('Verifying content on the Relatórios page...');
  const reportTitle = page.locator('h2:text("Relatórios - Contas a Receber")');
  await expect(reportTitle).toBeVisible({ timeout: 10000 });
  console.log('Report title is visible.');

  const firstTab = page.locator('.report-tab-link.active[data-report="posicao-carteira"]');
  await expect(firstTab).toBeVisible({ timeout: 10000 });
  console.log('Posição de Carteira tab is active and visible.');

  // 7. Take a screenshot
  console.log('Taking screenshot...');
  const screenshotPath = 'reports_page_screenshot.png';
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`Screenshot saved to ${screenshotPath}`);

  // This is a crucial step to signal completion to the testing framework
  console.log('Frontend verification script finished successfully.');
});