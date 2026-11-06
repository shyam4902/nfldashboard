#!/usr/bin/env node
// Build data/shared/nfl_snaps_2026.json: who actually plays, per team.
//
// Source: nflverse snap_counts_<season>.csv (free, keyless, sourced from
// Pro Football Reference box scores, refreshed by nflverse after each week).
// Regular-season rows only.
//
// Per team, per player:
//   season  share of the team's offensive (or defensive) snaps across every
//           game the team has played, 0-100. A game the player missed counts
//           as 0, so a mid-season arrival starts low; last3 shows his role now.
//   last3   the same share over the team's last three games.
//   weekly  his % in each of the team's games, aligned to `weeks`.
// Team snaps in a game = the most snaps any one player on that unit logged
// (the five linemen and the QB play every offensive snap).
//
// A build either writes a complete artifact or writes nothing, so the last
// good file survives an upstream failure.
//
// Usage: node scripts/build_snap_counts.js [--season 2026] [--csv <file>] [--dry-run]
'use strict';

const fs = require('fs');
const path = require('path');
const { atomicWriteFileSync } = require('./atomic-write.js');

const DEFAULT_SEASON = 2026;
const csvUrl = (season) =>
  `https://github.com/nflverse/nflverse-data/releases/download/snap_counts/snap_counts_${season}.csv`;
// Same codes the site's team table uses (nfl/nfl-lib.js TO_LOCAL).
const TO_LOCAL = { WSH: 'WAS', LA: 'LAR', JAC: 'JAX' };
const MIN_SHARE = 3; // drop players under 3% on both measures (special-teamers)

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  const [head, ...body] = rows;
  return body.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}

const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

function buildSnaps(rows, { season = DEFAULT_SEASON, generatedAt = new Date().toISOString() } = {}) {
  const teams = new Map(); // abbr -> { games: Map(gameId -> {week, off, def}), players: Map }
  for (const r of rows) {
    if (r.game_type !== 'REG' || Number(r.season) !== season) continue;
    const abbr = TO_LOCAL[r.team] || r.team;
    const week = Number(r.week);
    const off = Number(r.offense_snaps) || 0;
    const def = Number(r.defense_snaps) || 0;
    if (!abbr || !r.game_id || !Number.isFinite(week)) continue;
    if (!teams.has(abbr)) teams.set(abbr, { games: new Map(), players: new Map() });
    const t = teams.get(abbr);
    const g = t.games.get(r.game_id) || { week, off: 0, def: 0 };
    g.off = Math.max(g.off, off);
    g.def = Math.max(g.def, def);
    t.games.set(r.game_id, g);
    const key = r.pfr_player_id || r.player;
    const p = t.players.get(key) || { id: r.pfr_player_id || null, name: r.player, pos: r.position || '', games: new Map() };
    if (r.position) p.pos = r.position;
    p.games.set(r.game_id, { off, def });
    t.players.set(key, p);
  }

  let throughWeek = 0;
  const out = {};
  for (const [abbr, t] of [...teams].sort(([a], [b]) => a.localeCompare(b))) {
    const games = [...t.games].sort((a, b) => a[1].week - b[1].week);
    const last3 = games.slice(-3);
    throughWeek = Math.max(throughWeek, games.length ? games[games.length - 1][1].week : 0);
    const sum = (list, unit) => list.reduce((n, [, g]) => n + g[unit], 0);
    const players = [];
    for (const p of t.players.values()) {
      const mine = (list, unit) => list.reduce((n, [id]) => n + ((p.games.get(id) || {})[unit] || 0), 0);
      const unit = mine(games, 'off') >= mine(games, 'def') ? 'off' : 'def';
      const season = pct(mine(games, unit), sum(games, unit));
      const recent = pct(mine(last3, unit), sum(last3, unit));
      if (season < MIN_SHARE && recent < MIN_SHARE) continue;
      players.push({
        id: p.id, name: p.name, pos: p.pos, unit,
        season, last3: recent,
        snaps: mine(games, unit),
        weekly: games.map(([id, g]) => pct((p.games.get(id) || {})[unit] || 0, g[unit])),
      });
    }
    players.sort((a, b) => b.last3 - a.last3 || b.season - a.season || a.name.localeCompare(b.name));
    out[abbr] = { weeks: games.map(([, g]) => g.week), players };
  }

  return {
    artifact: 'nfl_snaps',
    season,
    generated_at: generatedAt,
    through_week: throughWeek,
    source: 'nflverse snap_counts (Pro Football Reference box scores), regular season',
    teams: out,
  };
}

function validate(artifact) {
  const n = Object.keys(artifact.teams).length;
  if (n !== 32) throw new Error(`snaps: expected 32 teams, got ${n}`);
  for (const [abbr, t] of Object.entries(artifact.teams)) {
    if (!t.players.length) throw new Error(`snaps: ${abbr} has no players`);
  }
}

async function main(argv) {
  const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
  const season = Number(arg('--season')) || DEFAULT_SEASON;
  const csvPath = arg('--csv');
  let text;
  if (csvPath) text = fs.readFileSync(csvPath, 'utf8');
  else {
    const res = await fetch(csvUrl(season), { headers: { 'User-Agent': 'matchupboard-snap-sync' } });
    if (!res.ok) throw new Error(`snaps: ${csvUrl(season)} returned ${res.status}`);
    text = await res.text();
  }
  const artifact = buildSnaps(parseCsv(text), { season });
  validate(artifact);
  const dest = path.join(__dirname, '..', 'data', 'shared', `nfl_snaps_${season}.json`);
  // Rewriting only on a data change keeps quiet runs from committing a new timestamp.
  if (fs.existsSync(dest)) {
    const prev = JSON.parse(fs.readFileSync(dest, 'utf8'));
    if (JSON.stringify(prev.teams) === JSON.stringify(artifact.teams)) {
      console.log(`snaps: unchanged through week ${artifact.through_week}`);
      return;
    }
  }
  if (argv.includes('--dry-run')) {
    console.log(`snaps: would write ${dest} through week ${artifact.through_week}`);
    return;
  }
  atomicWriteFileSync(dest, JSON.stringify(artifact) + '\n');
  console.log(`snaps: wrote ${dest} through week ${artifact.through_week}`);
}

module.exports = { parseCsv, buildSnaps, validate };

if (require.main === module) {
  main(process.argv.slice(2)).catch(err => { console.error(err.message); process.exit(1); });
}
