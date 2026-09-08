'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const LOADER_URL = pathToFileURL(path.join(__dirname, 'load_team_tendencies.js')).href;

const FIXTURE_TEAMS = ['NE', 'SEA', 'BUF', 'KC'];
const FIXTURE_METRICS = ['motion', 'play_action', 'shotgun'];

function writeWorkspace(dir, opts = {}) {
  const shared = path.join(dir, 'data', 'shared');
  fs.mkdirSync(shared, { recursive: true });

  const recs = [];
  for (const team of FIXTURE_TEAMS) {
    for (const side of ['off', 'def']) {
      for (const metric of FIXTURE_METRICS) {
        const obs = opts.zeroObserved && team === 'NE' && side === 'off' && metric === 'play_action'
          ? 0
          : (opts.obsv ?? 100);
        const num = obs === 0 ? 0 : (opts.num ?? 25);
        recs.push({
          team,
          side,
          metric,
          eligibility: 'Rule P',
          denominator: metric === 'play_action' ? 'dropbacks' : 'scrimmage_plays',
          eligible: obs,
          matched: obs,
          unmatched: 0,
          observed: obs,
          field_unknown: 0,
          unknown_empty: 0,
          unknown_unrecognized: 0,
          numerator: num,
          value: obs === 0 ? null : num / obs,
          missing_reason: null,
          source: metric === 'play_action' ? 'ftn_charting_2025' : 'play_by_play_2025',
        });
      }
    }
  }

  const payload = {
    artifact: 'team_tendencies_2025',
    generated_at: '2026-09-06T07:51:14Z',
    observation_period: { season: opts.opSeason ?? 2025, season_type: 'REG', weeks: '1-18', games: 272 },
    sources: {
      play_by_play_2025: {
        asset: 'pbp_2025.csv.gz',
        source_retrieved_at: null,
        source_released_at: null,
        source_update_check_at: null,
        license: { spdx: 'see nflverse-pbp repo terms', link: 'https://github.com/nflverse/nflverse-pbp', verified: false, note: 'not re-verified' },
      },
      ftn_charting_2025: {
        asset: 'ftn_2025.csv',
        source_retrieved_at: null,
        source_released_at: null,
        source_update_check_at: null,
        license: { spdx: 'CC-BY-SA-4.0', link: 'https://nflreadr.nflverse.com/reference/load_ftn_charting.html', verified: true, note: 'attribution required' },
      },
    },
    records: recs,
  };

  fs.writeFileSync(path.join(shared, 'team_tendencies_2025.json'), JSON.stringify(payload, null, 2));
  fs.writeFileSync(path.join(dir, 'team_tendencies_2025.json'), JSON.stringify(payload, null, 2));
}

function makeWorkspace(opts = {}) {
  const dir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'team-tendencies-fixture-'));
  writeWorkspace(dir, opts);
  return dir;
}

function cleanup(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
}

function workspaceUrls(dir) {
  return [
    pathToFileURL(path.join(dir, 'data', 'shared', 'team_tendencies_2025.json')).href,
    pathToFileURL(path.join(dir, 'team_tendencies_2025.json')).href,
  ];
}

test('loadTeamTendencies and getTeamTendency are exported', async () => {
  const m = await import(LOADER_URL);
  assert.equal(typeof m.loadTeamTendencies, 'function');
  assert.equal(typeof m.getTeamTendency, 'function');
  assert.equal(typeof m.teamTendenciesObservationPeriod, 'function');
  assert.equal(typeof m.renderTeamTendenciesDisclosure, 'function');
  assert.equal(typeof m.isJsonResponse, 'function');
  assert.equal(typeof m.validateTeamTendenciesPayload, 'function');
  assert.equal(typeof m.validateTeamTendenciesArtifact, 'function');
  assert.equal(typeof m.resetTeamTendenciesForTest, 'function');
});

test('valid fixture loads as a present artifact', async () => {
  const dir = makeWorkspace();
  try {
    const mod = await import(LOADER_URL);
    await mod.resetTeamTendenciesForTest();
    const url0 = workspaceUrls(dir)[0];
    const data = await mod.loadTeamTendencies([url0]);
    assert.ok(data && !data.absent, 'should load');
    assert.equal(data.artifact, 'team_tendencies_2025');
    assert.equal(data.records.length, FIXTURE_TEAMS.length * 2 * FIXTURE_METRICS.length);
  } finally {
    cleanup(dir);
  }
});

