# Dashboard Review Findings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Close the remaining trust-contract and verification-gate issues identified during the September 3, 2026 dashboard review without changing the source-of-truth data or adding a build step.

**Architecture:** Keep the static single-file dashboard architecture and the existing CommonJS ESPN updater. Fix missing-value rendering at the UI boundary, normalize and validate ESPN records before any roster mutation, and make browser checks portable and failure-enforcing. No live ESPN fetch, Supabase write, roster sync, launchd installation, commit, or deploy is part of this plan unless separately requested.

**Tech Stack:** Vanilla JavaScript in `index.html`, Node.js built-ins and `node:test`, Python Playwright scripts, repository JSON artifacts, and static HTTP servers.

---

## Scope and findings

This plan addresses the following reviewed findings:

1. `renderRosterSummary()` still turns missing cap space into `$0` through `cap.space || 0`.
2. The weekly projection card applies a neutral `50` classification when win probability is absent and prints the raw missing value.
3. ESPN normalization preserves abbreviated team names such as `Miami` instead of joining them to canonical dashboard team names.
4. `validateTransactions()` only checks that required fields are non-empty; it does not enforce types, allowed values, dates, or unique IDs.
5. `props-smoke.mjs` imports Playwright from a machine-specific absolute path.
6. `test_projections.py` prints failed checks but exits successfully, and `test_all_extensions.py` reports console errors without failing.
7. `sync_supabase_rosters.js` contains comments describing deleted applied-update behavior.

Out of scope:

- Persisting normalized ESPN transactions to Supabase.
- Running live sync or dry-run fetches against ESPN.
- Changing roster, transaction, schedule, or projection data artifacts.
- Splitting `index.html` into modules.
- Installing launchd jobs or deploying to Cloudflare Pages.

## Task 1: Add failing tests for missing-value UI behavior

**Files:**
- Modify: `nfldashboard/props-smoke.mjs`
- Modify: `nfldashboard/index.html`

- [x] Add source assertions that reject both missing-value fallbacks:
  - `/cap\.space\s*\|\|\s*0/`
  - `/parseInt\(g\.win_probability\)\s*\|\|\s*50/`
- [x] Add a browser assertion that a weekly card with no `win_probability` displays `Unavailable` or an em dash and does not display `50%`.
- [x] Run `node props-smoke.mjs` against the current implementation and confirm the new source assertion fails because the legacy cap and probability fallbacks still exist.

The regression checks must test the user-visible contract, not only exact implementation text. They must continue to allow legitimate numeric zero values when the source explicitly provides zero.

**Dependencies:** None.

**Estimated scope:** Small.

## Task 2: Remove fabricated cap and probability states

**Files:**
- Modify: `nfldashboard/index.html`
- Modify: `nfldashboard/props-smoke.mjs`

- [x] Replace the roster summary expression with an explicit finite-number check:

```js
const capValue = cap && Number.isFinite(Number(cap.space)) ? Number(cap.space) : null;
const capLabel = capValue === null ? 'Unavailable' : formatCap(capValue);
const capClass = capValue === null ? 'text-slate-400' : capValue >= 0 ? 'cap-positive' : 'cap-negative';
```

- [x] Render `capLabel` and `capClass` in the roster modal summary without converting absent data to zero.
- [x] Replace weekly probability classification with an explicit parse/check path:

```js
const probability = typeof g.win_probability === 'number'
  ? g.win_probability
  : typeof g.win_probability === 'string' && /^\d+(?:\.\d+)?%?$/.test(g.win_probability.trim())
    ? Number.parseFloat(g.win_probability)
    : null;
```

- [x] Render an unavailable label and neutral muted styling when `probability === null`; render the source value and threshold color only when the source supplied a valid probability.
- [x] Keep source-provided zero scores and zero probabilities valid; only missing, null, empty, or malformed values become unavailable.
- [x] Run `node props-smoke.mjs` and confirm the new checks pass.

**Dependencies:** Task 1.

**Estimated scope:** Small.

## Task 3: Add canonical ESPN team-name normalization tests

**Files:**
- Modify: `nfldashboard/update_rosters_from_espn.test.js`
- Modify: `nfldashboard/update_rosters_from_espn.js`

- [x] Add a failing fixture for a trade using a short destination, such as `Miami`, and assert the normalized record uses the canonical team name `Miami Dolphins`.
- [x] Add a failing fixture for a waiver source such as `Jacksonville`, and assert it becomes `Jacksonville Jaguars`.
- [x] Add a test for an already canonical team name to prove canonicalization is idempotent.
- [x] Run `node --test update_rosters_from_espn.test.js` and confirm the new canonicalization tests fail before implementation.

- [x] Add a `canonicalTeamName(name)` helper using the existing `TEAM_METADATA` keys. It must:
  - Trim whitespace.
  - Match full team names case-insensitively.
  - Match abbreviations from `TEAM_METADATA` case-insensitively.
  - Match ESPN short names only when the short name maps to exactly one canonical team.
  - Return the trimmed original string when no unambiguous mapping exists; it must not invent a team.
- [x] Apply canonicalization to `from_team` and `to_team` in `normalizeEspnTransaction()`.
- [x] Preserve `Free Agent` as the explicit source value for signings and releases where appropriate.
- [x] Use canonical team names during roster mutation where a normalized move supplies a canonical destination.
- [x] Run the parser tests and verify all canonicalization fixtures pass.

**Dependencies:** Task 2 is independent; this task may proceed after Task 1.

