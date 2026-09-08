'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// Local matchup-preview tendency loader.
// ═══════════════════════════════════════════════════════════════════════════
// Loads team_tendencies_2025.json from the dashboard's shared-data path and
// root fallback. In the browser this is a normal fetch(); in Node tests this
// module transparently reads file:// URLs from disk so the hermetic fixture
// tests stay deterministic.
//
// Two validation layers:
//  • validateTeamTendenciesPayload — structural + contract: shape, required
//    fields, duplicate identity, known values, nonnegative integer counts,
//    count invariants, rate/count agreement, fraction range, and source
//    references. Used by the loader for every candidate response and by
//    hermetic tests against small synthetic fixtures.
//  • validateTeamTendenciesArtifact — published-artifact contract: 192 unique
//    records and the four verified directional anchors, layered on top of the
//    same record checks. Used only against the real published artifact.
// ═══════════════════════════════════════════════════════════════════════════

const TEAM_TENDENCIES_URLS = [
  './data/shared/team_tendencies_2025.json',
  './team_tendencies_2025.json',
];

const TEAM_TENDENCIES_REQUIRED_TOP = [
  'artifact',
  'generated_at',
  'observation_period',
  'sources',
  'records',
];

const TEAM_TENDENCIES_REQUIRED_RECORD = [
  'team',
  'side',
  'metric',
  'source',
  'value',
];

const TEAM_TENDENCIES_COUNT_FIELDS = [
  'eligible',
  'matched',
  'unmatched',
  'observed',
  'field_unknown',
  'unknown_empty',
  'unknown_unrecognized',
  'numerator',
];

// Team codes as published in the 2025 artifact (LA for the Rams, SF for the
// 49ers). The dashboard team helper normalizes full names to these.
const TEAM_TENDENCIES_KNOWN_TEAMS = new Set(
  ('ARI ATL BAL BUF CAR CHI CIN CLE DAL DEN DET GB HOU IND JAX KC LA LAC ' +
   'LV MIA MIN NE NO NYG NYJ PHI PIT SEA SF TB TEN WAS').split(' ')
);

const TEAM_TENDENCIES_KNOWN_METRICS = new Set(['motion', 'play_action', 'shotgun']);
const TEAM_TENDENCIES_KNOWN_DENOMINATORS = new Set(['scrimmage_plays', 'dropbacks']);
const TEAM_TENDENCIES_KNOWN_SOURCES = new Set(['ftn_charting_2025', 'play_by_play_2025']);

// Verified directional anchors for the published 2025 artifact. These are
// expressed as numerator/observed for the play_action metric only and are
// checked by validateTeamTendenciesArtifact, not by the generic structural
// validator (which is used against small synthetic test fixtures).
const TEAM_TENDENCIES_ANCHORS = {
  'NE|off|play_action': { numerator: 148, observed: 613 },
  'NE|def|play_action': { numerator: 146, observed: 589 },
  'SEA|off|play_action': { numerator: 131, observed: 518 },
  'SEA|def|play_action': { numerator: 147, observed: 689 },
};

const TEAM_TENDENCIES_METRIC_DEFINITIONS = {
  motion: {
    off: 'motion usage: share of scrimmage plays with pre-snap motion',
    def: 'motion faced: share of opponent scrimmage plays with pre-snap motion (exposure, not effectiveness)',
  },
  play_action: {
    off: 'play-action usage: share of dropbacks with play-action',
    def: 'play-action faced: share of opponent dropbacks with play-action (exposure, not effectiveness)',
  },
  shotgun: {
    off: 'shotgun usage: share of scrimmage plays from shotgun',
    def: 'shotgun faced: share of opponent scrimmage plays from shotgun (exposure, not effectiveness)',
  },
};

let TEAM_TENDENCIES_DATA = null;
let TEAM_TENDENCIES_LAST_SOURCE = null;
let TEAM_TENDENCIES_LOAD_ERR = null;

