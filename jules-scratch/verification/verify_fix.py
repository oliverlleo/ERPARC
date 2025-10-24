import os
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()

    # Web version
    context_web = browser.new_context(viewport={'width': 1280, 'height': 720})
    page_web = context_web.new_page()
    page_web.goto('file://' + os.path.abspath('index.html'))
    page_web.screenshot(path='jules-scratch/verification/web_version.png')

    # Mobile version
    context_mobile = browser.new_context(viewport={'width': 375, 'height': 667})
    page_mobile = context_mobile.new_page()
    page_mobile.goto('file://' + os.path.abspath('index.html'))
    page_mobile.click('button[id^="mobile-menu-button"]')
    page_mobile.wait_for_selector('#mobile-menu', state='visible')
    page_mobile.screenshot(path='jules-scratch/verification/mobile_version.png')

    browser.close()

with sync_playwright() as playwright:
    run(playwright)
