import re
from playwright.sync_api import sync_playwright, Page, expect

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context()
    page = context.new_page()

    # Go to the login page
    page.goto("http://localhost:8080/index.html")

    # Click the admin login link and log in
    page.get_by_role("link", name="Acesso do Administrador").click()
    page.get_by_placeholder("seu@email.com").fill("admin@builderse.com.br")
    page.locator("#admin-login-password").fill("123456")
    page.get_by_role("button", name="Entrar como Admin").click()

    # Wait for the login page to be hidden, indicating a successful transition
    expect(page.locator("#login-page")).to_be_hidden(timeout=10000)

    # Now, wait for the main page to be visible
    expect(page.locator("#main-page")).to_be_visible()

    # Now that the container is visible, check for the heading
    expect(page.get_by_role("heading", name="Painel")).to_be_visible()

    # Click the notification bell to open the sidebar
    page.locator("#notification-bell-main").click()

    # Wait for the sidebar to be visible
    expect(page.locator("#notification-sidebar")).to_be_visible()

    # Click the "Ver todas as notificações" link
    page.get_by_role("link", name="Ver todas as notificações").click()

    # Verify that the notifications page is displayed
    notifications_page_container = page.locator("#notifications-page")
    expect(notifications_page_container).to_be_visible()
    expect(page.get_by_role("heading", name="Notificações")).to_be_visible()
    expect(page.get_by_text("Gerencie e visualize todas as suas notificações.")).to_be_visible()

    # Take a screenshot of the notifications page
    page.screenshot(path="jules-scratch/verification/notifications_page.png")

    # Close browser
    browser.close()

with sync_playwright() as playwright:
    run(playwright)