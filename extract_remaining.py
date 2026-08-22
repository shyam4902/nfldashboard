#!/usr/bin/env python3
"""Extract Category Leaders and Strength of Schedule."""
import pdfplumber
import json
import re
import os

PDF_PATH = "/Users/shyampatel/Desktop/NFL_Main/NFLDK2026_CS_ClayProjections2026.pdf"
JSON_PATH = "/Users/shyampatel/Desktop/NFL_Main/nfldashboard/clay_projections_2026.json"

TEAM_ABBRS = {
    'ARZ', 'ATL', 'BLT', 'BUF', 'CAR', 'CHI', 'CIN', 'CLV', 'DAL', 'DEN',
    'DET', 'GB', 'HST', 'IND', 'JAX', 'KC', 'LAC', 'LAR', 'LV', 'MIA',
    'MIN', 'NE', 'NO', 'NYG', 'NYJ', 'PHI', 'PIT', 'SEA', 'SF', 'TB', 'TEN', 'WAS'
}

TEAM_FULL = {
    'Detroit Lions': 'DET', 'Cincinnati Bengals': 'CIN', 'New Orleans Saints': 'NO',
    'Cleveland Browns': 'CLV', 'Baltimore Ravens': 'BLT', 'Indianapolis Colts': 'IND',
    'New York Jets': 'NYJ', 'Atlanta Falcons': 'ATL', 'Pittsburgh Steelers': 'PIT',
    'Minnesota Vikings': 'MIN', 'Tampa Bay Buccaneers': 'TB', 'Jacksonville Jaguars': 'JAX',
    'Tennessee Titans': 'TEN', 'Chicago Bears': 'CHI', 'Philadelphia Eagles': 'PHI',
    'Green Bay Packers': 'GB', 'Denver Broncos': 'DEN', 'Houston Texans': 'HST',
    'Carolina Panthers': 'CAR', 'Buffalo Bills': 'BUF', 'New England Patriots': 'NE',
    'Kansas City Chiefs': 'KC', 'Dallas Cowboys': 'DAL', 'San Francisco 49ers': 'SF',
    'Las Vegas Raiders': 'LV', 'Washington Commanders': 'WAS', 'Arizona Cardinals': 'ARZ',
    'Los Angeles Chargers': 'LAC', 'Los Angeles Rams': 'LAR', 'New York Giants': 'NYG',
    'Seattle Seahawks': 'SEA', 'Miami Dolphins': 'MIA'
}


def parse_line_entries(line):
    """Parse a line with 3 columns of Name TEAM Value data."""
    entries = []
    team_positions = []
    for m in re.finditer(r'\b([A-Z]{2,3})\b', line):
        if m.group(1) in TEAM_ABBRS:
            team_positions.append((m.start(), m.end(), m.group(1)))
    
    for i, (start, end, team) in enumerate(team_positions):
        if i == 0:
            name_start = 0
        else:
            prev_end = team_positions[i-1][1]
            num_match = re.search(r'[\d,\.%]+', line[prev_end:])
            name_start = prev_end + (num_match.end() if num_match else 0)
        
        name = line[name_start:start].strip()
        rest = line[end:]
        num_match = re.match(r'\s*([\d,\.%]+)', rest)
        value = num_match.group(1) if num_match else ''
        
        if name and team and value and len(name) > 1:
            entries.append({'name': name, 'team': team, 'value': value})
    return entries


def extract_page_categories(text, category_groups):
    """Extract categories from a page with multiple groups.
    category_groups: list of lists, each inner list has category names for one group.
    e.g., [['Pass Att', 'INTs', 'Rush Yds'], ['Pass Yds', 'Sacked', 'Rush TDs'], ...]"""
    
    leaders = {}
    current_group_idx = -1  # Start at -1, first header moves to 0
    
    for line in text.split('\n'):
        line = line.strip()
        if not line or 'Category' in line or 'Leaderboard' in line:
            continue
        
        # Detect header lines (contain "Player" and "Team")
        if 'Player' in line and 'Team' in line:
            current_group_idx += 1
            continue
        
        # Parse data line
        entries = parse_line_entries(line)
        if not entries:
            continue
        
        # Assign entries to categories
        if 0 <= current_group_idx < len(category_groups):
            cat_list = category_groups[current_group_idx]
            for col_idx, entry in enumerate(entries):
                if col_idx < len(cat_list):
                    cat_name = cat_list[col_idx]
                    if cat_name not in leaders:
                        leaders[cat_name] = []
                    leaders[cat_name].append(entry)
    
    return leaders


