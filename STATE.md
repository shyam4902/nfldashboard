# NFL Dashboard state

- Updated: 2026-09-04
- Live: https://nfldashboard.pages.dev/
- Repo: https://github.com/shyam4902/nfldashboard
- App: static `index.html`, tracked JSON assets, and Supabase roster and transaction data

## Shipped recently

- Aligned Home marquee game cards and the Teams page with the Schedule card design system:
  - Redesigned Home 'Week 1 Marquee' game cards (`marqueeGameHtml`) to use the `.home-sch-card` component matching `.sch-card`: high-res NFL team logos, Archivo bold abbreviations, Geist team names, green probability highlights for favorites, dual-color win probability bars, and footer with spread/total and direct navigation to Matchup Center.
  - Redesigned the Teams page (`renderConf`) from a cramped 4-column layout without logos to a responsive 2x2 division grid of rich studio cards (`.team-tile`): top team-color indicator rail, team logo with drop-shadow, Archivo typography, model projected wins badge, cap space, and draft capital summary.
  - Verified with `python3 test_all_extensions.py` (34/34 passing checks, 0 console errors) and live Playwright visual captures.
  rest of the app in one pass, replacing the legacy navy "Obsidian Slate" look:
  - Added a `tailwind.config` palette remap right after the Tailwind CDN tag. The
    `slate` ramp becomes warm studio charcoal (`#16191f` / `#2b3037` / `#8f9299`),
    `amber` becomes studio gold `#d9a441`, and `blue`/`sky`/`cyan`/`emerald`/`red`/
    `indigo` drop their neon chroma. This re-skins ~1,200 utility-class usages
    across every tab at once. The assignment is guarded (`window.tailwind =
    window.tailwind || {}`) so a blocked or offline CDN cannot abort page scripts.
  - Retuned the default `:root` theme tokens to the studio surfaces and accents
    (`--bg-body: #0b0d10`, `--bg-card: #14161a`, `--border-card: #2b3037`,
    `--accent-brand: #d9a441`) and added `--bg-inset` to all five themes.
  - Remapped hardcoded navy hexes/rgba in the generic CSS regions only; the
    `body.theme-*` alternate-theme blocks were deliberately left intact, so
    Stadium / ESPN / Retro / Analyst still switch correctly.
  - Retuned 37 accent rules: chrome and interaction states (active tab, focus
    ring, hovers, command palette, subtabs, moves filters) go gold; semantic
    "team B / offense / trade / NFC" blues go muted broadcast steel `#8fa6bf`
    so they stay distinguishable from the red side.
  - Rebuilt the header as studio chrome (`.app-header` + `.hdr-*`): Archivo brand
    lockup with gold `NFL`, gold active tab, charcoal search and utility buttons.
    `.tab-btn` now owns its own styling, so `showTab()` no longer juggles
    `bg-slate-800` / `text-slate-400` classes.
  - Added a `.studio-card` / `.studio-tile` / `.studio-link` / `.studio-foot`
    system and moved every remaining Home box onto it: Top Model Bets, Week N
    Marquee, Top Value Plays, Biggest Offseason Moves, League Overview KPI tiles,
    Today in the NFL, and the marquee game tiles. Home boxes now render on the
    same `#14161a` surface with the same `#2b3037` hairline as the hero.
  - Verified with `node props-smoke.mjs`, `python3 test_all_extensions.py`
    (31 checks, 0 console errors, all 5 themes captured), `node --test` (36/36)
    and `node scripts/validate-data.js` (15/15). NOTE: both browser suites load
    Tailwind and supabase-js from CDNs that some sandboxes block; where that
    happens they fail before any assertion, on unmodified `index.html` too.

- Simplified dashboard navigation and page ownership:
  - Removed Matchup from the header while keeping the full Matchup page available through selected games and the command palette.
  - Routed Home and Schedule game actions directly to the selected Matchup with no summary modal.
  - Gave named Home links deterministic Week 1 and Projections Standings destinations.
  - Renamed Compare to Player Compare, Both depth charts to Compare rosters, and the ambiguous Projections subtabs to Strength of Schedule and Team Projections.
  - Pointed How the model is graded to the Edge Analytics Model Lab.
  - Verified with `node props-smoke.mjs` and `python3 test_all_extensions.py`.

- Repaired Teams experience across live Supabase data, tracked static JSONs, and dashboard UI logic.
- Applied database migrations to Supabase (`nedyoydylpbjvihaoexy`) via Management API:
  - `supabase/migrations/20260903_espn_transactions_tx_id.sql`: Targets `nfl_dashboard.transactions`, allows `'waiver'` transaction type, creates unique index on `tx_id`, recreates public view with provenance columns (`tx_id`, `raw_text`, `source_date`, `created_at`), and sets RLS with public read and service_role write.
  - `supabase/migrations/20260904_atomic_roster_replacement.sql`: Implements atomic RPC `public.replace_nfl_players(p_rows jsonb)` on `nfl_dashboard.players` with transaction-level advisory lock `pg_advisory_xact_lock(7492026)`, minimum row check (1,600 rows), and RLS.
