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

DASHBOARD_DIR = os.path.dirname(os.path.abspath(__file__))
SCREENSHOT_DIR = os.path.join(DASHBOARD_DIR, "screenshots_expansion")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

# Hermetic data fixtures (default): intercept Supabase + nflverse with
# committed-data stand-ins. DASH_LIVE_NETWORK=1 opts into real services.
FIXTURES_DIR = os.path.join(DASHBOARD_DIR, "test-fixtures")
sys.path.insert(0, FIXTURES_DIR)
import browser_fixtures  # noqa: E402

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
    browser_fixtures.install(page, DASHBOARD_DIR)

    page.goto(f"http://127.0.0.1:{PORT}/index.html")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2500)
    page.screenshot(path=f"{SCREENSHOT_DIR}/01_home_default.png")
    successes.append("Home page loaded")

    # 0. Test the new Home showcase page (hero, feature grid, live spotlights)
    print("Testing Home showcase...")
    home_text = page.inner_text("#tab-home")
    if "League Command Center" in home_text and "What's Inside" in home_text:
        successes.append("Home hero + showcase section rendered")
    else:
        failures.append("Home hero/showcase missing")
    feat_cards = page.locator(".feature-card").count()
    if feat_cards >= 9:
        successes.append(f"Feature grid rendered with {feat_cards} clickable cards")
    else:
        failures.append(f"Feature grid incomplete: {feat_cards} cards")
    page.wait_for_timeout(1500)
    spots = page.inner_text("#homeSpotlights")
    for sec in ["2026 Projected Power", "Week 1 Marquee", "Top Value Plays", "Biggest Offseason Moves"]:
        if sec in spots:
            successes.append(f"Home spotlight '{sec}' rendered")
        else:
            failures.append(f"Home spotlight '{sec}' missing")
    # Feature card navigation: click a card and verify it switches tabs
    page.locator(".feature-card", has_text="Mike Clay Projections").click()
    page.wait_for_timeout(500)
    if page.locator("#tab-projections").is_visible():
        successes.append("Feature card navigates to its tab")
    else:
        failures.append("Feature card navigation broken")
    page.click('[data-tab="home"]')
    page.wait_for_timeout(400)
    # Regression: dynamic feature-card stats must reflect loaded data (not 0)
    feat_text = page.locator("#tab-home").inner_text()
    if "0 TEAMS" in feat_text.upper() or "0 MOVES" in feat_text.upper() or "0 PICKS" in feat_text.upper():
        failures.append("Feature-card stats baked at parse time (showing zeros)")
    else:
        successes.append("Feature-card stats reflect loaded data (no zero stubs)")
    # Regression: no horizontal overflow at mobile width
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(400)
    overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    if overflow > 0:
        failures.append(f"Horizontal overflow at mobile viewport: {overflow}px")
    else:
        successes.append("No horizontal overflow at mobile viewport")
    page.set_viewport_size({"width": 1600, "height": 950})

    # 1. Test Teams -> Moves newswire
    print("Testing Teams Moves newswire...")
    if page.locator('[data-tab="feed"]').count() == 0:
        successes.append("Top-level Transactions tab removed")
    else:
        failures.append("Top-level Transactions tab still present")

    # 1b. Draft tab removed; Draft Capital lives in the roster modal
    print("Testing Draft Capital in roster modal...")
    if page.locator('[data-tab="draft"]').count() == 0 and page.locator('#tab-draft').count() == 0:
        successes.append("Top-level Draft tab removed")
    else:
        failures.append("Top-level Draft tab still present")
    if page.locator('#rosterTabDc').count() == 1:
        successes.append("Draft Capital tab present in roster modal")
    else:
        failures.append("Draft Capital tab missing from roster modal")
    page.evaluate("openRoster('Cleveland Browns', 'draftcap')")
    page.wait_for_timeout(600)
    if page.locator('.dc-year-block').count() == 3 and page.locator('.dc-pick.gained').count() >= 2:
        successes.append("Draft Capital renders 2027/2028/2029 blocks with acquired picks")
    else:
        failures.append("Draft Capital view incomplete")
    page.evaluate("closeRoster()")
    page.wait_for_timeout(300)
    tile_txt = page.locator('.team-tile').first.inner_text()
    if '2027:' in tile_txt and '2028:' in tile_txt and '2029:' in tile_txt:
        successes.append("Team tiles show draft capital pick counts")
    else:
        failures.append("Team tiles missing draft capital summary")
    page.click('[data-tab="teams"]')
    page.wait_for_timeout(500)

    # 1c. Full-season schedule with week selector
    print("Testing schedule week selector...")
    page.click('[data-tab="schedule"]')
    page.wait_for_timeout(1500)
    chips = page.locator('#scheduleWeekChips button')
    if chips.count() == 18 and page.locator('.sch-card').count() == 16:
        successes.append("Schedule shows 18 week chips and 16 Week 1 cards")
    else:
        failures.append(f"Schedule selector wrong ({chips.count()} chips, {page.locator('.sch-card').count()} cards)")
    page.locator('#scheduleWeekChips button', has_text='WK 2').click()
    page.wait_for_timeout(1200)
    wk2_cards = page.locator('.sch-card').count()
    wk2_head = page.inner_text('#scheduleWeekNum')
    if wk2_cards == 16 and wk2_head == '2':
        successes.append("Week 2 slate renders with dynamic heading")
    else:
        failures.append(f"Week 2 render wrong ({wk2_cards} cards, heading {wk2_head})")
    if page.locator('.sch-card .sch-lines b').count() > 0:
        successes.append("Week 2 cards carry live market lines")
    else:
        failures.append("Week 2 cards missing market lines")
    page.click('[data-tab="teams"]')
    page.wait_for_timeout(500)
    move_tabs = page.locator('#teamsSubTabs .teams-subtab')
    if move_tabs.count() == 3 and page.locator('#teamsSubTabs', has_text='Moves').count():
        successes.append("Teams sub-tabs expose Overview, Moves, and Power Index")
    else:
        failures.append("Teams sub-tabs incomplete")
    page.locator('#teamsSubTabs .teams-subtab', has_text='Moves').click()
    page.wait_for_timeout(400)
    moves_text = page.inner_text('#movesContainer')
    if 'league activity wire' in moves_text.lower() and 'moves' in moves_text.lower() and page.locator('#movesNewswire .move-row').count() > 0:
        successes.append("Moves date-grouped newswire rendered with live transactions")
    else:
        failures.append("Moves newswire missing or empty")
    if page.locator('#movesNewswire .moves-date-group').count() > 1:
        successes.append("Moves feed grouped by transaction date")
    else:
        failures.append("Moves feed date grouping missing")
    original_rows = page.locator('#movesNewswire .move-row').count()
    if original_rows > 0:
        first_player = page.locator('#movesNewswire .move-row').first.locator('.move-player').inner_text()
        page.locator('#movesSearch').fill(first_player)
        page.wait_for_timeout(200)
        filtered_rows = page.locator('#movesNewswire .move-row').count()
        if filtered_rows > 0 and filtered_rows < original_rows:
            successes.append("Moves search filter narrows the source-backed wire")
        else:
            failures.append("Moves search filter did not narrow the source-backed wire")
    else:
        failures.append("Moves source returned no transactions; cannot test search interaction")
    if page.locator('#movesNewswire .move-row').count() > 0:
        page.locator('#movesNewswire .move-row').first.click()
        page.wait_for_timeout(200)
        if page.locator('#moveDetailDrawer.active').count() == 1 and page.locator('#moveDetailContent').inner_text():
            successes.append("Move detail drawer opens from a wire row")
        else:
            failures.append("Move detail drawer failed to open")
        page.locator('.move-drawer-close').click()
    page.locator('#movesSearch').fill('')
    page.wait_for_timeout(150)
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(250)
    moves_overflow = page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    if moves_overflow <= 0:
        successes.append("Moves view has no mobile horizontal overflow")
    else:
        failures.append(f"Moves view horizontal overflow: {moves_overflow}px")
    page.set_viewport_size({"width": 1600, "height": 950})

    # Legacy route compatibility
    page.evaluate("showTab('feed')")
    page.wait_for_timeout(250)
    if page.locator('#tab-teams').is_visible() and page.locator('#teamsMovesPanel').is_visible():
        successes.append("Legacy feed route redirects to Teams Moves")
    else:
        failures.append("Legacy feed route redirect broken")

    # 2. Test All 5 Themes
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

    # Regression: compare search datalists must contain ALL player names, not
    # just the first 200 alphabetically (bug: only A-D names populated).
    p1_values = page.locator("#pCompareList1 option").evaluate_all("els => els.map(e => e.value)")
    p2_values = page.locator("#pCompareList2 option").evaluate_all("els => els.map(e => e.value)")
    if (len(p1_values) > 200 and len(p2_values) > 200
            and "Justin Jefferson" in p1_values and "Patrick Mahomes" in p1_values
            and "Justin Jefferson" in p2_values):
        successes.append("Compare search datalists include all player names (no A-name truncation)")
    else:
        failures.append(f"Compare search datalist truncated (p1 opts={len(p1_values)}, p2 opts={len(p2_values)})")

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

server.shutdown()

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

sys.exit(0 if len(failures) == 0 and len(console_errors) == 0 else 1)