test('getTeamTendency returns the matching record value', async () => {
  const dir = makeWorkspace({ num: 40, obsv: 160 });
  try {
    const url0 = workspaceUrls(dir)[0];
    const mod = await import(LOADER_URL);
    await mod.resetTeamTendenciesForTest();
    const data = await mod.loadTeamTendencies([url0]);
    assert.ok(data && !data.absent, 'fixture must load');
    const rec = mod.getTeamTendency('NE', 'off', 'play_action');
    assert.ok(rec, 'NE/off/play_action must be present');
    assert.equal(rec.numerator, 40);
    assert.equal(rec.observed, 160);
    assert.ok(Number.isFinite(rec.value) && Math.abs(rec.value - 0.25) < 1e-9, String(rec.value));
  } finally {
    cleanup(dir);
  }
});

test('getTeamTendency returns null for an absent key', async () => {
  const dir = makeWorkspace();
  try {
    const url0 = workspaceUrls(dir)[0];
    const mod = await import(LOADER_URL);
    await mod.resetTeamTendenciesForTest();
    const data = await mod.loadTeamTendencies([url0]);
    assert.ok(data && !data.absent, 'fixture must load');
    assert.equal(mod.getTeamTendency('NON', 'off', 'play_action'), null);
  } finally {
    cleanup(dir);
  }
});

test('observed zero yields null value and passes validation', async () => {
  const dir = makeWorkspace({ zeroObserved: true });
  try {
    const mod = await import(LOADER_URL);
    await mod.resetTeamTendenciesForTest();
    const url0 = workspaceUrls(dir)[0];
    const sharedUrl = workspaceUrls(dir)[0];
    const data = await mod.loadTeamTendencies([sharedUrl]);
    assert.ok(data && !data.absent, 'observed-zero fixture must load; problems: ' + JSON.stringify(data));
    const rec = mod.getTeamTendency('NE', 'off', 'play_action');
    assert.ok(rec, 'NE/off/play_action must be present in loaded data; rec=' + JSON.stringify(rec));
    assert.equal(rec.observed, 0);
    assert.equal(rec.value, null);
  } finally {
    cleanup(dir);
  }
});

test('missing top-level field is rejected and loader falls through', async () => {
  const dir = makeWorkspace();
  try {
    const shared = path.join(dir, 'data', 'shared');
    const badUrl = pathToFileURL(path.join(shared, 'team_tendencies_2025.json')).href;
    const payload = JSON.parse(fs.readFileSync(path.join(shared, 'team_tendencies_2025.json'), 'utf8'));
    delete payload.observation_period;
    fs.writeFileSync(path.join(shared, 'team_tendencies_2025.json'), JSON.stringify(payload));
    fs.writeFileSync(path.join(dir, 'team_tendencies_2025.json'), JSON.stringify(payload));
    const mod = await import(LOADER_URL);
    await mod.resetTeamTendenciesForTest();
    const data = await mod.loadTeamTendencies([badUrl]);
    assert.equal(data.absent, true);
  } finally {
    cleanup(dir);
  }
});

test('wrong record count is rejected by structural validation', async () => {
  const { validateTeamTendenciesPayload } = await import(LOADER_URL);
  const payload = {
    artifact: 'x', generated_at: '2026-01-01T00:00:00Z',
    observation_period: {}, sources: {},
    records: [{ team: 'NE', side: 'off', metric: 'play_action', source: 'ftn_charting_2025', value: 0.25, observed: 100 }],
  };
  const problems = validateTeamTendenciesPayload(payload);
  assert.ok(problems.length > 0, JSON.stringify(problems));
});

function fullRecord(over) {
  return {
    team: 'NE', side: 'off', metric: 'play_action', eligibility: 'Rule P',
    denominator: 'dropbacks', source: 'ftn_charting_2025',
    eligible: 10, matched: 10, unmatched: 0, observed: 10, field_unknown: 0,
    unknown_empty: 0, unknown_unrecognized: 0, numerator: 5, missing_reason: null,
    ...over,
  };
}

function payloadWith(records, over = {}) {
  return {
    artifact: 'x', generated_at: '2026-01-01T00:00:00Z',
    observation_period: { season: 2025, season_type: 'REG' },
    sources: { ftn_charting_2025: {}, play_by_play_2025: {} },
    records,
    ...over,
  };
}

test('observed zero with non-null value is structurally rejected', async () => {
  const { validateTeamTendenciesPayload } = await import(LOADER_URL);
  const payload = payloadWith([fullRecord({ value: 0.5, observed: 0, numerator: 0 })]);
  const problems = validateTeamTendenciesPayload(payload);
  assert.ok(problems.length > 0 && problems.some(p => /observed 0 but non-null/.test(p)), JSON.stringify(problems));
});

