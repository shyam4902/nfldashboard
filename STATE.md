# NFL Dashboard state

- Updated: 2026-09-12
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

## Checkpoint 3 (2026-09-07): clear season context

- Matchup preview season labels are now derived from the data, not hardcoded:
  tendencies season comes from the artifact's `observation_period`
  (`teamTendenciesObservationPeriod` exposed by `scripts/load_team_tendencies.js`),
  EPA season from the max `season` in the efficiency dataset
  (`measuredEpaSeason()`), and the current season from `schedule.json.season`
  (`currentSeason()`). A regenerated artifact for a new season flips every
  label without code edits.
- The preview states the current season is in progress when it differs from
  the measured season ("2026 season in progress — these numbers measure the
  2025 regular season (last completed), not 2026"), so a 2026 roster or
  schedule never makes the 2025 measured stats appear current. Disclosure and
  banner labels keep the observation window (weeks 1-18, 272 games), the
  aggregation time, and the "not a current-season measurement" note separate.
- Formation Lab now explains the field: illustrative alignments from the
  current roster snapshot — not a verified game-day lineup or confirmed
  assignments, and not a complete weekly injury report. The footer source
  credit row was corrected to the sources actually used (nflverse play-by-play,
  FTN charting, Clay, Supabase rosters) — the old row claimed Next Gen Stats
  and PFF, which this app does not use.
- `README.md` gained a "Matchup preview: season labels and update rules"
  section: per-source update cadence, how each season is determined, and what
  the app shows before the data arrives, including the recorded 2026
  current-season limitation and what would enable it.
- Tests: `scripts/team_tendencies.test.js` gained a fixture-based 2026
  observation-period label test (18/18); `test_all_extensions.py` asserts the
  last-completed label, the current-season-in-progress note, and the Formation
  Lab field note (all green).

## Checkpoint 4 (2026-09-07): owner-visible failed-update banner

- The dashboard now fetches `./data/shared/pipeline-status.json` on load
  (`loadPipelineStatus()`, cache no-store, never blocks rendering) and, when it
  reports `status: "failed"`, renders a visible banner under the header with
  the failing step, run time (UTC), exit code, a "last published data" note,
  and the recovery command. `ok` or absent file = no banner (no claim).
- `test_all_extensions.py` asserts all three states via route interception:
  no banner on healthy `ok`, a visible banner with step/recovery on `failed`,
  and no banner and no error when the file is absent (0 console / 0 page
  errors, full suite green).
- The writer lives in the producer: `fantasyfootball/scripts/daily-pipeline.sh`
  writes `pipeline-status.json` on every run (see fantasyfootball STATE.md).

## Checkpoint 5 (2026-09-08): release rehearsal fixes

- Home hero Edge-promo buttons linked to the dead custom domain
  (`edge.shyamsapps.qzz.io`) — rewritten to the canonical
  `edgeplay-analytics.pages.dev` (+ `/model-lab`) per `docs/agents/edge-url-policy.md`.
- `_redirects` deny list extended with `/schedule-redesign.html` and
  `/home-redesign.html` (tracked/working scratch HTML that was previously
  fetchable). `_redirects` itself is untracked — it must be committed with
  the release or the live site keeps serving internal files (verified:
  live `nfldashboard.pages.dev` still returns 200 for AGENTS.md/STATE.md/
  scripts/* — Sept 4 blocker B2 is fixed in-repo but never shipped).
- Mobile horizontal overflow fixed on the Matchup tab (Sept 4 blocker B5):
  the team-picker row (`#matchupGame`/`#matchupTeamA`/`#matchupTeamB`
  selects) forced the page to 535px at a 390px viewport. Selects now
  shrink (`min-w-0`) and the team row wraps. All 7 Matchup subtabs and all
  3 Teams sub-tabs now measure exactly 390px at a 390px viewport.
- Keyboard access hardened:
  - `renderMatchupPanels()` preserves focus across re-renders (possession
    toggle, Formation Lab player chips, personnel/front selects) — the
    innerHTML swap previously dropped keyboard focus after a swap.
  - Formation Lab starter chips are now real controls: `tabindex="0"`,
    `role="button"`, `aria-label`, and Enter/Space opens the player modal.
- `checkpoint5_rehearsal.py` added: release-rehearsal browser probe
  (desktop walkthrough + mobile overflow on every Matchup/Teams subtab +
  possession swap + keyboard + cross-app link checks).

## Checkpoint 6 (2026-09-10): results after games are played

- `sync_scores.js` (new): pulls final/in-progress scores from the ESPN
  scoreboard API into `schedule.json` and its `data/shared/` copy
  (`winner`, `away_score`, `home_score`, plus a new `status` field and a
  top-level `scores_synced_at`). Matches on the game's **Eastern-time** date,
  since Thursday/Sunday-night kickoffs are the next day in UTC —
  `sync_scores.test.js` pins that. `--week N` and `--dry-run` supported.
  Contacts a live service; run it after each slate. Week 1 kickoff game is
  recorded: Seahawks 13, Patriots 10.
- The featured "game of the week" no longer sits on a game that has been
  played. `pickFeaturedGames()` drops any game whose kickoff has passed (or
  that carries a result) and ranks the rest; Sunday Night Football now
  outranks other primetime, so Week 1's hero is Cowboys @ Giants on SNF.
  The home hero and the Schedule carousel share the same picker and the same
  `gameCategories()` (extracted from the Schedule render loop, which now
  calls it instead of inlining the logic).
- Played games render their result, not a stale pregame line: the home
  scorestrip shows `FINAL` with both scores, and Schedule cards show a
  `FINAL`/`LIVE` chip, the score in place of spread/win%, and
  "SEA won 13-10" in the footer.
- **Automated (2026-09-12).** `.github/workflows/sync-scores.yml` runs
  `sync_scores.js` hourly Sept-Feb on GitHub Actions, then commits and pushes
  only when `schedule.json` actually changed — the push is the Pages deploy.
  It runs `sync_scores.test.js` and `scripts/validate-data.js` first, so a
  malformed or copy-drifted schedule never reaches the live site, and a quiet
  hour produces no commit and no rebuild. `workflow_dispatch` for a manual run.
  The local command still works and is the fallback if Actions is down.
- Week 1 results recorded so far: Seahawks 13-10 Patriots, 49ers 27-7 Rams.
- Verified: `python3 test_all_extensions.py` (all green, 0 console / 0 page
  errors), `node scripts/validate-data.js` (16/16),
  `python3 test_schedule_data.py`, `node --test sync_scores.test.js`.
  `node props-smoke.mjs` cannot run here — the npm `playwright` module is not
  installed in this repo (pre-existing; the Python suites use their own).

## In flight

- Checkpoint 2 (trustworthy evidence) repairs on the local matchup preview:
  - `scripts/load_team_tendencies.js` now rejects malformed records, duplicate
    identities on the `team|side|metric` lookup key, count-invariant breaks,
    rate/count disagreement, out-of-range values, and unknown source keys;
    keeps present unknown records (observed 0, value null) distinct from
    absent records; and renders an expanded evidence disclosure (definition,
    observation period, aggregation time, clickable source + license, cache
    sha256, missing counts, source-update provenance).
  - `index.html` question banner now renders the dynamic offense-usage /
    defense-exposure sentence with real records (full team names display,
    abbreviations look up); roster label is honest (no fabricated
    fetched/update timestamps; illustrative-lineups note); the matchup
    sidebar no longer shows the unsupported log5 win-probability card.
  - Tests fixed: `scripts/team_tendencies.test.js` (17 passing), the four
    `validate_data.test.js` fixture-manifest failures (18 passing), and the
    Python suite's matchup check now requires real content, captures uncaught
    `pageerror`s, and fails on a blank panel.
- Untracked screenshot captures and draft tendencies scripts staged for separate validation.

## Next

- Coordinate review of `results/checkpoint-2-completion.md` (checkpoint 2 of
  `docs/superpowers/plans/2026-09-05-matchup-product/10-build-checkpoints.md`).
- Run cross-repo checks (`scripts/sync_shared_data.sh`, `scripts/check_repo_drift.sh`).

## Blockers

- None.
