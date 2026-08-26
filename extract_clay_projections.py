#!/usr/bin/env python3
"""
Extract Mike Clay's 2026 NFL Projection Guide into structured JSON.
Uses robust parsing with header detection and number-based validation.
"""
import pdfplumber
import json
import re
import os

PDF_PATH = "/Users/shyampatel/Desktop/NFL_Main/NFLDK2026_CS_ClayProjections2026.pdf"
OUTPUT_DIR = "/Users/shyampatel/Desktop/NFL_Main"

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
ABBR_MAP = {v: k for k, v in TEAM_MAP.items()}
ABBR_TO_FULL = {k: v for k, v in TEAM_MAP.items()}

# Words that indicate header/informational lines, not player data
HEADER_WORDS = {
    'Total', 'Column', 'Quarterback', 'Running', 'Wide', 'Tight', 'Interior',
    'Edge', 'Off-ball', 'Off-Ball', 'Cornerback', 'Safety', 'Returner', 'Kicker',
    'Leaderboard', 'Projections', 'Player', 'Defender', 'Team', 'Return', 'Returns',
    'Quarterbacks', 'Receivers', 'Linebackers', 'Safeties', 'Defensive',
    'Offensive', 'Positional', 'Category', 'Team Pos', 'Wide Receiver',
}

def safe_int(v):
    try: return int(float(str(v).replace(',', '').replace('%', '').strip()))
    except: return 0

def safe_float(v):
    try: return float(str(v).replace(',', '').replace('%', '').strip())
    except: return 0.0

def is_number(s):
    """Check if string is a number (int or float)."""
    try:
        float(str(s).replace(',', '').replace('%', ''))
        return True
    except:
        return False

def find_team_abbr(parts):
    """Find team abbreviation in parts list. Returns (name, team_idx) or None."""
    for i, p in enumerate(parts):
        if p in TEAM_MAP and i > 0:
            # Make sure everything before is not a header word
            name_parts = parts[:i]
            name = ' '.join(name_parts)
            if name in HEADER_WORDS or any(w in HEADER_WORDS for w in name_parts):
                continue
            # Make sure name looks like a person name (has letters, not just numbers)
            if any(is_number(w) for w in name_parts):
                continue
            return name, i
    return None


