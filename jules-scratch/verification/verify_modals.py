from playwright.sync_api import sync_playwright, Page, expect
import time

def verify_estorno_ui(page: Page):
    """
    This script verifies the UI for reversed ('estornado') transactions
    in both the 'Contas a Pagar' and 'Contas a Receber' modals.
    """
    # 1. Navigate and Login
    page.goto("http://localhost:8080/")

    # Use a try-except block for login in case we're already logged in
    try:
        expect(page.get_by_role("heading", name="Painel")).to_be_visible(timeout=5000)
        print("Already logged in.")
    except Exception:
        print("Logging in...")
        page.get_by_role("link", name="Acesso do Administrador").click()
        # Scope the locators to the admin login modal to avoid ambiguity
        admin_modal = page.locator("#admin-login-modal")
        admin_modal.get_by_label("E-mail").fill("test.user@email.com")
        admin_modal.get_by_label("Senha").fill("password") # Password doesn't matter for test user
        admin_modal.get_by_role("button", name="Entrar como Admin").click()
        # Wait for main page to load
        expect(page.get_by_role("heading", name="Painel")).to_be_visible(timeout=10000)

    # 2. Navigate to Contas a Pagar
    page.get_by_role("button", name="Financeiro").click()
    page.get_by_role("link", name="Contas a Pagar").click()
    expect(page.get_by_role("heading", name="Contas a Pagar")).to_be_visible()

    # 3. Inject data and open 'Contas a Pagar' modal
    page.evaluate("""() => {
        const modal = document.getElementById('visualizar-despesa-modal');
        const historyBody = document.getElementById('pagamentos-history-table-body');
        document.getElementById('view-despesa-descricao').textContent = 'Test Despesa';

        historyBody.innerHTML = ''; // Clear existing rows

        // Row 1: Normal Transaction
        const normalRow = historyBody.insertRow();
        normalRow.innerHTML = `
            <td class="px-4 py-2 text-sm text-green-600">Pagamento</td>
            <td class="px-4 py-2 text-sm">01/01/2024</td>
            <td class="px-4 py-2 text-sm">R$ 100,00</td><td class="px-4 py-2 text-sm">R$ 0,00</td><td class="px-4 py-2 text-sm">R$ 0,00</td>
            <td class="px-4 py-2 text-sm"><button class="estornar-btn text-red-500 hover:underline">Estornar</button></td>
        `;

        // Row 2: Reversed (Estornado) Transaction
        const estornadoRow = historyBody.insertRow();
        estornadoRow.style.textDecoration = 'line-through';
        estornadoRow.classList.add('text-gray-400');
        estornadoRow.innerHTML = `
            <td class="px-4 py-2 text-sm text-gray-500">Pagamento (Estornado)</td>
            <td class="px-4 py-2 text-sm">02/01/2024</td>
            <td class="px-4 py-2 text-sm">R$ 50,00</td><td class="px-4 py-2 text-sm">R$ 0,00</td><td class="px-4 py-2 text-sm">R$ 0,00</td>
            <td class="px-4 py-2 text-sm"><button class="estornar-btn text-red-500 hover:underline disabled:text-gray-400" disabled>Estornar</button></td>
        `;

        // Row 3: The "Estorno" transaction itself
        const estornoActionRow = historyBody.insertRow();
        estornoActionRow.innerHTML = `
            <td class="px-4 py-2 text-sm text-red-500">Estorno</td>
            <td class="px-4 py-2 text-sm">03/01/2024</td>
            <td class="px-4 py-2 text-sm">R$ 50,00</td><td class="px-4 py-2 text-sm">R$ 0,00</td><td class="px-4 py-2 text-sm">R$ 0,00</td>
            <td class="px-4 py-2 text-sm"><button class="estornar-btn text-red-500 hover:underline disabled:text-gray-400" disabled>Estornar</button></td>
        `;
        modal.classList.remove('hidden');
    }""")

    time.sleep(1) # Wait for render
    # 4. Take screenshot
    page.screenshot(path="jules-scratch/verification/pagar_modal_verification.png")
    print("Screenshot for 'Contas a Pagar' modal taken.")

    # 5. Close the pagar modal
    page.locator("#close-visualizar-modal-btn").click()
    expect(page.locator("#visualizar-despesa-modal")).to_be_hidden()

    # 6. Navigate to Contas a Receber
    page.get_by_role("button", name="Financeiro").click()
    page.get_by_role("link", name="Contas a Receber").click()
    expect(page.get_by_role("heading", name="Contas a Receber")).to_be_visible()

    # 7. Inject data and open 'Contas a Receber' modal
    page.evaluate("""() => {
        const modal = document.getElementById('visualizar-receita-modal');
        const historyBody = document.getElementById('recebimentos-history-table-body');
        document.getElementById('view-receita-descricao').textContent = 'Test Receita';

        historyBody.innerHTML = ''; // Clear existing rows

        // Row 1: Normal Transaction
        const normalRow = historyBody.insertRow();
        normalRow.innerHTML = `
            <td class="px-4 py-2 text-sm text-green-600">Recebimento</td>
            <td class="px-4 py-2 text-sm">01/01/2024</td>
            <td class="px-4 py-2 text-sm">R$ 200,00</td><td class="px-4 py-2 text-sm">R$ 0,00</td><td class="px-4 py-2 text-sm">R$ 0,00</td>
            <td class="px-4 py-2 text-sm"><button class="estornar-recebimento-btn text-red-500 hover:underline">Estornar</button></td>
        `;

        // Row 2: Reversed (Estornado) Transaction
        const estornadoRow = historyBody.insertRow();
        estornadoRow.style.textDecoration = 'line-through';
        estornadoRow.classList.add('text-gray-400');
        estornadoRow.innerHTML = `
            <td class="px-4 py-2 text-sm text-gray-500">Recebimento (Estornado)</td>
            <td class="px-4 py-2 text-sm">02/01/2024</td>
            <td class="px-4 py-2 text-sm">R$ 75,00</td><td class="px-4 py-2 text-sm">R$ 0,00</td><td class="px-4 py-2 text-sm">R$ 0,00</td>
            <td class="px-4 py-2 text-sm"><button class="estornar-recebimento-btn text-red-500 hover:underline disabled:text-gray-400" disabled>Estornar</button></td>
        `;
        modal.classList.remove('hidden');
    }""")

    time.sleep(1) # Wait for render
    # 8. Take screenshot
    page.screenshot(path="jules-scratch/verification/receber_modal_verification.png")
    print("Screenshot for 'Contas a Receber' modal taken.")

    # 9. Close the modal
    page.locator("#close-visualizar-receita-modal-btn").click()
    expect(page.locator("#visualizar-receita-modal")).to_be_hidden()

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        verify_estorno_ui(page)
        browser.close()

if __name__ == "__main__":
    run_verification()