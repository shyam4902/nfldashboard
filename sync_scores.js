#!/usr/bin/env node
// Sync final (and in-progress) scores into schedule.json from the ESPN
// scoreboard API. Fills winner / away_score / home_score / status on games
// that have already kicked off, so the dashboard can show results the day
// after they happen instead of a permanently pregame schedule.
//
// Usage:
//   node sync_scores.js              # sync every kicked-off game still missing a result
//   node sync_scores.js --week 1     # only that week
//   node sync_scores.js --dry-run    # print what would change, write nothing
//
// Writes schedule.json and its data/shared copy (validate-data.js checks
// copy identity). Contacts a live service.
'use strict';

const fs = require('fs');
const path = require('path');
const { atomicWriteFileSync } = require('./scripts/atomic-write.js');

const ROOT = __dirname;
const TARGETS = [
  path.join(ROOT, 'schedule.json'),
  path.join(ROOT, 'data', 'shared', 'schedule.json'),
];
const API = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const weekArg = args.indexOf('--week');
const ONLY_WEEK = weekArg >= 0 ? Number(args[weekArg + 1]) : null;

// ESPN's ?dates= is the game's Eastern-time date, which is what our game_id
// prefix already encodes — a Sunday-night kickoff is 00:20Z the next day.
function etDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d).reduce((a, p) => (a[p.type] = p.value, a), {});
  return `${parts.year}${parts.month}${parts.day}`;
}

async function fetchDay(yyyymmdd) {
  const res = await fetch(API + yyyymmdd);
  if (!res.ok) throw new Error(`ESPN ${yyyymmdd}: HTTP ${res.status}`);
  const json = await res.json();
  const out = new Map();
  for (const ev of json.events || []) {
    const c = (ev.competitions || [])[0];
    if (!c) continue;
    const home = (c.competitors || []).find(x => x.homeAway === 'home');
    const away = (c.competitors || []).find(x => x.homeAway === 'away');
    if (!home || !away) continue;
    const state = ((c.status || {}).type || {}).state; // pre | in | post
    out.set(`${away.team.displayName}@${home.team.displayName}`, {
      away_score: away.score == null ? null : Number(away.score),
      home_score: home.score == null ? null : Number(home.score),
      state,
      winner: state === 'post'
        ? (home.winner ? home.team.displayName : (away.winner ? away.team.displayName : 'TIE'))
        : null,
    });
  }
  return out;
}

if (require.main !== module) { module.exports = { etDate }; return; }

(async () => {
  const schedule = JSON.parse(fs.readFileSync(TARGETS[0], 'utf8'));
  const now = Date.now();

  const pending = schedule.games.filter(g =>
    (ONLY_WEEK === null || g.week === ONLY_WEEK) &&
    new Date(g.kickoff_utc).getTime() <= now &&
    (g.winner == null || g.status === 'in_progress')
  );
  if (!pending.length) { console.log('No kicked-off games missing a result.'); return; }

  const days = [...new Set(pending.map(g => etDate(g.kickoff_utc)).filter(Boolean))].sort();
  const board = new Map();
  for (const day of days) {
    for (const [k, v] of await fetchDay(day)) board.set(k, v);
  }

  let changed = 0;
  const missed = [];
  for (const g of pending) {
    const r = board.get(`${g.away_team}@${g.home_team}`);
    if (!r || r.state === 'pre') { missed.push(g.game_id); continue; }
    g.away_score = r.away_score;
    g.home_score = r.home_score;
    g.winner = r.winner;
    g.status = r.state === 'post' ? 'final' : 'in_progress';
    changed += 1;
    console.log(`${g.game_id}  ${g.away_team} ${g.away_score} @ ${g.home_team} ${g.home_score}  [${g.status}]`);
  }
  if (missed.length) console.warn(`No ESPN result for: ${missed.join(', ')}`);
  if (!changed) { console.log('Nothing to write.'); return; }

  schedule.scores_synced_at = new Date().toISOString();
  if (DRY) { console.log(`--dry-run: ${changed} game(s) would be written.`); return; }
  const json = JSON.stringify(schedule, null, 2) + '\n';
  for (const t of TARGETS) {
    if (fs.existsSync(path.dirname(t))) atomicWriteFileSync(t, json);
  }
  console.log(`Wrote ${changed} result(s) to ${TARGETS.filter(t => fs.existsSync(t)).length} file(s).`);
})().catch(err => { console.error(err.message); process.exit(1); });