test('non-finite value is structurally rejected', async () => {
  const { validateTeamTendenciesPayload } = await import(LOADER_URL);
  const payload = payloadWith([fullRecord({ value: NaN })]);
  const problems = validateTeamTendenciesPayload(payload);
  assert.ok(problems.length > 0 && problems.some(p => /value must be a finite number/.test(p)), JSON.stringify(problems));
});

test('directional anchors are validated against the real artifact counts', async () => {
  const realPath = path.join(__dirname, '..', '..', 'data', 'shared', 'team_tendencies_2025.json');
  assert.ok(fs.existsSync(realPath), 'real artifact must be present for this check');
  const { validateTeamTendenciesArtifact } = await import(LOADER_URL);
  const payload = JSON.parse(fs.readFileSync(realPath, 'utf8'));
  const problems = validateTeamTendenciesArtifact(payload);
  assert.equal(problems.length, 0, JSON.stringify(problems));
});

test('structural validation rejects a duplicate record key', async () => {
  const { validateTeamTendenciesPayload } = await import(LOADER_URL);
  const rec = { team: 'NE', side: 'off', metric: 'play_action', source: 'ftn_charting_2025', value: 0.25, observed: 100, eligible: 100, matched: 100, unmatched: 0, field_unknown: 0, unknown_empty: 0, unknown_unrecognized: 0, numerator: 25, missing_reason: null };
  const payload = {
    artifact: 'x', generated_at: '2026-01-01T00:00:00Z',
    observation_period: {}, sources: {},
    records: [rec, { ...rec }],
  };
  const problems = validateTeamTendenciesPayload(payload);
  assert.ok(problems.length > 0 && problems.some(p => /duplicate record key/.test(p)), JSON.stringify(problems));
});

