from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        # Set a mobile viewport to trigger mobile-specific styles
        context = browser.new_context(viewport={'width': 375, 'height': 812}, is_mobile=True)
        page = context.new_page()

        # Navigate to the local index.html file
        filepath = os.path.abspath('index.html')
        page.goto(f'file://{filepath}')

        # Directly manipulate the DOM to get to the state we need to screenshot.
        # This bypasses any JavaScript event listeners that might not run correctly in a file:// context.
        page.evaluate("() => { \
            document.getElementById('cadastros-page').classList.add('visible'); \
            document.getElementById('gerais-cadastro-section').classList.remove('hidden'); \
        }")

        # The section is now visible. We can take the screenshot of the scrollable tabs.
        tabs_container = page.locator('#gerais-cadastro-section .mobile-scrollable')
        tabs_container.screenshot(path='jules-scratch/verification/verification.png')

        browser.close()

if __name__ == '__main__':
    run()
