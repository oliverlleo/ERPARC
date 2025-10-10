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

        # Add a recurring revenue
        page.fill("#what-if-receita-descricao", "Contrato Mensal")
        page.fill("#what-if-receita-valor", "2000")
        page.select_option("#what-if-receita-forma-pagamento", "recurring")
        page.fill("#what-if-receita-recurrences", "3")
        page.select_option("#what-if-receita-recurring-frequency", "mensal")
        page.fill("#what-if-receita-data", "2025-11-01")
        page.click("#what-if-receita-form button[type='submit']")

        # Add an installment expense
        page.fill("#what-if-despesa-descricao", "Compra de Equipamento")
        page.fill("#what-if-despesa-valor", "1500")
        page.select_option("#what-if-despesa-forma-pagamento", "installment")
        page.fill("#what-if-despesa-installments", "3")
        page.fill("#what-if-despesa-data", "2025-11-15")
        page.click("#what-if-despesa-form button[type='submit']")

        # Save the scenario
        page.once("dialog", lambda dialog: dialog.accept("Cenário 1: Contrato e Equipamento"))
        page.click("#what-if-save-scenario-btn")

        # Clear the scenario
        page.click("#what-if-clear-scenario-btn")

        # Load the saved scenario
        page.click(".what-if-load-btn")

        # Add a new expense
        page.fill("#what-if-despesa-descricao", "Marketing")
        page.fill("#what-if-despesa-valor", "500")
        page.select_option("#what-if-despesa-forma-pagamento", "single")
        page.fill("#what-if-despesa-data", "2025-12-01")
        page.click("#what-if-despesa-form button[type='submit']")

        # Save the modified scenario
        page.once("dialog", lambda dialog: dialog.accept("Cenário 2: Com Marketing"))
        page.click("#what-if-save-scenario-btn")

        # Select the first scenario for comparison
        page.check(".what-if-compare-checkbox[data-scenario-id*='saved-']")

        page.wait_for_timeout(2000)
        # Take a screenshot
        page.screenshot(path="jules-scratch/verification/advanced_what_if.png")

    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)