def extract_team_projections(pdf):
    """Extract team-by-team projections (pages 2-33)."""
    teams = {}
    for page_idx in range(1, 33):
        page = pdf.pages[page_idx]
        text = page.extract_text()
        if not text:
            continue

        lines = text.split('\n')
        m = re.match(r'2026 (.+?) Projections', lines[0])
        team_name = m.group(1) if m else f'Team_{page_idx}'

        team_data = {
            'name': team_name, 'abbr': ABBR_MAP.get(team_name, ''),
            'offense': [], 'defense': [], 'weekly_projections': [],
            'projected_wins': None, 'nfl_rank': None, 'sos_ranking': None,
            'unit_grades': {},
        }

        m = re.search(r'PROJECTED WINS:\s*([\d.]+)\s*\(NFL RANK:\s*(\d+)\)', text)
        if m:
            team_data['projected_wins'] = float(m.group(1))
            team_data['nfl_rank'] = int(m.group(2))

        m = re.search(r'Strength of Schedule Ranking:\s*(\d+)', text)
        if m:
            team_data['sos_ranking'] = int(m.group(1))

        unit_start = text.find('UNIT')
        if unit_start >= 0:
            for m in re.finditer(r'(QB|RB|WR|TE|OL|DI|ED|LB|CB|S)\s+(\d+)', text[unit_start:unit_start+500]):
                pos, grade = m.group(1), int(m.group(2))
                if pos not in team_data['unit_grades']:
                    team_data['unit_grades'][pos] = grade

        for line in lines[3:]:
            line = line.strip()
            if not line or 'UNIT' in line or 'PROJECTED' in line or 'Strength' in line:
                continue

            # Skip header lines
            if any(line.startswith(w) for w in ['Pos Player', 'Pos Player', 'Wk Opp']):
                continue

            # Split at first defensive position marker (DI, ED, LB, CB, S)
            # But only if it's preceded by a number (part of defense stats)
            def_match = re.search(r'(\d+)\s+(DI|ED|LB|CB|S)\s+', line)
            if def_match:
                off_part = line[:def_match.start() + len(def_match.group(1))]
                def_start = def_match.start() + len(def_match.group(1))
                def_part = line[def_start:]
            else:
                off_part = line
                def_part = ''

            # Parse offense
            off_parts = off_part.split()
            if len(off_parts) >= 15 and off_parts[0] in ['QB', 'RB', 'WR', 'TE'] and off_parts[-1].isdigit():
                pos = off_parts[0]
                # Find where numbers start
                num_start = 1
                while num_start < len(off_parts) and not is_number(off_parts[num_start]):
                    num_start += 1
                name = ' '.join(off_parts[1:num_start])
                nums = off_parts[num_start:]
                try:
                    team_data['offense'].append({
                        'pos': pos, 'name': name,
                        'games': safe_int(nums[0]),
                        'pass_att': safe_int(nums[1]), 'pass_comp': safe_int(nums[2]),
                        'pass_yds': safe_int(nums[3]), 'pass_td': safe_int(nums[4]),
                        'pass_int': safe_int(nums[5]), 'sacks_taken': safe_int(nums[6]),
                        'rush_att': safe_int(nums[7]), 'rush_yds': safe_int(nums[8]),
                        'rush_td': safe_int(nums[9]), 'targets': safe_int(nums[10]),
                        'rec': safe_int(nums[11]), 'rec_yds': safe_int(nums[12]),
                        'rec_td': safe_int(nums[13]),
                        'ppr_pts': safe_int(nums[14]) if len(nums) > 14 else 0,
                        'ppr_rank': safe_int(nums[15]) if len(nums) > 15 else 0,
                    })
                except:
                    pass

            # Parse defense
            if def_part:
                def_parts = def_part.split()
                if len(def_parts) >= 8 and def_parts[0] in ['DI', 'ED', 'LB', 'CB', 'S']:
                    try:
                        team_data['defense'].append({
                            'pos': def_parts[0],
                            'name': ' '.join(def_parts[1:-7]),
                            'snaps': safe_int(def_parts[-7]),
                            'tackles': safe_float(def_parts[-6]),
                            'sacks': safe_float(def_parts[-5]),
                            'interceptions': safe_float(def_parts[-4]),
                            'ff': safe_float(def_parts[-3]),
                            'rank': safe_int(def_parts[-1]),
                        })
                    except:
                        pass

                wk = re.search(r'(\d+)\s+([A-Z]{2,4})\s+([HV])\s+([\d.]+)\s+([\d.]+)\s+(\d+%)', def_part)
                if wk:
                    team_data['weekly_projections'].append({
                        'week': int(wk.group(1)),
                        'opponent': ABBR_TO_FULL.get(wk.group(2), wk.group(2)),
                        'opp_abbr': wk.group(2),
                        'location': wk.group(3),
                        'team_score': float(wk.group(4)),
                        'opp_score': float(wk.group(5)),
                        'win_probability': wk.group(6),
                    })

        teams[team_name] = team_data
    return teams


