from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Go to the local file
    page.goto("file:///app/index.html", wait_until="networkidle")

    # Wait for the login page to be visible
    page.wait_for_selector("#login-page.visible")

    # Fill in the login form and submit
    page.locator("#login-empresa").select_option(label="Test Company")
    page.locator("#login-usuario").fill("test.user@email.com")
    page.locator("#login-password").fill("password")
    page.locator('button[type="submit"]').first.click()

    # Wait for the main page to be visible after login
    page.wait_for_selector("#main-page.visible")

    # Click on the "Financeiro" dropdown in the main navbar
    page.locator('#financeiro-nav-link').click()

    # Click on the "Relatórios" link in the dropdown
    page.locator('a.nav-link[data-target="relatorios-page"]').first.click()

    # Wait for the reports page to be visible
    page.wait_for_selector("#relatorios-page.visible")

    # Click on the "Contas a Pagar" tab
    page.locator('button[data-relatorio-tab="contas-a-pagar"]').click()

    # Change the report type to "Previsão de Desembolsos"
    page.locator("#relatorio-pagar-tipo").select_option("previsao-desembolsos")

    # Click the generate report button
    page.locator("#gerar-relatorio-pagar-btn").click()

    # Wait for the report to be generated
    page.wait_for_selector("#relatorio-pagar-visualizacao-area:not(:has-text('Selecione os filtros e clique em \"Gerar Relatório\"'))")

    # Take a screenshot
    page.screenshot(path="jules-scratch/verification/05_previsao_desembolsos_fix.png")

    browser.close()

with sync_playwright() as playwright:
    run(playwright)