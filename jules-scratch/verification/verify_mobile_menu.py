import os
from playwright.sync_api import sync_playwright

def run(playwright):
    browser = playwright.chromium.launch()
    context = browser.new_context(viewport={'width': 375, 'height': 667})
    page = context.new_page()
    page.goto('file://' + os.path.abspath('index.html'))
    page.click('#mobile-menu-button')
    page.wait_for_selector('#mobile-menu', state='visible')
    page.screenshot(path='jules-scratch/verification/verification.png')
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