**Estimated scope:** Medium.

## Task 4: Strengthen normalized transaction validation

**Files:**
- Modify: `nfldashboard/update_rosters_from_espn.js`
- Modify: `nfldashboard/update_rosters_from_espn.test.js`
- Modify: `nfldashboard/README.md`
- Modify: `nfldashboard/STATE.md`

- [x] Add failing tests proving validation rejects:
  - Non-object rows.
  - Missing or non-string `id`, `source`, `source_key`, `type`, `player_name`, `from_team`, `to_team`, and `detail`.
  - A `source` other than `ESPN`.
  - A `type` outside `signing`, `waiver`, `trade`, and `draft`.
  - A malformed `sort_date` that is not `YYYY-MM-DD`.
  - Duplicate IDs across rows.
- [x] Keep valid empty position values allowed because ESPN may omit a position; `pos` must still be either a string or absent according to the chosen normalized schema.
- [x] Implement validation that returns deterministic row-specific errors and does not throw for malformed input.
- [x] Validate the dry-run envelope as well as its transaction rows:
  - `source` is `ESPN`.
  - `source_url` is the configured ESPN URL.
  - `fetched_at` is a valid ISO timestamp.
  - `record_count` equals `transactions.length`.
- [x] Make the live updater abort before roster mutation or processed-ID writes when validation fails.
- [x] Update README and STATE wording from broad “schema validation” to the exact enforced contract once implemented.
- [x] Run `node --test update_rosters_from_espn.test.js` and confirm malformed fixtures are rejected.

**Dependencies:** Task 3.

**Estimated scope:** Medium.

## Task 5: Make browser verification portable and failure-enforcing

**Files:**
- Modify: `nfldashboard/props-smoke.mjs`
- Modify: `nfldashboard/test_projections.py`
- Modify: `nfldashboard/test_all_extensions.py`
- Modify: `nfldashboard/README.md`

- [x] Replace the absolute Playwright import in `props-smoke.mjs` with the repository’s portable resolution strategy. Prefer a normal package import if the repository provides one; otherwise allow an explicit `PLAYWRIGHT_MODULE` environment variable and emit a clear setup error.
- [x] Make the smoke server close in a `try/finally` block so assertion failures do not leave port `8123` occupied.
- [x] Add a `failures` list to `test_projections.py`; every current boolean check must append a failure when false.
- [x] Include console errors in `test_projections.py` failure handling.
- [x] Make `test_projections.py` exit `0` only when no failures and no console errors exist.
- [x] Add console errors to `test_all_extensions.py`’s exit condition, while preserving its existing failure reporting.
- [x] Keep generated screenshots out of source/docs commits.
- [x] Run each browser test once with its normal data and once with an intentionally failing local assertion or fixture path to verify the process exits nonzero; restore the test afterward.
- [x] Run the normal browser tests and confirm a real failure cannot report success.

**Dependencies:** Tasks 1–4.

**Estimated scope:** Medium.

## Task 6: Remove stale roster-sync comments

**Files:**
- Modify: `nfldashboard/sync_supabase_rosters.js`
- Modify: `nfldashboard/README.md`
- Modify: `nfldashboard/STATE.md`

- [x] Replace the opening sync-script comments with the actual behavior: fetch Supabase teams and players, apply the Madden overlay, and write `nfl_rosters_2026.json`.
- [x] Remove references to “applied updates” and a future ESPN depth-chart overlay unless that future behavior is explicitly documented as a separate planned feature.
- [x] Keep the warning that the script is live and writes a local roster artifact.
- [x] Add a static regression check that rejects `applied updates` and `ESPN depth-chart overlay` from the sync script.
- [x] Run JavaScript syntax checks and the smoke suite.

**Dependencies:** Task 5.

**Estimated scope:** Small.

## Checkpoint: Review findings closed

- [x] `node check_html_scripts.mjs`
- [x] `node --check generate_roster_files.js`
- [x] `node --check sync_supabase_rosters.js`
- [x] `node --check update_rosters_from_espn.js`
- [x] `node --test update_rosters_from_espn.test.js`
- [x] `node props-smoke.mjs`
- [x] `python3 test_all_extensions.py`
- [x] `python3 test_projections.py`
- [x] `python3 test_schedule_data.py`
- [x] `python3 -m py_compile test_all_extensions.py test_projections.py test_schedule_data.py`
- [x] `git diff --check`
- [x] Confirm no generated screenshots, normalized dry-run output, credentials, or live runtime files are staged.

## Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| ESPN uses ambiguous short team names | High | Canonicalize only unambiguous values; preserve unknown text rather than guessing. |
| A missing probability is confused with a legitimate zero | High | Use explicit presence and numeric parsing checks. |
| Test hardening exposes existing UI fixture instability | Medium | Fix the assertion and fixture contract separately; do not weaken the gate. |
| Portable Playwright resolution differs across machines | Medium | Use the repository package when present and provide a clear environment override/setup error. |
| Validation blocks previously accepted ESPN rows | Medium | Add fixtures for every supported type and report rejected descriptions without mutating roster data. |
| Generated screenshots create noisy diffs | Low | Treat screenshots as local test artifacts and stage only intentional assets. |

## Completion criteria

The plan is complete when every reviewed issue has a regression test, the implementation satisfies the source-backed unavailable-state contract, malformed ESPN records cannot reach roster mutation, browser checks are portable and fail on real errors, stale comments are removed, and the full checkpoint suite exits successfully.
