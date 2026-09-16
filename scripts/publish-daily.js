#!/usr/bin/env node
// Daily dashboard publisher.
//
// The daily producer pipeline writes into the launchd runtime tree, and a git
// push is the only thing that actually ships the public dashboard (Cloudflare
// Pages builds this repo). The Mac's own checkout lives on the Desktop, which
// macOS TCC denies to background jobs — so this publisher works in an ISOLATED
// checkout under Application Support instead:
//
//   1. update the isolated checkout from origin/main
//   2. copy ONLY the artifacts the daily pipeline owns (props board, freshness
//      manifest, pipeline status) — never schedule.json, whose scores belong to
//      the score workflow and may be newer than the runtime copy
//   3. rebuild the standings + current-season statistics artifacts
//   4. validate every data asset
//   5. commit the changed files (never a force push, never an overwrite)
//   6. push, rebasing onto origin/main if the score workflow pushed meanwhile
//   7. verify the deployed artifacts match what was pushed
//
// A failure anywhere before the commit leaves the last published output alone.
// Run from the isolated checkout: node scripts/publish-daily.js --root <dir>
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('node:child_process');

const PUBLIC_BASE = process.env.PUBLISH_PUBLIC_BASE || 'https://nfldashboard.pages.dev';
const COMMIT_FOOTER = [
  'Generated with Codebuff 🤖',
  'Co-Authored-By: Codebuff <noreply@codebuff.com>',
].join('\n');

// Artifacts this pipeline owns. `dest` entries are repo-relative paths in the
// checkout; a source is resolved from the runtime tree (dashboard dir first,
// then the shared layer). schedule.json / nfl_rosters_2026.json are
// deliberately absent: the score workflow and the roster sync own them, and
// copying the runtime copies would roll back newer published scores.
const PRODUCER_ARTIFACTS = [
  { name: 'props-board.json', dest: ['props-board.json', 'data/shared/props-board.json'], required: true },
  { name: 'team_season_efficiency.json', dest: ['team_season_efficiency.json', 'data/shared/team_season_efficiency.json'] },
  { name: 'team_tendencies_2025.json', dest: ['team_tendencies_2025.json', 'data/shared/team_tendencies_2025.json'] },
  { name: 'clay_projections_2026.json', dest: ['clay_projections_2026.json', 'data/shared/clay_projections_2026.json'] },
  { name: 'freshness.json', dest: ['data/shared/freshness.json'] },
  { name: 'pipeline-status.json', dest: ['data/shared/pipeline-status.json'] },
];

// Files the publisher is allowed to stage. Anything else in the working tree is
// left untouched and never committed.
const STAGED_PATHS = [
  'props-board.json',
  'data/shared/props-board.json',
  'team_season_efficiency.json',
  'data/shared/team_season_efficiency.json',
  'team_tendencies_2025.json',
  'data/shared/team_tendencies_2025.json',
  'clay_projections_2026.json',
  'data/shared/clay_projections_2026.json',
  'data/shared/freshness.json',
  'data/shared/pipeline-status.json',
  'nfl_standings_2026.json',
  'data/shared/nfl_standings_2026.json',
  'nfl_stats_2026.json',
  'data/shared/nfl_stats_2026.json',
];

const log = (msg) => console.log(`[publish] ${msg}`);

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function parseArgs(args) {
  const opts = {
    root: path.join(__dirname, '..'),
    runtime: process.env.NFL_PROPS_RUNTIME_ROOT
      || path.join(process.env.HOME || '.', 'Library', 'Application Support', 'nfldashboard-props'),
    season: 2026,
    dryRun: false,
    verify: true,
    node: process.env.NODE || process.execPath,
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--root') opts.root = path.resolve(args[++i]);
    else if (arg === '--runtime') opts.runtime = path.resolve(args[++i]);
    else if (arg === '--season') opts.season = Number(args[++i]);
    else if (arg === '--node') opts.node = args[++i];
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--no-verify') opts.verify = false;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return opts;
}

function makeGit(root) {
  return function git(args, { allowFailure = false, timeout = 120000 } = {}) {
    const res = spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout });
    if (res.error) throw new Error(`git ${args.join(' ')}: ${res.error.message}`);
    if (res.status !== 0 && !allowFailure) {
      throw new Error(`git ${args.join(' ')} failed: ${(res.stderr || res.stdout || '').trim()}`);
    }
    return res;
  };
}

function runNode(node, script, args, cwd) {
  const res = spawnSync(node, [script, ...args], { cwd, encoding: 'utf8', timeout: 300000 });
  return {
    ok: res.status === 0,
    status: res.status,
    output: `${res.stdout || ''}${res.stderr || ''}`.trim(),
  };
}

// ── steps ───────────────────────────────────────────────────────────────────