def parse_positional_page(pdf, page_indices, pos_name, columns):
    """Generic positional parser using team abbreviation detection."""
    players = []
    for page_idx in page_indices:
        page = pdf.pages[page_idx]
        text = page.extract_text()
        if not text:
            continue

        for line in text.split('\n'):
            line = line.strip()
            if not line:
                continue

            parts = line.split()
            if len(parts) < 5:
                continue

            # Skip header/informational lines
            if any(line.startswith(w) for w in HEADER_WORDS):
                continue
            if parts[0] in HEADER_WORDS:
                continue
            # Skip lines that are mostly text headers
            text_count = sum(1 for p in parts if not is_number(p.replace('%', '')))
            if text_count > 4:  # Too many text parts = likely header
                continue

            result = find_team_abbr(parts)
            if not result:
                continue

            name, team_idx = result
            nums = parts[team_idx + 1:]

            # Clean percentages
            clean_nums = []
            for n in nums:
                clean_nums.append(n.replace('%', ''))

            if len(clean_nums) < len(columns):
                continue

            player = {
                'pos': pos_name,
                'name': name,
                'team_abbr': parts[team_idx],
                'team': ABBR_TO_FULL.get(parts[team_idx], parts[team_idx]),
            }

            for i, col in enumerate(columns):
                val = clean_nums[i]
                if col.endswith('_pct'):
                    player[col] = val + '%'
                elif is_number(val):
                    player[col] = float(val) if '.' in val else int(val)
                else:
                    player[col] = val

            players.append(player)

    return players


def extract_positional_projections(pdf):
    """Extract all positional projections."""
    positions = {}

    positions['QB'] = parse_positional_page(pdf, [34], 'QB',
        ['pos_rank', 'ff_pts', 'games', 'pass_att', 'pass_comp', 'pass_yds',
         'pass_td', 'interceptions', 'sacks_taken', 'rush_att', 'rush_yds', 'rush_td'])

    positions['RB'] = parse_positional_page(pdf, [35, 36, 37], 'RB',
        ['pos_rank', 'ff_pts', 'games', 'carries', 'rush_yds', 'rush_td',
         'targets', 'rec', 'rec_yds', 'rec_td', 'carry_pct', 'target_pct'])

    positions['WR'] = parse_positional_page(pdf, [38, 39, 40, 41, 42], 'WR',
        ['pos_rank', 'ff_pts', 'games', 'carries', 'rush_yds', 'rush_td',
         'targets', 'rec', 'rec_yds', 'rec_td', 'carry_pct', 'target_pct'])

    positions['TE'] = parse_positional_page(pdf, [43, 44], 'TE',
        ['pos_rank', 'ff_pts', 'games', 'carries', 'rush_yds', 'rush_td',
         'targets', 'rec', 'rec_yds', 'rec_td', 'carry_pct', 'target_pct'])

    positions['IDL'] = parse_positional_page(pdf, [45, 46], 'IDL',
        ['pos_rank', 'ff_pts', 'snaps', 'total_tackles', 'solo_tackles', 'assists',
         'tfl', 'sacks', 'interceptions', 'ff'])

    positions['EDGE'] = parse_positional_page(pdf, [47, 48], 'EDGE',
        ['pos_rank', 'ff_pts', 'snaps', 'total_tackles', 'solo_tackles', 'assists',
         'tfl', 'sacks', 'interceptions', 'ff'])

    positions['LB'] = parse_positional_page(pdf, [49, 50], 'LB',
        ['pos_rank', 'ff_pts', 'snaps', 'total_tackles', 'solo_tackles', 'assists',
         'tfl', 'sacks', 'interceptions', 'ff'])

    positions['CB'] = parse_positional_page(pdf, [51, 52], 'CB',
        ['pos_rank', 'ff_pts', 'snaps', 'total_tackles', 'solo_tackles', 'assists',
         'tfl', 'sacks', 'interceptions', 'ff'])

    positions['S'] = parse_positional_page(pdf, [53, 54], 'S',
        ['pos_rank', 'ff_pts', 'snaps', 'total_tackles', 'solo_tackles', 'assists',
         'tfl', 'sacks', 'interceptions', 'ff'])

    positions['RET'] = parse_positional_page(pdf, [55], 'RET',
        ['kr_att', 'kr_yds', 'kr_td', 'pr_att', 'pr_yds', 'pr_td',
         'total_att', 'total_yds', 'total_td'])

    positions['K'] = parse_positional_page(pdf, [56], 'K',
        ['ff_pts', 'fg_made', 'fg_att', 'fg_pct', 'xp_made', 'xp_att', 'xp_pct'])

    return positions