// ── helpers ────────────────────────────────────────────────────────────────

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function isNonNegativeInteger(v) {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

// ── record-level contract checks (used by both validators) ─────────────────

function recordProblems(r, sources) {
  const problems = [];
  if (!r || !isPlainObject(r)) {
    return ['record is not an object'];
  }
  const key = `${r.team}|${r.side}|${r.metric}`;
  for (const k of TEAM_TENDENCIES_REQUIRED_RECORD) {
    if (!(k in r)) problems.push(`record ${key} missing field "${k}"`);
  }
  if (typeof r.team !== 'string' || !r.team) problems.push(`record ${key} has no team`);
  else if (!TEAM_TENDENCIES_KNOWN_TEAMS.has(r.team)) problems.push(`record ${key} has unknown team "${r.team}"`);
  if (r.side !== 'off' && r.side !== 'def') problems.push(`record ${key} has invalid side "${r.side}"`);
  if (typeof r.metric !== 'string' || !r.metric) problems.push(`record ${key} has no metric`);
  else if (!TEAM_TENDENCIES_KNOWN_METRICS.has(r.metric)) problems.push(`record ${key} has unknown metric "${r.metric}"`);
  if (r.eligibility !== undefined && r.eligibility !== 'Rule P') {
    problems.push(`record ${key} eligibility "${r.eligibility}" != "Rule P"`);
  }
  if (r.denominator !== undefined && !TEAM_TENDENCIES_KNOWN_DENOMINATORS.has(r.denominator)) {
    problems.push(`record ${key} has unknown denominator "${r.denominator}"`);
  }
  if (typeof r.source !== 'string' || !r.source) {
    problems.push(`record ${key} has no source key`);
  } else if (!TEAM_TENDENCIES_KNOWN_SOURCES.has(r.source)) {
    problems.push(`record ${key} has unknown source key "${r.source}"`);
  } else if (!sources || !isPlainObject(sources) || !(r.source in sources)) {
    problems.push(`record ${key} source "${r.source}" has no top-level sources entry`);
  }
  for (const f of TEAM_TENDENCIES_COUNT_FIELDS) {
    if (r[f] === undefined) {
      problems.push(`record ${key} missing count field "${f}"`);
    } else if (!isNonNegativeInteger(r[f])) {
      problems.push(`record ${key} count field "${f}" must be a nonnegative integer`);
    }
  }
  if (problems.length) return problems;

  if (r.eligible !== r.matched + r.unmatched) {
    problems.push(`record ${key} violates eligible == matched + unmatched`);
  }
  if (r.matched !== r.observed + r.field_unknown) {
    problems.push(`record ${key} violates matched == observed + field_unknown`);
  }
  if (r.field_unknown !== r.unknown_empty + r.unknown_unrecognized) {
    problems.push(`record ${key} violates field_unknown == unknown_empty + unknown_unrecognized`);
  }
  if (r.numerator > r.observed) {
    problems.push(`record ${key} numerator exceeds observed`);
  }
  if (r.observed === 0) {
    if (r.value !== null) {
      problems.push(`record ${key} has observed 0 but non-null value`);
    }
  } else {
    if (typeof r.value !== 'number' || !Number.isFinite(r.value)) {
      problems.push(`record ${key} value must be a finite number`);
    } else if (r.value < 0 || r.value > 1) {
      problems.push(`record ${key} value ${r.value} outside fraction range [0, 1]`);
    } else if (Math.abs(r.value - r.numerator / r.observed) > 1e-9) {
      problems.push(
        `record ${key} value ${r.value} disagrees with numerator/observed ${r.numerator / r.observed}`
      );
    }
  }
  const missing = r.missing_reason;
  if (r.unmatched || r.field_unknown) {
    if (typeof missing !== 'string' || !missing.trim()) {
      problems.push(`record ${key} has missing observations but no reason`);
    }
  } else if (missing !== null && missing !== undefined) {
    problems.push(`record ${key} is fully observed but missing_reason is set`);
  }
  return problems;
}

function checkTopLevel(data, problems) {
  if (!isPlainObject(data)) {
    problems.push('team_tendencies must be a JSON object');
    return;
  }
  for (const k of TEAM_TENDENCIES_REQUIRED_TOP) {
    if (!(k in data)) problems.push(`team_tendencies missing top-level field "${k}"`);
  }
  if (data.observation_period !== undefined) {
    const op = data.observation_period;
    if (!isPlainObject(op)) {
      problems.push('team_tendencies.observation_period must be an object');
    } else {
      if (!('season' in op)) problems.push('team_tendencies.observation_period missing "season"');
      if (op.season_type !== undefined && op.season_type !== 'REG') {
        problems.push(`team_tendencies.observation_period.season_type "${op.season_type}" != "REG"`);
      }
    }
  }
  if (data.sources !== undefined && !isPlainObject(data.sources)) {
    problems.push('team_tendencies.sources must be an object');
  }
  if (!Array.isArray(data.records)) {
    problems.push('team_tendencies.records must be an array');
  }
}

function checkRecordsCommon(data, problems) {
  const keys = new Set();
  for (let i = 0; i < data.records.length; i++) {
    const r = data.records[i];
    if (!isPlainObject(r)) {
      problems.push(`team_tendencies.records[${i}] is not an object`);
      continue;
    }
    const sub = recordProblems(r, data.sources);
    for (const p of sub) problems.push(`team_tendencies.records[${i}] ${p}`);
    if (!sub.length || !sub.some(p => /has no team|has unknown team|has invalid side|has no metric|has unknown metric/.test(p))) {
      // Duplicate identity is judged on the consumer lookup key (team, side,
      // metric) — the source key is attribution, not identity.
      const key = `${r.team}|${r.side}|${r.metric}`;
      if (keys.has(key)) problems.push(`team_tendencies duplicate record key ${key}`);
      keys.add(key);
    }
  }
  return keys;
}

// ── structural + contract validation (used by loader + hermetic tests) ─────

function validateTeamTendenciesPayload(data) {
  const problems = [];
  checkTopLevel(data, problems);
  if (!isPlainObject(data) || !Array.isArray(data.records)) return problems;
  checkRecordsCommon(data, problems);
  return problems;
}

// ── artifact contract validation (real published artifact only) ────────────

function validateTeamTendenciesArtifact(data) {
  const problems = validateTeamTendenciesPayload(data);
  if (!isPlainObject(data) || !Array.isArray(data.records)) return problems;
  if (data.records.length !== 192) {
    problems.push(
      `team_tendencies.records expected 192 records, got ${data.records.length}`
    );
  }
  const by = new Map();
  for (const r of data.records) {
    if (!isPlainObject(r)) continue;
    by.set(`${r.team}|${r.side}|${r.metric}`, r);
  }
  for (const key of Object.keys(TEAM_TENDENCIES_ANCHORS)) {
    const rec = by.get(key);
    const want = TEAM_TENDENCIES_ANCHORS[key];
    if (!rec) {
      problems.push(`team_tendencies missing anchor record ${key}`);
      continue;
    }
    if (rec.numerator !== want.numerator) {
      problems.push(
        `team_tendencies anchor ${key} numerator ${rec.numerator} != ${want.numerator}`
      );
    }
    if (rec.observed !== want.observed) {
      problems.push(
        `team_tendencies anchor ${key} observed ${rec.observed} != ${want.observed}`
      );
    }
  }
  return problems;
}

// ── loader I/O ─────────────────────────────────────────────────────────────

function asHref(input) {
  if (typeof input !== 'string') return input;
  if (input.startsWith('http://') || input.startsWith('https://')) return input;
  if (input.startsWith('file://')) return input;
  try {
    const raw = input.startsWith('/') ? 'file://' + input : input;
    return new URL(raw, typeof location !== 'undefined' && location.href ? location.origin : 'file:///').href;
  } catch {
    return input;
  }
}

function filePathFromHref(href) {
  if (!href || !href.startsWith('file://')) return null;
  const u = new URL(href);
  const p = u.pathname;
  if (typeof process !== 'undefined' && process.platform === 'win32' && p.startsWith('/')) {
    return p.slice(1);
  }
  return decodeURIComponent(p);
}

async function loadFromPath(path) {
  const fs = await import('node:fs');
  const text = fs.readFileSync(path, 'utf-8');
  return JSON.parse(text);
}

async function loadFromFetch(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`http ${res.status}`);
  if (!isJsonResponse(res)) throw new Error('non-JSON content-type');
  return res.json();
}

