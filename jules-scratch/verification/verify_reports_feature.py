from playwright.sync_api import sync_playwright, expect
import os

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Listen for and print any messages from the browser's console
        page.on("console", lambda msg: print(f"Browser console: {msg.type} >> {msg.text}"))

        # Navigate to the local server
        page.goto("http://localhost:8000/index.html", wait_until="domcontentloaded")

        # Bypass login by hiding the login page and showing the main page
        page.evaluate("document.getElementById('login-page').style.display = 'none'")
        page.evaluate("document.getElementById('main-page').classList.add('visible')")

        # Click the main "Financeiro" dropdown button
        financeiro_dropdown_button = page.locator("#financeiro-nav-link")
        expect(financeiro_dropdown_button).to_be_visible()
        financeiro_dropdown_button.click()

        # Find and click the "Relatórios" link in the dropdown
        relatorios_link = page.locator('#financeiro-dropdown a[data-target="relatorios-page"]')
        expect(relatorios_link).to_be_visible()
        relatorios_link.click()

        # Verify the reports page is visible
        reports_page = page.locator("#relatorios-page")
        expect(reports_page).to_be_visible()

        # Verify the title of the reports page
        expect(page.locator("#relatorios-page h1")).to_have_text("Relatórios Financeiros")

        # Take a screenshot for visual confirmation
        page.screenshot(path="jules-scratch/verification/reports_feature.png")

        browser.close()

if __name__ == "__main__":
    run_verification()