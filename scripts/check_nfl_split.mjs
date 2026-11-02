// Load-order harness for the nfl/ split (PACKET-2026-11-02-2).
// Mode A runs the local <script src> files from nfl/index.html in order in one vm context.
// Mode B runs the original single inline script (from commit 52aa24a) the same way.
// It also checks the cut is lossless: local JS concatenated in load order, minus the
// lines moved to boot.js, equals the original script content line for line.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = '52aa24a';

function stub() {
  const target = function () {};
  const handler = {
    get(_t, prop) {
      if (prop === 'then') return undefined;
      if (prop === Symbol.toPrimitive) return () => '';
      if (prop === Symbol.iterator) return function* () {};
      if (prop === 'error') return null; // supabase-style `{ data, error }` results read as success
      return stub();
    },
    apply() { return stub(); },
    construct() { return stub(); },
    set() { return true; },
    has() { return true; },
  };
  return new Proxy(target, handler);
}

function makeContext() {
  const ctx = vm.createContext({});
  for (const name of ['document', 'localStorage', 'sessionStorage', 'fetch', 'supabase', 'tailwind',
    'matchMedia', 'IntersectionObserver', 'ResizeObserver', 'MutationObserver', 'setTimeout', 'setInterval',
    'clearTimeout', 'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'navigator',
    'location', 'history', 'Chart', 'Image', 'URL', 'URLSearchParams', 'Event', 'CustomEvent', 'console',
    'addEventListener', 'removeEventListener', 'getComputedStyle', 'alert', 'confirm', 'open',
    'scrollTo', 'requestIdleCallback', 'performance', 'AbortController']) {
    ctx[name] = stub();
  }
  ctx.window = ctx;
  ctx.self = ctx;
  ctx.globalThis = ctx;
  ctx.console = { log() {}, warn() {}, error() {}, info() {}, debug() {} };
  return ctx;
}

// Runs the files in order. Between files the event loop is drained (setImmediate), which models
// a promise or timer firing while the browser is still fetching the next <script>. console.error
// calls and unhandled rejections inside the page count as errors too: page code wraps its startup
// in .catch handlers that only log, so a load-order bug would otherwise stay invisible.
async function runFiles(files) {
  const ctx = makeContext();
  const errors = [];
  let current = '(between files)';
  ctx.console = {
    log() {}, warn() {}, info() {}, debug() {},
    error(...args) {
      // Errors made inside the vm come from another realm, so test by shape, not instanceof.
      const isErr = a => a && typeof a === 'object' && typeof a.message === 'string' && typeof a.name === 'string';
      const e = args.find(isErr);
      const text = args.filter(a => typeof a === 'string').join(' ').trim();
      errors.push({ file: current, name: e ? e.name : 'console.error', message: e ? `${text} ${e.message}`.trim() : text });
    },
  };
  const onRejection = reason => {
    errors.push({ file: current, name: (reason && reason.name) || 'UnhandledRejection', message: String(reason && reason.message) });
  };
  process.on('unhandledRejection', onRejection);
  const tick = () => new Promise(resolve => setImmediate(resolve));
  for (const { name, code } of files) {
    current = name;
    try {
      vm.runInContext(code, ctx, { filename: name });
    } catch (err) {
      errors.push({ file: name, name: err && err.name, message: String(err && err.message) });
    }
    await tick();
  }
  current = '(after last file)';
  await tick();
  await tick();
  process.off('unhandledRejection', onRejection);
  return errors;
}

const html = readFileSync(join(root, 'nfl/index.html'), 'utf8');
const srcs = [...html.matchAll(/<script\s+src="([^"]+)"[^>]*><\/script>/gi)].map(m => m[1]).filter(s => s.startsWith('/nfl/js/'));
const tailwindConfig = srcs.filter(s => s.endsWith('/tailwind-config.js'));
const mainSrcs = srcs.filter(s => !s.endsWith('/tailwind-config.js'));
const filesA = srcs.map(s => ({ name: s, code: readFileSync(join(root, s), 'utf8') }));

const baseHtml = execFileSync('git', ['show', `${BASE}:nfl/index.html`], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const baseLines = baseHtml.split('\n');
const scriptOpens = baseLines.map((l, i) => (l === '<script>' ? i : -1)).filter(i => i >= 0);
const scriptCloses = baseLines.map((l, i) => (l === '</script>' ? i : -1)).filter(i => i >= 0);
if (scriptOpens.length !== 2 || scriptCloses.length !== 2) throw new Error('baseline: expected 2 inline scripts');
const baseTailwind = baseLines.slice(scriptOpens[0] + 1, scriptCloses[0]).join('\n');
const baseMainLines = baseLines.slice(scriptOpens[1] + 1, scriptCloses[1]);
const baseMain = baseMainLines.join('\n');

const errA = await runFiles(filesA);
const errB = await runFiles([{ name: 'baseline:tailwind', code: baseTailwind }, { name: 'baseline:main', code: baseMain }]);

const show = errs => errs.length ? errs.map(e => `  ${e.file}: ${e.name}: ${e.message}`).join('\n') : '  (no errors)';
console.log('Script order (Mode A):\n  ' + srcs.join('\n  '));
console.log('\nMode A (split files) errors:\n' + show(errA));
console.log('\nMode B (baseline ' + BASE + ') errors:\n' + show(errB));

// Pass: Mode A throws nothing Mode B did not.
const baseKeys = new Set(errB.map(e => `${e.name}: ${e.message}`));
const newErrs = errA.filter(e => !baseKeys.has(`${e.name}: ${e.message}`));
let failed = false;
if (newErrs.length) {
  failed = true;
  console.log('\nFAIL: Mode A threw errors the baseline did not:\n' + show(newErrs));
}

// Lossless check. MOVED_TO_BOOT lists the line ranges (inclusive, numbered as in
// 52aa24a:nfl/index.html) that were cut out of their banner section and put in boot.js.
// Rule: original script minus those ranges == the other local files joined in load order,
// and boot.js == those ranges in original order.
const MOVED_TO_BOOT = [[5627, 5650], [7274, 7276]];
const firstScriptLine = scriptOpens[1] + 2; // original line number of baseMainLines[0]
const inMoved = n => MOVED_TO_BOOT.some(([a, b]) => n >= a && n <= b);
const bootSrc = mainSrcs.find(s => s.endsWith('/boot.js'));
const fileLines = src => readFileSync(join(root, src), 'utf8').replace(/\n$/, '').split('\n');
const bootLines = fileLines(bootSrc);
const otherLines = mainSrcs.filter(s => s !== bootSrc).flatMap(fileLines);
const expectBoot = [];
const expectOther = [];
baseMainLines.forEach((text, i) => {
  const n = firstScriptLine + i;
  (inMoved(n) ? expectBoot : expectOther).push(text);
});
// baseMainLines ends with the blank line before </script>; files end without a trailing blank
// line split, so compare after trimming that one final empty element on both sides.
const same = (x, y) => x.length === y.length && x.every((l, i) => l === y[i]);
const lossless = same(expectOther, otherLines) && same(expectBoot, bootLines);
console.log('\nLines moved to boot.js (original line numbers in ' + BASE + ':nfl/index.html):');
baseMainLines.forEach((text, i) => {
  const n = firstScriptLine + i;
  if (inMoved(n)) console.log(`  ${n}: ${text}`);
});
console.log(`\nLossless cut: ${lossless ? 'OK' : 'MISMATCH'} (${otherLines.length} lines in section files + ${bootLines.length} in boot.js = ${otherLines.length + bootLines.length}; original script ${baseMainLines.length} lines)`);
if (!lossless) failed = true;

console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
