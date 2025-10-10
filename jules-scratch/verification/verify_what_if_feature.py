from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        page.goto("http://localhost:8080/index.html")

        # Login
        page.click("#admin-login-link")
        page.wait_for_selector("#admin-login-modal")
        page.fill("#admin-login-email", "test.user@email.com")
        page.fill("#admin-login-password", "password")
        page.click("#admin-login-form button[type='submit']")
        page.wait_for_selector("#main-page.visible")
        page.wait_for_timeout(1000)

        # Navigate to Fluxo de Caixa
        page.click("#financeiro-nav-link")
        page.click("a[data-target='fluxo-de-caixa-page']")

        # Switch to What-If tab
        page.click("a[data-fluxo-tab='what-if']")
        page.wait_for_selector("#fluxo-what-if-tab:not(.hidden)")
        page.wait_for_timeout(500)

        # Add a hypothetical revenue
        page.fill("#what-if-receita-descricao", "Novo Projeto Y")
        page.fill("#what-if-receita-valor", "5000")
        page.fill("#what-if-receita-data", "2025-12-31")
        page.click("#what-if-receita-form button[type='submit']")

        # Add a hypothetical expense
        page.fill("#what-if-despesa-descricao", "Salário Dev Jr.")
        page.fill("#what-if-despesa-valor", "3500")
        page.fill("#what-if-despesa-data", "2025-12-20")
        page.click("#what-if-despesa-form button[type='submit']")

        page.wait_for_timeout(2000)
        # Take a screenshot
        page.screenshot(path="jules-scratch/verification/what_if_feature.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)