async function loadTeamTendencies(urls) {
  if (TEAM_TENDENCIES_DATA !== null) return TEAM_TENDENCIES_DATA;
  TEAM_TENDENCIES_LOAD_ERR = null;
  const list = urls && Array.isArray(urls) ? urls : TEAM_TENDENCIES_URLS;
  for (const raw of list) {
    const url = asHref(raw);
    try {
      const data = url.startsWith('file://')
        ? await loadFromPath(filePathFromHref(url))
        : await loadFromFetch(url);
      const problems = validateTeamTendenciesPayload(data);
      if (problems.length) {
        console.warn(
          `[loadTeamTendencies] malformed ${url}: ${problems.join('; ')}`
        );
        continue;
      }
      TEAM_TENDENCIES_DATA = data;
      TEAM_TENDENCIES_LAST_SOURCE = url;
      return data;
    } catch (e) {
      console.warn(`[loadTeamTendencies] failed ${url}: ${e && e.message}`);
    }
  }
  TEAM_TENDENCIES_DATA = { absent: true };
  return TEAM_TENDENCIES_DATA;
}

// Returns the record for a team/side/metric, or null when that record is
// absent. A present record with value null is a real "observed zero" record:
// it is returned as-is so the disclosure can distinguish it from an absent
// key and from an observed zero rate. The payload validator has already
// rejected malformed records, so no per-call re-validation is needed.
function getTeamTendency(team, side, metric) {
  if (!TEAM_TENDENCIES_DATA || TEAM_TENDENCIES_DATA.absent) return null;
  const rec = TEAM_TENDENCIES_DATA.records.find(
    (r) => r.team === team && r.side === side && r.metric === metric
  );
  return rec || null;
}

