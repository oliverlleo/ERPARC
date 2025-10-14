from playwright.sync_api import sync_playwright, expect
import time

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    try:
        page.goto("file:///app/crm.html")

        # Wait for the login page to be visible
        expect(page.locator("#login-page")).to_be_visible(timeout=10000)

        # Click admin login link
        page.click("#admin-login-link")

        # Wait for the admin login modal to be visible
        expect(page.locator("#admin-login-modal")).to_be_visible(timeout=10000)

        # Perform admin login
        page.fill("#admin-login-email", "admin@example.com")
        page.fill("#admin-login-password", "password")
        page.click("#admin-login-form button[type='submit']")

        # Wait for the main app to be visible
        page.wait_for_timeout(2000)
        expect(page.locator("#main-app")).to_be_visible(timeout=10000)

        # Navigate to reports
        page.click('a[data-target="relatorios-page"]')

        # Wait for the reports page to be visible
        expect(page.locator("#relatorios-page")).to_be_visible(timeout=10000)

        # Switch to the "Contas a Pagar" tab
        page.click('a[data-relatorio-tab="contas-a-pagar"]')

        # Wait for the "Contas a Pagar" tab to be visible
        expect(page.locator("#relatorio-contas-a-pagar-tab")).to_be_visible(timeout=10000)

        # Take a screenshot
        page.screenshot(path="jules-scratch/verification/verification.png")
    except Exception as e:
        print(e)
        page.screenshot(path="jules-scratch/verification/error.png")
        print(page.content())
    finally:
        browser.close()