def extract_standings(pdf):
    """Extract projected standings (page 61)."""
    page = pdf.pages[60]
    text = page.extract_text()
    if not text:
        return {}

    standings = {'divisions': {}, 'draft_order': []}
    current_div = None

    for line in text.split('\n'):
        line = line.strip()
        if not line:
            continue

        # Check for division header
        div_match = re.match(r'^(AFC|NFC)\s+([ENSW]+)', line)
        if div_match:
            current_div = f'{div_match.group(1)} {div_match.group(2)}'
            standings['divisions'][current_div] = []
            rest = line[div_match.end():].strip()
            if rest:
                line = rest
            else:
                continue

        if current_div:
            # Team name should be at the START of the line (after possible division prefix)
            for full_name in sorted(TEAM_MAP.values(), key=len, reverse=True):
                if line.startswith(full_name):
                    rest = line[len(full_name):].strip().split()
                    if len(rest) >= 6:
                        try:
                            standings['divisions'][current_div].append({
                                'name': full_name, 'abbr': ABBR_MAP.get(full_name, ''),
                                'wins': float(rest[0]), 'losses': float(rest[1]),
                                'favored_games': safe_int(rest[2]),
                                'pf': safe_int(rest[3]), 'pa': safe_int(rest[4]),
                                'diff': safe_int(rest[5]),
                                'sos_rank': safe_int(rest[6]) if len(rest) > 6 else 0,
                                'projected_wins': safe_float(rest[7]) if len(rest) > 7 else 0,
                            })
                        except:
                            pass
                    break

    draft_section = text[text.find('Draft Order'):] if 'Draft Order' in text else ''
    for m in re.finditer(r'(\d+)\s+(.+?)\s+([\d.]+)\s+([\d.]+)', draft_section):
        standings['draft_order'].append({
            'pick': safe_int(m.group(1)), 'team': m.group(2).strip(),
            'wins': safe_float(m.group(3)), 'losses': safe_float(m.group(4)),
        })

    return standings


def extract_unit_grades(pdf):
    """Extract unit grades (page 63)."""
    page = pdf.pages[62]
    text = page.extract_text()
    if not text:
        return {}

    grades = {}
    for line in text.split('\n'):
        line = line.strip()
        if not line or 'Grade' in line or 'Team' in line:
            continue
        for full_name in TEAM_MAP.values():
            if full_name in line:
                idx = line.index(full_name) + len(full_name)
                rest = line[idx:].strip().split()
                if len(rest) >= 16:
                    try:
                        grades[full_name] = {
                            'QB': safe_int(rest[0]), 'RB': safe_int(rest[1]),
                            'WR': safe_int(rest[2]), 'TE': safe_int(rest[3]),
                            'OL': safe_int(rest[4]), 'DI': safe_int(rest[5]),
                            'ED': safe_int(rest[6]), 'LB': safe_int(rest[7]),
                            'CB': safe_int(rest[8]), 'S': safe_int(rest[9]),
                            'total_grade': safe_float(rest[10]),
                            'total_rank': safe_int(rest[11]),
                            'offense_grade': safe_float(rest[12]),
                            'offense_rank': safe_int(rest[13]),
                            'defense_grade': safe_float(rest[14]),
                            'defense_rank': safe_int(rest[15]),
                        }
                    except:
                        pass
                break
    return grades


