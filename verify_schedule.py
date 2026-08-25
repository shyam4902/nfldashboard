#!/usr/bin/env python3
"""Focused Playwright smoke test for the new Schedule tab in nfldashboard."""
import os
import sys
import threading
import http.server
import time
from playwright.sync_api import sync_playwright

DASHBOARD_DIR = os.path.dirname(os.path.abspath(__file__))
PORT = 8791

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DASHBOARD_DIR, **kwargs)
    def log_message(self, format, *args):
        pass

server = http.server.HTTPServer(("127.0.0.1", PORT), Handler)
thread = threading.Thread(target=server.serve_forever, daemon=True)
thread.start()
time.sleep(0.5)

successes, failures, console_errors = [], [], []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1600, "height": 950})
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.goto(f"http://127.0.0.1:{PORT}/index.html")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(3000)

    # 1. Schedule tab button exists
    btn = page.locator('[data-tab="schedule"]')
    if btn.count() > 0:
        successes.append("Schedule tab button present in nav")
    else:
        failures.append("Schedule tab button missing")

    # 2. Click Schedule, cards render
    btn.first.click()
    page.wait_for_selector(".sch-card", timeout=8000)
    n = page.locator(".sch-card").count()
    page.wait_for_timeout(800)
    if n == 16:
        successes.append(f"Rendered all {n} Week 1 matchup cards")
    else:
        failures.append(f"Expected 16 cards, got {n}")

    # 3. Cards show matchup names, kickoff time and CTA regardless of data source
    text = page.inner_text("#scheduleGrid")
    if "Patriots" in text and "Seahawks" in text and "View matchup" in text and "View matchup" in text:
        successes.append("Cards render away/home teams, kickoff, venue, and click-through CTA")
    else:
        failures.append("Card content incomplete")

    # 4. Open matchup detail modal
    page.locator(".sch-card").first.click()
    page.wait_for_selector("#matchupModal.active", timeout=5000)
    modal_low = page.inner_text("#matchupModal").lower()
    # Game Lines box keeps Spread (with team in parens, e.g. (NE) +3.5) + Total, no moneyline cell
    gl_ok = ("(ne) +3.5" in modal_low) and ("&nbsp;" not in modal_low)
    if "win probability" in modal_low and "view roster" in modal_low and "week 1 matchup" in modal_low and gl_ok:
        successes.append("Matchup detail modal shows Week 1 label, win probability, Spread(team)+Total lines, roster actions")
    else:
        failures.append("Matchup detail modal incomplete or Game Lines box wrong (expected Spread with (team) + Total)")
    page.screenshot(path="screenshots_expansion/11_schedule_week1.png")
    page.locator("#matchupModal .roster-close").click()

    # 5. Real market lines render (nflverse spread/total/moneyline)
    # nflverse games.csv is ~2MB; poll until the first card's lines resolve
    page.wait_for_timeout(800)
    ok_market = False
    for _ in range(40):
        if page.locator(".sch-card .sch-line b").count() > 0:
            if page.evaluate("() => (MARKET_LINES && Object.keys(MARKET_LINES).length > 0)"):
                ok_market = True
                break
        page.wait_for_timeout(400)
    grid_low = page.inner_text("#scheduleGrid").lower()
    opener = page.locator(".sch-card").first.inner_text()
    # moneyline moved to each team row (e.g. +150 / -180); percentages live in the Win Prob cell
    ml_on_team_rows = ("+150" in opener and "-180" in opener)
    if ok_market and "spread" in grid_low and "total" in grid_low and "win prob" in grid_low and ml_on_team_rows and any(c.isdigit() for c in grid_low):
        successes.append("Cards show Spread/Total/Win Prob in the line row and each team's moneyline on its row")
    else:
        failures.append("Card market layout wrong (expected Spread/Total/Win Prob row + per-team moneyline)")

    # 6. Command palette includes schedule
    page.keyboard.press("Meta+k")
    page.wait_for_selector("#cmdPaletteInput", timeout=5000)
    page.fill("#cmdPaletteInput", "Schedule")
    page.wait_for_timeout(400)
    cmd = page.inner_text("#cmdPaletteResults")
    if "Week 1 Schedule" in cmd:
        successes.append("Command palette includes Week 1 Schedule")
    else:
        failures.append("Command palette missing schedule entry")
    page.keyboard.press("Escape")

    browser.close()

print("\n" + "="*50)
print("SCHEDULE TAB TEST SUMMARY")
print("="*50)
for s in successes:
    print(f"✓ {s}")
if failures:
    for f in failures:
        print(f"✗ {f}")
else:
    print("All Schedule tab tests passed!")
print(f"Console errors: {len(console_errors)}")
for e in console_errors:
    print(f"  [err] {e}")
sys.exit(0 if len(failures) == 0 else 1)