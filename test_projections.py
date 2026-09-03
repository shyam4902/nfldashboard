#!/usr/bin/env python3
"""Test the Projections tab via HTTP server."""
import os
import sys
import threading
import http.server
import time
from playwright.sync_api import sync_playwright

DASHBOARD_DIR = os.path.dirname(os.path.abspath(__file__))
SCREENSHOT_DIR = os.path.join(DASHBOARD_DIR, "screenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DASHBOARD_DIR, **kwargs)

    def log_message(self, format, *args):
        pass


server = http.server.HTTPServer(("127.0.0.1", 8766), Handler)
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
print("HTTP server running on http://127.0.0.1:8766")
time.sleep(0.5)

failures = []


def require_contains(label, content, expected):
    if expected in content:
        print(f"✓ {label}")
    else:
        failures.append(f"{label} missing {expected!r}")
        print(f"✗ {label}: expected {expected!r}")


try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1600, "height": 900})
        console_msgs = []
        page.on("console", lambda msg: console_msgs.append(f"[{msg.type}] {msg.text}"))

        page.goto("http://127.0.0.1:8766/index.html")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(3000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/01_home.png", full_page=False)
        print("✓ Home page loaded")

        page.click('[data-tab="projections"]')
        page.wait_for_timeout(3000)
        page.screenshot(path=f"{SCREENSHOT_DIR}/02_standings.png", full_page=False)
        content = page.inner_text("#projContent")
        require_contains("Standings rendered", content, "Buffalo Bills")

        page.locator("button", has_text=" QB").first.click()
        page.wait_for_timeout(1500)
        page.screenshot(path=f"{SCREENSHOT_DIR}/03_qb.png", full_page=False)
        require_contains("QB tab", page.inner_text("#projContent"), "Josh Allen")

        page.locator("button", has_text=" RB").first.click()
        page.wait_for_timeout(1500)
        page.screenshot(path=f"{SCREENSHOT_DIR}/04_rb.png", full_page=False)
        require_contains("RB tab", page.inner_text("#projContent"), "Jahmyr Gibbs")

        page.locator("button", has_text=" WR").first.click()
        page.wait_for_timeout(1500)
        page.screenshot(path=f"{SCREENSHOT_DIR}/05_wr.png", full_page=False)
        require_contains("WR tab", page.inner_text("#projContent"), "Puka Nacua")

        page.locator("button", has_text="Unit Grades").first.click()
        page.wait_for_timeout(1500)
        page.screenshot(path=f"{SCREENSHOT_DIR}/06_unitgrades.png", full_page=False)
        require_contains("Unit Grades tab", page.inner_text("#projContent"), "Los Angeles Rams")

        retired_starters = page.locator("button", has_text="Starters").count()
        if retired_starters == 0:
            print("✓ Retired Starters control absent")
        else:
            failures.append("Retired Starters control is present")
            print("✗ Retired Starters control is present")

        page.locator("button", has_text="Coaching").first.click()
        page.wait_for_timeout(1500)
        page.screenshot(path=f"{SCREENSHOT_DIR}/08_coaching.png", full_page=False)
        require_contains("Coaching tab", page.inner_text("#projContent"), "Andy Reid")

        errors = [m for m in console_msgs if m.startswith("[error")]
        if errors:
            failures.extend(f"Console error: {error}" for error in errors)
            print(f"\nConsole errors ({len(errors)}):")
            for error in errors[:5]:
                print(f"  {error}")
        else:
            print("\n✓ No console errors")

        browser.close()
finally:
    server.shutdown()
    server.server_close()

print(f"\nScreenshots saved to {SCREENSHOT_DIR}/")
if failures:
    print(f"\nFAILURES ({len(failures)}):")
    for failure in failures:
        print(f"  ✗ {failure}")
    sys.exit(1)
