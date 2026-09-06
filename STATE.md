# NFL Dashboard state

- Updated: 2026-09-06
- Live: https://nfldashboard.pages.dev/
- Repo: https://github.com/shyam4902/nfldashboard
- App: static `index.html`, tracked JSON assets, and Supabase roster/transaction data

## Shipped recently

- Teams overview card proportions & layout:
  - Enlarged team tiles by ~20-25% (~248px width by ~92px height) with 32px drop-shadow logos, 15px Archivo abbreviation, and 12px Geist team name.
  - Centered overview container at `max-width: 1040px` with 4 division columns per conference.
  - Removed projected wins badges from overview tiles; projected wins and records remain in team subtabs and roster modal (`openRoster`).
  - Retained team color rail and cap space footer on each tile.
  - Deployed to origin/main (`90488b0`).
- Schedule page featured matchup rotating carousel matching the home hero (`.sch-marq-*`).
- Home marquee game cards and Teams page aligned with Schedule card design system.
- Simplified navigation: removed Matchup from header, renamed Compare to Player Compare, direct links to Matchup Center.
- Verified: `python3 test_all_extensions.py` (32 passing checks, 0 console errors), `node scripts/validate-data.js` (16/16).

## In flight

- Agent D local matchup preview for 2025 team tendencies (`MATCHUP_STATE.gameId`, `load_team_tendencies.js`).
- Untracked screenshot captures and draft tendencies scripts staged for separate validation.

## Next

- Finalize and verify `scripts/team_tendencies.test.js`.
- Run cross-repo checks (`scripts/sync_shared_data.sh`, `scripts/check_repo_drift.sh`).

## Blockers

- None.
