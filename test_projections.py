#!/usr/bin/env python3
"""Test the Projections tab via HTTP server."""
import os, sys, threading, http.server, time
from playwright.sync_api import sync_playwright

DASHBOARD_DIR = os.path.dirname(os.path.abspath(__file__))
SCREENSHOT_DIR = os.path.join(DASHBOARD_DIR, "screenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

# Start a simple HTTP server in background
class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DASHBOARD_DIR, **kwargs)
    def log_message(self, format, *args):
        pass  # suppress logs

server = http.server.HTTPServer(("127.0.0.1", 8766), Handler)
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
print("HTTP server running on http://127.0.0.1:8766")
time.sleep(0.5)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 900})

    # Collect console messages
    console_msgs = []
    page.on("console", lambda msg: console_msgs.append(f"[{msg.type}] {msg.text}"))

    page.goto("http://127.0.0.1:8766/index.html")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)
    page.screenshot(path=f"{SCREENSHOT_DIR}/01_home.png", full_page=False)
    print("✓ Home page loaded")

    # Click Projections tab
    page.click('[data-tab="projections"]')
    page.wait_for_timeout(3000)
    page.screenshot(path=f"{SCREENSHOT_DIR}/02_standings.png", full_page=False)

    content = page.inner_text("#projContent")
    if "Buffalo Bills" in content or "AFC" in content:
        print("✓ Standings rendered")
    else:
        print(f"✗ Standings NOT rendered: {content[:200]}")

    # QB
    page.locator("button", has_text=" QB").first.click()
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{SCREENSHOT_DIR}/03_qb.png", full_page=False)
    content = page.inner_text("#projContent")
    print(f"✓ QB tab: {'Josh Allen' in content}")

    # RB
    page.locator("button", has_text=" RB").first.click()
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{SCREENSHOT_DIR}/04_rb.png", full_page=False)
    content = page.inner_text("#projContent")
    print(f"✓ RB tab: {'Jahmyr Gibbs' in content}")

    # WR
    page.locator("button", has_text=" WR").first.click()
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{SCREENSHOT_DIR}/05_wr.png", full_page=False)
    content = page.inner_text("#projContent")
    print(f"✓ WR tab: {'Puka Nacua' in content}")

    # Unit Grades
    page.locator("button", has_text="Unit Grades").first.click()
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{SCREENSHOT_DIR}/06_unitgrades.png", full_page=False)
    content = page.inner_text("#projContent")
    print(f"✓ Unit Grades tab: {'Los Angeles Rams' in content}")

    # Current UI contract: projected starters were retired; roster depth lives
    # in Teams and is covered by the dashboard smoke suite. Verify the
    # projections panel does not expose the retired Starters control.
    retired_starters = page.locator("button", has_text="Starters").count()
    print(f"✓ Retired Starters control absent: {retired_starters == 0}")

    # Coaching
    page.locator("button", has_text="Coaching").first.click()
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{SCREENSHOT_DIR}/08_coaching.png", full_page=False)
    content = page.inner_text("#projContent")
    print(f"✓ Coaching tab: {'Andy Reid' in content}")

    # Check console for errors
    errors = [m for m in console_msgs if m.startswith("[error")]
    if errors:
        print(f"\nConsole errors ({len(errors)}):")
        for e in errors[:5]:
            print(f"  {e}")
    else:
        print("\n✓ No console errors")

    browser.close()

server.shutdown()
print(f"\nScreenshots saved to {SCREENSHOT_DIR}/")
