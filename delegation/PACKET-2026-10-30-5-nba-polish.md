# PACKET-2026-10-30-5: NBA polish from packet 4's known gaps (about 20 minutes)
Repo: /Users/shyampatel/Desktop/NFL_Main/nfldashboard — work directly in this tree.
Executor: freebuff, same session. About 20 minutes are left. Tasks are in priority order:
finish each one fully before starting the next, and if time runs out, mark the rest SKIPPED
in the walkthrough. Packets 3 and 4 are committed and live; read their walkthroughs' "Known gaps".

Only edit `nba/index.html`, `nba/nba.js`, `nba/nba.test.mjs`, and your walkthrough files.

## Tasks

T1. Top performer on score cards. `parseScoreboard` games gain `leaders: { away: {name, line}, home: {name, line} } | null`
from `competitions[0].competitors[].leaders` (or `competitions[0].leaders`, whichever the fixture
has; check `nba/fixtures/scoreboard-20261022.json`). Show one small muted line per team on final
and live cards, e.g. `Maxey 27 PTS`. Upcoming cards show nothing extra.
Test: scoreboard-20261022 games each have both leaders with a non-empty name.

T2. Phone search fixes from packet 4's gaps: opening search on phones must not leave the brand
and sport switch unclickable (close search on outside tap, and keep the switch reachable);
show a small "Searching…" row while a request is in flight and "No NBA players found" for an
empty result.

T3. Leaders polish: label the 3PM board "3PM per game"; give leader headshots fixed `width`/`height`
attributes and `decoding="async"`, with the player's initials in a neutral circle when there's
no headshot or it fails to load (`onerror` swap, no layout jump).

T4. Team page stats card. On `#team/<id>`, above Schedule/Roster tabs, show a compact card with
PPG, Opp PPG, Diff, FG%, 3P%, REB, AST, TOV using the T5 team data cache and `parseTeamStats`
plus the standings `ppg`/`oppPpg` (no new endpoints).

T5. Player vs player `#players/<idA>/<idB>`. Reuse the compare table renderer from packet 3 with
season averages from `parsePlayerOverview` (PTS, REB, AST, STL, BLK, TO, FG%, 3P%, FT%, MIN;
lower is better for TO). Two search boxes (reuse the T2 search component) to pick players. Entry
point: a "Compare" link on the player page header that prefills player A.
Test: none required beyond existing; note in the walkthrough how you checked it.

T6. Self-review: `node --test nba/nba.test.mjs` (0 failures), `node check_html_scripts.mjs`,
the banned-content grep from packet 3 T9 (0 for both files), the inline-script syntax check,
and every new `innerHTML` value through `esc()`. Add one line to the 2026-10-30 section of STATE.md.

## Hard rules
- No git commands except read-only `git diff --stat` / `git status --short`.
- No dependencies, no external scripts, no live fetches, no browser, no builds.
- No odds, predictions, news or fantasy content.

## Required output
`delegation/PACKET-2026-10-30-5-walkthrough.md`: per task, file:line, what changed, done-command
output, SKIPPED with reason where needed, and "Known gaps". Skip the reladraw diagram if under 5
minutes remain.
