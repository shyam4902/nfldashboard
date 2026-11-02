#!/usr/bin/env python3
"""Append the current season's rows to team_season_efficiency.json.

Mirrors research/nfl-stickiness/01_build_dataset.R (the 2012-2025 builder)
exactly: REG plays only, no 2-point tries, offense grouped by posteam and
defense by defteam, the same nine rate metrics, the same 4-decimal rounding
(jsonlite digits=4), one row per team per side in first-appearance order.

Downloads nflverse's season play-by-play once, drops any existing rows for
that season from the committed JSON, appends the new ones, and writes both
data/shared/team_season_efficiency.json (canonical) and the root browser
fallback atomically (temp file + rename).

Python standard library only: urllib, gzip, csv, json.

Usage: python3 scripts/build_team_efficiency.py   (run from anywhere)
"""

import csv
import gzip
import io
import json
import math
import os
import sys
import tempfile
import urllib.request

SEASON = 2026
PBP_URL = ("https://github.com/nflverse/nflverse-data/releases/download/pbp/"
           "play_by_play_%d.csv.gz" % SEASON)

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGETS = (
    os.path.join(REPO_ROOT, "data", "shared", "team_season_efficiency.json"),
    os.path.join(REPO_ROOT, "team_season_efficiency.json"),
)

# Same key order as the committed rows (season, team, metrics..., side).
KEYS = ("season", "team", "plays", "epa_per_play", "success_rate",
        "yds_per_play", "turnover_rate", "pass_att", "pass_epa_per_att",
        "run_epa_per_att", "sack_rate", "side")

# nflreadr::clean_team_abbrs equivalents a pbp team code could carry.
LEGACY_TEAM = {"OAK": "LV", "SD": "LAC", "STL": "LA", "JAC": "JAX",
               "WSH": "WAS", "BLT": "BAL", "CLT": "IND", "CLV": "CLE"}


def as_float(raw):
    """CSV cell -> float, or None for NA/empty (R: is.na(x))."""
    if raw is None:
        return None
    raw = raw.strip()
    if raw == "" or raw.upper() in ("NA", "NAN", "NULL"):
        return None
    try:
        return float(raw)
    except ValueError:
        return None


def is_one(raw):
    """R: x == 1 for a non-NA cell; NA compares to nothing, so False."""
    value = as_float(raw)
    return value is not None and value == 1


def clean_team(code):
    """nflreadr::clean_team_abbrs, scoped to the codes that can appear."""
    if not code:
        return None
    code = code.strip().upper()
    return LEGACY_TEAM.get(code, code)


def rate(total, count):
    """mean()/sum() over .N the way R reports it; NaN when empty."""
    if count == 0:
        return float("nan")
    return total / count


def round4(value):
    """jsonlite digits=4 rounding."""
    return round(value, 4)


def num_text(value):
    """Serialize a number the way jsonlite::toJSON(digits=4) prints one."""
    if isinstance(value, int):
        return str(value)
    value = round(value, 4)
    if value == 0:
        # jsonlite prints 0 and -0 without a decimal point.
        return "-0" if math.copysign(1.0, value) < 0 else "0"
    if value == int(value):
        return str(int(value))
    return repr(value)


def dump_rows(rows):
    """Pretty JSON identical to the committed file's shape."""
    out = ["["]
    for index, row in enumerate(rows):
        out.append("  {")
        out.append(",\n".join(
            "    %s: %s" % (json.dumps(key), row_json(row[key]))
            for key in KEYS))
        out.append("  }" + ("," if index < len(rows) - 1 else ""))
    out.append("]")
    return "\n".join(out) + "\n"


def row_json(value):
    if isinstance(value, str):
        return json.dumps(value)
    if isinstance(value, int) and not isinstance(value, bool):
        return str(value)
    return num_text(value)


def new_group():
    return {"plays": 0, "epa_sum": 0.0, "success_sum": 0.0, "success_n": 0,
            "yards_sum": 0.0, "yards_n": 0, "turnovers": 0, "pass_att": 0,
            "pass_epa_sum": 0.0, "pass_epa_n": 0, "run_epa_sum": 0.0,
            "run_epa_n": 0, "sacks": 0, "dropbacks": 0}


def accumulate(group, row, epa, play_type):
    group["plays"] += 1
    group["epa_sum"] += epa

    success = as_float(row.get("success"))
    if success is not None:
        group["success_sum"] += success
        group["success_n"] += 1

    yards = as_float(row.get("yards_gained"))
    if yards is not None:
        group["yards_sum"] += yards
        group["yards_n"] += 1

    if is_one(row.get("fumble_lost")) or is_one(row.get("interception")):
        group["turnovers"] += 1

    pass_attempt = is_one(row.get("pass_attempt"))
    if pass_attempt:
        group["pass_att"] += 1
    if pass_attempt and play_type == "pass":
        group["pass_epa_sum"] += epa
        group["pass_epa_n"] += 1
    if play_type == "run":
        group["run_epa_sum"] += epa
        group["run_epa_n"] += 1

    if is_one(row.get("sack")):
        group["sacks"] += 1
    if (pass_attempt or is_one(row.get("sack"))
            or is_one(row.get("qb_scramble"))):
        group["dropbacks"] += 1


