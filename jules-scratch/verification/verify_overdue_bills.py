import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Go to the login page
        await page.goto("http://localhost:8000/index.html")

        # Go to the reports page directly
        await page.goto("http://localhost:8000/index.html#relatorios-page")

        # Switch to "Contas a Pagar" tab
        await page.get_by_role("button", name="Contas a Pagar").click()

        # Filter by "Vencido"
        await page.get_by_role("button", name="Vencido").click()

        # Take a screenshot
        await page.screenshot(path="jules-scratch/verification/overdue_bills.png")

        await browser.close()

asyncio.run(main())