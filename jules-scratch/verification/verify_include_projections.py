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

        # Uncheck "Include Projections"
        page.uncheck("#what-if-include-projections")

        # Add a hypothetical revenue
        page.fill("#what-if-receita-descricao", "Projeto Z")
        page.fill("#what-if-receita-valor", "10000")
        page.select_option("#what-if-receita-forma-pagamento", "single")
        page.fill("#what-if-receita-data", "2025-12-01")
        page.click("#what-if-receita-form button[type='submit']")
        page.wait_for_timeout(2000)

        # Take a screenshot without projections
        page.screenshot(path="jules-scratch/verification/without_projections.png")

        # Check "Include Projections"
        page.check("#what-if-include-projections")
        page.wait_for_timeout(2000)

        # Take a screenshot with projections
        page.screenshot(path="jules-scratch/verification/with_projections.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)