function updateCheckout(git, root) {
  const branch = (git(['rev-parse', '--abbrev-ref', 'HEAD']).stdout || '').trim();
  if (branch !== 'main') {
    if (branch === 'HEAD') git(['checkout', 'main']);
    else throw new Error(`isolated checkout is on "${branch}", expected main`);
  }
  git(['fetch', 'origin', 'main']);
  const ahead = Number((git(['rev-list', '--count', 'origin/main..HEAD']).stdout || '0').trim());
  const behind = Number((git(['rev-list', '--count', 'HEAD..origin/main']).stdout || '0').trim());
  if (ahead && behind) {
    // A previous run committed but never pushed; replay it on the new tip.
    log(`${ahead} local commit(s) and ${behind} upstream commit(s) — rebasing`);
    git(['rebase', 'origin/main']);
  } else if (behind) {
    git(['merge', '--ff-only', 'origin/main']);
    log(`fast-forwarded to origin/main (${behind} commit(s))`);
  } else {
    log('checkout already at origin/main');
  }
}

function resolveSource(runtime, name) {
  const candidates = [
    path.join(runtime, 'nfldashboard', name),
    path.join(runtime, 'data', 'shared', name),
  ];
  return candidates.find((file) => fs.existsSync(file)) || null;
}

function copyProducerArtifacts({ runtime, root, dryRun }) {
  const copied = [];
  const skipped = [];
  for (const artifact of PRODUCER_ARTIFACTS) {
    const src = resolveSource(runtime, artifact.name);
    if (!src) {
      if (artifact.required) throw new Error(`required producer artifact missing from the runtime: ${artifact.name}`);
      skipped.push(`${artifact.name} (absent from runtime)`);
      continue;
    }
    for (const rel of artifact.dest) {
      const dst = path.join(root, rel);
      if (fs.existsSync(dst) && sha256(dst) === sha256(src)) continue;
      // Never roll a timestamped artifact backwards: an older runtime board
      // (e.g. a stale reinstall) must not replace a newer published one.
      const srcVintage = readJson(src)?.generated_at;
      const dstVintage = fs.existsSync(dst) ? readJson(dst)?.generated_at : null;
      if (srcVintage && dstVintage && Date.parse(srcVintage) < Date.parse(dstVintage)) {
        skipped.push(`${rel} (runtime copy is older: ${srcVintage} < ${dstVintage})`);
        continue;
      }
      if (dryRun) { copied.push(`${rel} (dry-run)`); continue; }
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
      copied.push(rel);
    }
  }
  return { copied, skipped };
}

// Prefer the checkout's builder, but fall back to the copy beside this file:
// on the very first run the isolated checkout is at origin/main, which may not
// carry the builder yet.
function leagueBuilder(root) {
  const inCheckout = path.join(root, 'scripts', 'build_league_data.js');
  return fs.existsSync(inCheckout) ? inCheckout : path.join(__dirname, 'build_league_data.js');
}

function buildLeagueData({ node, root, season, dryRun }) {
  const args = ['--root', root, '--season', String(season)];
  if (dryRun) args.push('--dry-run');
  const res = runNode(node, leagueBuilder(root), args, root);
  if (!res.ok) throw new Error(`league data build failed (exit ${res.status}):\n${res.output}`);
  for (const line of res.output.split('\n')) log(`  ${line}`);
  return res.output;
}

function validate({ node, root }) {
  const res = runNode(node, path.join(root, 'scripts', 'validate-data.js'), [], root);
  for (const line of res.output.split('\n')) log(`  ${line}`);
  if (!res.ok) throw new Error(`data validation failed:\n${res.output}`);
  return res.output;
}

// Stage only the allow-listed paths, then report what actually changed.
function stageAndCommit({ git, root, dryRun }) {
  const changed = [];
  for (const rel of STAGED_PATHS) {
    const res = git(['status', '--porcelain', '--', rel], { allowFailure: true });
    if ((res.stdout || '').trim()) changed.push(rel);
  }
  if (!changed.length) return { changed, committed: false };
  if (dryRun) return { changed, committed: false, dryRun: true };

  git(['add', '--', ...STAGED_PATHS]);
  const staged = (git(['diff', '--cached', '--name-only']).stdout || '').trim();
  if (!staged) return { changed, committed: false };

  const season = readJson(path.join(root, 'nfl_standings_2026.json'))?.season || '';
  const message = [
    `data: publish daily dashboard output${season ? ` (${season})` : ''}`,
    '',
    'Producer export, freshness manifest, actual standings, and current-season',
    'player/team statistics, published by the daily pipeline publisher.',
    '',
    COMMIT_FOOTER,
  ].join('\n');
  git(['commit', '-m', message]);
  log(`committed ${staged.split('\n').length} file(s)`);
  return { changed, committed: true };
}

