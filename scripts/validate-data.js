#!/usr/bin/env node
// One boring data-asset validator for the dashboard.
//
// Reads scripts/data-assets.json (the single inventory of dashboard data
// assets) and checks, per asset:
//   * JSON parses
//   * required top-level fields / array length / item fields are present
//   * every listed deploy copy is byte-identical to the canonical file
//   * every browser fallback path exists
//   * the freshness manifest entry matches the asset's true data vintage
//     (embedded generated_at, canonical file mtime, or internal consistency
//     for research-sourced assets whose origin lives outside this repo)
//   * manifest sources and inventory freshness_keys cover each other
//
// Time-independent: all vintage comparisons derive from fixed file contents
// and the two timestamps already stored in freshness.json, never from "now".
//
// Usage: node scripts/validate-data.js [--root <path>]
// Exit 0 = all checks pass; 1 = any check failed.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DEFAULT_ROOT = path.join(__dirname, '..');

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// Mirror of the sync script's vintage rule: an embedded top-level
// `generated_at` wins (survives any copy); otherwise the file's mtime,
// floored to whole seconds and rendered as UTC ISO without milliseconds
// (matches `stat -f %m` + `date -u -r` in sync-shared-data.sh).
function fileVintage(file) {
  const stat = fs.statSync(file);
  return new Date(Math.floor(stat.mtimeMs / 1000) * 1000)
    .toISOString().replace(/\.000Z$/, 'Z');
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

function checkAsset(asset, root, manifest, problems, notes) {
  const tag = asset.id;

  // ── freshness contract (manifest entry must exist for every key) ──
  if (asset.freshness_key && manifest) {
    if (!manifest.sources || !manifest.sources[asset.freshness_key]) {
      problems.push(`freshness manifest is missing source "${asset.freshness_key}"`);
      return; // nothing more to check for a wholly unrecorded source
    }
  }

  if (asset.kind === 'none') {
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
    for (const key of asset.required_fields || []) {
      if (!(key in data)) problems.push(`${asset.canonical} is missing required field "${key}"`);
    }
    for (const [field, spec] of Object.entries(asset.nested_arrays || {})) {
      const arr = data[field];
      if (!Array.isArray(arr)) {
        problems.push(`${asset.canonical}.${field} must be an array`);
        continue;
      }
      if (arr.length < spec.min) {
        problems.push(`${asset.canonical}.${field} has ${arr.length} rows, expected >= ${spec.min}`);
      }
      for (const item of arr) {
        for (const f of spec.item_fields || []) {
          if (!(f in item)) problems.push(`${asset.canonical}.${field} item missing field "${f}"`);
        }
      }
    }
  } else if (asset.kind === 'array') {
    if (!Array.isArray(data)) {
      problems.push(`${asset.canonical} must be an array`);
      return;
    }
    if (data.length < (asset.min_length || 0)) {
      problems.push(`${asset.canonical} has ${data.length} rows, expected >= ${asset.min_length}`);
    }
    for (const item of data) {
      for (const f of asset.item_fields || []) {
        if (!(f in item)) problems.push(`${asset.canonical} item missing field "${f}"`);
      }
    }
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
    let vintage = null;
    if (asset.freshness_mode === 'embedded') {
      vintage = data && typeof data === 'object' && data.generated_at ? data.generated_at : null;
      if (!vintage) problems.push(`${asset.canonical} has no embedded generated_at for vintage check`);
    } else if (asset.freshness_mode === 'file') {
      vintage = fileVintage(canonicalPath);
    }
    if (vintage) {
      if (entry.as_of !== vintage) {
        problems.push(`${asset.freshness_key}: manifest as_of ${entry.as_of} != true vintage ${vintage}`);
      }
    }
    checkFreshnessInternal(asset, manifest, problems);
  }
}

function checkFreshnessInternal(asset, manifest, problems) {
  if (!asset.freshness_key || !manifest) return;
  const entry = manifest.sources[asset.freshness_key];
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
  const assets = inventory.assets || [];

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

  // Bidirectional contract: every inventory freshness_key has a manifest
  // source, and every manifest source is a known inventory asset.
  const inventoryKeys = assets.filter(a => a.freshness_key).map(a => a.freshness_key);
  if (manifest && manifest.sources) {
    const manifestKeys = Object.keys(manifest.sources);
    for (const k of inventoryKeys) {
      if (!manifestKeys.includes(k)) problems.push(`freshness manifest is missing source "${k}"`);
    }
    for (const k of manifestKeys) {
      if (!inventoryKeys.includes(k)) problems.push(`freshness manifest has unknown source "${k}" not in inventory`);
    }
  } else if (manifest) {
    problems.push('freshness manifest has no "sources" object');
  }

  for (const asset of assets) {
    const assetProblems = [];
    const assetNotes = [];
    checkAsset(asset, root, manifest, assetProblems, assetNotes);
    results.push({ id: asset.id, ok: assetProblems.length === 0, problems: assetProblems, notes: assetNotes });
    problems.push(...assetProblems.map(p => `[${asset.id}] ${p}`));
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