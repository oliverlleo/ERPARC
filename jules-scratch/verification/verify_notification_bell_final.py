import asyncio
import re
from playwright.async_api import async_playwright, expect

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        try:
            # Navigate to the login page
            await page.goto("http://localhost:8080/index.html", timeout=60000)

            # Use a helper function for login
            async def login_as_admin():
                await page.click("#admin-login-link")
                await expect(page.locator("#admin-login-modal")).to_be_visible()
                await page.fill("#admin-login-email", "test.user@email.com")
                await page.fill("#admin-login-password", "123456")
                await page.click("#admin-login-form button[type='submit']")
                await expect(page.locator("#main-page")).to_be_visible(timeout=15000)
                print("Login successful, main page is visible.")

            await login_as_admin()

            # --- Verification for Movimentacao Bancaria Page ---
            print("\n--- Verifying on Conciliação Bancária Page ---")

            # Navigate to Conciliação Bancária
            await page.click("#financeiro-nav-link")
            await page.click("a[data-target='movimentacao-bancaria-page']")
            await expect(page.locator("#movimentacao-bancaria-page")).to_be_visible(timeout=10000)
            print("Navigated to Conciliação Bancária page.")

            # Click the notification bell on the movimentacao page
            notification_bell_mov = page.locator("#notification-bell-movimentacao")
            await notification_bell_mov.click()
            print("Clicked notification bell on Movimentacao page.")

            # Verify the sidebar is visible by checking its content
            notification_sidebar = page.locator("#notification-sidebar")
            await expect(notification_sidebar.get_by_role("heading", name="Notificações")).to_be_visible()
            print("Notification sidebar is visible.")

            # Take a screenshot
            await page.screenshot(path="jules-scratch/verification/screenshot_movimentacao_sidebar_open.png")
            print("Screenshot taken with sidebar open on Movimentacao page.")

            # Click outside the sidebar to close it
            await page.click("body", position={"x": 10, "y": 10})
            await expect(notification_sidebar.get_by_role("heading", name="Notificações")).to_be_hidden()
            print("Notification sidebar is hidden after clicking outside.")

            # --- Verification for Main Dashboard Page ---
            print("\n--- Verifying on Main Dashboard Page ---")
            await page.locator(".nav-link[data-target='main-page']").first().click()
            await expect(page.get_by_role("heading", name="Painel")).to_be_visible()
            print("Navigated back to Main Dashboard page.")

            # Click the notification bell on the main page
            notification_bell_main = page.locator("#notification-bell-main")
            await notification_bell_main.click()
            print("Clicked notification bell on Main page.")

            # Verify the sidebar is visible again
            await expect(notification_sidebar.get_by_role("heading", name="Notificações")).to_be_visible()
            print("Notification sidebar is visible again.")

            # Take a screenshot
            await page.screenshot(path="jules-scratch/verification/screenshot_main_sidebar_open.png")
            print("Screenshot taken with sidebar open on Main page.")

            # Close it one last time
            await page.locator("#close-notification-sidebar").click()
            await expect(notification_sidebar.get_by_role("heading", name="Notificações")).to_be_hidden()
            print("Notification sidebar closed with the 'X' button.")


            print("\n✅ Frontend Verification Successful!")

        except Exception as e:
            print(f"❌ An error occurred during verification: {e}")
            await page.screenshot(path="jules-scratch/verification/error.png")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(main())