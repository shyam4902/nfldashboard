// Hermetic concurrent-publisher regression.
//
// Every tracked-artifact writer must publish via a same-dir temp + atomic
// rename, with a temp name UNIQUE per process — otherwise two concurrent
// publishers (two syncs, two builds) share one fixed temp path, interleave
// writes, and can publish truncated or mixed bytes.
//
// This test exercises the REAL writers against throwaway targets:
//   1. scripts/atomic-write.js — two concurrent node processes write the same
//      target with different large payloads; the survivor must be one complete
//      payload, never a mix, and no temp files may remain.
//   2. scripts/build_draft_capital.py — two concurrent python3 runs (copied to
//      a temp tree so their output path stays inside the tempdir); both must
//      exit 0 and produce output byte-identical to a serial reference run.
//
// No live data, Supabase, network, or current-workspace state is read; both
// writers are fully self-contained.
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const HERE = __dirname;
const ATOMIC_WRITE = path.join(HERE, 'scripts', 'atomic-write.js');
const DRAFT_CAPITAL = path.join(HERE, 'scripts', 'build_draft_capital.py');

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

function leftoverTemps(dir) {
  return walk(dir).filter(f => /\.tmp(-\d+)?(\.\d+)?$/.test(f));
}

function makePayload(letter) {
  return JSON.stringify({
    publisher: letter,
    filler: letter.repeat(2 * 1024 * 1024),
    tail: `complete-payload-${letter}`,
  });
}

test('two concurrent node publishers through the real atomic-write helper stay uncorrupted', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'concurrent-atomic-fixture-'));
  try {
    fs.mkdirSync(path.join(dir, 'scripts'));
    fs.copyFileSync(ATOMIC_WRITE, path.join(dir, 'scripts', 'atomic-write.js'));
    const driver = path.join(dir, 'pub.js');
    fs.writeFileSync(driver, `
      const fs = require('node:fs');
      const { atomicWriteFileSync } = require('./scripts/atomic-write.js');
      const target = process.argv[2];
      const payload = fs.readFileSync(process.argv[3], 'utf8');
      atomicWriteFileSync(target, payload);
    `);
    const target = path.join(dir, 'out.json');
    const payloadA = makePayload('A');
    const payloadB = makePayload('B');
    const payloadFileA = path.join(dir, 'payload-a.json');
    const payloadFileB = path.join(dir, 'payload-b.json');
    fs.writeFileSync(payloadFileA, payloadA);
    fs.writeFileSync(payloadFileB, payloadB);

    const codes = await Promise.all(
      [payloadFileA, payloadFileB].map(payloadFile =>
        new Promise(resolve => {
          const child = spawn(process.execPath, [driver, target, payloadFile]);
          child.on('exit', code => resolve(code));
        }))
    );
    assert.deepEqual(codes, [0, 0]);

    const final = fs.readFileSync(target, 'utf8');
    assert.ok(final === payloadA || final === payloadB,
      'final file must be exactly one complete payload, never a mix');
    const parsed = JSON.parse(final);
    assert.match(parsed.tail, /^complete-payload-[AB]$/);
    assert.equal(parsed.filler.length, 2 * 1024 * 1024);
    assert.deepEqual(leftoverTemps(dir), [], 'no temp files may remain');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('two concurrent python draft-capital builds complete with identical, valid output', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'concurrent-python-fixture-'));
  try {
    // The builder derives its output path from __file__ (parent.parent), so a
    // copied script writes inside the temp tree — fully hermetic.
    fs.mkdirSync(path.join(dir, 'scripts'));
    fs.copyFileSync(DRAFT_CAPITAL, path.join(dir, 'scripts', 'build_draft_capital.py'));

    const run = () => spawnSync('python3', [path.join(dir, 'scripts', 'build_draft_capital.py')],
      { encoding: 'utf8' });
    const serial = run();
    assert.equal(serial.status, 0, serial.stdout + serial.stderr);
    const serialOut = fs.readFileSync(path.join(dir, 'draft-capital.json'), 'utf8');

    const codes = await Promise.all([0, 1].map(() =>
      new Promise(resolve => {
        const child = spawn('python3', [path.join(dir, 'scripts', 'build_draft_capital.py')]);
        child.on('exit', code => resolve(code));
      })));
    assert.deepEqual(codes, [0, 0], 'both concurrent python runs exit 0');

    const outPath = path.join(dir, 'draft-capital.json');
    const final = fs.readFileSync(outPath, 'utf8');
    assert.equal(final, serialOut, 'concurrent output matches serial reference');
    const parsed = JSON.parse(final);
    assert.ok(parsed.capital && parsed.capital['Kansas City Chiefs'], 'output is the full object');
    assert.deepEqual(leftoverTemps(dir), [], 'no temp files may remain');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
