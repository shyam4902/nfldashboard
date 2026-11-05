// Pure helpers for the NFL League tab (/nfl/#league): standings form,
// conference seeding, column sorting, the standings map layout and ESPN
// leader lines.
//
// No DOM, no network, no globals. nfl/js/league.js loads this file with a
// dynamic import(), like views.js loads nfl-lib.js. Tests:
// node --test nfl/league-lib.test.mjs
// Missing inputs give empty results or nulls, never invented numbers.

import { isFinalGame, localAbbr } from './nfl-lib.js?v=20261106a';

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function str(value) {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  return String(value);
}

function num(value) {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim().replace(/^\+/, '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function timeOf(iso) {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/* ── Formatting ─────────────────────────────────────────────────────────── */

// .857, 1.000, .000. A team with no games has a null pct and shows a dash.
export function pctText(pct) {
  const p = num(pct);
  if (p == null) return '—';
  return p.toFixed(3).replace(/^0/, '');
}

export function signedText(value) {
  const n = num(value);
  if (n == null) return '—';
  return n > 0 ? '+' + n : String(n);
}

/* ── Form: streak and last five ─────────────────────────────────────────── */

// Streak and last-five record for one team from schedule.json finals.
// `cutoffIso` is the standings artifact's generated_at, so a game finished
// after the standings were built is not counted. `expected` is the team's
// standings row: if the schedule's W-L-T up to the cutoff does not match it,
// the two sources disagree and the form is withheld (null) rather than shown
// against a different record.
export function teamForm(games, teamName, cutoffIso, expected) {
  const cutoff = timeOf(cutoffIso);
  const list = arr(games).filter((g) => isFinalGame(g) && (g.home_team === teamName || g.away_team === teamName))
    .filter((g) => cutoff == null || (timeOf(g.kickoff_utc) ?? Infinity) < cutoff)
    .slice()
    .sort((a, b) => (timeOf(b.kickoff_utc) ?? 0) - (timeOf(a.kickoff_utc) ?? 0));
  const results = list.map((g) => {
    const home = g.home_team === teamName;
    const us = Number(home ? g.home_score : g.away_score);
    const them = Number(home ? g.away_score : g.home_score);
    return us > them ? 'W' : us < them ? 'L' : 'T';
  });
  const count = (r) => results.filter((x) => x === r).length;
  if (expected && (count('W') !== expected.wins || count('L') !== expected.losses || count('T') !== (expected.ties || 0))) {
    return null;
  }
  if (!results.length) return { streak: '', last5: '', results: [] };
  let run = 1;
  while (run < results.length && results[run] === results[0]) run += 1;
  const five = results.slice(0, 5);
  const w = five.filter((x) => x === 'W').length;
  const l = five.filter((x) => x === 'L').length;
  const t = five.filter((x) => x === 'T').length;
  return {
    streak: results[0] + run,
    last5: t ? `${w}-${l}-${t}` : `${w}-${l}`,
    results,
  };
}

// W3 sorts above W1 above T1 above L1 above L4. No streak sorts last.
export function streakValue(streak) {
  const m = /^([WLT])(\d+)$/.exec(str(streak));
  if (!m) return null;
  const n = Number(m[2]);
  return m[1] === 'W' ? n : m[1] === 'L' ? -n : 0;
}

/* ── Ordering and seeding ───────────────────────────────────────────────── */

// Display order: win pct, then point differential, then points scored, then
// name. This is the artifact's own display order, not the NFL tiebreakers.
export function compareTeams(a, b) {
  const pa = num(a?.win_pct);
  const pb = num(b?.win_pct);
  if (pa == null && pb != null) return 1;
  if (pa != null && pb == null) return -1;
  if (pa != null && pb != null && pa !== pb) return pb - pa;
  const d = (num(b?.differential) ?? 0) - (num(a?.differential) ?? 0);
  if (d) return d;
  const f = (num(b?.points_for) ?? 0) - (num(a?.points_for) ?? 0);
  if (f) return f;
  return str(a?.team).localeCompare(str(b?.team));
}

// One conference as the playoff picture would read today: each division's
// best team takes seeds 1-4, everyone else follows from 5. Seeds 5-7 are the
// wild-card places. Returns [] when the conference is not in the artifact.
export function conferenceSeeds(divisions, conference) {
  const divs = arr(divisions).filter((d) => d && d.conference === conference && arr(d.teams).length);
  if (!divs.length) return [];
  const leaders = divs.map((d) => arr(d.teams).slice().sort(compareTeams)[0]);
  const leaderSet = new Set(leaders);
  const rest = divs.flatMap((d) => arr(d.teams)).filter((t) => !leaderSet.has(t)).sort(compareTeams);
  return [...leaders.sort(compareTeams), ...rest].map((team, i) => ({
    ...team,
    seed: i + 1,
    divisionLeader: i < leaders.length,
  }));
}

// Stable column sort. `valueOf(row, key)` reads the cell; rows with no value
// go last whichever way the column sorts, and ties keep their incoming order.
export function sortRows(rows, key, dir, valueOf) {
  const sign = dir === 'asc' ? 1 : -1;
  return arr(rows).map((row, i) => ({ row, i, v: valueOf(row, key) })).sort((a, b) => {
    const x = a.v;
    const y = b.v;
    if (x == null && y != null) return 1;
    if (x != null && y == null) return -1;
    if (x != null && y != null && x !== y) {
      const cmp = typeof x === 'string' ? x.localeCompare(y) : x - y;
      if (cmp) return cmp * sign;
    }
    return a.i - b.i;
  }).map((entry) => entry.row);
}

/* ── Standings map ──────────────────────────────────────────────────────── */

// Squarified treemap (Bruls, Huizing, van Wijk), same as /nba/'s Mosaic.
// Items are { v > 0, ...anything }; returns them with x, y, w, h.
export function squarify(items, x, y, w, h) {
  const out = [];
  const list = arr(items).filter((item) => item && item.v > 0);
  const total = list.reduce((sum, item) => sum + item.v, 0);
  if (!total || w <= 0 || h <= 0) return out;
  const scale = (w * h) / total;
  let rest = list.map((item) => ({ ...item, a: item.v * scale }));
  while (rest.length) {
    const short = Math.min(w, h);
    let row = [];
    let best = Infinity;
    for (const item of rest) {
      const next = [...row, item];
      const sum = next.reduce((acc, z) => acc + z.a, 0);
      const max = Math.max(...next.map((z) => z.a));
      const min = Math.min(...next.map((z) => z.a));
      const worst = Math.max((short * short * max) / (sum * sum), (sum * sum) / (short * short * min));
      if (worst > best) break;
      best = worst;
      row = next;
    }
    const sum = row.reduce((acc, z) => acc + z.a, 0);
    if (w >= h) {
      const colW = sum / h;
      let cy = y;
      for (const item of row) {
        const ch = item.a / colW;
        out.push({ ...item, x, y: cy, w: colW, h: ch });
        cy += ch;
      }
      x += colW;
      w -= colW;
    } else {
      const rowH = sum / w;
      let cx = x;
      for (const item of row) {
        const cw = item.a / rowH;
        out.push({ ...item, x: cx, y, w: cw, h: rowH });
        cx += cw;
      }
      y += rowH;
      h -= rowH;
    }
    rest = rest.slice(row.length);
  }
  return out;
}

/* ── Leaders ────────────────────────────────────────────────────────────── */

// ESPN byathlete leaderboard with each player's season line from the same
// payload. `columns` are { key, cat, name }; a column whose stat name is not
// in the payload is skipped, and a player without that value has no key in
// `line`. Ranked by the board stat, top `limit` (0 keeps all).
export function parseNflLeaderLines(json, category, stat, columns, limit = 10) {
  const categories = arr(json?.categories);
  const namesOf = (name) => arr(categories.find((entry) => str(entry?.name) === name)?.names).map(str);
  const index = namesOf(str(category)).indexOf(str(stat));
  if (index < 0) return [];
  const cols = arr(columns).map((c) => ({ ...c, at: namesOf(str(c.cat)).indexOf(str(c.name)) })).filter((c) => c.at >= 0);
  const rows = [];
  for (const entry of arr(json?.athletes)) {
    const blocks = new Map(arr(entry?.categories).map((b) => [str(b?.name), arr(b?.totals)]));
    const value = num((blocks.get(str(category)) || [])[index]);
    if (value == null) continue;
    const athlete = entry?.athlete || {};
    const line = {};
    for (const c of cols) {
      const v = num((blocks.get(str(c.cat)) || [])[c.at]);
      if (v != null) line[c.key] = v;
    }
    rows.push({
      rank: 0,
      id: str(athlete.id),
      name: str(athlete.displayName || athlete.fullName),
      teamAbbr: localAbbr(athlete.teamShortName || athlete.team?.abbreviation),
      pos: str(athlete?.position?.abbreviation),
      headshot: str(athlete?.headshot?.href),
      value,
      line,
    });
  }
  rows.sort((a, b) => b.value - a.value);
  return (limit ? rows.slice(0, limit) : rows).map((row, i) => ({ ...row, rank: i + 1 }));
}

// 1,851 for counts, 65.2 for rates.
export function statText(value) {
  const n = num(value);
  if (n == null) return '—';
  return Number.isInteger(n) ? n.toLocaleString('en-US') : n.toFixed(1);
}
