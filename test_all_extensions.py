#!/usr/bin/env python3
"""
Comprehensive verification test for updated NFL Dashboard features.
"""

import json
import os
import re
import sys
import threading
import http.server
import time
from playwright.sync_api import sync_playwright

DASHBOARD_DIR = os.path.dirname(os.path.abspath(__file__))
SCREENSHOT_DIR = os.path.join(DASHBOARD_DIR, "screenshots_expansion")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

# Deterministic data-feed fixtures (default): intercept Supabase + nflverse with
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
page_errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 950})

    def handle_console(msg):
        if msg.type == "error":
            console_errors.append(msg.text)
    def handle_pageerror(err):
        # Uncaught page exceptions (ReferenceError etc.) — the suite must fail
        # on these, not just on console errors.
        page_errors.append(str(err))
    page.on("console", handle_console)
    page.on("pageerror", handle_pageerror)
    browser_fixtures.install(page, DASHBOARD_DIR)

    page.goto(f"http://127.0.0.1:{PORT}/index.html")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2500)
    page.screenshot(path=f"{SCREENSHOT_DIR}/01_home_default.png")
    successes.append("Home page loaded")

    # 0. Test the 2a Home redesign page (hero carousel, scorestrip, storylines, power index)
    print("Testing Home 2a redesign...")
    home_text = page.inner_text("#tab-home")
    if page.locator("#h2aHero").is_visible() and page.locator(".h2a-strip").is_visible():
        successes.append("Home 2a hero carousel + scorestrip rendered")
    else:
        failures.append("Home 2a hero or scorestrip missing")
    logo_count = page.locator(".h2a-strip img, .h2a-pi-row img").count()
    if logo_count >= 6:
        successes.append(f"Team logos rendered in scorestrip and power index ({logo_count} logos)")
    else:
        failures.append(f"Team logos missing or insufficient in home: {logo_count}")
    page.wait_for_timeout(1500)
    spots = page.inner_text("#homeSpotlights")
    for sec in ["Week 1 Marquee", "Top Value Plays", "Biggest Offseason Moves"]:
        if sec in spots:
            successes.append(f"Home spotlight '{sec}' rendered")
        else:
            failures.append(f"Home spotlight '{sec}' missing")
    # Power index navigation: click a row and verify it switches to projections tab
    page.locator(".h2a-pi-row").first.click()
    page.wait_for_timeout(500)
    if page.locator("#tab-projections").is_visible():
        successes.append("Home power index navigates to projections tab")
    else:
        failures.append("Home power index navigation broken")
    page.click('[data-tab="home"]')
    page.wait_for_timeout(400)
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
    page.evaluate("openRoster('Cleveland Browns', 'offense')")
    page.wait_for_timeout(400)
    summary_txt = page.locator('#rosterSummary').inner_text().lower()
    if 'draft capital' in summary_txt and 'picks' in summary_txt:
        successes.append("Roster summary card presents draft capital")
    else:
        failures.append("Roster summary card missing draft capital")
    page.evaluate("closeRoster()")
    page.wait_for_timeout(300)
    tile_txt = page.locator('.team-tile').first.inner_text()
    if 'Cap Space' in tile_txt and 'Proj W' not in tile_txt:
        successes.append("Team tiles render clean cap space without projected wins badges")
    else:
        failures.append("Team tiles missing clean cap space or have unexpected projected wins badges")
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
    page.screenshot(path=f"{SCREENSHOT_DIR}/11_schedule_week2.png")
    page.click('[data-tab="teams"]')
    page.wait_for_timeout(500)
    page.screenshot(path=f"{SCREENSHOT_DIR}/12_teams_overview.png")
    move_tabs = page.locator('#teamsSubTabs .teams-subtab')
    if move_tabs.count() == 3 and page.locator('#teamsSubTabs', has_text='Moves').count():
        successes.append("Teams sub-tabs expose Overview, Moves, and Power Index")
    else:
        failures.append("Teams sub-tabs incomplete")
    page.locator('#teamsSubTabs .teams-subtab', has_text='Moves').click()
    page.wait_for_timeout(400)
    page.screenshot(path=f"{SCREENSHOT_DIR}/13_teams_moves.png")
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

    # 8. Test Matchup Center & Pro Preview
    print("Testing Matchup Center & Pro Preview...")
    page.evaluate("showTab('matchup')")
    page.wait_for_timeout(900)
    page.screenshot(path=f"{SCREENSHOT_DIR}/14_matchup_center.png")
    # Click Pro Preview subtab
    pro_tab = page.locator('#matchupViewMode button, [onclick*="preview"], [onclick*="pro"]')
    if pro_tab.count() > 0:
        page.locator('button', has_text='Pro Preview').first.click()
        page.wait_for_timeout(900)
        page.screenshot(path=f"{SCREENSHOT_DIR}/15_matchup_pro_preview.png")
    # Real-content assertions: a blank main panel or a missing question/EPA
    # evidence is a FAILURE, not a success. The tendencies loader is async, so
    # first wait for its evidence disclosure to render (up to ~5s).
    disclosure_ready = False
    for _ in range(10):
        if page.locator("#matchupMainContent details summary").count() > 0:
            disclosure_ready = True
            break
        page.wait_for_timeout(500)
    preview_text = page.locator("#matchupMainContent").inner_text().strip()
    if len(preview_text) < 100:
        failures.append(f"Matchup Pro Preview main panel is blank or nearly empty ({len(preview_text)} chars)")
    else:
        if "How will" in preview_text and "play-action" in preview_text and "does not measure" in preview_text:
            successes.append("Matchup Pro Preview question banner renders dynamic play-action copy")
        else:
            failures.append("Matchup Pro Preview question banner missing dynamic question or exposure wording")
        if re.search(r"\d+ of \d+", preview_text):
            successes.append("Matchup Pro Preview shows numeric tendency evidence (numerator / observed)")
        else:
            failures.append("Matchup Pro Preview missing numeric tendency evidence")
        if "Overall EPA" in preview_text and re.search(r"EPA.*\d", preview_text, re.DOTALL):
            successes.append("Matchup Pro Preview shows numeric EPA bars")
        else:
            failures.append("Matchup Pro Preview missing numeric EPA bars")
        if "Win Probability" in page.locator("#matchupSidebar").inner_text():
            failures.append("Matchup Pro Preview still shows the unsupported win-probability card")
        else:
            successes.append("Matchup Pro Preview excludes the win-probability card")
    # Expanded evidence disclosure: open the first details block and verify the
    # definition, observation period, aggregation time, and a clickable source.
    if disclosure_ready:
        page.locator("#matchupMainContent details summary").first.click()
        page.wait_for_timeout(400)
        disclosure_text = page.locator("#matchupMainContent").inner_text()
        if "measures:" in disclosure_text and "2025 regular season" in disclosure_text and "aggregated" in disclosure_text:
            successes.append("Matchup evidence disclosure shows definition, season window, and aggregation time")
        else:
            failures.append("Matchup evidence disclosure missing definition, season, or aggregation provenance")
        if page.locator("#matchupMainContent details a[href^='http']").count() > 0:
            successes.append("Matchup evidence disclosure links to its source")
        else:
            failures.append("Matchup evidence disclosure missing a clickable source link")
    else:
        failures.append("Matchup evidence disclosure never rendered (tendency loader did not load)")
    # Checkpoint 3: the observation season is labeled and kept distinct from
    # the current (2026) season, and the field carries the illustrative note.
    if re.search(r"2025 regular season", preview_text, re.IGNORECASE) and "last completed" in preview_text:
        successes.append("Matchup preview labels the measured season as last completed, distinct from the current season")
    else:
        failures.append("Matchup preview missing measured-season label or last-completed note")
    if "2026 season in progress" in preview_text:
        successes.append("Matchup preview states the current season is in progress, so measured numbers are historical")
    else:
        failures.append("Matchup preview missing current-season-in-progress note")
    page.evaluate("setMatchupSubTab('formation')")
    page.wait_for_timeout(700)
    formation_text = page.locator("#matchupMainContent").inner_text()
    if "Illustrative alignments" in formation_text and "not a complete weekly injury report" in formation_text:
        successes.append("Formation Lab explains the field is illustrative, not a game-day lineup or injury report")
    else:
        failures.append("Formation Lab missing illustrative-alignment / injury-report note")
    page.evaluate("setMatchupSubTab('preview')")
    page.wait_for_timeout(400)

    # Checkpoint 4: the failed-update banner is the owner-visible signal.
    # Healthy (ok) status -> no banner; failed status -> visible banner with
    # the failing step, run time, and recovery hint; absent file -> no claim.
    banner = page.locator("#pipelineStatusBanner")
    if banner.is_hidden() and "Last automatic data update failed" not in page.inner_text("body"):
        successes.append("No failure banner with a healthy (ok) pipeline status")
    else:
        failures.append("Failure banner shown while pipeline status is ok")

    failed_page = browser.new_page(viewport={"width": 1600, "height": 950})
    failed_page.on("console", handle_console)
    failed_page.on("pageerror", handle_pageerror)
    browser_fixtures.install(failed_page, DASHBOARD_DIR)
    failed_page.route(
        "**/data/shared/pipeline-status.json",
        lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=json.dumps({
                "status": "failed",
                "started_at": "2026-09-08T03:45:54Z",
                "finished_at": "2026-09-08T03:47:10Z",
                "failed_step": "sync shared data",
                "exit_code": 1,
            }),
        ),
    )
    failed_page.goto(f"http://127.0.0.1:{PORT}/index.html")
    failed_page.wait_for_load_state("networkidle")
    failed_page.wait_for_timeout(1500)
    failed_banner = failed_page.locator("#pipelineStatusBanner")
    failed_text = failed_page.inner_text("body")
    if failed_banner.is_visible() \
            and re.search(r"last automatic data update failed", failed_text, re.IGNORECASE) \
            and "sync shared data" in failed_text and "props:daily" in failed_text:
        successes.append("Failed pipeline status renders the visible failure banner (step, time, recovery)")
    else:
        failures.append("Failed pipeline status did not render the failure banner")
    failed_page.close()

    absent_page = browser.new_page(viewport={"width": 1600, "height": 950})
    absent_page.on("console", handle_console)
    absent_page.on("pageerror", handle_pageerror)
    browser_fixtures.install(absent_page, DASHBOARD_DIR)
    absent_page.route("**/data/shared/pipeline-status.json",
                      lambda route: route.fulfill(status=204))
    absent_page.goto(f"http://127.0.0.1:{PORT}/index.html")
    absent_page.wait_for_load_state("networkidle")
    absent_page.wait_for_timeout(1200)
    if absent_page.locator("#pipelineStatusBanner").is_hidden() \
            and not re.search(r"last automatic data update failed",
                              absent_page.inner_text("body"), re.IGNORECASE):
        successes.append("Absent pipeline status file shows no banner (no claim, no error)")
    else:
        failures.append("Absent pipeline status file rendered a banner or page error")
    absent_page.close()

    # Malformed (non-JSON) status response: treated as "no claim" — the page
    # must render normally with no banner and no uncaught error.
    malformed_page = browser.new_page(viewport={"width": 1600, "height": 950})
    malformed_page.on("console", handle_console)
    malformed_page.on("pageerror", handle_pageerror)
    browser_fixtures.install(malformed_page, DASHBOARD_DIR)
    malformed_page.route("**/data/shared/pipeline-status.json",
                         lambda route: route.fulfill(status=200,
                                                      content_type="text/html",
                                                      body="<html>not json</html>"))
    malformed_page.goto(f"http://127.0.0.1:{PORT}/index.html")
    malformed_page.wait_for_load_state("networkidle")
    malformed_page.wait_for_timeout(1200)
    if malformed_page.locator("#pipelineStatusBanner").is_hidden() \
            and not re.search(r"last automatic data update failed",
                              malformed_page.inner_text("body"), re.IGNORECASE):
        successes.append("Malformed pipeline status response shows no banner and no error")
    else:
        failures.append("Malformed pipeline status response broke the page or showed a banner")
    malformed_page.close()

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
print(f"\nUncaught page errors: {len(page_errors)}")
for err in page_errors:
    print(f"  [Page Error] {err}")

sys.exit(0 if len(failures) == 0 and len(console_errors) == 0 and len(page_errors) == 0 else 1)
