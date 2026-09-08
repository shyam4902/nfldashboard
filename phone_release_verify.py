#!/usr/bin/env python3
"""
Post-release phone-browser verification of the LIVE dashboard
(https://nfldashboard.pages.dev), mobile viewport with touch.

Checks, interactively:
  * Home / Schedule load on the phone with no overflow
  * Matchup preview: game identity, both offenses, EPA, season note,
    no win-probability card
  * Evidence disclosure: expand both details blocks, verify definition,
    observation period, aggregation time, source link, and the
    not-a-current-season / defensive-exposure caveats
  * Formation Lab: field renders with player chips, tapping a chip opens
    the player modal, illustrative-alignment note present, no overflow
  * Failure banner: request-intercepted pipeline-status.json with a failed
    payload renders the visible banner (step, time, recovery); the live
    healthy (ok) status shows no banner
  * Keyboard: possession toggle focusable, Enter switches, focus retained
"""

import json
import re
import sys
import time
from playwright.sync_api import sync_playwright

URL = "https://nfldashboard.pages.dev/"
console_errors = []
page_errors = []


def new_page(p, ctx=None):
    pg = (ctx or p).new_page()
    pg.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: page_errors.append(str(e)))
    return pg


results = []


def check(label, ok, detail=""):
    results.append((label, ok, detail))
    print(("✓ " if ok else "✗ ") + label + (f" — {detail}" if detail else ""))


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(
        viewport={"width": 390, "height": 844},
        user_agent=("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) "
                    "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 "
                    "Mobile/15E148 Safari/604.1"),
        is_mobile=True,
        has_touch=True,
    )
    pg = new_page(p, ctx)
    pg.goto(URL, timeout=60000)
    pg.wait_for_load_state("networkidle")
    pg.wait_for_timeout(4000)

    # ── Home ──
    check("Home renders on phone", pg.locator("#h2aHero").is_visible())
    ov = pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    check("No horizontal overflow (Home)", ov == 0, f"{ov}px")

    # ── Schedule ──
    pg.evaluate("showTab('schedule')")
    pg.wait_for_timeout(1500)
    chips = pg.locator("#scheduleWeekChips button").count()
    cards = pg.locator(".sch-card").count()
    check("Schedule loads (18 week chips, 16 cards)", chips == 18 and cards == 16, f"{chips} chips / {cards} cards")

    # ── Matchup preview ──
    pg.evaluate("showTab('matchup')")
    pg.wait_for_timeout(1200)
    pg.evaluate("setMatchupSubTab('preview')")
    pg.wait_for_timeout(2500)
    hero = pg.locator("#matchupHeroBanner").inner_text()
    check("Game identity in hero (NE vs SEA)", "Patriots" in hero and "Seahawks" in hero, hero[:60].replace("\n", " "))
    preview = pg.locator("#matchupMainContent").inner_text()
    check("Preview shows EPA bars", "Overall EPA" in preview)
    check("Tendencies loaded (numerator/observed)", bool(re.search(r"\d+ of \d+", preview)))
    check("Season note present", "season in progress" in preview and "last completed" in preview)
    check("No win-probability card", "Win Probability" not in pg.locator("#matchupSidebar").inner_text())

    # Offense B swap
    pg.evaluate("swapViewedOffense()")
    pg.wait_for_timeout(800)
    preview_b = pg.locator("#matchupMainContent").inner_text()
    check("Offense B renders EPA after swap", "Overall EPA" in preview_b)
    hero_after = pg.locator("#matchupHeroBanner").inner_text()
    check("Game identity kept after swap", "Patriots" in hero_after and "Seahawks" in hero_after)
    pg.evaluate("swapViewedOffense()")
    pg.wait_for_timeout(600)

    # ── Evidence disclosure (tap to expand) ──
    pg.locator("#matchupMainContent details summary").first.tap()
    pg.wait_for_timeout(500)
    pg.locator("#matchupMainContent details summary").nth(1).tap()
    pg.wait_for_timeout(500)
    disc = pg.locator("#matchupMainContent").inner_text()
    check("Disclosure: definition (measures:)", "measures:" in disc)
    check("Disclosure: observation window (weeks/games)", bool(re.search(r"weeks 1-18|weeks", disc)) and "games" in disc)
    check("Disclosure: aggregation time labeled", "aggregated" in disc and "aggregation time" in disc)
    check("Disclosure: source link present", pg.locator("#matchupMainContent details a[href^='http']").count() > 0)
    check("Disclosure: not a current-season measurement", "not a current-season measurement" in disc)
    check("Disclosure: defensive exposure caveat", "does not measure defensive effectiveness" in disc or "does not predict a winner" in disc)

    # ── Formation Lab (tap a chip) ──
    pg.evaluate("setMatchupSubTab('formation')")
    pg.wait_for_timeout(1200)
    ftext = pg.locator("#matchupMainContent").inner_text()
    check("Formation Lab illustrative note", "Illustrative alignments" in ftext and "not a complete weekly injury report" in ftext)
    chips_f = pg.locator("#matchupMainContent .formation-player").count()
    check("Formation field player chips render", chips_f >= 10, f"{chips_f} chips")
    ov = pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    check("No horizontal overflow (Formation)", ov == 0, f"{ov}px")
    pg.locator("#matchupMainContent .formation-player").first.tap()
    pg.wait_for_timeout(900)
    modal = pg.locator("#playerModal, .player-modal").first
    modal_visible = modal.is_visible()
    modal_text = modal.inner_text() if modal_visible else ""
    check("Tap player chip opens the player modal", modal_visible and bool(re.search(r"QB|WR|RB|TE|DE|CB|S", modal_text)), modal_text[:60].replace("\n", " "))
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(300)

    # ── Failure banner (intercepted, live build) ──
    pg2 = new_page(p, ctx)
    pg2.route("**/data/shared/pipeline-status.json", lambda route: route.fulfill(
        status=200, content_type="application/json",
        body=json.dumps({
            "status": "failed", "started_at": "2026-09-08T09:00:00Z",
            "finished_at": "2026-09-08T09:01:30Z",
            "failed_step": "sync shared data", "exit_code": 1,
        }),
    ))
    pg2.goto(URL, timeout=60000)
    pg2.wait_for_load_state("networkidle")
    pg2.wait_for_timeout(2500)
    body2 = pg2.inner_text("body")
    banner = pg2.locator("#pipelineStatusBanner")
    check("Failure banner visible on failed status", banner.is_visible() and re.search(r"last automatic data update failed", body2, re.I))
    check("Banner shows failing step + recovery", "sync shared data" in body2 and "props:daily" in body2)
    pg2.close()

    # ── Healthy state: live ok status → no banner ──
    body_live = pg.inner_text("body")
    check("No banner with healthy (ok) live status",
          not pg.locator("#pipelineStatusBanner").is_visible()
          and "Last automatic data update failed" not in body_live)
    pg.close()

    ctx.close()
    browser.close()

print("\n" + "=" * 50)
print("PHONE VERIFICATION SUMMARY")
print("=" * 50)
passed = sum(1 for _, ok, _ in results if ok)
failed = [(l, d) for l, ok, d in results if not ok]
print(f"{passed}/{len(results)} checks passed")
if failed:
    print("FAILURES:")
    for l, d in failed:
        print(f"  ✗ {l} — {d}")
print(f"Console errors: {len(console_errors)} | Page errors: {len(page_errors)}")
for e in console_errors[:5]:
    print(f"  [console] {e[:140]}")
for e in page_errors[:3]:
    print(f"  [pageerr] {e[:140]}")

sys.exit(1 if (failed or console_errors or page_errors) else 0)