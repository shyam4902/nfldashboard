#!/usr/bin/env python3
"""
Fix projected starters extraction.
Each page has 4 teams in a 2×2 grid. We find the actual gap between
the two team groups to determine the y-split.
"""
import pdfplumber
import json
import re
import os

PDF_PATH = "/Users/shyampatel/Desktop/NFL_Main/NFLDK2026_CS_ClayProjections2026.pdf"
OUTPUT_PATH = "/Users/shyampatel/Desktop/NFL_Main/nfldashboard/clay_projections_2026.json"

TEAM_MAP = {
    'ARZ': 'Arizona Cardinals', 'ATL': 'Atlanta Falcons', 'BLT': 'Baltimore Ravens',
    'BUF': 'Buffalo Bills', 'CAR': 'Carolina Panthers', 'CHI': 'Chicago Bears',
    'CIN': 'Cincinnati Bengals', 'CLV': 'Cleveland Browns', 'DAL': 'Dallas Cowboys',
    'DEN': 'Denver Broncos', 'DET': 'Detroit Lions', 'GB': 'Green Bay Packers',
    'HST': 'Houston Texans', 'IND': 'Indianapolis Colts', 'JAX': 'Jacksonville Jaguars',
    'KC': 'Kansas City Chiefs', 'LAC': 'Los Angeles Chargers', 'LAR': 'Los Angeles Rams',
    'LV': 'Las Vegas Raiders', 'MIA': 'Miami Dolphins', 'MIN': 'Minnesota Vikings',
    'NE': 'New England Patriots', 'NO': 'New Orleans Saints', 'NYG': 'New York Giants',
    'NYJ': 'New York Jets', 'PHI': 'Philadelphia Eagles', 'PIT': 'Pittsburgh Steelers',
    'SEA': 'Seattle Seahawks', 'SF': 'San Francisco 49ers', 'TB': 'Tampa Bay Buccaneers',
    'TEN': 'Tennessee Titans', 'WAS': 'Washington Commanders'
}
ABBR_TO_FULL = {k: v for k, v in TEAM_MAP.items()}

CONF_DIVS = {
    75: 'NFC East', 76: 'NFC North', 77: 'NFC South', 78: 'NFC West',
    79: 'AFC East', 80: 'AFC North', 81: 'AFC South', 82: 'AFC West'
}

X_SPLIT = 280.0  # Left vs right column
Y_HEADER = 100.0


def safe_int(v):
    try:
        return int(float(str(v).replace(',', '').replace('%', '').strip()))
    except:
        return 0


def parse_players_from_words(word_list):
    """Parse player entries from a list of words."""
    starters = []
    i = 0
    while i < len(word_list):
        w = word_list[i]['text']

        pos_match = re.match(r'^(QB|RB|WR|TE|LT|LG|C|RG|RT|DI|ED|LB|CB|S)(\d)$', w)
        if pos_match:
            pos = pos_match.group(1)
            depth = int(pos_match.group(2))

            name_parts = []
            rating = 0
            j = i + 1
            while j < len(word_list):
                next_w = word_list[j]['text']
                if next_w.isdigit() and len(name_parts) > 0:
                    rating = int(next_w)
                    break
                elif re.match(r'^(QB|RB|WR|TE|LT|LG|C|RG|RT|DI|ED|LB|CB|S)\d$', next_w):
                    break
                else:
                    name_parts.append(next_w)
                j += 1

            if name_parts:
                name = ' '.join(name_parts)
                starters.append({
                    'position': pos,
                    'depth': depth,
                    'name': name,
                    'rating': rating
                })

            i = j + 1
        else:
            i += 1

    return starters


def find_y_split(data_words):
    """Find the y-split by finding the largest gap in y positions."""
    y_positions = sorted(set(w['top'] for w in data_words))

    if len(y_positions) < 2:
        return 200  # Default

    # Find the largest gap
    max_gap = 0
    best_split = (y_positions[0] + y_positions[-1]) / 2

    for i in range(len(y_positions) - 1):
        gap = y_positions[i + 1] - y_positions[i]
        if gap > max_gap:
            max_gap = gap
            best_split = (y_positions[i] + y_positions[i + 1]) / 2

    return best_split


