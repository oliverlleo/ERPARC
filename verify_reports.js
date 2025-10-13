const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Navigate to the local server
    await page.goto('http://localhost:8000');

    // Perform login
    await page.waitForSelector('#login-page', { state: 'visible' });
    await page.fill('#login-empresa', 'your_company_id'); // Replace with a valid company ID from your test data
    await page.fill('#login-usuario', 'test.user@email.com');
    await page.fill('#login-password', 'password123');
    await page.click('button[type="submit"]');

    // Wait for the main page to load after login
    await page.waitForSelector('#main-page', { state: 'visible', timeout: 10000 });
    console.log('Login successful, main page is visible.');

    // Navigate to the Relatórios page
    await page.click('#financeiro-nav-link'); // Click the "Financeiro" dropdown
    await page.waitForSelector('#financeiro-dropdown a[data-target="relatorios-page"]', { state: 'visible' });
    await page.click('#financeiro-dropdown a[data-target="relatorios-page"]');

    // Wait for the reports page to be visible
    await page.waitForSelector('#relatorios-page', { state: 'visible', timeout: 10000 });
    console.log('Successfully navigated to the Relatórios page.');

    // Wait for a key element on the report page to ensure it's fully loaded
    await page.waitForSelector('#posicao-carteira-report-content', { state: 'visible' });
    console.log('Posição de Carteira report content is visible.');

    // Take a screenshot
    await page.screenshot({ path: 'reports_page_screenshot.png' });
    console.log('Screenshot of the reports page taken successfully.');

  } catch (error) {
    console.error('An error occurred during verification:', error);
    await page.screenshot({ path: 'error_screenshot.png' });
  } finally {
    await browser.close();
  }
})();