#!/usr/bin/env python3
"""
Data-integrity test for the Week 1 NFL slate in schedule.json.

Guards the slate against regressions so future-week expansion can't
silently break Week 1. Asserts, independently of the front end:

  * exactly 16 games, all 32 NFL teams scheduled exactly once
  * kickoff_utc valid and on the expected weekday
  * required fields present and non-empty per game
  * game_id matches its away/home teams
  * matchups agree with the in-app Mike Clay strength_of_schedule
"""
import json
import os
import sys
from datetime import datetime, timezone, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
ET = timezone(timedelta(hours=-4))  # EDT in September 2026

# Kickoff weekday expectations for the marquee/openers, keyed by game_id
# prefix (used to assert the right day-of-week for the non-standard games).
desired_weekdays = {
    "2026-09-09-NE-SEA": "Wed", "2026-09-10-SF-LAR": "Thu",
    "2026-09-13-DAL-NYG": "Sun", "2026-09-14-DEN-KC": "Mon",
}
# NFL teams (full display names used by the app).
ALL_TEAMS = sorted([
    "Arizona Cardinals", "Atlanta Falcons", "Baltimore Ravens", "Buffalo Bills",
    "Carolina Panthers", "Chicago Bears", "Cincinnati Bengals", "Cleveland Browns",
    "Dallas Cowboys", "Denver Broncos", "Detroit Lions", "Green Bay Packers",
    "Houston Texans", "Indianapolis Colts", "Jacksonville Jaguars", "Kansas City Chiefs",
    "Las Vegas Raiders", "Los Angeles Chargers", "Los Angeles Rams", "Miami Dolphins",
    "Minnesota Vikings", "New England Patriots", "New Orleans Saints", "New York Giants",
    "New York Jets", "Philadelphia Eagles", "Pittsburgh Steelers", "San Francisco 49ers",
    "Seattle Seahawks", "Tampa Bay Buccaneers", "Tennessee Titans", "Washington Commanders",
])

failures = []


def check(cond, msg):
    if not cond:
        failures.append(msg)


def main():
    path = os.path.join(HERE, "schedule.json")
    sched = json.load(open(path))
    games = sched["games"]

    check(sched.get("season") == 2026, f"season != 2026 ({sched.get('season')})")
    check(sched.get("week") == 1, f"week != 1 ({sched.get('week')})")
    check(len(games) == 16, f"expected 16 games, got {len(games)}")

    # All teams appear exactly once as away and exactly once as home
    aways = [g["away_team"] for g in games]
    homes = [g["home_team"] for g in games]
    check(len(aways) == 16 and len(set(aways)) == 16, "expected 16 distinct away teams")
    check(len(homes) == 16 and len(set(homes)) == 16, "expected 16 distinct home teams")
    check(sorted(set(aways) | set(homes)) == ALL_TEAMS, "all 32 teams are not covered exactly once across the slate")

    seen_ids = set()
    for g in games:
        gid = g.get("game_id", "")
        check(gid not in seen_ids, f"duplicate game_id {gid}")
        seen_ids.add(gid)
        for field in ("away_team", "home_team", "venue", "city", "kickoff_utc", "tv", "game_id"):
            check(bool(g.get(field)), f"{gid}: missing field '{field}'")
        check(g["away_team"] != g["home_team"], f"{gid}: team plays itself")

        # game_id encodes YYYY-MM-DD-AWAY-HOME pattern
        base = gid.split("-")
        if len(base) >= 5:
            check(g["away_team"] in ALL_TEAMS and g["home_team"] in ALL_TEAMS,
                  f"{gid}: unrecognized team(s)")

        # kickoff_utc must parse and reference the opener dates (Sep 9-14, 2026)
        try:
            dt = datetime.fromisoformat(g["kickoff_utc"].replace("Z", "+00:00"))
        except ValueError as e:
            check(False, f"{gid}: bad kickoff_utc {g['kickoff_utc']} ({e})")
            continue
        et = dt.astimezone(ET)
        check(et.year == 2026 and et.month == 9 and 9 <= et.day <= 14,
              f"{gid}: kickoff {et} outside Sep 9-14 window")

        # Expected weekday for the designated games
        if gid in desired_weekdays:
            check(et.strftime("%a") == desired_weekdays[gid],
                  f"{gid}: expected {desired_weekdays[gid]} but kickoff is {et.strftime('%a')}")

    # Matchups must agree with the in-app Clay strength_of_schedule data
    clay_path = os.path.join(HERE, "clay_projections_2026.json")
    if os.path.exists(clay_path):
        clay = json.load(open(clay_path))
        sos = clay.get("strength_of_schedule", {})
        abbr_to_team = {info["team"]: abbr for abbr, info in sos.items()}
        # build a Clay-style week1 map: team -> opponent (with leading @ for road)
        wk1 = {}
        for abbr, info in sos.items():
            wk1[info["team"]] = info["schedule"][0]
        for g in games:
            away_opp = wk1.get(g["home_team"], "")   # what the home team sees in wk1
            home_opp = wk1.get(g["away_team"], "")   # what the away team sees in wk1
            away_abbr = abbr_to_team.get(g["away_team"])
            home_abbr = abbr_to_team.get(g["home_team"])
            if away_abbr and home_abbr:
                check(away_opp == away_abbr,
                      f"{g['game_id']}: Clay says {g['home_team']} wk1 opp={away_opp!r}, expected {away_abbr!r}")
                check(home_opp == "@" + home_abbr,
                      f"{g['game_id']}: Clay says {g['away_team']} wk1 opp={home_opp!r}, expected @{home_abbr!r}")

    if failures:
        print(f"sched-data: FAILED ({len(failures)})")
        for f in failures:
            print("  -", f)
        return 1
    print(f"sched-data: OK ({len(games)} games, all invariants hold)")
    return 0


if __name__ == "__main__":
    sys.exit(main())