def extract_starters_from_page(pdf, page_idx):
    """Extract starters from a page using gap-based column/row splitting."""
    page = pdf.pages[page_idx - 1]  # 0-indexed
    words = page.extract_words()

    if not words:
        return {}

    # Filter out header words
    data_words = [w for w in words if w['top'] > Y_HEADER]

    # Find the y-split using gap detection
    y_split = find_y_split(data_words)

    # Split words into 4 quadrants
    quadrants = {
        'top_left': [w for w in data_words if w['x0'] < X_SPLIT and w['top'] < y_split],
        'top_right': [w for w in data_words if w['x0'] >= X_SPLIT and w['top'] < y_split],
        'bottom_left': [w for w in data_words if w['x0'] < X_SPLIT and w['top'] >= y_split],
        'bottom_right': [w for w in data_words if w['x0'] >= X_SPLIT and w['top'] >= y_split],
    }

    result = {}
    for quadrant_name, quadrant_words in quadrants.items():
        # Sort by y then x
        quadrant_words.sort(key=lambda w: (w['top'], w['x0']))

        # Find team abbreviation
        team_abbr = None
        for w in quadrant_words:
            if w['text'] in TEAM_MAP:
                team_abbr = w['text']
                break

        if team_abbr:
            # Remove team abbreviation from word list
            player_words = [w for w in quadrant_words if w['text'] != team_abbr]
            starters = parse_players_from_words(player_words)
            team_name = ABBR_TO_FULL.get(team_abbr, team_abbr)
            result[team_name] = starters

    return result


def extract_all_starters(pdf_path):
    """Extract all starters from the PDF."""
    pdf = pdfplumber.open(pdf_path)

    starters = {}

    for page_idx, conf_div in CONF_DIVS.items():
        starters[conf_div] = extract_starters_from_page(pdf, page_idx)

        for team, players in starters[conf_div].items():
            print(f"  {conf_div}: {team} ({len(players)} players)")

    pdf.close()
    return starters


def main():
    print("Extracting projected starters...")
    starters = extract_all_starters(PDF_PATH)

    total = sum(len(s) for d in starters.values() for s in d.values())
    print(f"\nTotal: {total} starters across {len(starters)} divisions")

    print("\nLoading existing JSON...")
    with open(OUTPUT_PATH, 'r') as f:
        data = json.load(f)

    data['projected_starters'] = starters

    for p in [OUTPUT_PATH]:
        if os.path.exists(os.path.dirname(p)):
            with open(p, 'w') as f:
                json.dump(data, f, indent=2)
            print(f"Saved to {p}")

    print("\n=== VERIFICATION ===")
    checks = [
        ('NFC East', 'Dallas Cowboys', 'QB1', 'Dak Prescott'),
        ('NFC East', 'New York Giants', 'QB1', 'Jaxson Dart'),
        ('NFC East', 'Philadelphia Eagles', 'QB1', 'Jalen Hurts'),
        ('NFC East', 'Washington Commanders', 'QB1', 'Jayden Daniels'),
        ('NFC North', 'Chicago Bears', 'QB1', 'Caleb Williams'),
        ('NFC North', 'Detroit Lions', 'QB1', 'Jared Goff'),
        ('NFC North', 'Green Bay Packers', 'QB1', 'Jordan Love'),
        ('NFC North', 'Minnesota Vikings', 'QB1', 'Kyler Murray'),
        ('AFC East', 'Buffalo Bills', 'QB1', 'Josh Allen'),
        ('AFC East', 'Miami Dolphins', 'QB1', 'Tua'),
        ('AFC North', 'Baltimore Ravens', 'QB1', 'Lamar Jackson'),
        ('AFC North', 'Cincinnati Bengals', 'QB1', 'Joe Burrow'),
        ('AFC West', 'Denver Broncos', 'QB1', 'Bo Nix'),
        ('AFC West', 'Kansas City Chiefs', 'QB1', 'Patrick Mahomes'),
    ]

    for div, team, pos, expected_name in checks:
        if div in starters and team in starters[div]:
            players = starters[div][team]
            pos_code = pos.rstrip('0123456789')
            depth_num = int(re.search(r'\d+', pos).group(0)) if re.search(r'\d+', pos) else 1
            found = [p for p in players if p['position'] == pos_code and p['depth'] == depth_num]
            if found:
                actual = found[0]['name']
                status = "✓" if expected_name in actual else f"✗ (got {actual})"
            else:
                status = "✗ (not found)"
        else:
            status = "✗ (team not found)"
        print(f"  {team} {pos}: {expected_name} {status}")


if __name__ == '__main__':
    main()
