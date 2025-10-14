from playwright.sync_api import sync_playwright, expect
import subprocess
import time
import os

def run_verification():
    # Start a simple HTTP server in the background
    server_process = subprocess.Popen(["python", "-m", "http.server", "8080"], cwd=os.getcwd())
    time.sleep(2)  # Give the server a moment to start

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()

            # Navigate to the local server
            page.goto("http://localhost:8080/index.html")

            # Listen for console messages
            page.on("console", lambda msg: print(f"CONSOLE: {msg.text}"))
            # Listen for page errors
            page.on("pageerror", lambda err: print(f"PAGE_ERROR: {err}"))

            # Wait for the login page to become visible
            expect(page.get_by_text("Bem-vindo de volta")).to_be_visible(timeout=60000)

            # Log in
            page.select_option("#login-empresa", "test-company-id")
            page.fill("#login-usuario", "test.user@email.com")
            page.fill("#login-password", "password")
            page.click("button[type='submit']")

            # Wait for the main page to be visible
            expect(page.locator("#main-page.visible")).to_be_visible()

            # Navigate to the reports page
            page.click('.nav-link[data-target="relatorios-page"]')

            # Wait for the reports page to be visible
            expect(page.locator("#relatorios-page")).to_be_visible()

            # Click the "Financeiro" dropdown
            page.click("#financeiro-nav-link-relatorios")

            # Expect the dropdown to be visible
            expect(page.locator("#financeiro-dropdown-relatorios")).to_be_visible()

            # Take a screenshot
            page.screenshot(path="jules-scratch/verification/verification.png")

            browser.close()
    finally:
        # Stop the server
        server_process.terminate()

if __name__ == "__main__":
    run_verification()