def build_row(team, side, group, season):
    plays = group["plays"]
    return {
        "season": season,
        "team": team,
        "plays": plays,
        "epa_per_play": round4(rate(group["epa_sum"], plays)),
        "success_rate": round4(rate(group["success_sum"], group["success_n"])),
        "yds_per_play": round4(rate(group["yards_sum"], group["yards_n"])),
        "turnover_rate": round4(rate(group["turnovers"], plays)),
        "pass_att": group["pass_att"],
        "pass_epa_per_att": round4(
            rate(group["pass_epa_sum"], group["pass_epa_n"])),
        "run_epa_per_att": round4(
            rate(group["run_epa_sum"], group["run_epa_n"])),
        "sack_rate": round4(rate(group["sacks"], group["dropbacks"])),
        "side": side,
    }


def build_season_rows():
    """One pass over the pbp CSV -> the 64 rows for SEASON."""
    request = urllib.request.Request(
        PBP_URL, headers={"User-Agent": "nfldashboard-build-team-efficiency"})
    print("downloading %s" % PBP_URL)
    with urllib.request.urlopen(request) as response:
        payload = response.read()
    print("downloaded %.1f MB gzipped" % (len(payload) / 1024 / 1024))

    off_groups = {}
    def_groups = {}
    kept = 0
    with gzip.GzipFile(fileobj=io.BytesIO(payload)) as gz:
        with io.TextIOWrapper(gz, encoding="utf-8") as text:
            for row in csv.DictReader(text):
                if row.get("season_type") != "REG":
                    continue
                if not row.get("posteam"):
                    continue
                epa = as_float(row.get("epa"))
                if epa is None:
                    continue
                play_type = row.get("play_type")
                if play_type not in ("pass", "run"):
                    continue
                two_pt = as_float(row.get("two_point_attempt"))
                if two_pt is not None and two_pt != 0:
                    continue

                kept += 1
                row_season = int(float(row.get("season")))
                if row_season != SEASON:
                    raise SystemExit(
                        "expected season %d in %s, got %r"
                        % (SEASON, PBP_URL, row.get("season")))

                for side, column, groups in (
                        ("off", "posteam", off_groups),
                        ("def", "defteam", def_groups)):
                    team = clean_team(row.get(column))
                    if team is None:
                        raise SystemExit(
                            "missing %s team code at play_id %r"
                            % (column, row.get("play_id")))
                    group = groups.setdefault(team, new_group())
                    accumulate(group, row, epa, play_type)

    rows = [build_row(team, "off", off_groups[team], SEASON)
            for team in off_groups]
    rows += [build_row(team, "def", def_groups[team], SEASON)
             for team in def_groups]
    print("kept %d REG pass/run plays; built %d rows (%d offense, %d defense)"
          % (kept, len(rows), len(off_groups), len(def_groups)))
    return rows


def self_check(rows):
    """Assert the invariants the packet requires before anything is written."""
    season_rows = [row for row in rows if row["season"] == SEASON]
    assert len(season_rows) == 64, \
        "expected 64 rows for %d, got %d" % (SEASON, len(season_rows))
    for side in ("off", "def"):
        teams = [row["team"] for row in season_rows if row["side"] == side]
        assert len(teams) == 32 and len(set(teams)) == 32, \
            "expected 32 distinct %s teams, got %r" % (side, teams)
    for row in season_rows:
        for key in KEYS:
            value = row[key]
            if isinstance(value, float):
                assert math.isfinite(value), \
                    "non-finite %s for %s/%s: %r" % (
                        key, row["team"], row["side"], value)
            elif key != "team" and key != "side" and not isinstance(value, int):
                raise AssertionError("bad value for %s: %r" % (key, value))


def write_atomic(path, text):
    directory = os.path.dirname(path)
    handle, temp_path = tempfile.mkstemp(
        dir=directory, prefix=".team_season_efficiency.", suffix=".tmp")
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as stream:
            stream.write(text)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp_path, path)
    except BaseException:
        try:
            os.unlink(temp_path)
        except OSError:
            pass
        raise


def main():
    new_rows = build_season_rows()
    with open(TARGETS[1], encoding="utf-8") as stream:
        existing = json.load(stream)
    dropped = sum(1 for row in existing if row.get("season") == SEASON)
    kept_rows = [row for row in existing if row.get("season") != SEASON]
    rows = kept_rows + new_rows
    self_check(rows)

    text = dump_rows(rows)
    for target in TARGETS:
        write_atomic(target, text)
        print("wrote %s (%d rows)" % (target, len(rows)))
    print("dropped %d pre-existing %d rows; appended %d new ones"
          % (dropped, SEASON, len(new_rows)))
    print("self-check OK: 64 rows for %d, 32 teams per side, all metrics "
          "finite" % SEASON)
    return 0


if __name__ == "__main__":
    sys.exit(main())