def extract_unit_ranks(pdf):
    """Extract positional unit ranks (pages 64-73)."""
    unit_ranks = {}
    position_names = {
        63: 'QB', 64: 'RB', 65: 'WR', 66: 'TE', 67: 'OL',
        68: 'IDL', 69: 'EDGE', 70: 'LB', 71: 'CB', 72: 'S'
    }

    for page_idx, pos_name in position_names.items():
        page = pdf.pages[page_idx]
        text = page.extract_text()
        if not text:
            continue

        ranks = []
        for line in text.split('\n'):
            line = line.strip()
            if not line or 'Grade' in line or 'Team' in line or 'Depth' in line:
                continue
            m = re.match(r'(\d+)\s+(.+)', line)
            if m:
                grade = safe_int(m.group(1))
                rest = m.group(2).strip()
                for full_name in TEAM_MAP.values():
                    if full_name in rest:
                        depth = rest.replace(full_name, '').strip()
                        ranks.append({
                            'team': full_name, 'abbr': ABBR_MAP.get(full_name, ''),
                            'grade': grade, 'depth': depth,
                        })
                        break
        unit_ranks[pos_name] = sorted(ranks, key=lambda x: -x['grade'])

    return unit_ranks


def extract_coaching_staffs(pdf):
    """Extract coaching staffs (page 74)."""
    page = pdf.pages[73]
    text = page.extract_text()
    if not text:
        return []

    staffs = []
    for line in text.split('\n'):
        line = line.strip()
        if not line or line.startswith('Tm '):
            continue
        for abbr, full_name in TEAM_MAP.items():
            if line.startswith(abbr):
                rest = line[len(abbr):].strip()
                parts = rest.split()
                if len(parts) >= 9:
                    staffs.append({
                        'team': full_name, 'abbr': abbr,
                        'head_coach': f'{parts[0]} {parts[1]}',
                        'offensive_coord': f'{parts[2]} {parts[3]}',
                        'offensive_playcaller': f'{parts[4]} {parts[5]}',
                        'defensive_coord': f'{parts[6]} {parts[7]}',
                        'gm': f'{parts[8]} {parts[9]}' if len(parts) > 9 else parts[8],
                    })
                break
    return staffs


def extract_projected_starters(pdf):
    """Extract projected starters with ratings (pages 75-82)."""
    starters = {}
    conf_divs = {
        74: 'NFC East', 75: 'NFC North', 76: 'NFC South', 77: 'NFC West',
        78: 'AFC East', 79: 'AFC North', 80: 'AFC South', 81: 'AFC West'
    }

    for page_idx, conf_div in conf_divs.items():
        page = pdf.pages[page_idx]
        text = page.extract_text()
        if not text:
            continue
        starters[conf_div] = {}

        for abbr, full_name in TEAM_MAP.items():
            team_starters = []
            for m in re.finditer(r'(QB|RB|WR|TE|LT|LG|C|RG|RT|DI|ED|LB|CB|S)(\d)\s+([A-Za-z\s\'\.]+?)\s+(\d+)', text):
                start = max(0, m.start() - 200)
                if abbr in text[start:m.start()]:
                    team_starters.append({
                        'position': m.group(1), 'depth': int(m.group(2)),
                        'name': m.group(3).strip(), 'rating': safe_int(m.group(4)),
                    })
            if team_starters:
                starters[conf_div][full_name] = team_starters

    return starters