- Synchronized canonical live rosters:
  - Replaced 2,517 stale rows in Supabase with a validated 32-team snapshot of 1,699 active players (52 to 54 players per team) fetched directly from ESPN core API.
  - Regenerated `nfl_rosters_2026.json` and deploy copy `data/shared/nfl_rosters_2026.json` with pure ESPN identity fields, removing corrupted Madden age/jersey overwrites.
  - Updated `sync_supabase_rosters.js` and `sync_rosters_from_espn_api.js` to support both `sb_secret_` (header `apikey`) and legacy JWT service keys.
- Synchronized live transactions:
  - Added multi-page pagination to `update_rosters_from_espn.js` (pages 1-4, 855 items after 2026-04-23).
  - Inserted 1,616 fresh transaction rows with deterministic `tx_id` values and source timestamps into Supabase. Total transaction count increased from 352 to 1,968, with the latest transaction dated 2026-09-03. Verified idempotent on re-run (0 rows inserted).
- Hardened dashboard UI (`index.html`):
  - Isolated Madden rating overlays in `mergeMadden()`: Madden data only provides `maddenRating`, `maddenSpeed`, and related ratings; it no longer overwrites verified ESPN player age or jersey numbers.
  - Updated Teams "Moves" page: defaults to "Roster Moves" filter (trades, signings, waivers, cuts), filtering out 2026 NFL draft picks while keeping them accessible via an explicit "Draft" filter.
  - Improved date parsing in the Moves table to prioritize `source_date` before falling back to `date` or `created_at`, ensuring proper chronological sorting.
  - Updated Moves subtab badge and summary metrics to reflect active roster moves count.
- Added comprehensive verification suites:
  - Unit tests: `moves_filtering.test.js` (6 deterministic tests verifying filter behavior, draft exclusion, sorting, and edge cases). Total test suite now at 50/50 passing (`node --test *.test.js`).
  - Production health check: `scripts/production-health-check.mjs` (7 checks verifying remote Supabase contracts, row counts, and schema columns).
  - Browser extensions suite: `python3 test_all_extensions.py` (verified 0 console errors and clean rendering).

- Home view redesigned to the "2a" pregame-studio direction:
  - `homeRedesign2aHtml()` / `initHomeCarousel()` / `home2a*` helpers: 3-slide auto-rotating hero, Week 1 color-bar scorestrip, storylines and power-index row. Scoped under `.h2a-*` classes.
  - Team logos and visual assets integrated across the homepage UI.
  - `_redirects` deny list added at repo root.

- Schedule view redesigned to match the NFL26 pregame studio theme:
  - Scoped studio controls bar with week selector carousel (WK 1 to WK 18), view mode switcher (Broadcast Slate vs 32x18 Matrix), and quick filters (Primetime, Divisional, Close Spreads <= 3.0, High Total >= 47.0).
  - Marquee kickoff hero banner with 110x140 team pods, radial glow backdrops, dual win-probability distribution bar, and direct link to Matchup Center.
  - Chronological broadcast windows (Thursday/Special Kickoff, Sunday 1:00 PM ET Early Slate, Sunday 4:25 PM National Slate, Primetime Showdowns) with team logos, spread, log5 win probability, and total lines.
  - Full-season 32x18 matrix view updated with studio dark aesthetics and sticky team column.
  - Verified with `python3 test_all_extensions.py` (0 errors, 100% checks passing).

## Backup and rollback artifacts

- Supabase table snapshots before migration and data replacement:
  - Directory: `~/.nfldashboard-backups/20260904_repair/`
  - Players (2,517 rows): `nfl_players_2026-09-04T10-13-34-968Z.json` (SHA-256: `e2a402367c667a756b5fc06312f67c6e4c2f978fc79c4d6c27cb1ebd767cec14`)
  - Transactions (352 rows): `nfl_transactions_2026-09-04T10-13-34-968Z.json` (SHA-256: `8d9596ab2f88c239118521ec319e67ef00bc33c23a26bf9244f779947b470b3c`)
- Rollback instructions:
  - Supabase players: restore using `public.replace_nfl_players()` RPC with backup JSON rows.
  - Supabase transactions: truncate `nfl_dashboard.transactions` and re-insert backup JSON rows.
  - Git: revert commit `a2dc55a` or reset to `962c915`.

## In flight

- Local `main` is merged with `fix/teams-roster-moves-repair`.
- Untracked `screenshots_expansion/*.png` edits remain untouched.
- Ready to push to `origin/main` to trigger Cloudflare Pages deployment.

## Next

- Push `main` to `origin/main`.
- Verify live production deployment at `https://nfldashboard.pages.dev` via browser and automated checks.
- Clean up temporary worktree `nfldashboard-teams-repair`.