def extract_category_leaders(pdf):
    """Extract category leaderboard projections from pages 58-60."""
    all_leaders = {}
    
    # Page 58 (index 57): 3 groups of 3 categories
    page58_groups = [
        ['Pass Att', 'INTs', 'Rush Yds'],
        ['Pass Yds', 'Sacked', 'Rush TDs'],
        ['Pass TDs', 'Carries', 'Targets']
    ]
    
    # Page 59 (index 58): 3 groups of 2 categories
    page59_groups = [
        ['Rec', 'Touches'],
        ['Rec Yds', 'Scrim Yds'],
        ['Rec TDs', 'Scrim TDs']
    ]
    
    # Page 60 (index 59): 1 group of 3 categories
    page60_groups = [
        ['Carry%', 'Target Share', 'Target Share - RBs Only']
    ]
    
    for page_idx, groups in [(57, page58_groups), (58, page59_groups), (59, page60_groups)]:
        page = pdf.pages[page_idx]
        text = page.extract_text()
        if not text:
            continue
        
        leaders = extract_page_categories(text, groups)
        for cat, players in leaders.items():
            if cat not in all_leaders:
                all_leaders[cat] = []
            all_leaders[cat].extend(players)
    
    # Deduplicate and limit
    for cat in all_leaders:
        seen = set()
        unique = []
        for p in all_leaders[cat]:
            key = (p['name'], p['team'])
            if key not in seen:
                seen.add(key)
                unique.append(p)
        all_leaders[cat] = unique[:20]
    
    return all_leaders


def extract_strength_of_schedule(pdf):
    """Extract strength of schedule from page 62."""
    page = pdf.pages[61]
    text = page.extract_text()
    if not text:
        return {}
    
    sos = {}
    for line in text.split('\n'):
        line = line.strip()
        if not line or '2026 NFL' in line or ('Rk' in line and 'Team' in line):
            continue
        
        for full_name, abbr in TEAM_FULL.items():
            if full_name in line:
                idx = line.index(full_name)
                prefix = line[:idx].strip()
                rank_match = re.search(r'(\d+)$', prefix)
                rank = int(rank_match.group(1)) if rank_match else 0
                
                rest = line[idx + len(full_name):].strip()
                schedule = rest.split()
                
                sos[abbr] = {
                    'rank': rank,
                    'team': full_name,
                    'schedule': schedule[:18] if len(schedule) >= 18 else schedule
                }
                break
    
    return sos


def main():
    print("Loading existing data...")
    with open(JSON_PATH) as f:
        data = json.load(f)
    
    pdf = pdfplumber.open(PDF_PATH)
    
    print("\nExtracting Category Leaders...")
    leaders = extract_category_leaders(pdf)
    for cat, players in leaders.items():
        print(f"  {cat}: {len(players)} players")
        if players:
            print(f"    #1: {players[0]['name']} ({players[0]['team']}) - {players[0]['value']}")
    data['category_leaders'] = leaders
    
    print("\nExtracting Strength of Schedule...")
    sos = extract_strength_of_schedule(pdf)
    print(f"  {len(sos)} teams")
    data['strength_of_schedule'] = sos
    
    pdf.close()
    
    for p in [JSON_PATH]:
        if os.path.exists(os.path.dirname(p)):
            with open(p, 'w') as f:
                json.dump(data, f, indent=2)
            size = os.path.getsize(p) / 1024
            print(f"Saved to {p} ({size:.1f} KB)")


if __name__ == '__main__':
    main()
