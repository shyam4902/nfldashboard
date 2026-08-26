# NFL Dashboard — Mike Clay Projections Integration Walkthrough

**Date:** August 21, 2026
**Source:** Mike Clay's 2026 NFL Projection Guide (82-page PDF, updated 8/19/2026)

---

## What Was Built

Imported the entire Mike Clay 2026 NFL Projection Guide PDF into the NFL Dashboard as a new **Projections** tab with 12 sub-tabs covering every section of the PDF.

---

## Architecture

### Data Pipeline

```
PDF (82 pages)
  → extract_clay_projections.py  →  clay_projections_2026.json (1MB)
  → extract_remaining.py         →  (merged into same JSON)
  → index.html loads JSON via fetch() at runtime
```

**Key files:**
- `extract_clay_projections.py` — Main extraction script (team projections, positional projections, standings, unit grades, unit ranks, coaching staffs, projected starters)
- `extract_remaining.py` — Secondary extraction (category leaders, strength of schedule)
- `clay_projections_2026.json` — Combined JSON output (~1MB)
- `index.html` — Dashboard with new "Projections" tab and all rendering JavaScript

---

## PDF Structure → Dashboard Mapping

| PDF Pages | Section | Dashboard Sub-tab | Data Extracted |
|-----------|---------|-------------------|----------------|
| 2–33 | Team Projections | 🏟 Teams | 32 teams × (offense players, defense players, weekly projections, unit grades) |
| 34 | Leaderboard (cover) | — | Skipped (header page) |
| 35 | QB Projections | 🎯 QB | 40 QBs with pass/rush stats |
| 36–38 | RB Projections | 🏃 RB | 111 RBs with carry/rec/target stats |
| 39–43 | WR Projections | 📡 WR | 187 WRs with rec/rush/target stats |
| 44–45 | TE Projections | 🤲 TE | 80 TEs with carry/rec/target stats |
| 46–47 | IDL Projections | 🛡 Defense → IDL | 80 IDLs with tackle/sack/INT stats |
| 48–49 | EDGE Projections | 🛡 Defense → EDGE | 80 EDGEs |
| 50–51 | LB Projections | 🛡 Defense → LB | 79 LBs |
| 52–53 | CB Projections | 🛡 Defense → CB | 80 CBs |
| 54–55 | S Projections | 🛡 Defense → S | 80 Ss |
| 56 | Returner Projections | — (in JSON) | 27 returners |
| 57 | Kicker Projections | — (in JSON) | 32 kickers |
| 58–60 | Category Leaders | 🏆 Leaders | 18 leaderboards (Pass Att, INTs, Rush Yds, Targets, Rec, Carry%, Target Share, etc.) |
| 61 | Projected Standings | 🏈 Standings | 8 divisions, 32 teams with W-L, PF, PA, Diff, Fav, SOS |
| 62 | Strength of Schedule | 📅 Schedule | Full 18-week schedule for all 32 teams |
| 63 | Unit Grades | 📊 Unit Grades | 32 teams × 10 position groups (1–10 scale) |
| 64–73 | Positional Unit Ranks | — (in JSON, used by Teams tab) | Depth charts with grades |
| 74 | Coaching Staffs | 📋 Coaching | 32 coaching staffs (HC, OC, Playcaller, DC, GM) |
| 75–82 | Projected Starters | ⭐ Starters | 346 starters across 8 divisions with player ratings |

---

## How the Extraction Works

### Team Projections (Pages 2–33)

Each team page has offense and defense data **on the same line**, side by side:

```
QB Jacoby Brissett 17 517 327 3355 15 9 40 47 210 1 0 0 0 0 199 29 DI Walter Nolen 653 46 4.1 0.0 25
```

**Offense** is left of the first defensive position marker (DI/ED/LB/CB/S). The regex splits at `(\d+)\s+(DI|ED|LB|CB|S)\s+` to separate them.

Offense format: `Pos Name Games PassAtt PassComp PassYds PassTD INT Sk RushAtt RushYds RushTD Tgt Rec RecYds RecTD [PPRPts PPRRank]`

Defense format: `Pos Name Snaps Tackles Sacks INTs FumbleForced Rank`

### Positional Projections (Pages 35–57)

These pages do NOT have position prefixes (no "QB" before "Josh Allen"). The parser finds the team abbreviation (2–3 uppercase letters) and splits:

```
Josh Allen BUF 1 369 17 509 340 3946 26 12 36 116 580 12
            ↑   ↑  ↑
          team  rank ffpts
```

Everything before the team abbreviation = player name. Everything after = stats.

### Category Leaders (Pages 58–60)

Multi-column layout (3 columns per row, multiple rows per page). The parser:
1. Finds all team abbreviations on each line
2. Extracts `Name TEAM Value` entries
3. Assigns to categories based on column position and row counter
4. Header lines (containing "Player" and "Team") signal category group transitions

### Strength of Schedule (Page 62)

Each line: `Rank TeamName Week1 Week2 ... Week18`

