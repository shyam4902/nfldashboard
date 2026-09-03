"""Deterministic browser-test fixtures for the dashboard's runtime data feeds.

Intercepts exactly three request families so the Python Playwright suites do
not depend on live services or today's database contents:

  * Supabase REST (nedyoydylpbjvihaoexy.supabase.co) — nfl_teams,
    nfl_players, nfl_transactions. Players come from the COMMITTED
    nfl_rosters_2026.json snapshot (the deploy artifact of the same table,
    with team_id linkage added); teams are derived from it; transactions come
    from the static, clearly-labeled test fixture nfl_transactions.json.
  * nflverse games.csv (raw.githubusercontent.com/nflverse/**) — synthesized
    deterministically from the COMMITTED schedule.json so market-line
    assertions hold without the live file.
  * espncdn team-logos — served as a 1x1 PNG so image loads never touch the
    network or log console errors.

Third-party CDN libraries (Tailwind, supabase-js, fonts) still load from the
network — those are stable artifacts, not project data. For a genuinely
live-data run, set DASH_LIVE_NETWORK=1 and none of these routes install.

Usage (from a Playwright test):
    import browser_fixtures  # with test-fixtures/ on sys.path
    browser_fixtures.install(page, dashboard_dir)
"""

import base64
import json
import os
import urllib.parse

SUPABASE_PATTERN = "https://nedyoydylpbjvihaoexy.supabase.co/**"
NFLVERSE_PATTERN = "https://raw.githubusercontent.com/nflverse/**"
ESPNCDN_PATTERN = "https://a.espncdn.com/**"

# 1x1 transparent PNG
_TINY_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
)

TEAM_COLOR_OVERRIDES = {
    "New England Patriots": "#C60C30",
    "Seattle Seahawks": "#69BE28",
    "Houston Texans": "#A71930",
    "Cleveland Browns": "#FF3C00",
    "Dallas Cowboys": "#003594",
    "Baltimore Ravens": "#6B3FA0",
    "Green Bay Packers": "#187A44",
    "Indianapolis Colts": "#00529B",
    "New York Giants": "#0053A0",
    "New York Jets": "#007A53",
    "Philadelphia Eagles": "#007A65",
    "Washington Commanders": "#8C182A",
}
DEFAULT_COLOR = "#3b82f6"

_JSON_HEADERS = {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
}
_CORS_HEADERS = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "apikey,authorization,content-type,prefer,x-client-info,range",
}


class FixtureData:
    """Loads committed repo data once and derives deterministic feed responses."""

    def __init__(self, dashboard_dir):
        self.dir = dashboard_dir
        with open(os.path.join(dashboard_dir, "nfl_rosters_2026.json")) as f:
            roster_rows = json.load(f)
        # team rows derived from the roster snapshot (canonical abbrs already)
        seen = {}
        for p in roster_rows:
            name = p.get("team_name")
            if name and name not in seen:
                seen[name] = p
        self.teams = []
        for i, (name, p) in enumerate(sorted(seen.items()), start=1):
            abbr = p.get("team_abbr") or ""
            self.teams.append({
                "id": str(i),
                "name": name,
                "abbr": abbr,
                "division": p.get("division") or "",
                "primary_color": TEAM_COLOR_OVERRIDES.get(name, DEFAULT_COLOR),
                # no cap_space / dead_money / status keys: the app renders
                # missing cap as "Unavailable", never a fabricated $0
            })
        team_id = {t["name"]: t["id"] for t in self.teams}
        self.players = []
        for i, p in enumerate(roster_rows, start=1):
            row = dict(p)
            row["id"] = str(i)
            row["team_id"] = team_id.get(p.get("team_name"))
            self.players.append(row)
        with open(os.path.join(dashboard_dir, "test-fixtures", "nfl_transactions.json")) as f:
            self.transactions = json.load(f)
        # Supabase query returns newest-first; pre-sort so we can ignore params
        self.transactions.sort(key=lambda t: t.get("sort_date") or "", reverse=True)

        with open(os.path.join(dashboard_dir, "schedule.json")) as f:
            schedule = json.load(f)
        abbr_of = {t["name"]: t["abbr"] for t in self.teams}
        self.games_csv = _games_csv(schedule, abbr_of)

    def table_response(self, url):
        parsed = urllib.parse.urlparse(url)
        table = parsed.path.rstrip("/").split("/")[-1]
        if table == "nfl_teams":
            rows = self.teams
        elif table == "nfl_players":
            qs = urllib.parse.parse_qs(parsed.query)
            try:
                offset = int(qs.get("offset", ["0"])[0])
            except ValueError:
                offset = 0
            try:
                limit = int(qs.get("limit", ["1000"])[0])
            except ValueError:
                limit = 1000
            rows = self.players[offset:offset + limit]
        elif table == "nfl_transactions":
            rows = self.transactions
        else:
            rows = []
        return json.dumps(rows)


def _games_csv(schedule, abbr_of):
    """Deterministic 2026 REG games.csv (the columns loadGameLines reads)."""
    header = ["season", "game_type", "week", "away_team", "home_team",
              "spread_line", "total_line", "away_moneyline", "home_moneyline"]
    lines = [",".join(header)]
    for i, g in enumerate(schedule.get("games", [])):
        away = abbr_of.get(g.get("away_team"), g.get("away_team"))
        home = abbr_of.get(g.get("home_team"), g.get("home_team"))
        lines.append(",".join([
            "2026", "REG", str(g.get("week", 1)), str(away), str(home),
            str(-(i % 6) - 1), str(40 + (i % 14)),
            str(120 + i), str(-130 - i),
        ]))
    return "\n".join(lines) + "\n"


def install(page, dashboard_dir):
    """Install fixture routes on a Playwright page (sync API).

    Set DASH_LIVE_NETWORK=1 beforehand to skip interception entirely.
    """
    if os.environ.get("DASH_LIVE_NETWORK") == "1":
        print("[browser fixtures] DASH_LIVE_NETWORK=1 — live network mode, no interception")
        return
    data = FixtureData(dashboard_dir)

    def handle(route, request):
        url = request.url
        if "supabase.co" in url:
            if request.method == "OPTIONS":
                route.fulfill(status=204, headers=_CORS_HEADERS, body="")
                return
            body = data.table_response(url)
            route.fulfill(status=200, headers=_JSON_HEADERS, body=body)
        elif "raw.githubusercontent.com/nflverse" in url:
            route.fulfill(status=200, headers={"content-type": "text/csv"},
                          body=data.games_csv)
        else:  # espncdn logos
            route.fulfill(status=200, headers={"content-type": "image/png"},
                          body=_TINY_PNG)

    page.route(SUPABASE_PATTERN, handle)
    page.route(NFLVERSE_PATTERN, handle)
    page.route(ESPNCDN_PATTERN, handle)
    print("[browser fixtures] intercepting Supabase + nflverse + espncdn with "
          "deterministic committed-data fixtures")
