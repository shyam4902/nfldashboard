# Browser-test fixtures (deterministic data feeds)

The dashboard's Python Playwright suites (`test_all_extensions.py`,
`test_projections.py`) and the Node smoke test (`props-smoke.mjs`) intercept
the runtime **data** feeds and serve deterministic, committed-data fixtures.
Suite results therefore do not depend on live Supabase contents, the nflverse
file, or today's network state for project data.

These are deterministic data-feed tests, not fully offline tests: Tailwind,
supabase-js, and Google Fonts still load from their CDNs over the network
(see "What is not intercepted" below).

## What is intercepted

| Feed | Fixture source |
|---|---|
| `nedyoydylpbjvihaoexy.supabase.co` (nfl_teams) | 32 rows derived from the committed `nfl_rosters_2026.json` snapshot (id/name/abbr/division/primary_color; no cap fields, so missing cap renders as `Unavailable`) |
| Supabase `nfl_players` | The committed `nfl_rosters_2026.json` rows (the deploy artifact of the same table) with synthetic `id` + `team_id` linkage; honors `offset`/`limit` pagination |
| Supabase `nfl_transactions` | `nfl_transactions.json` in this directory, a static, synthetic stand-in, not live data. Every row is labeled "test fixture row" in its detail so it can never be mistaken for a real transaction. It exists only to give the Moves newswire deterministic rows (multiple dates, trades/signings, blockbusters). |
| `raw.githubusercontent.com/nflverse/**` (games.csv) | Synthesized deterministically from the committed `schedule.json` (2026 REG rows with deterministic spread/total/moneyline columns) |
| `a.espncdn.com` (team logos) | 1x1 PNG, so no network image loads and no console noise |

The Supabase REST responses carry CORS headers and answer OPTIONS preflights
the same way the real service does.

## What is not intercepted

Tailwind, supabase-js, and Google Fonts load from their CDNs. Those are stable
third-party artifacts (like the Playwright browser binary itself), not project
data. Full offline isolation would require vendoring them, which is a
deliberate non-goal of these fixtures.

## Opt-in live mode

Fixture interception is the default test path. To exercise real Supabase and
nflverse data instead, set:

```bash
DASH_LIVE_NETWORK=1 python3 test_all_extensions.py   # python suites
DASH_LIVE_NETWORK=1 python3 test_projections.py
LIVE_SMOKE=1 PLAYWRIGHT_MODULE=/path/to/playwright node props-smoke.mjs   # node
```

Live mode is the explicit opt-in; it is not what CI or a routine verification
run executes.
