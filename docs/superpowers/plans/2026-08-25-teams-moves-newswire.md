# Teams -> Moves Newswire Implementation Plan

> Historical record: this plan was completed and pushed. Use `README.md` and `STATE.md` for the current dashboard contract and verification commands.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Move Transactions into a compact Moves sub-tab under Teams and replace the current card-plus-table page with a dense date-grouped transaction newswire.

**Architecture:** Keep the existing single-file static dashboard architecture in `index.html`. Reuse `DATA.transactions`, current transaction filter state, team abbreviations, existing player/team navigation, and the current Teams tab. Add a small Teams sub-tab state machine, a dedicated dense feed renderer, and a selected-transaction drawer while preserving the existing roster, compare, power-index, and projections behavior.

**Tech Stack:** Static HTML, CSS, vanilla JavaScript, Tailwind utility classes already loaded by the dashboard, Supabase-backed `DATA`, Playwright browser tests, Python regression scripts.

---

### Task 1: Add Teams sub-tab state and navigation

**Files:**
- Modify: `nfldashboard/index.html` near the Teams panel markup and transaction state/functions.
- Test: `nfldashboard/test_all_extensions.py`

- [x] Add an inline Teams sub-navigation with `Overview`, `Moves`, and `Power Index` controls. Keep roster/team cards in Overview and place the existing `macroRow`/`heatmapContainer` in Power Index.
- [x] Add `currentTeamsSubTab = 'overview'`, `renderTeamsSubTabs()`, and `setTeamsSubTab(tab)` using the existing active-class conventions.
- [x] Make `setTeamsSubTab('moves')` render the transaction view; make `setTeamsSubTab('overview')` render team cards; make `setTeamsSubTab('power')` render macro and heatmap content.
- [x] Make `showTab('teams')` render the sub-navigation and current sub-tab, and make internal Moves links call `showTab('teams'); setTeamsSubTab('moves')`.
- [x] Add a browser regression assertion that Teams exposes Overview/Moves/Power Index and that the Moves control activates the transaction view.

### Task 2: Remove the top-level Transactions route

**Files:**
- Modify: `nfldashboard/index.html` header markup, home feature/spotlight actions, command palette actions, and `showTab` routing.
- Modify: `nfldashboard/WALKTHROUGH.md` navigation description.
- Test: `nfldashboard/test_all_extensions.py`, `nfldashboard/test_schedule_data.py` for schedule assertions.

- [x] Remove the `data-tab="feed"` Transactions button from the primary header.
- [x] Replace every Home feature, Home spotlight, command-palette, and other internal action that opens `feed` with a Teams -> Moves action.
- [x] Keep a compatibility branch in `showTab('feed')` that redirects to `showTab('teams'); setTeamsSubTab('moves')` so stale bookmarks do not fail.
- [x] Update walkthrough navigation text to document `Teams -> Moves` rather than a top-level Transactions tab.
- [x] Assert the header has no Transactions tab and legacy `showTab('feed')` reaches the Moves view.

### Task 3: Implement the compact date-grouped newswire

**Files:**
- Modify: `nfldashboard/index.html` transaction markup, CSS, and rendering functions.
- Test: `nfldashboard/test_all_extensions.py`

- [x] Replace the existing feed panel markup with a compact Moves container containing an inline data-derived summary, filter toolbar, and feed mount point.
- [x] Implement `renderMovesView()` with summary counts for total moves, trades, blockbusters, and latest update from `DATA.transactions`.
- [x] Implement `renderMovesFilters()` with search, type, team, blockbusters-only, and sort controls using the existing transaction state variables.
- [x] Implement `getMovesTransactions()` to filter and sort `DATA.transactions` without mutating the source array.
- [x] Implement `renderMovesNewswire()` to group transactions by `date_str`/`sort_date` and render compact rows with type, player, position, movement, detail, and a thin blockbuster marker.
- [x] Escape transaction text before HTML insertion and preserve the existing team abbreviation fallback behavior.
- [x] Handle draft rows in the same date-grouped feed rather than rendering a separate large draft block.
- [x] Add compact responsive CSS so the feed wraps or scrolls internally without page-level horizontal overflow.
- [x] Assert live rows, grouped dates, summary values, filters, and no mobile overflow.

### Task 4: Add selected transaction detail drawer

**Files:**
- Modify: `nfldashboard/index.html` modal markup, CSS, and transaction handlers.
- Test: `nfldashboard/test_all_extensions.py`

- [x] Add a narrow drawer-style overlay with close control and a detail mount point.
- [x] Implement `openMoveDetail(index)` using the current filtered list and `closeMoveDetail()` restoring document scrolling.
- [x] Render player, position, transaction type, date, from team, destination team, and full detail text.
- [x] Add relevant team and player actions using existing `openRoster` and `openPlayerModal` patterns when records exist.
- [x] Ensure row clicks open the drawer and closing it returns to the same scroll position.
- [x] Assert drawer content and close behavior in a browser test.

### Task 5: Remove obsolete transaction-only rendering paths

**Files:**
- Modify: `nfldashboard/index.html` obsolete `renderFeed`, `renderBiggestMoves`, and feed-only initialization references.
- Test: `nfldashboard/test_all_extensions.py`

- [x] Remove the old large `biggestMoves` carousel and feed-only markup after the new Moves view is wired.
- [x] Keep shared transaction-derived helpers used by team roster changes and Home spotlights.
- [x] Ensure no stale DOM IDs or undefined handlers remain.
- [x] Add static checks for duplicate IDs, unresolved custom handlers, and stale top-level feed references.

### Task 6: Verify, document, commit, push, and deploy

**Files:**
- Modify: `nfldashboard/test_all_extensions.py`, `nfldashboard/WALKTHROUGH.md`.
- Commit: `nfldashboard/index.html`, tests, docs, and any intended assets.

- [x] Run JavaScript syntax validation.
- [x] Run transaction/data tests, schedule tests, projections tests, and the complete browser extension suite.
- [x] Test desktop and mobile layouts, all five existing visual themes, navigation paths, filters, drawer interactions, and zero console errors.
- [x] Review staged diff for unrelated files and secrets.
- [x] Commit the implementation with a descriptive message and push `main`.
- [x] Verify the deployed `https://nfldashboard.pages.dev` Teams -> Moves experience with Playwright.

## Checkpoints

- After Task 2: Header navigation and legacy feed redirects work.
- After Task 4: Dense feed and drawer work end-to-end.
- Before push: Full regression suite and live deployment check are green.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Existing internal links still call `showTab('feed')` | Medium | Keep a compatibility redirect and update all known callers. |
| Large single-file renderer becomes duplicated | Medium | Reuse current state and helpers; remove obsolete feed renderer after migration. |
| Dense feed overflows mobile screens | High | Use responsive grid/flex rules and assert `scrollWidth - innerWidth === 0`. |
| Dynamic transaction content is inserted unsafely | High | Escape all player/team/detail strings before HTML insertion. |
| Moving Power Index hides existing Teams content | Medium | Give it an explicit sub-tab and preserve the existing renderers unchanged. |
