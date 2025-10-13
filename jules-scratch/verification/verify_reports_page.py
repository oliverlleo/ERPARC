import re
from playwright.sync_api import sync_playwright, Page, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # Navigate to the local index.html file using the correct absolute path
        page.goto("file:///app/index.html")

        # Wait for a key element in the login form to be visible. This is more robust.
        expect(page.get_by_text("Bem-vindo de volta")).to_be_visible(timeout=15000)

        # Now that we know the content is ready, we can check the container's visibility
        expect(page.locator("#login-page")).to_be_visible()

        # Log in as the test user
        page.locator("#login-empresa").select_option(label="Empresa Teste")
        page.locator("#login-usuario").fill("test.user@email.com")
        page.locator("#login-password").fill("password")
        page.locator("button[type='submit']").click()

        # Wait for the main page to load after login
        expect(page.locator("#main-page")).to_be_visible(timeout=15000)

        # Click the "Financeiro" dropdown. There are multiple, so we target the one in the visible header.
        page.locator("#main-page header >> text=Financeiro").click()

        # Click the "Relatórios" link in the dropdown
        page.locator("#financeiro-dropdown >> text=Relatórios").click()

        # Verify that the Relatórios page is now visible
        expect(page.locator("#relatorios-page")).to_be_visible(timeout=10000)
        expect(page.locator("#relatorios-page h1")).to_have_text("Relatórios")

        # Click through the report tabs to ensure they are all present
        page.get_by_role("link", name="Posição de Carteira").click()
        expect(page.locator("#posicao-carteira-report-content")).to_be_visible()

        page.get_by_role("link", name="Análise de Inadimplência").click()
        expect(page.locator("#inadimplencia-report-content")).to_be_visible()

        page.get_by_role("link", name="Previsão de Recebimentos").click()
        expect(page.locator("#previsao-recebimentos-report-content")).to_be_visible()

        page.get_by_role("link", name="Análise por Categoria").click()
        expect(page.locator("#analise-categorias-report-content")).to_be_visible()

        page.get_by_role("link", name="Ranking de Clientes").click()
        expect(page.locator("#ranking-clientes-report-content")).to_be_visible()

        # Take a screenshot of the final state
        page.screenshot(path="jules-scratch/verification/verification.png")
        print("Screenshot taken successfully.")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/error_screenshot.png")
    finally:
        browser.close()

with sync_playwright() as playwright:
    run(playwright)