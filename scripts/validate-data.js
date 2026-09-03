#!/usr/bin/env node
// One boring data-asset validator for the dashboard.
//
// Reads scripts/data-assets.json (the single inventory of dashboard data
// assets) and checks, per asset:
//   * JSON parses
//   * required top-level fields / array length / item fields are present
//   * every listed deploy copy is byte-identical to the canonical file
//   * every browser fallback path exists
//   * the freshness manifest entry is internally consistent: as_of parses and
//     never postdates generated_at, age_hours/status are derived from as_of at
//     stamp time, and max_age_hours matches the inventory
//   * where the asset carries an embedded generated_at (props-board.json),
//     the manifest as_of equals that embedded value
//   * manifest sources and inventory freshness_keys cover each other
//   * runtime assets (Supabase tables, the nflverse feed) record required
//     status, failure behavior, and fallback policy — the validator never
//     contacts the network
//
// Time-independent and checkout-independent: file contents and manifest
// timestamps are the only inputs, never file mtimes. Git does not preserve
// mtimes on clone/checkout, so file mtime is deliberately NOT provenance here;
// exact source-vintage verification lives producer-side
// (fantasyfootball/test/freshness-provenance.test.js, which stamps the real
// sync script against fixtures with controlled mtimes).
//
// Usage: node scripts/validate-data.js [--root <path>]
// Exit 0 = all checks pass; 1 = any check failed.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_ROOT = path.join(__dirname, '..');

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// Floor((genSec - asOfSec) / 3600) — identical arithmetic to the bash
// stamp(): epoch-seconds truncation, then integer division.
function expectedAgeHours(generatedAtIso, asOfIso) {
  const genSec = Math.floor(Date.parse(generatedAtIso) / 1000);
  const asOfSec = Math.floor(Date.parse(asOfIso) / 1000);
  return Math.floor((genSec - asOfSec) / 3600);
}

function expectedStatus(ageHours, maxAgeHours) {
  return ageHours > maxAgeHours ? 'stale' : 'fresh';
}

function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// ── shape checks ────────────────────────────────────────────────────────────
// Every malformed input (null, primitives, arrays where objects are required,
// non-object array entries, non-object manifest entries) becomes a normal
// validation message — never an uncaught exception.

function requirePlainObject(value, label, problems) {
  if (!isPlainObject(value)) {
    problems.push(`${label} must be a JSON object`);
    return false;
  }
  return true;
}

function requireFieldIn(data, field, label, problems) {
  if (!(field in data)) problems.push(`${label} is missing required field "${field}"`);
}

function checkArrayItems(arr, itemFields, label, problems) {
  arr.forEach((item, i) => {
    if (!isPlainObject(item)) {
      problems.push(`${label} item ${i} must be an object`);
      return;
    }
    for (const f of itemFields || []) {
      if (!(f in item)) problems.push(`${label} item ${i} is missing field "${f}"`);
    }
  });
}

