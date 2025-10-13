import asyncio
from playwright.async_api import async_playwright, expect
import os
import re

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Get the absolute path to the index.html file
        file_path = os.path.abspath('index.html')

        # Go to the local file
        await page.goto(f'file://{file_path}')

        # Wait for the login page to have the 'visible' class. This is more robust.
        await expect(page.locator("#login-page")).to_have_class(re.compile(r'\bvisible\b'))

        # Fill in the login form for the test user
        await page.locator("#admin-login-link").click()
        await expect(page.locator("#admin-login-modal")).to_be_visible()
        await page.locator("#admin-login-email").fill("test.user@email.com")
        await page.locator("#admin-login-password").fill("password")
        await page.locator("#admin-login-form button[type='submit']").click()

        # Wait for the main page to become visible after login
        await expect(page.locator("#main-page")).to_have_class(re.compile(r'\bvisible\b'))

        # Click the "Financeiro" dropdown and then the "Relatórios" link
        await page.locator("#financeiro-nav-link").click()
        await page.locator("#financeiro-dropdown a[data-target='relatorios-page']").click()

        # Wait for the reports page to be visible
        await expect(page.locator("#relatorios-page")).to_have_class(re.compile(r'\bvisible\b'))

        # Assert that the main report container is visible
        await expect(page.locator("#contas-a-receber-reports-section")).to_be_visible()

        # Assert that the report tabs are present
        await expect(page.locator("a[data-report='posicao-carteira']")).to_be_visible()
        await expect(page.locator("a[data-report='inadimplencia']")).to_be_visible()

        # Take a screenshot of the reports page
        await page.screenshot(path="jules-scratch/verification/verification.png")

        await browser.close()

asyncio.run(main())