def main():
    print("Opening PDF...")
    pdf = pdfplumber.open(PDF_PATH)
    print(f"Total pages: {len(pdf.pages)}")

    print("\n1. Team projections...")
    team_projections = extract_team_projections(pdf)
    for t, d in list(team_projections.items())[:3]:
        print(f"   {t}: {len(d['offense'])} off, {len(d['defense'])} def, {len(d['weekly_projections'])} weeks")
    print(f"   Total: {len(team_projections)} teams")

    print("\n2. Positional projections...")
    positional = extract_positional_projections(pdf)
    for pos, players in positional.items():
        print(f"   {pos}: {len(players)} players")

    print("\n3. Standings...")
    standings = extract_standings(pdf)
    div_count = len(standings.get('divisions', {}))
    team_count = sum(len(v) for v in standings.get('divisions', {}).values())
    print(f"   {div_count} divisions, {team_count} teams")

    print("\n4. Unit grades...")
    unit_grades = extract_unit_grades(pdf)
    print(f"   {len(unit_grades)} teams")

    print("\n5. Unit ranks...")
    unit_ranks = extract_unit_ranks(pdf)
    for pos, ranks in unit_ranks.items():
        print(f"   {pos}: {len(ranks)} teams")

    print("\n6. Coaching staffs...")
    coaching = extract_coaching_staffs(pdf)
    print(f"   {len(coaching)} teams")

    print("\n7. Projected starters...")
    starters = extract_projected_starters(pdf)
    total = sum(len(s) for d in starters.values() for s in d.values())
    print(f"   {total} starters across {len(starters)} divisions")

    pdf.close()

    # Rebuild team defense from positional projections (PDF text merges columns,
    # so the raw defense parse is unreliable). The positional pages parse cleanly.
    print("\n8. Rebuilding team defense from positional projections...")
    pos_lookup = {}
    pos_map = {'IDL': 'DI', 'EDGE': 'ED', 'LB': 'LB', 'CB': 'CB', 'S': 'S'}
    for pos_group in ['IDL', 'EDGE', 'LB', 'CB', 'S']:
        for p in positional.get(pos_group, []):
            key = p.get('team_abbr', '')
            if key not in pos_lookup:
                pos_lookup[key] = []
            pos_lookup[key].append(p)

    for team_name, td in team_projections.items():
        abbr = td.get('abbr', '')
        if not abbr or abbr not in pos_lookup:
            continue
        team_def = []
        for pos_group in ['IDL', 'EDGE', 'LB', 'CB', 'S']:
            for p in pos_lookup.get(abbr, []):
                if p.get('pos') == pos_group:
                    team_def.append({
                        'pos': pos_map.get(pos_group, pos_group),
                        'name': p['name'],
                        'snaps': p['snaps'],
                        'tackles': p['total_tackles'],
                        'sacks': p['sacks'],
                        'interceptions': p['interceptions'],
                        'fumbles_forced': p['ff'],
                        'rank': p['pos_rank'],
                    })
        team_def.sort(key=lambda x: x['rank'])
        # Add position-group totals
        final_def = []
        for pos_group in ['DI', 'ED', 'LB', 'CB', 'S']:
            group = [p for p in team_def if p['pos'] == pos_group]
            if group:
                final_def.extend(group)
                final_def.append({
                    'pos': 'Total', 'name': f'{pos_group} Total',
                    'snaps': sum(p['snaps'] for p in group),
                    'tackles': sum(p['tackles'] for p in group),
                    'sacks': round(sum(p['sacks'] for p in group), 1),
                    'interceptions': round(sum(p['interceptions'] for p in group), 1),
                    'fumbles_forced': round(sum(p['fumbles_forced'] for p in group), 1),
                    'rank': 0,
                })
        td['defense'] = final_def
    print(f"   Rebuilt defense for {len(team_projections)} teams")

    all_data = {
        'team_projections': team_projections,
        'positional_projections': positional,
        'standings': standings,
        'unit_grades': unit_grades,
        'unit_ranks': unit_ranks,
        'coaching_staffs': coaching,
        'projected_starters': starters,
        'metadata': {
            'source': "Mike Clay's 2026 NFL Projection Guide",
            'updated': '8/19/2026',
        }
    }

    output_path = os.path.join(OUTPUT_DIR, 'nfldashboard', 'clay_projections_2026.json')
    with open(output_path, 'w') as f:
        json.dump(all_data, f, indent=2)
    print(f"\nSaved to {output_path}")
    print(f"Size: {os.path.getsize(output_path) / 1024:.1f} KB")
    print("Done!")


if __name__ == '__main__':
    main()
