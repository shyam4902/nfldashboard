#!/usr/bin/env python3
"""Build draft-capital.json: each team's 2027/2028 draft pick holdings.

Starts every team with a standard 7-round draft and applies every pick trade
recorded in the app's transaction data (Supabase nfl_transactions + the
hardcoded summer 2026 transaction log + the processed in-season sync log).

Conventions:
- Trades from March 2026 that mention a pick WITHOUT a year refer to 2026
  picks (the April draft had not happened yet), so they don't affect future
  capital and are ignored here.
- Only explicitly-labeled 2027/2028 picks are applied.
- Compensatory picks are not yet tracked (no reliable source for 2027+ comps);
  the schema reserves a `comp_picks` section so they can be added without
  touching the UI.

Usage: python3 scripts/build_draft_capital.py   (run from repo root)
"""
import json
from pathlib import Path

YEARS = [2027, 2028, 2029]
TEAMS = [
    "Arizona Cardinals", "Atlanta Falcons", "Baltimore Ravens", "Buffalo Bills",
    "Carolina Panthers", "Chicago Bears", "Cincinnati Bengals", "Cleveland Browns",
    "Dallas Cowboys", "Denver Broncos", "Detroit Lions", "Green Bay Packers",
    "Houston Texans", "Indianapolis Colts", "Jacksonville Jaguars",
    "Kansas City Chiefs", "Las Vegas Raiders", "Los Angeles Chargers",
    "Los Angeles Rams", "Miami Dolphins", "Minnesota Vikings",
    "New England Patriots", "New Orleans Saints", "New York Giants",
    "New York Jets", "Philadelphia Eagles", "Pittsburgh Steelers",
    "San Francisco 49ers", "Seattle Seahawks", "Tampa Bay Buccaneers",
    "Tennessee Titans", "Washington Commanders",
]

# (year, round, from_team, to_team, player, date, note)
PICK_TRADES = [
    (2027, 1, "Los Angeles Rams", "Cleveland Browns", "Myles Garrett", "2026-07-24",
     "Blockbuster: Garrett to LAR for Verse + picks"),
    (2028, 2, "Los Angeles Rams", "Cleveland Browns", "Myles Garrett", "2026-07-24", ""),
    (2027, 1, "New England Patriots", "Philadelphia Eagles", "A.J. Brown", "2026-07-20",
     "Brown to NE for two 2027 picks"),
    (2027, 3, "New England Patriots", "Philadelphia Eagles", "A.J. Brown", "2026-07-20", ""),
    (2027, 3, "Los Angeles Rams", "Kansas City Chiefs", "Trent McDuffie", "2026-03-01", ""),
    (2027, 4, "Dallas Cowboys", "Green Bay Packers", "Rashan Gary", "2026-03-01", ""),
    (2027, 5, "Chicago Bears", "New England Patriots", "Garrett Bradbury", "2026-03-01", ""),
    (2027, 6, "Kansas City Chiefs", "New York Jets", "Justin Fields", "2026-03-01", ""),
    (2027, 6, "Seattle Seahawks", "New York Jets", "Irvin Charles", "2026-05-28", ""),
    (2027, 7, "Houston Texans", "Detroit Lions", "David Montgomery", "2026-03-01",
     "Texans also sent OL Juice Scruggs + 2026 4th"),
    (2027, 7, "Philadelphia Eagles", "Carolina Panthers", "Andy Dalton", "2026-03-01", ""),
    (2028, 6, "Houston Texans", "New Orleans Saints", "Kai Kroeger", "2026-03-01", ""),
    (2028, 6, "Miami Dolphins", "New England Patriots", "Caedan Wallace", "2026-08-10", ""),
    (2029, 7, "New England Patriots", "Miami Dolphins", "Caedan Wallace", "2026-08-10",
     "Other half of the same trade: Miami's 2028 6th went to New England"),
]

NOTES = [
    "Future capital reflects a standard 7-round draft adjusted by every pick trade "
    "in the dashboard's transaction log through Aug 2026. Compensatory picks and "
    "pick swaps not itemized in transaction details are not tracked.",
]


def main():
    capital = {t: {str(y): list(range(1, 8)) for y in YEARS} for t in TEAMS}
    acquired = {t: {str(y): [] for y in YEARS} for t in TEAMS}

    for year, rnd, src, dst, player, date, note in PICK_TRADES:
        ys = str(year)
        if rnd in capital[src][ys]:
            capital[src][ys].remove(rnd)
        else:
            raise SystemExit(f"Ledger error: {src} has no {year} round-{rnd} pick to trade ({player})")
        capital[dst][ys].append(rnd)
        capital[dst][ys].sort()
        acquired[dst][ys].append({"round": rnd, "via": src, "player": player})

    out = {
        "generated": "2026-08-26",
        "years": YEARS,
        "source": "Derived from nfl_transactions (Supabase), the summer 2026 transaction log, "
                  "and the processed in-season sync log. See scripts/build_draft_capital.py.",
        "notes": NOTES,
        "trades": [
            {"year": y, "round": r, "from_team": s, "to_team": d,
             "player": p, "date": dt, **({"note": n} if n else {})}
            for (y, r, s, d, p, dt, n) in PICK_TRADES
        ],
        "capital": capital,
        "acquired": acquired,
        # Reserved for future compensatory-pick data (2027+ comps not yet awarded/sourced).
        # Shape: { team: { year: [ {round, note} ] } }
        "comp_picks": {},
    }

    path = Path(__file__).resolve().parent.parent / "draft-capital.json"
    path.write_text(json.dumps(out, indent=2) + "\n")
    print(f"Wrote {path}")
    for t in TEAMS:
        c = out["capital"][t]
        print(f"  {t:26s} 2027: {c['2027']}  2028: {c['2028']}")


if __name__ == "__main__":
    main()