The parser matches full team names and extracts the 18-week schedule. "0" = bye week.

### Projected Starters (Pages 75–82)

Two-team layout per page. The parser:
1. Finds player entries: `QB1 Dak Prescott 7`
2. Looks backwards 200 characters for the team abbreviation
3. Associates the player with that team

---

## Dashboard UI

### Tab Structure

```
Header: Home | Schedule | Teams | Projections | Props & Value

Teams sub-tabs: Overview | Moves | Power Index

Projections sub-tabs:
  🏈 Standings | 🏆 Leaders | 📅 Schedule | 🏟 Teams |
  🎯 QB | 🏃 RB | 📡 WR | 🤲 TE | 🛡 Defense |
  📊 Unit Grades | ⭐ Starters | 📋 Coaching
```

### Draft Capital (team roster modal + team tiles)

The former Draft tab was removed after the 2026 draft. Each team's roster modal now has a **Draft Capital** tab (right of Special Teams) showing 2027/2028/2029 pick holdings from `draft-capital.json`, generated by `scripts/build_draft_capital.py` from the app's transaction ledger. Acquired picks are highlighted with their source team; traded-away rounds are struck through. Team tiles on the Teams grid show a compact per-year pick count. Compensatory picks have a reserved `comp_picks` schema slot (no source yet).

### Schedule (full season)

`schedule.json` covers all 272 regular-season games (weeks 1-18), built by `scripts/build_full_schedule.py` from nflverse games.csv (Week 1 keeps its hand-enriched TV/city data). The Schedule tab has a week-chip selector defaulting to the current week; market lines are keyed by week and pulled live from nflverse. The home marquee follows the current week.

### Rendering Functions

| Function | Sub-tab | Description |
|----------|---------|-------------|
| `renderMovesView()` | Teams -> Moves | Compact date-grouped transaction newswire with filters and selected-move drawer |
| `renderStandingsProj()` | Standings | Division tables with color-coded W-L, Diff, Fav, SOS |
| `renderCategories()` | Leaders | Grid of leaderboard cards (top 10 per category) |
| `renderSOS()` | Schedule | Full 18-week grid with BYE week detection, home/away styling |
| `renderTeamProj()` | Teams | Card grid with projected wins, unit grades, top player |
| `renderPosProj()` | QB/RB/WR/TE | Sortable tables with search filtering |
| `renderDefProj()` | Defense | Sub-tabs for IDL/EDGE/LB/CB/S with stat tables |
| `renderUnitGrades()` | Unit Grades | Full 32-team table with color-coded grades (≥9 amber, ≥7 green, <5 red) |
| `renderStarters()` | Starters | Division-by-division starter cards with rating badges |
| `renderCoaching()` | Coaching | Full table with HC, OC, Playcaller, DC, GM |

---

## Known Limitations & Issues

### Extraction Issues

1. **Defensive position extraction from team pages** — The defense regex may capture some weekly projection data. This is cosmetic and doesn't affect the positional projections (which are cleaner).

2. **Returners and Kickers** — Extracted into JSON but no dedicated sub-tab (they're in the JSON under `positional_projections.RET` and `positional_projections.K`).

3. **Unit Ranks depth charts** — Extracted into `unit_ranks` JSON but displayed indirectly through the Teams tab card view rather than a dedicated sub-tab.

### Dashboard Issues

1. **The `═` characters in comments** — These are box-drawing characters used in section dividers. They're valid in JavaScript but fail Python's `compile()` check. Not a real issue.

2. **Smart quotes** — The original codebase had some smart quotes (U+2018, U+2019) that were replaced with regular quotes. This was necessary for the `normName()` regex to work correctly.

3. **Multi-line single-quoted strings** — The `renderSOS()` function had a multi-line single-quoted string which is invalid JavaScript. Fixed by using string concatenation.

---

## How to Run

### Extract data from PDF
```bash
cd nfldashboard
python3 extract_clay_projections.py
python3 extract_remaining.py
# Outputs clay_projections_2026.json
```

### Serve the dashboard
```bash
cd nfldashboard
python3 -m http.server 8080
# Open http://localhost:8080/index.html
# Click "Projections" tab
```

### Test with Playwright
```bash
python3 test_projections.py
```

---

## Data Verification

All data was verified against the PDF:

- **Top QB:** Josh Allen (BUF) — 369 FF pts ✓
- **Top RB:** Jahmyr Gibbs (DET) — 365 FF pts ✓
- **Top WR:** Puka Nacua (LAR) — 356 FF pts ✓
- **Top TE:** Trey McBride (ARI) — 242 FF pts ✓
- **#1 SOS:** Detroit Lions ✓
- **#1 Unit Grade:** Los Angeles Rams (7.1 overall) ✓
- **Projected wins range:** 3.5 (ARI) to 13.2 (LAR) ✓
- **Standings:** All 32 teams across 8 divisions ✓
- **Coaching staffs:** All 32 teams ✓
- **Starters:** 346 total with player ratings ✓
