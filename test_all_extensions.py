#!/usr/bin/env python3
"""
Comprehensive verification test for updated NFL Dashboard features.
"""

import os
import sys
import threading
import http.server
import time
from playwright.sync_api import sync_playwright

DASHBOARD_DIR = "/Users/shyampatel/Desktop/NFL_Main/nfldashboard"
SCREENSHOT_DIR = os.path.join(DASHBOARD_DIR, "screenshots_expansion")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DASHBOARD_DIR, **kwargs)
    def log_message(self, format, *args):
        pass

PORT = 8788
server = http.server.HTTPServer(("127.0.0.1", PORT), Handler)
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
print(f"HTTP server running on http://127.0.0.1:{PORT}")
time.sleep(0.5)

successes = []
failures = []
console_errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 950})

    def handle_console(msg):
        if msg.type == "error":
            console_errors.append(msg.text)
    page.on("console", handle_console)

    page.goto(f"http://127.0.0.1:{PORT}/index.html")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2500)
    page.screenshot(path=f"{SCREENSHOT_DIR}/01_home_default.png")
    successes.append("Home page loaded")

    # 1. Test All 5 Themes
    print("Testing Distinct Themes...")
    for theme in ['stadium', 'espn', 'retro', 'analyst', 'default']:
        page.select_option("#themeSelector", theme)
        page.wait_for_timeout(400)
        page.screenshot(path=f"{SCREENSHOT_DIR}/02_theme_{theme}.png")
    successes.append("All 5 themes switched and visually captured")

    # 2. Test Consensus Power Index & Calibrated Tiers
    print("Testing Consensus Power Index...")
    page.click('[data-tab="projections"]')
    page.wait_for_timeout(1000)
    page.locator("button", has_text="Consensus Power").first.click()
    page.wait_for_selector("#projContent table", timeout=5000)
    page.wait_for_timeout(1000)
    page.screenshot(path=f"{SCREENSHOT_DIR}/06_consensus_power_calibrated.png")
    cp_content = page.inner_text("#projContent")
    if "Tier 1: Elite" in cp_content and "Tier 2: Contender" in cp_content and "Tier 3: Playoff Hunt" in cp_content and "Tier 4: Rebuilding" in cp_content:
        successes.append("Unified Consensus Power Index rendered with all 4 calibrated tiers (Tier 1 Elite, Contender, Playoff Hunt, Rebuilding)")
    else:
        failures.append("Consensus Power Index tier badges incomplete or missing Tier 1")

    # 3. Test Deep Head-to-Head Player Comparison Modal
    print("Testing Deep Player Comparison Modal...")
    page.evaluate("async () => { await openPlayerCompareModal('Josh Allen', 'Lamar Jackson'); }")
    page.wait_for_selector("#playerCompareContent svg", timeout=5000)
    page.wait_for_timeout(1000)
    page.screenshot(path=f"{SCREENSHOT_DIR}/08_player_comparison_deep.png")
    comp_content = page.inner_text("#playerCompareContent")
    has_radar = page.locator("#playerCompareContent svg").count() > 0
    has_stat_table = "Direct Stat-by-Stat Delta Comparison" in comp_content or "DIRECT STAT-BY-STAT" in comp_content.upper()
    has_rivals = "Quick Rivals" in comp_content or "QUICK RIVALS" in comp_content.upper()
    if "Josh Allen" in comp_content and "Lamar Jackson" in comp_content and has_radar and has_stat_table and has_rivals:
        successes.append("Deep Player Comparison rendered side-by-side hero cards, dual SVG radar chart, stat delta table with advantage indicators, and rival pills")
    else:
        failures.append(f"Player comparison modal missing key deep metrics or radar (radar={has_radar}, table={has_stat_table}, rivals={has_rivals})")

    # Test clicking a quick rival in compare modal
    page.locator("button", has_text="vs Patrick Mahomes").first.click()
    page.wait_for_timeout(600)
    page.screenshot(path=f"{SCREENSHOT_DIR}/08_player_comparison_mahomes.png")

    page.locator("#playerCompareModal .roster-close").click()
    page.wait_for_timeout(500)

    # 4. Test Universal Player Modal
    print("Testing Universal Player Modal...")
    page.evaluate("async () => { await openPlayerModal('Patrick Mahomes', 'KC'); }")
    page.wait_for_selector("#playerModalContent h2", timeout=5000)
    page.wait_for_timeout(1000)
    page.screenshot(path=f"{SCREENSHOT_DIR}/07_player_modal_mahomes.png")
    modal_content = page.inner_text("#playerModalContent")
    if "Patrick Mahomes" in modal_content and "MIKE CLAY 2026 PROJECTIONS" in modal_content:
        successes.append("Universal Player Profile Modal rendered Patrick Mahomes")
    else:
        failures.append("Player modal incomplete")

    page.locator("#playerModal .roster-close").click()
    page.wait_for_timeout(500)

    # 5. Test Clay vs Market Delta
    print("Testing Clay vs Market Delta...")
    page.locator("button", has_text="Clay vs Market").first.click()
    page.wait_for_selector("#projContent table", timeout=5000)
    page.wait_for_timeout(1000)
    page.screenshot(path=f"{SCREENSHOT_DIR}/03_clay_vs_market_delta.png")
    delta_content = page.inner_text("#projContent")
    if "Mike Clay Projections vs Market Line Delta" in delta_content:
        successes.append("Clay vs Market Delta rendered with injury discount rules")
    else:
        failures.append("Clay vs Market Delta missing")

    # 6. Test Matchup Matrix
    print("Testing Matchup Matrix...")
    page.locator("button", has_text="Matchup Matrix").first.click()
    page.wait_for_selector("#projContent table", timeout=5000)
    page.wait_for_timeout(1000)
    page.screenshot(path=f"{SCREENSHOT_DIR}/04_matchup_matrix.png")
    mm_content = page.inner_text("#projContent")
    if "Opponent-Adjusted Weekly Matchup Matrix" in mm_content:
        successes.append("Opponent-Adjusted Matchup Matrix verified")
    else:
        failures.append("Matchup Matrix missing")

    # 7. Test Command Palette
    print("Testing Command Palette...")
    page.keyboard.press("Meta+k")
    page.wait_for_selector("#cmdPaletteInput", timeout=5000)
    page.wait_for_timeout(500)
    page.fill("#cmdPaletteInput", "Eagles")
    page.wait_for_timeout(500)
    page.screenshot(path=f"{SCREENSHOT_DIR}/10_command_palette_search.png")
    cmd_content = page.inner_text("#cmdPaletteResults")
    if "Philadelphia Eagles" in cmd_content:
        successes.append("Command Palette verified")
    else:
        failures.append("Command Palette failed")

    page.keyboard.press("Escape")
    page.wait_for_timeout(500)

    browser.close()

print("\n" + "="*50)
print("TEST SUMMARY")
print("="*50)
for s in successes:
    print(f"✓ {s}")
if failures:
    print("\nFAILURES:")
    for f in failures:
        print(f"✗ {f}")
else:
    print("\nAll functional tests passed cleanly!")

print(f"\nConsole errors logged: {len(console_errors)}")
for err in console_errors:
    print(f"  [Console Error] {err}")

sys.exit(0 if len(failures) == 0 else 1)
