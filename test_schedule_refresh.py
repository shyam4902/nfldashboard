"""A weekly refresh must advance the week without erasing recorded results."""
import csv
import io
import json
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

from scripts import build_full_schedule as builder


class ScheduleRefreshTest(unittest.TestCase):
    def test_rollover_preserves_results_and_provenance(self):
        schedule = json.loads((Path(__file__).parent / "schedule.json").read_text())
        schedule["scores_synced_at"] = "2026-09-15T05:37:56Z"
        for game in schedule["games"]:
            if game["week"] == 1:
                game.update(status="final", away_score=10, home_score=20,
                            winner=game["home_team"])
        names = {name: abbr for abbr, name in builder.TEAM_NAMES.items()}
        csv_text = io.StringIO()
        fields = ["season", "game_type", "week", "gameday", "gametime",
                  "away_team", "home_team", "stadium"]
        writer = csv.DictWriter(csv_text, fieldnames=fields)
        writer.writeheader()
        for game in schedule["games"]:
            kickoff = datetime.fromisoformat(game["kickoff_utc"]).astimezone(builder.ET)
            writer.writerow(dict(season=2026, game_type="REG", week=game["week"],
                                 gameday=kickoff.strftime("%Y-%m-%d"),
                                 gametime=kickoff.strftime("%H:%M"),
                                 away_team=names[game["away_team"]],
                                 home_team=names[game["home_team"]], stadium=game["venue"]))
        self.assertEqual(builder.current_week(schedule["games"],
                         datetime.fromisoformat("2026-09-14T23:00:00+00:00")), 1)
        self.assertEqual(builder.current_week(schedule["games"],
                         datetime.fromisoformat("2026-09-15T12:00:00+00:00")), 2)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "schedule.json").write_text(json.dumps(schedule))
            with patch.object(builder, "__file__", str(root / "scripts/build_full_schedule.py")), \
                 patch.object(builder.urllib.request, "urlopen",
                              return_value=io.BytesIO(csv_text.getvalue().encode())):
                builder.main()
            refreshed = json.loads((root / "schedule.json").read_text())
        self.assertEqual(refreshed["scores_synced_at"], schedule["scores_synced_at"])
        self.assertEqual(refreshed["games"], schedule["games"])


if __name__ == "__main__":
    unittest.main()
