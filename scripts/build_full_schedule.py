#!/usr/bin/env python3
"""Build the full 2026 regular-season schedule.json (weeks 1-18).

Week 1 keeps its hand-enriched entries (venue, city, TV); every other game
comes from nflverse's public games.csv with stadium + ET->UTC kickoff
conversion. Idempotent: re-running refreshes kickoffs/venues without
duplicating games.

Usage: python3 scripts/build_full_schedule.py   (run from repo root)
"""
import csv
import io
import json
import os
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

NFLVERSE_URL = ("https://raw.githubusercontent.com/nflverse/nfldata/"
                "master/data/games.csv")
ET = ZoneInfo("America/New_York")

# nflverse abbreviation -> app display name
TEAM_NAMES = {
    "ARI": "Arizona Cardinals", "ATL": "Atlanta Falcons", "BAL": "Baltimore Ravens",
    "BUF": "Buffalo Bills", "CAR": "Carolina Panthers", "CHI": "Chicago Bears",
    "CIN": "Cincinnati Bengals", "CLE": "Cleveland Browns", "DAL": "Dallas Cowboys",
    "DEN": "Denver Broncos", "DET": "Detroit Lions", "GB": "Green Bay Packers",
    "HOU": "Houston Texans", "IND": "Indianapolis Colts", "JAX": "Jacksonville Jaguars",
    "KC": "Kansas City Chiefs", "LV": "Las Vegas Raiders", "LAC": "Los Angeles Chargers",
    "LA": "Los Angeles Rams", "MIA": "Miami Dolphins", "MIN": "Minnesota Vikings",
    "NE": "New England Patriots", "NO": "New Orleans Saints", "NYG": "New York Giants",
    "NYJ": "New York Jets", "PHI": "Philadelphia Eagles", "PIT": "Pittsburgh Steelers",
    "SF": "San Francisco 49ers", "SEA": "Seattle Seahawks", "TB": "Tampa Bay Buccaneers",
    "TEN": "Tennessee Titans", "WAS": "Washington Commanders",
}


def kickoff_utc(gameday: str, gametime: str) -> str:
    """nflverse gametime is ET; convert to a Z-suffixed UTC ISO string."""
    local = datetime.strptime(f"{gameday} {gametime}", "%Y-%m-%d %H:%M").replace(tzinfo=ET)
    return local.astimezone(ZoneInfo("UTC")).strftime("%Y-%m-%dT%H:%M:%SZ")


def current_week(games) -> int:
    """The week containing 'now', or the next upcoming week if between games."""
    now = datetime.now(ZoneInfo("UTC"))
    week_starts = {}
    for g in games:
        dt = datetime.strptime(g["kickoff_utc"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=ZoneInfo("UTC"))
        # a week runs from its first kickoff's Tuesday
        start = dt - timedelta(days=(dt.weekday() - 1) % 7)
        start = start.replace(hour=0, minute=0, second=0, microsecond=0)
        week_starts[g["week"]] = min(week_starts.get(g["week"], start), start)
    for wk in sorted(week_starts):
        nxt = week_starts.get(wk + 1)
        if week_starts[wk] <= now and (nxt is None or now < nxt):
            return wk
    if now < min(week_starts.values()):
        return min(week_starts)
    return max(week_starts)


def main():
    root = Path(__file__).resolve().parent.parent
    path = root / "schedule.json"
    existing = json.loads(path.read_text())

    req = urllib.request.Request(NFLVERSE_URL)
    text = urllib.request.urlopen(req, timeout=30).read().decode()
    rows = [r for r in csv.DictReader(io.StringIO(text))
            if r.get("season") == "2026" and r.get("game_type") == "REG"]
    if len(rows) != 272:
        raise SystemExit(f"expected 272 nflverse 2026 REG games, got {len(rows)}")

    # Preserve enriched week-1 entries keyed by matchup
    enriched = {}
    for g in existing.get("games", []):
        enriched.setdefault((g["away_team"], g["home_team"]), g)

    games = []
    for r in rows:
        away_abbr, home_abbr = r["away_team"], r["home_team"]
        away, home = TEAM_NAMES.get(away_abbr), TEAM_NAMES.get(home_abbr)
        if not away or not home:
            raise SystemExit(f"unmapped nflverse team: {away_abbr} @ {home_abbr}")
        ko = kickoff_utc(r["gameday"], r["gametime"])
        prev = enriched.get((away, home))
        if prev and prev.get("kickoff_utc") == ko:
            # keep the hand-enriched entry, just tag the week
            g = dict(prev)
        else:
            g = {
                "game_id": f"{r['gameday']}-{away_abbr}-{home_abbr}",
                "away_team": away,
                "home_team": home,
                "venue": r.get("stadium") or "",
                "city": "",
                "kickoff_utc": ko,
                "tv": "",
                "winner": None,
                "away_score": None,
                "home_score": None,
            }
        g["week"] = int(r["week"])
        games.append(g)

    games.sort(key=lambda g: (g["week"], g["kickoff_utc"]))
    out = {
        "season": 2026,
        "week": current_week(games),
        "total_weeks": 18,
        "generated": datetime.now(ZoneInfo("UTC")).strftime("%Y-%m-%d"),
        "source": "nflverse games.csv (matchups, kickoffs, stadiums); Week 1 enriched with TV/city",
        "games": games,
    }
    # atomic publish: write a same-dir temp then rename so an interrupted
    # build can never leave a truncated tracked artifact in place. The pid
    # suffix keeps concurrent builds from sharing (and corrupting) one temp.
    tmp = path.with_name(path.name + f".tmp.{os.getpid()}")
    tmp.write_text(json.dumps(out, indent=2) + "\n")
    os.replace(tmp, path)
    weeks = sorted({g["week"] for g in games})
    print(f"Wrote {path}: {len(games)} games, weeks {weeks[0]}-{weeks[-1]}, current week {out['week']}")


if __name__ == "__main__":
    main()