function checkAsset(asset, root, manifest, problems, notes) {
  const tag = asset.id;

  // ── inventory entry shape ──
  if (!isPlainObject(asset)) {
    problems.push('inventory contains a non-object asset entry');
    return;
  }

  // ── runtime assets: documented contract only, never touched over the network ──
  if (asset.kind === 'runtime') {
    for (const f of ['required', 'failure_behavior', 'fallback_policy']) {
      const v = asset[f];
      if (typeof v !== 'boolean' && typeof v !== 'string') {
        problems.push(`[${tag}] runtime asset must record "${f}" (boolean required, string behavior)`);
      } else if (f !== 'required' && !String(v).trim()) {
        problems.push(`[${tag}] runtime asset "${f}" must not be empty`);
      }
    }
    return;
  }

  // ── freshness contract (manifest entry must exist for every key) ──
  if (asset.freshness_key && manifest) {
    if (!manifest.sources || !manifest.sources[asset.freshness_key]) {
      problems.push(`freshness manifest is missing source "${asset.freshness_key}"`);
      return; // nothing more to check for a wholly unrecorded source
    }
  }

  if (asset.kind === 'none' || !asset.canonical) {
    // Research handoff: no repo file; freshness consistency only.
    checkFreshnessInternal(asset, manifest, problems);
    return;
  }

  // ── presence ──
  const canonicalPath = path.join(root, asset.canonical);
  if (!fs.existsSync(canonicalPath)) {
    if (asset.required) {
      problems.push(`missing required asset: ${asset.canonical}`);
    } else {
      notes.push(`optional asset absent (acceptable): ${asset.canonical}`);
    }
    return;
  }

  // ── JSON parse + shape ──
  let data;
  try {
    data = loadJson(canonicalPath);
  } catch (err) {
    problems.push(`${asset.canonical} is not valid JSON: ${err.message}`);
    return;
  }

  if (asset.kind === 'object') {
    if (!requirePlainObject(data, asset.canonical, problems)) return;
    for (const key of asset.required_fields || []) {
      requireFieldIn(data, key, asset.canonical, problems);
    }
    for (const [field, spec] of Object.entries(asset.nested_arrays || {})) {
      const arr = data[field];
      if (!Array.isArray(arr)) {
        problems.push(`${asset.canonical}.${field} must be an array`);
        continue;
      }
      if (arr.length < (spec.min || 0)) {
        problems.push(`${asset.canonical}.${field} has ${arr.length} rows, expected >= ${spec.min}`);
      }
      checkArrayItems(arr, spec.item_fields, `${asset.canonical}.${field}`, problems);
    }
  } else if (asset.kind === 'array') {
    if (!Array.isArray(data)) {
      problems.push(`${asset.canonical} must be an array`);
      return;
    }
    if (data.length < (asset.min_length || 0)) {
      problems.push(`${asset.canonical} has ${data.length} rows, expected >= ${asset.min_length}`);
    }
    checkArrayItems(data, asset.item_fields, asset.canonical, problems);
  }

  // ── duplicate deploy copies must be byte-identical ──
  for (const copyRel of asset.copies || []) {
    const copyPath = path.join(root, copyRel);
    if (!fs.existsSync(copyPath)) {
      problems.push(`copy ${copyRel} is missing (canonical: ${asset.canonical})`);
      continue;
    }
    if (sha256(copyPath) !== sha256(canonicalPath)) {
      problems.push(`copy ${copyRel} differs from canonical ${asset.canonical}`);
    }
  }

  // ── browser fallbacks must exist ──
  for (const fbRel of asset.fallbacks || []) {
    const fbPath = path.join(root, fbRel.replace(/^\.\//, ''));
    if (!fs.existsSync(fbPath)) {
      problems.push(`browser fallback ${fbRel} is missing`);
    }
  }

  // ── freshness provenance ──
  if (asset.freshness_key && manifest) {
    const entry = manifest.sources[asset.freshness_key];
    if (!isPlainObject(entry)) {
      problems.push(`${asset.freshness_key}: manifest source is not an object`);
      return;
    }
    if (asset.freshness_mode === 'embedded') {
      // Content-based: an embedded top-level generated_at survives any copy and
      // any checkout, so it can be compared exactly against the manifest.
      const vintage = isPlainObject(data) ? data.generated_at : null;
      if (!vintage) {
        problems.push(`${asset.canonical} has no embedded generated_at for vintage check`);
      } else if (entry.as_of !== vintage) {
        problems.push(`${asset.freshness_key}: manifest as_of ${entry.as_of} != true vintage ${vintage}`);
      }
    }
    // 'file' mtime is intentionally NOT a freshness mode here: Git discards
    // mtimes on checkout, so a clean clone would never validate. All other
    // assets are checked for internal manifest consistency only.
    checkFreshnessInternal(asset, manifest, problems);
  }
}

function checkFreshnessInternal(asset, manifest, problems) {
  if (!asset.freshness_key || !manifest) return;
  const entry = manifest.sources[asset.freshness_key];
  if (!isPlainObject(entry)) {
    problems.push(`${asset.freshness_key}: manifest source is not an object`);
    return;
  }
  const generatedAt = manifest.generated_at;
  const maxAge = asset.max_age_hours;

  if (!entry.as_of || !Number.isFinite(Date.parse(entry.as_of))) {
    problems.push(`${asset.freshness_key}: manifest as_of is missing or unparseable`);
    return;
  }
  const asOfMs = Date.parse(entry.as_of);
  const genMs = Date.parse(generatedAt);
  if (!Number.isFinite(genMs)) {
    problems.push(`freshness manifest generated_at is unparseable: ${generatedAt}`);
    return;
  }
  if (asOfMs > genMs) {
    problems.push(`${asset.freshness_key}: as_of ${entry.as_of} postdates manifest generated_at ${generatedAt}`);
  }
  const age = expectedAgeHours(generatedAt, entry.as_of);
  if (entry.age_hours !== age) {
    problems.push(`${asset.freshness_key}: declared age_hours ${entry.age_hours} != ${age} (derived from as_of/generated_at)`);
  }
  const wantStatus = expectedStatus(age, maxAge);
  if (entry.status !== wantStatus) {
    problems.push(`${asset.freshness_key}: status "${entry.status}" != expected "${wantStatus}" at age ${age}h vs max ${maxAge}h`);
  }
  if (entry.max_age_hours !== maxAge) {
    problems.push(`${asset.freshness_key}: manifest max_age_hours ${entry.max_age_hours} != inventory ${maxAge}`);
  }
}

function validate(root = DEFAULT_ROOT) {
  const problems = [];
  const results = [];

  const inventoryPath = path.join(root, 'scripts', 'data-assets.json');
  let inventory;
  try {
    inventory = loadJson(inventoryPath);
  } catch (err) {
    return { ok: false, problems: [`cannot read inventory ${inventoryPath}: ${err.message}`], results: [] };
  }
  if (!isPlainObject(inventory) || !Array.isArray(inventory.assets)) {
    return { ok: false, problems: [`inventory ${inventoryPath} must be an object with an "assets" array`], results: [] };
  }
  const assets = inventory.assets;

  // freshness.json is optional by design; when present, hold it to the contract.
  const manifestPath = path.join(root, 'data', 'shared', 'freshness.json');
  let manifest = null;
  if (fs.existsSync(manifestPath)) {
    try {
      manifest = loadJson(manifestPath);
    } catch (err) {
      problems.push(`freshness manifest is not valid JSON: ${err.message}`);
    }
  }
  if (manifest !== null && !isPlainObject(manifest)) {
    problems.push('freshness manifest must be a JSON object');
    manifest = null;
  }
  if (manifest && !isPlainObject(manifest.sources)) {
    problems.push('freshness manifest has no "sources" object');
    manifest = null;
  }

  // Bidirectional contract: every inventory freshness_key has a manifest
  // source, and every manifest source is a known inventory asset.
  const inventoryKeys = assets.filter(a => isPlainObject(a) && a.freshness_key).map(a => a.freshness_key);
  if (manifest && isPlainObject(manifest.sources)) {
    const manifestKeys = Object.keys(manifest.sources);
    for (const k of inventoryKeys) {
      if (!manifestKeys.includes(k)) problems.push(`freshness manifest is missing source "${k}"`);
    }
    for (const k of manifestKeys) {
      if (!inventoryKeys.includes(k)) problems.push(`freshness manifest has unknown source "${k}" not in inventory`);
    }
  }

  for (const asset of assets) {
    const assetProblems = [];
    const assetNotes = [];
    checkAsset(asset, root, manifest, assetProblems, assetNotes);
    const id = isPlainObject(asset) ? asset.id : '(malformed)';
    results.push({ id, ok: assetProblems.length === 0, problems: assetProblems, notes: assetNotes });
    problems.push(...assetProblems.map(p => `[${id}] ${p}`));
  }

  return { ok: problems.length === 0, problems, results };
}

function main() {
  const args = process.argv.slice(2);
  let root = DEFAULT_ROOT;
  const i = args.indexOf('--root');
  if (i !== -1 && args[i + 1]) root = path.resolve(args[i + 1]);

  const result = validate(root);
  for (const r of result.results) {
    if (r.ok) {
      console.log(`OK   ${r.id}`);
      for (const n of r.notes || []) console.log(`       ~ ${n}`);
    } else {
      console.log(`FAIL ${r.id}`);
      for (const p of r.problems) console.log(`       - ${p}`);
    }
  }
  if (result.problems.length && result.results.length === 0) {
    for (const p of result.problems) console.log(`FAIL - ${p}`);
  }
  if (result.ok) {
    console.log(`validate-data: all ${result.results.length} assets pass`);
  } else {
    console.error(`validate-data: ${result.problems.length} problem(s) found`);
    process.exitCode = 1;
  }
}

module.exports = { validate };

if (require.main === module) main();