// The observation window of the loaded artifact, or null when nothing is
// loaded. Consumers derive the season label from this (plus the efficiency
// data's own season field) instead of hardcoding a year, so a regenerated
// artifact for a new season flips the labels without code edits.
function teamTendenciesObservationPeriod() {
  if (!TEAM_TENDENCIES_DATA || TEAM_TENDENCIES_DATA.absent) return null;
  return TEAM_TENDENCIES_DATA.observation_period || null;
}

// ── evidence disclosure ────────────────────────────────────────────────────

function tendencyRateLine(rec) {
  if (rec.value === null) {
    return '<span class="text-amber-300">observed 0 — no rate computed (present record with zero observations; distinct from a missing record)</span>';
  }
  return `${(rec.value * 100).toFixed(1)}% of ${attrEsc(rec.denominator)} (numerator ${rec.numerator} / observed ${rec.observed})`;
}

function sourceLinkHtml(key) {
  const src = TEAM_TENDENCIES_DATA && TEAM_TENDENCIES_DATA.sources
    ? TEAM_TENDENCIES_DATA.sources[key]
    : null;
  if (!src || !isPlainObject(src)) return attrEsc(key);
  const link = typeof src.license?.link === 'string' && /^https?:\/\//.test(src.license.link)
    ? src.license.link
    : null;
  const name = typeof src.asset === 'string' && src.asset ? src.asset : key;
  const body = link
    ? `<a href="${attrEsc(link)}" target="_blank" rel="noopener noreferrer" class="underline text-sky-400 hover:text-sky-300">${attrEsc(name)}</a>`
    : attrEsc(name);
  const spdx = typeof src.license?.spdx === 'string' ? src.license.spdx : '';
  const licLink = typeof src.license?.link === 'string' && /^https?:\/\//.test(src.license.link)
    ? src.license.link
    : null;
  const lic = licLink && spdx
    ? `<a href="${attrEsc(licLink)}" target="_blank" rel="noopener noreferrer" class="underline text-sky-400 hover:text-sky-300">${attrEsc(spdx)}</a>`
    : (spdx ? attrEsc(spdx) : 'unstated');
  const sha = typeof src.sha256 === 'string' ? src.sha256 : '';
  const shaLine = sha ? `<div class="text-slate-600">cache sha256: ${attrEsc(sha)}</div>` : '';
  const updateTime = (src.source_update_check_at == null && src.source_released_at == null)
    ? 'source update time unknown'
    : `${src.source_update_check_at != null ? 'last checked ' + attrEsc(String(src.source_update_check_at)) : 'release ' + attrEsc(String(src.source_released_at))}`;
  return `<div>source: ${body} (${lic})</div>${shaLine}<div class="text-slate-600">${updateTime}</div>`;
}

