# PACKET-2026-10-30-7: NBA finish pass (speed, titles, a11y, gaps)
Repo: /Users/shyampatel/Desktop/NFL_Main/nfldashboard — work directly in this tree.
Executor: freebuff, same session, after PACKET-2026-10-30-6. Do every task in order, then T9.
Packet 6 moved the NFL page; don't touch `index.html`, `nfl/`, the test files it edited, or
`sitemap.xml`. Only edit `nba/index.html`, `nba/nba.js`, `nba/nba.test.mjs`, the new `404.html`,
`STATE.md`, and your walkthrough files.

## Tasks

T1. Smaller images (biggest speed win). ESPN serves full-size files: a headshot is 207KB and a
logo 37KB. Its resizer returns the same image at 8KB / 2KB (checked 2026-10-30):
`https://a.espncdn.com/combiner/i?img=<path>&w=<w>&h=<h>` where `<path>` is the URL path after
`a.espncdn.com` (e.g. `/i/headshots/nba/players/full/3945274.png`). Add one helper
`smallImg(url, w, h)` in `nba/nba.js` (exported, pure) that rewrites `https://a.espncdn.com/...`
URLs to the resizer at 2x the displayed size and leaves any other URL unchanged. Use it for
every logo and headshot in `nba/index.html`. Every `<img>` gets explicit `width`/`height`,
`loading="lazy"` (except the first screen of score cards) and `decoding="async"`.
Test: `smallImg` rewrites an espncdn URL, keeps non-espncdn URLs as-is, and returns '' for ''.

T2. Date bar at 375px: the date input pushes the "next" arrow onto a second line. Keep prev,
date, next and Today on one row on phones (shrink the input, or show the input as an icon
button that opens the native picker). No sideways scroll.

T3. Packet 5 gaps: (a) the player-compare pickers show the chosen players' names after a
re-render; (b) the picker debounce timer is cleared on every hash change (hook it into the same
place `stopPolling` runs), so no callback writes into detached nodes.

T4. Page titles per view, for tabs, history and shared links: `NBA Scores · Thu, Oct 22 ·
Matchup Board`, `BOS vs ORL · Matchup Board` (game), `Tyrese Maxey · Matchup Board`,
`PHI vs CLE · Compare · Matchup Board`, `Maxey vs Tatum · Matchup Board`, `NBA Standings ·
Matchup Board`, `NBA Leaders · Matchup Board`, team name for team pages. Set `document.title`
once the view's data has loaded; keep the default title while loading.

T5. Final-game team stats. On `#game/<id>` for live and final games, below the line score and
above the box tables, show a team comparison from the box score totals (FG, FG%, 3PT, 3P%, FT,
REB, AST, TOV, STL, BLK) by reusing the compare table renderer from packet 3 (lower is better
for TOV). Compute percentages from made/attempted when the totals only give `M-A`.
Test: for summary-401909093, the computed CLE and PHI FG% match `made/attempted` to 1 decimal.

T6. Accessibility pass on `nba/index.html`: visible `:focus-visible` outline in the gold accent
on links, buttons, selects and inputs; every icon-only button has an `aria-label`; tables have a
visually hidden `<caption>`; the sport switch and tabs mark the current item with
`aria-current`; images that carry no meaning have `alt=""`, player headshots have the player's
name as `alt`. Add a "Skip to content" link targeting `#app`.

T7. Standings view toggle: Conference (current) / League (one table of 30 sorted by win pct,
then point diff). Remember the choice in the hash (`#standings/league`).

T8. `404.html` at the repo root (Cloudflare Pages serves it for unknown paths): Matchup Board
wordmark, "That page doesn't exist", links to `/nfl/` and `/nba/`. Same head setup as
`nba/index.html` (palette, fonts, favicon), no scripts needed.

T9. Self-review. `node --test nba/nba.test.mjs` (0 failures, at least 21 tests),
`node check_html_scripts.mjs`, the banned-content grep from packet 3 T9 (0 for both files), the
inline-script syntax check, `xmllint --html --noout 404.html`, every new `innerHTML` value
through `esc()`, and list every `setTimeout`/`setInterval` with what clears it. Add a line to
the 2026-10-30 section of STATE.md.

## Hard rules
- No git commands except read-only `git diff --stat` / `git status --short`.
- No dependencies, no external scripts, no browser, no builds, no live fetches.
- No odds, predictions, news or fantasy content.

## Required output
`delegation/PACKET-2026-10-30-7-walkthrough.md`: per task, file:line, what changed, done-command
output, SKIPPED with reason where needed, and "Known gaps". Draw what changed with reladraw as
`delegation/PACKET-2026-10-30-7-changes.reladraw` + `.svg`.
