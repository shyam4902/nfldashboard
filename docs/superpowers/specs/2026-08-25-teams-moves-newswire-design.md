# Teams -> Moves Newswire Design

> Historical record: this design was implemented. Use `README.md` and `STATE.md` for the current dashboard contract.

**Status:** Approved design
**Date:** August 25, 2026

## Goal

Turn the current top-level Transactions page into a compact `Moves` sub-tab under `Teams`. The view should optimize for quickly scanning league activity, not presenting large feature cards or marketing-style summaries.

## Navigation

- Remove `Transactions` from the primary header navigation.
- Add `Moves` to the Teams sub-navigation.
- The existing transaction route/state remains available through internal links and the command palette, but those links should open `Teams` and activate `Moves`.
- Home spotlight links that currently open `feed` should be updated to open `Teams -> Moves`.

## Layout

The page is a dense, date-grouped newswire.

### Compact summary line

At the top of the Moves view, show a single inline summary line:

`372 moves · 48 trades · 12 blockbusters · updated Aug 07`

The values should be derived from `DATA.transactions`; no fixed values should be embedded in the UI.

### Filter rail

Place filters in a compact horizontal toolbar above the feed:

- Search input for player, team, or position.
- Type filter: All, Trades, Signings, Draft.
- Team filter.
- Blockbusters-only toggle.
- Sort control: Newest first or Oldest first.

The toolbar may wrap on narrow screens, but controls must not create page-level horizontal overflow.

### Date-grouped newswire

Group transactions by calendar date, newest first by default. Each transaction is a compact row with:

- Date group shown once as a left-side date rail or group heading.
- Type badge.
- Player name.
- Position.
- Movement: `FROM -> TO` for trades and acquisitions, `TEAM <-> TEAM` or `TEAM re-signs` for retained players.
- Short detail text.
- A small blockbuster marker when `transaction.blockbuster` is true.

Draft transactions may remain grouped by date in the same wire. They should not receive a separate large card treatment.

### Selected transaction drawer

Clicking a transaction opens a narrow detail drawer or compact modal. It should show:

- Player name and position.
- Transaction type and date.
- From team and destination team.
- Full detail text.
- Links/actions to open the relevant team context and player profile when those records exist.

Closing the drawer returns the user to the same feed position.

## Visual direction

- Dense information hierarchy with small, readable type.
- Minimal empty space and no oversized hero section.
- No standalone blockbuster cards.
- Use a restrained accent stripe or marker for blockbusters.
- Reuse the dashboard's existing theme variables and interaction conventions.
- Preserve readable contrast in both dark and Clean Analyst themes.
- Use familiar icons for actions such as close, search, and navigation where the existing icon set supports them.

## Data and behavior

- Reuse `DATA.transactions`, `DATA.teams`, `DATA.teamAbbr`, and existing transaction filtering state where possible.
- Preserve current sort/filter semantics unless the new grouping requires an adapter.
- Escape dynamic transaction content before inserting it into HTML.
- Empty filter results should show a compact empty state inside the feed, without changing page layout.
- Internal navigation must activate the Teams tab and the Moves sub-tab consistently from Home, command palette, and transaction/team links.

## Acceptance criteria

- `Transactions` is absent from the primary header.
- `Teams` exposes a `Moves` sub-tab and opens it directly when requested by an internal link.
- The default view shows a compact date-grouped feed using live transaction data.
- Search, type, team, blockbuster, and sort controls update the feed without horizontal overflow at mobile widths.
- Blockbuster transactions are visually identifiable without large cards.
- Clicking a row opens the selected transaction detail view and closing it preserves the feed.
- Home, command palette, and relevant existing links reach `Teams -> Moves`.
- Existing Teams overview, roster, comparison, and projections behavior remains intact.
- Existing test suites pass, and browser verification reports zero console errors.