function renderTeamTendenciesDisclosure(team, side, metric, rec) {
  if (!rec) rec = getTeamTendency(team, side, metric);
  if (!rec) {
    return `<div class="text-[10px] text-slate-400 font-mono">tendency unavailable for this team/side/metric.</div>`;
  }
  const key = `${team}|${side}|${metric}`;
  const definition = (TEAM_TENDENCIES_METRIC_DEFINITIONS[metric] || {})[side] || `${metric} for ${side}`;
  const op = TEAM_TENDENCIES_DATA && TEAM_TENDENCIES_DATA.observation_period
    ? TEAM_TENDENCIES_DATA.observation_period
    : {};
  const opLabel = (op.season != null ? String(op.season) + ' ' : '') + 'regular season'
    + (op.weeks ? ` · weeks ${attrEsc(String(op.weeks))}` : '')
    + (op.games != null ? ` · ${op.games} games` : '');
  const generatedAt = TEAM_TENDENCIES_DATA && typeof TEAM_TENDENCIES_DATA.generated_at === 'string'
    ? TEAM_TENDENCIES_DATA.generated_at
    : null;
  const eligibilityDef = TEAM_TENDENCIES_DATA && TEAM_TENDENCIES_DATA.eligibility
    && typeof TEAM_TENDENCIES_DATA.eligibility.definition === 'string'
    ? TEAM_TENDENCIES_DATA.eligibility.definition
    : 'season_type == REG, pass/run, posteam non-empty, epa non-empty, two_point_attempt != 1';
  const missingLine =
    rec.missing_reason && rec.missing_reason.trim()
      ? `<span class="text-amber-300">missing: ${attrEsc(rec.missing_reason)}</span>`
      : '<span class="text-slate-500">no missing observations</span>';
  return `<details class="group text-[11px] text-slate-300 bg-slate-900/60 border border-subtle rounded-lg p-3 space-y-1.5">
    <summary class="cursor-pointer font-semibold text-slate-200 list-none flex items-center gap-2">
      <span class="text-[10px] font-mono text-slate-500">${opLabel} evidence</span>
      <span class="text-slate-500 group-open:rotate-180 transition-transform">▾</span>
    </summary>
    <div class="space-y-1 font-mono text-[10px] leading-relaxed">
      <div><span class="text-slate-500">measures:</span> ${attrEsc(definition)}</div>
      <div><span class="text-slate-500">rate:</span> ${tendencyRateLine(rec)}</div>
      <div><span class="text-slate-500">denominator:</span> ${attrEsc(rec.denominator)}</div>
      <div><span class="text-slate-500">eligibility:</span> ${attrEsc(rec.eligibility)} — ${attrEsc(eligibilityDef)}</div>
      <div><span class="text-slate-500">eligible / matched / unmatched:</span> ${rec.eligible} / ${rec.matched} / ${rec.unmatched}</div>
      <div><span class="text-slate-500">observed / field_unknown:</span> ${rec.observed} / ${rec.field_unknown}</div>
      <div><span class="text-slate-500">unknown_empty / unknown_unrecognized:</span> ${rec.unknown_empty} / ${rec.unknown_unrecognized}</div>
      <div><span class="text-slate-500">missing:</span> ${missingLine}</div>
      ${generatedAt ? `<div><span class="text-slate-500">aggregated:</span> ${attrEsc(generatedAt)} <span class="text-slate-600">(aggregation time, not a fetch or update time)</span></div>` : ''}
      ${sourceLinkHtml(rec.source)}
      <div class="text-slate-500 pt-1 border-t border-subtle/50">Historic ${opLabel} — not a current-season measurement. ${side === 'def' ? 'Defensive exposure counts what opponents ran; it does not measure defensive effectiveness and is not a predicted advantage.' : ''}</div>
    </div>
  </details>`;
}

function attrEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isJsonResponse(res) {
  const ct = (res.headers && res.headers.get && res.headers.get('content-type')) || '';
  return ct.includes('application/json');
}

export { loadTeamTendencies, getTeamTendency, teamTendenciesObservationPeriod, renderTeamTendenciesDisclosure, isJsonResponse, attrEsc, validateTeamTendenciesPayload, validateTeamTendenciesArtifact };

// test-only: clears the module-level cache so a fixture rewrite is visible.
export function resetTeamTendenciesForTest() {
  TEAM_TENDENCIES_DATA = null;
  TEAM_TENDENCIES_LAST_SOURCE = null;
  TEAM_TENDENCIES_LOAD_ERR = null;
}

// Attach to window for global use in index.html
if (typeof window !== 'undefined') {
  window.loadTeamTendencies = loadTeamTendencies;
  window.getTeamTendency = getTeamTendency;
  window.teamTendenciesObservationPeriod = teamTendenciesObservationPeriod;
  window.renderTeamTendenciesDisclosure = renderTeamTendenciesDisclosure;
}