import re
from playwright.sync_api import sync_playwright, Page, expect
import time

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    try:
        # 1. Navigate directly to the page (main-page is now visible by default)
        print("Navigating to the application page...")
        page.goto("http://localhost:8080/index.html", timeout=60000)

        # Wait for main page to be visible (it should be immediate)
        expect(page.locator("#main-page")).to_be_visible(timeout=10000)
        print("Main page is visible.")

        # 2. Create a notification using page.evaluate
        print("Creating a test notification via JS evaluate...")
        page.evaluate("() => window.criarNotificacao('sucesso', 'Pagamento Aprovado', 'O pagamento para o fornecedor XYZ foi confirmado.')")

        # 3. Check for red dot and open panel
        red_dot = page.locator("#notificacao-ponto-vermelho")
        expect(red_dot).to_be_visible(timeout=5000)
        print("Red dot is visible.")

        notificacoes_btn = page.locator("#notificacoes-btn")
        notificacoes_btn.click()

        panel = page.locator("#notificacoes-painel")
        expect(panel).to_be_visible()
        print("Notification panel opened.")

        # 4. Verify notification content and take screenshot
        notification_item = panel.locator(".notification-item")
        expect(notification_item).to_have_count(1)
        expect(notification_item).to_contain_text("Pagamento Aprovado")
        expect(notification_item).to_contain_text("O pagamento para o fornecedor XYZ foi confirmado.")
        print("Notification content verified.")

        page.screenshot(path="jules-scratch/verification/01_new_notification.png")

        # 5. Mark as read and verify
        notification_item.click()
        expect(notification_item).not_to_have_class(re.compile(r'bg-blue-50'), timeout=5000)
        print("Notification marked as read.")

        # Red dot should disappear
        expect(red_dot).to_be_hidden()
        print("Red dot is hidden after reading.")

        page.screenshot(path="jules-scratch/verification/02_read_notification.png")

        # 6. Pin the notification and verify
        pin_button = notification_item.locator(".pin-notification-btn")
        pin_button.click()

        # The listener should re-render it in the pinned list
        time.sleep(1) # Give it a moment for the re-render
        pinned_list = page.locator("#notificacoes-fixadas-lista")
        expect(pinned_list.locator(".notification-item")).to_have_count(1)
        expect(pinned_list).to_contain_text("Pagamento Aprovado")
        print("Notification pinned successfully.")

        page.screenshot(path="jules-scratch/verification/03_pinned_notification.png")

        print("Verification script completed successfully!")

    except Exception as e:
        print(f"An error occurred: {e}")
        page.screenshot(path="jules-scratch/verification/error.png")
        raise
    finally:
        browser.close()

if __name__ == "__main__":
    with sync_playwright() as p:
        run(p)