# NFL Dashboard — Mike Clay projections integration

> Historical implementation record. For the current app contract, data sources, deployment, and verification commands, use `README.md` and `STATE.md`.

**Original source:** Mike Clay's 2026 NFL Projection Guide (82-page PDF, updated 2026-08-19)

## What remains current

The project keeps the extracted Clay data in `clay_projections_2026.json`. The dashboard uses that artifact for the Projections views that are still present: standings, leaders, schedule, team projections, positional projections, defense, unit grades, coaching, and model comparison views.

Projected starters, returners, kickers, and some unit-rank data remain available in the JSON artifact but do not have dedicated dashboard views. Current roster depth is sourced through the Teams flow rather than the retired Clay projected-starters panel.

## Current projection navigation

```text
Projections:
  Standings | Leaders | Schedule | Teams | Coaching
  QB | RB | WR | TE | Defense | IDL | EDGE | LB | CB | S
  Unit Grades | Clay vs Market | Matchup Matrix | Consensus Power
```

The dashboard's primary views are Home, Schedule, Matchup, Teams, and Projections. Teams contains Overview, Moves, and Power Index. Props and win totals are linked to Edge Analytics rather than rendered as dashboard tabs.

## Data pipeline record

The original implementation extracted the PDF into JSON and loaded the artifact with `fetch()` from the static page. Extraction code and generated artifacts may evolve independently; do not assume that every JSON section has a corresponding dashboard panel. Use the current files and verification suite as the source of truth.

The current repository also includes source-backed schedule, roster, transaction, draft-capital, Madden-rating, props-board, and freshness artifacts. Missing runtime values must remain unavailable rather than being filled with prototype values.

## Verification

From `nfldashboard/`:

```bash
node check_html_scripts.mjs
node --test update_rosters_from_espn.test.js
node props-smoke.mjs
python3 test_all_extensions.py
python3 test_projections.py
python3 test_schedule_data.py
```

The full operational verification list and deployment instructions live in `README.md`.

## Historical implementation notes

The original extraction covered team pages, positional projections, category leaders, strength of schedule, unit grades, coaching staffs, and projected starters. Those notes explain how the initial artifact was built; they are not a promise that every extracted section remains a live UI surface.

For the retired projected-starters view, use Teams roster depth. Do not restore a dashboard-wide “Top WR” or projected-starter claim unless the current UI and source contract explicitly support it.
