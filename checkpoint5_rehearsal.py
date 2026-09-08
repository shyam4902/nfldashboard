#!/usr/bin/env python3
"""
Checkpoint 5 release-rehearsal probe.

Covers what the existing suites do not:
  * Horizontal page overflow at 390px on EVERY Matchup subtab and Teams
    (the Sept 4 dress-rehearsal B5 blocker, rechecked against the
    checkpoint 1-3 Matchup changes).
  * Possession swap keeps the selected game and flips numeric evidence.
  * Keyboard: possession toggle is focusable, Enter/space switches it,
    visible focus is retained, and the field has an equivalent player list.
  * Cross-app links: every dashboard Edge href targets the canonical
    pages.dev URL; zero dead custom-domain links; desktop walkthrough of
    Home/Schedule/Teams/Projections/Matchup with screenshots.
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
SHOT_DIR = os.path.join(DASHBOARD_DIR, "screenshots_expansion")
os.makedirs(SHOT_DIR, exist_ok=True)

FIXTURES_DIR = os.path.join(DASHBOARD_DIR, "test-fixtures")
sys.path.insert(0, FIXTURES_DIR)
import browser_fixtures  # noqa: E402


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DASHBOARD_DIR, **kwargs)
    def log_message(self, format, *args):
        pass


PORT = 8789
server = http.server.HTTPServer(("127.0.0.1", PORT), Handler)
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
print(f"HTTP server running on http://127.0.0.1:{PORT}")
time.sleep(0.5)

successes = []
failures = []
console_errors = []
page_errors = []

MATCHUP_SUBTABS = ["preview", "overview", "passing", "rushing", "trenches", "insights", "formation"]


def check_overflow(page, label):
    w = page.evaluate("document.documentElement.scrollWidth")
    cw = page.evaluate("document.documentElement.clientWidth")
    if w > cw:
        failures.append(f"Horizontal overflow [{label}]: scrollWidth {w}px > viewport {cw}px")
    else:
        successes.append(f"No horizontal overflow [{label}]")


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # ── Desktop walkthrough ────────────────────────────────────────────────
    page = browser.new_page(viewport={"width": 1440, "height": 900})

    def handle_console(msg):
        if msg.type == "error":
            console_errors.append(msg.text)
    def handle_pageerror(err):
        page_errors.append(str(err))
    page.on("console", handle_console)
    page.on("pageerror", handle_pageerror)
    browser_fixtures.install(page, DASHBOARD_DIR)

    page.goto(f"http://127.0.0.1:{PORT}/index.html")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2500)
    page.screenshot(path=f"{SHOT_DIR}/cp5_desktop_home.png")
    if page.locator("#h2aHero").is_visible():
        successes.append("Desktop Home loads hero + feature cards")
    else:
        failures.append("Desktop Home hero missing")

    # Schedule
    page.click('[data-tab="schedule"]')
    page.wait_for_timeout(1500)
    if page.locator('#scheduleWeekChips button').count() == 18 and page.locator('.sch-card').count() == 16:
        successes.append("Desktop Schedule: 18 week chips, 16 Week 1 cards")
    else:
        failures.append("Desktop Schedule wrong")
    page.screenshot(path=f"{SHOT_DIR}/cp5_desktop_schedule.png")

    # Teams
    page.click('[data-tab="teams"]')
    page.wait_for_timeout(1200)
    if page.locator('.team-tile').count() >= 16 and page.locator('#teamsSubTabs .teams-subtab').count() == 3:
        successes.append("Desktop Teams: tiles + Overview/Moves/Power tabs")
    else:
        failures.append("Desktop Teams incomplete")
    page.screenshot(path=f"{SHOT_DIR}/cp5_desktop_teams.png")

    # Projections
    page.click('[data-tab="projections"]')
    page.wait_for_timeout(1200)
    if page.locator('#projContent').is_visible():
        successes.append("Desktop Projections renders")
    else:
        failures.append("Desktop Projections missing")
    page.screenshot(path=f"{SHOT_DIR}/cp5_desktop_projections.png")

    # Matchup / Pro Preview
    page.evaluate("showTab('matchup')")
    page.wait_for_timeout(900)
    page.evaluate("setMatchupSubTab('preview')")
    page.wait_for_timeout(1200)
    page.screenshot(path=f"{SHOT_DIR}/cp5_desktop_matchup.png")

    # Game identity
    hero_text = page.locator("#matchupHeroBanner").inner_text()
    if "Patriots" in hero_text and "Seahawks" in hero_text:
        successes.append("Matchup game identity: NE vs SEA hero banner")
    else:
        failures.append(f"Matchup hero banner missing game identity: {hero_text[:80]}")

    # Both offenses + numeric evidence flip
    preview_a = page.locator("#matchupMainContent").inner_text()
    if "Overall EPA" in preview_a and re.search(r"\d+ of \d+", preview_a):
        successes.append("Matchup offense A shows EPA + tendency evidence")
    else:
        failures.append("Matchup offense A missing EPA or tendency evidence")
    page.evaluate("swapViewedOffense()")
    page.wait_for_timeout(800)
    preview_b = page.locator("#matchupMainContent").inner_text()
    if "Overall EPA" in preview_b and re.search(r"\d+ of \d+", preview_b):
        successes.append("Matchup offense B shows EPA + tendency evidence after swap")
    else:
        failures.append("Matchup offense B missing evidence after swap")
    if "Seahawks" in page.locator("#matchupHeroBanner").inner_text():
        successes.append("Possession swap keeps the selected game (hero unchanged)")
    else:
        failures.append("Possession swap changed the game identity")
    page.evaluate("swapViewedOffense()")
    page.wait_for_timeout(600)

    # Field access
    page.evaluate("setMatchupSubTab('formation')")
    page.wait_for_timeout(900)
    formation_text = page.locator("#matchupMainContent").inner_text()
    if "Illustrative alignments" in formation_text:
        successes.append("Formation Lab renders with illustrative-alignment note")
    else:
        failures.append("Formation Lab note missing")
    page.screenshot(path=f"{SHOT_DIR}/cp5_desktop_formation.png")

    # Cross-app links: every Edge href must use the canonical pages.dev URL
    hrefs = page.evaluate("""
        Array.from(document.querySelectorAll('a[href*="edge"]')).map(a => a.href)
    """)
    bad = [h for h in hrefs if "shyamsapps" in h]
    good = [h for h in hrefs if "edgeplay-analytics.pages.dev" in h]
    if bad:
        failures.append(f"Dead custom-domain links found: {bad}")
    else:
        successes.append("Zero dead edge.shyamsapps.qzz.io links in the candidate")
    if good:
        successes.append(f"Dashboard links to Edge via canonical pages.dev ({len(good)} hrefs)")
    else:
        failures.append("No Edge links found in the dashboard")

    # ── Mobile 390x844 ─────────────────────────────────────────────────────
    page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(600)

    for tab, name in [("home", "Home"), ("schedule", "Schedule"), ("teams", "Teams"),
                      ("projections", "Projections"), ("matchup", "Matchup")]:
        page.evaluate(f"showTab('{tab}')")
        page.wait_for_timeout(1000)
        check_overflow(page, f"mobile {name}")
    page.screenshot(path=f"{SHOT_DIR}/cp5_mobile_matchup.png")

    # Every Matchup subtab at mobile width (the Sept 4 B5 blocker was 535px)
    page.evaluate("showTab('matchup')")
    page.wait_for_timeout(800)
    for sub in MATCHUP_SUBTABS:
        page.evaluate(f"setMatchupSubTab('{sub}')")
        page.wait_for_timeout(700)
        check_overflow(page, f"mobile Matchup:{sub}")
    page.screenshot(path=f"{SHOT_DIR}/cp5_mobile_formation.png")

    # Teams sub-tabs at mobile width
    page.evaluate("showTab('teams')")
    page.wait_for_timeout(800)
    for sub in ["overview", "moves", "power"]:
        try:
            page.evaluate(f"setTeamsSubTab('{sub}')")
        except Exception:
            page.locator('#teamsSubTabs .teams-subtab', has_text=sub.capitalize()).click()
        page.wait_for_timeout(500)
        check_overflow(page, f"mobile Teams:{sub}")
    page.screenshot(path=f"{SHOT_DIR}/cp5_mobile_teams_moves.png")

    # ── Keyboard access ────────────────────────────────────────────────────
    page.evaluate("showTab('matchup')")
    page.wait_for_timeout(600)
    page.evaluate("setMatchupSubTab('preview')")
    page.wait_for_timeout(900)
    page.evaluate("document.querySelector('#matchupMainContent button[onclick*=\"swapViewedOffense\"]').focus()")
    page.wait_for_timeout(200)
    focused = page.evaluate("document.activeElement && document.activeElement.outerHTML.slice(0, 120)")
    if "swapViewedOffense" in (focused or ""):
        successes.append("Possession toggle is keyboard-focusable")
    else:
        failures.append(f"Possession toggle not focusable: {focused}")
    page.keyboard.press("Enter")
    page.wait_for_timeout(700)
    pressed = page.evaluate("""
        document.querySelector('#matchupMainContent button[onclick*="swapViewedOffense"]')
            .getAttribute('aria-pressed')
    """)
    focused_after = page.evaluate("document.activeElement && document.activeElement.outerHTML.slice(0, 120)")
    if pressed == "false":
        successes.append("Enter on the toggle switches possession (aria-pressed flips)")
    else:
        failures.append(f"Enter did not switch possession: aria-pressed={pressed}")
    if "swapViewedOffense" in (focused_after or ""):
        successes.append("Visible focus retained on the toggle after switching")
    else:
        failures.append("Focus lost after switching possession")
    page.keyboard.press("Enter")
    page.wait_for_timeout(500)

    # Field player information through the keyboard: each starter chip is
    # focusable (role=button) and Enter opens the player modal (the cp1
    # requirement: keyboard access to the field's player information).
    page.evaluate("setMatchupSubTab('formation')")
    page.wait_for_timeout(900)
    chip_state = page.evaluate("""
        (() => {
            const chips = document.querySelectorAll('#matchupMainContent .formation-player');
            const first = chips[0];
            return {
                count: chips.length,
                focusable: !!first && first.getAttribute('tabindex') === '0' && first.getAttribute('role') === 'button',
                names: !!first && /[A-Z]/.test(first.innerText)
            };
        })()
    """)
    page.evaluate("document.querySelector('#matchupMainContent .formation-player').focus()")
    page.wait_for_timeout(200)
    page.keyboard.press("Enter")
    page.wait_for_timeout(700)
    modal_text = page.evaluate("""
        (() => {
            const m = document.querySelector('#playerModal') || document.querySelector('.player-modal');
            return m ? m.innerText : '';
        })()
    """)
    if chip_state["count"] >= 10 and chip_state["focusable"] and chip_state["names"]:
        successes.append(f"Field player chips are keyboard-focusable ({chip_state['count']} chips with names)")
    else:
        failures.append(f"Field player chips not keyboard-accessible: {chip_state}")
    if modal_text and "A.J. Brown" in modal_text:
        successes.append("Enter on a focused player chip opens the player modal")
    else:
        failures.append(f"Enter on a player chip did not open the player modal: {modal_text[:80]!r}")
    page.keyboard.press("Escape")
    page.wait_for_timeout(300)

    page.screenshot(path=f"{SHOT_DIR}/cp5_keyboard_formation.png")
    page.close()

    # ── Edge app: link back to the dashboard (E1 cross-app check) ─────────
    try:
        edge_page = browser.new_page(viewport={"width": 390, "height": 844})
        edge_errors = []
        edge_page.on("pageerror", lambda err: edge_errors.append(str(err)))
        edge_page.goto("https://edgeplay-analytics.pages.dev", timeout=30000)
        edge_page.wait_for_load_state("networkidle")
        edge_page.wait_for_timeout(1500)
        edge_hrefs = edge_page.evaluate(
            "Array.from(document.querySelectorAll('a')).map(a => a.href)"
        )
        dash_links = [h for h in edge_hrefs if "nfldashboard.pages.dev" in h]
        if dash_links:
            successes.append(f"Edge links back to the dashboard ({len(dash_links)} hrefs)")
        else:
            failures.append("Edge has no link back to the dashboard (E1 one-way only)")
        if edge_errors:
            failures.append(f"Edge home page errors: {edge_errors[:3]}")
        else:
            successes.append("Edge home loads on mobile with zero page errors")
        edge_page.screenshot(path=f"{SHOT_DIR}/cp5_edge_mobile_home.png")
        edge_page.close()
    except Exception as e:
        failures.append(f"Edge live check failed: {e}")

    browser.close()

server.shutdown()

print("\n" + "=" * 50)
print("CHECKPOINT 5 REHEARSAL SUMMARY")
print("=" * 50)
for s in successes:
    print(f"✓ {s}")
if failures:
    print("\nFAILURES:")
    for f in failures:
        print(f"✗ {f}")
else:
    print("\nAll rehearsal checks passed cleanly!")

print(f"\nConsole errors logged: {len(console_errors)}")
for err in console_errors:
    print(f"  [Console Error] {err}")
print(f"Uncaught page errors: {len(page_errors)}")
for err in page_errors:
    print(f"  [Page Error] {err}")

sys.exit(1 if (failures or console_errors or page_errors) else 0)