test('renderTeamTendenciesDisclosure renders the record and missing_reason', async () => {
  const realPath = path.join(__dirname, '..', '..', 'data', 'shared', 'team_tendencies_2025.json');
  assert.ok(fs.existsSync(realPath), 'real artifact must be present for this check');
  const realSharedUrl = workspaceUrls(path.join(__dirname, '..', '..'))[0];
  const mod = await import(LOADER_URL);
  await mod.resetTeamTendenciesForTest();
  await mod.loadTeamTendencies([realSharedUrl]);
  const rec = mod.getTeamTendency('NE', 'off', 'play_action');
  assert.ok(rec, 'real NE/off/play_action must be present');
  const html = mod.renderTeamTendenciesDisclosure('NE', 'off', 'play_action', rec);
  assert.ok(html.includes('denominator'));
  assert.ok(html.includes('148'));
  assert.ok(html.includes('613'));
  assert.ok(html.includes('24.1%'));
  // Expanded evidence: observation period, aggregation time, definition,
  // and a clickable source link with license attribution.
  assert.ok(html.includes('2025 regular season'), 'observation period label');
  assert.ok(html.includes('aggregated'), 'aggregation-time label');
  assert.ok(html.includes('measures:'), 'definition line');
  assert.ok(/<a href="https?:\/\//.test(html), 'clickable source link');
});

test('renderTeamTendenciesDisclosure returns unavailable copy for missing key', async () => {
  const mod = await import(LOADER_URL);
  const html = mod.renderTeamTendenciesDisclosure('NON', 'off', 'play_action', null);
  assert.ok(html.includes('unavailable'));
});

test('present unknown record (observed 0, value null) is distinct from an absent key', async () => {
  const dir = makeWorkspace({ zeroObserved: true });
  try {
    const mod = await import(LOADER_URL);
    await mod.resetTeamTendenciesForTest();
    const url0 = workspaceUrls(dir)[0];
    const data = await mod.loadTeamTendencies([url0]);
    assert.ok(data && !data.absent, 'fixture must load');
    const presentUnknown = mod.getTeamTendency('NE', 'off', 'play_action');
    assert.ok(presentUnknown, 'present unknown record must be returned, not discarded');
    assert.equal(presentUnknown.observed, 0);
    assert.equal(presentUnknown.value, null);
    assert.equal(mod.getTeamTendency('NON', 'off', 'play_action'), null, 'absent key stays null');
  } finally {
    cleanup(dir);
  }
});

test('validation rejects rate/count disagreement, invariant breaks, and unknown sources', async () => {
  const { validateTeamTendenciesPayload } = await import(LOADER_URL);
  const expectProblem = (label, record, re) => {
    const problems = validateTeamTendenciesPayload(payloadWith([record]));
    assert.ok(problems.some(p => re.test(p)), `${label}: ${JSON.stringify(problems)}`);
  };
  expectProblem('rate/count disagreement', fullRecord({ value: 0.6 }), /disagrees with numerator\/observed/);
  expectProblem('value outside range', fullRecord({ value: 1.2 }), /outside fraction range/);
  expectProblem('eligible invariant', fullRecord({ value: 0.5, eligible: 11 }), /eligible == matched \+ unmatched/);
  expectProblem('matched invariant', fullRecord({ value: 0.5, matched: 9 }), /matched == observed \+ field_unknown/);
  expectProblem('unknown split', fullRecord({ value: 0.5, eligible: 12, matched: 12, field_unknown: 2, unknown_empty: 1, unknown_unrecognized: 0, missing_reason: 'field empty in source feed' }), /field_unknown == unknown_empty \+ unknown_unrecognized/);
  expectProblem('numerator over observed', fullRecord({ value: 0.5, numerator: 11 }), /numerator exceeds observed/);
  expectProblem('missing reason absent', fullRecord({ value: null, observed: 0, numerator: 0, eligible: 1, matched: 0, unmatched: 1, field_unknown: 0, missing_reason: null }), /missing observations but no reason/);
  expectProblem('unknown team', fullRecord({ value: 0.5, team: 'XYZ' }), /unknown team/);
  expectProblem('unknown source key', fullRecord({ value: 0.5, source: 'bogus' }), /unknown source key/);
  // Known source key that the payload's top-level sources omits.
  const noFtnsources = validateTeamTendenciesPayload(payloadWith(
    [fullRecord({ value: 0.5, source: 'ftn_charting_2025' })],
    { sources: { play_by_play_2025: {} } }
  ));
  assert.ok(noFtnsources.some(p => /no top-level sources entry/.test(p)), JSON.stringify(noFtnsources));
});

test('duplicate identity is judged on team|side|metric, not source', async () => {
  const { validateTeamTendenciesPayload } = await import(LOADER_URL);
  const rec = {
    team: 'NE', side: 'off', metric: 'play_action', eligibility: 'Rule P',
    denominator: 'dropbacks', source: 'ftn_charting_2025',
    eligible: 10, matched: 10, unmatched: 0, observed: 10, field_unknown: 0,
    unknown_empty: 0, unknown_unrecognized: 0, numerator: 5, value: 0.5, missing_reason: null,
  };
  const payload = {
    artifact: 'x', generated_at: '2026-01-01T00:00:00Z',
    observation_period: { season: 2025 },
    sources: { ftn_charting_2025: {}, play_by_play_2025: {} },
    // Same team/side/metric with a DIFFERENT source is still a duplicate:
    // the lookup key never included source.
    records: [rec, { ...rec, source: 'play_by_play_2025' }],
  };
  const problems = validateTeamTendenciesPayload(payload);
  assert.ok(problems.some(p => /duplicate record key NE\|off\|play_action/.test(p)), JSON.stringify(problems));
});

// Fixture-based season transition check: a synthetic 2026 observation period
// must render as 2026 in the disclosure and be reported by the observation
// helper. This is a TEST of the label mechanics, not a claim that live 2026
// charting exists (the published artifact is still the 2025 regular season).
test('fixture 2026 observation period renders as 2026 and is reported by the helper', async () => {
  const dir = makeWorkspace({ opSeason: 2026 });
  try {
    const mod = await import(LOADER_URL);
    await mod.resetTeamTendenciesForTest();
    const url0 = workspaceUrls(dir)[0];
    const data = await mod.loadTeamTendencies([url0]);
    assert.ok(data && !data.absent, 'fixture must load');
    const op = mod.teamTendenciesObservationPeriod();
    assert.equal(op.season, 2026);
    const html = mod.renderTeamTendenciesDisclosure('NE', 'off', 'play_action');
    assert.ok(html.includes('2026 regular season'), 'disclosure labels the fixture observation season');
    assert.ok(!html.includes('2025 regular season'), 'no silent season blending');
  } finally {
    cleanup(dir);
  }
});

test('zero-observation disclosure copy keeps observed-zero distinct from no observations', async () => {
  const dir = makeWorkspace({ zeroObserved: true });
  try {
    const mod = await import(LOADER_URL);
    await mod.resetTeamTendenciesForTest();
    const url0 = workspaceUrls(dir)[0];
    await mod.loadTeamTendencies([url0]);
    const html = mod.renderTeamTendenciesDisclosure('NE', 'off', 'play_action');
    assert.ok(html.includes('observed 0'), 'zero-observation state visible');
    assert.ok(!/no observations/.test(html) || /distinct from a missing record/.test(html),
      'must not claim there are no observations for a present record');
  } finally {
    cleanup(dir);
  }
});