function push({ git }) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = git(['push', 'origin', 'HEAD:main'], { allowFailure: true });
    if (res.status === 0) {
      log(`pushed to origin/main (attempt ${attempt})`);
      return true;
    }
    const err = `${res.stderr || res.stdout || ''}`.trim();
    log(`push attempt ${attempt} failed: ${err.split('\n').slice(-2).join(' ')}`);
    // Someone else (the score workflow) moved main. Replay our commit on top
    // and retry — never force.
    git(['fetch', 'origin', 'main']);
    const rebase = git(['rebase', 'origin/main'], { allowFailure: true });
    if (rebase.status !== 0) {
      git(['rebase', '--abort'], { allowFailure: true });
      throw new Error(`rebase onto origin/main failed: ${(rebase.stderr || '').trim()}`);
    }
  }
  throw new Error('push failed after 3 attempts');
}

async function verifyDeployed({ root, attempts = 20, delayMs = 15000 }) {
  const targets = [
    'props-board.json',
    'data/shared/freshness.json',
    'data/shared/nfl_standings_2026.json',
    'data/shared/nfl_stats_2026.json',
  ].filter((rel) => fs.existsSync(path.join(root, rel)));
  let pending = targets.slice();
  for (let attempt = 1; attempt <= attempts && pending.length; attempt++) {
    const stillPending = [];
    for (const rel of pending) {
      const local = sha256(path.join(root, rel));
      try {
        const res = await fetch(`${PUBLIC_BASE}/${rel}?cb=${Date.now()}`, {
          cache: 'no-store',
          signal: AbortSignal.timeout(20000),
        });
        if (!res.ok) { stillPending.push(rel); continue; }
        const body = Buffer.from(await res.arrayBuffer());
        const remote = crypto.createHash('sha256').update(body).digest('hex');
        if (remote !== local) { stillPending.push(rel); continue; }
        log(`verified deployed ${rel}`);
      } catch {
        stillPending.push(rel);
      }
    }
    pending = stillPending;
    if (pending.length && attempt < attempts) await new Promise((r) => setTimeout(r, delayMs));
  }
  if (pending.length) throw new Error(`deployed artifacts do not match local output: ${pending.join(', ')}`);
  return targets;
}

// Standalone runs (not driven by daily-pipeline.sh) have no EXIT trap to record
// a failure, so write the same owner-visible status shape the pipeline uses.
function recordFailure(runtime, reason) {
  const now = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const status = {
    status: 'failed',
    started_at: now,
    finished_at: now,
    failed_step: `publish dashboard: ${reason.split('\n')[0].slice(0, 200)}`,
    exit_code: 1,
  };
  const json = JSON.stringify(status, null, 2) + '\n';
  for (const rel of ['data/shared/pipeline-status.json', 'nfldashboard/data/shared/pipeline-status.json']) {
    try {
      const file = path.join(runtime, rel);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, json);
    } catch { /* the runtime may be unreachable; the log above still stands */ }
  }
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const git = makeGit(opts.root);

  // The builder is resolved later (checkout first, then this script's own
  // directory), so it is deliberately not a precondition — the first run after
  // a fresh clone may predate it reaching origin/main.
  for (const required of ['index.html', 'scripts/validate-data.js', 'schedule.json']) {
    if (!fs.existsSync(path.join(opts.root, required))) {
      throw new Error(`not a dashboard checkout (missing ${required}): ${opts.root}`);
    }
  }

  log(`checkout ${opts.root}`);
  log(`runtime  ${opts.runtime}`);
  if (opts.dryRun) log('dry run: no files, commits, or pushes');

  if (!opts.dryRun) updateCheckout(git, opts.root);

  const copy = copyProducerArtifacts({ runtime: opts.runtime, root: opts.root, dryRun: opts.dryRun });
  for (const rel of copy.copied) log(`copied ${rel}`);
  for (const rel of copy.skipped) log(`kept    ${rel}`);
  if (!copy.copied.length) log('no producer artifact changed');

  log('building standings + stats');
  buildLeagueData({ node: opts.node, root: opts.root, season: opts.season, dryRun: opts.dryRun });

  log('validating data assets');
  validate({ node: opts.node, root: opts.root });

  const commit = stageAndCommit({ git, root: opts.root, dryRun: opts.dryRun });
  for (const rel of commit.changed) log(`changed ${rel}`);
  if (!commit.changed.length) {
    log('nothing to publish');
    return;
  }
  if (opts.dryRun) {
    log(`dry run: would commit and push ${commit.changed.length} file(s)`);
    return;
  }

  push({ git });

  if (opts.verify) {
    log('verifying the deployed artifacts');
    const verified = await verifyDeployed({ root: opts.root });
    log(`deployed artifacts match (${verified.length} file(s))`);
  }
}

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  main().catch((err) => {
    console.error(`[publish] FAILED: ${err.message}`);
    // A dry run must have no side effects at all — not even a status record.
    if (!dryRun) {
      const opts = parseArgs(process.argv.slice(2));
      recordFailure(opts.runtime, err.message);
    }
    process.exit(1);
  });
}

module.exports = {
  copyProducerArtifacts,
  PRODUCER_ARTIFACTS,
  STAGED_PATHS,
  verifyDeployed,
  stageAndCommit,
};
