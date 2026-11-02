# PACKET-2026-11-02-2 walkthrough: split nfl/index.html

Diagram: [PACKET-2026-11-02-2-changes.svg](PACKET-2026-11-02-2-changes.svg) (source: `PACKET-2026-11-02-2-changes.reladraw`)

Base: working tree at 52aa24a. No git commands were run by hand. The harness itself calls `git show 52aa24a:nfl/index.html` read-only, as the spec asked.
All boundary lines (9, 90, 92, 1748, 2106, 7277, the nine `// ═══` banners, 7274, 7275) were asserted by the cut script before slicing.

## T1. CSS: done
- New `nfl/nfl.css` (1,655 lines) = old lines 93-1747. `@import url(fonts.googleapis...)` is still first.
- `nfl/index.html`: `<style>` block replaced by `<link rel="stylesheet" href="/nfl/nfl.css">`.
- Proof: `grep -c "<style" nfl/index.html` prints `0`. (`home.js` still has a `<style>` inside a JS template string. That is JS content, not a tag in the HTML.)

## T2. JS: done
- `nfl/js/tailwind-config.js` (80 lines) = old lines 10-89, loaded right after the Tailwind CDN tag.
- Main script split at the banners into `core, home, render, roster, matchup, league, routing, schedule, extensions, boot`, ten `<script src="/nfl/js/<name>.js">` tags in the old position and order. Classic scripts, no module/defer/async.
- Lines moved to `boot.js` (original numbers in 52aa24a):
  - 5627-5650: the `// INIT` block, `loadAllData().then(() => { ...renderHome(); applyHash(); renderTeams(); ... }).catch(...)` plus its trailing blank line. It was at the bottom of the routing section.
  - 7274-7276: `// ── INIT THEME ON START ──`, `initTheme();`, blank line.
- Why the INIT block moved: its `.then` callback runs when the Supabase fetch resolves. That can happen while the browser is still downloading `schedule.js`, `extensions.js` or `boot.js`, and the callback calls `loadFreshness`, `loadPipelineStatus`, `renderHome` and `applyHash`. The harness caught it as `ReferenceError: loadFreshness is not defined` before the move.
- Listeners (`hashchange`, `keydown`, `scroll`, Escape) and `Object.assign(MATCHUP_STATE, ...)` stayed put: they only touch things defined in their own or earlier files at the time they fire or run (`MATCHUP_STATE` is declared in `core.js`). The only other top-level initializer that calls anything is `const sb = window.supabase.createClient(...)` in `core.js`, which uses the CDN script.

## T3. Harness: done
`scripts/check_nfl_split.mjs`, Node stdlib only, `node:vm`.
- One vm context, recursive Proxy stubs for the browser globals. `then` is undefined, `Symbol.toPrimitive` returns `''`. Two additions beyond the spec, both needed to make it catch real bugs: a stub's `.error` is `null` (so `{data, error}` Supabase results look like success and `loadAllData` reaches its `.then`), and the event loop is drained between files, with `console.error` calls and unhandled rejections counted as errors (page startup wraps itself in a `.catch` that only logs).
- Mode A runs the `src` list from `nfl/index.html`. Mode B runs the original two inline scripts from `git show 52aa24a:nfl/index.html`.
- Lossless check: the original script minus the two moved ranges equals the other files joined in order, and `boot.js` equals the moved ranges. 5143 + 27 = 5170 lines, matches the original.
- `node scripts/check_nfl_split.mjs` prints, ending with `Lossless cut: OK ...` and `RESULT: PASS`, exit 0. Mode A errors: none. Mode B errors: none.

## T4. Checks that read the page: done
- `check_html_scripts.mjs`: also runs `node --check` on each local `<script src="/...">`. Output: `index.html ... (3 inline blocks, 0 local files)`, `nfl/index.html ... (0 inline blocks, 11 local files)`, `nba/index.html ... (2 inline blocks, 0 local files)`. Exit 0.
- `props-smoke.mjs`: `sourceHtml` is now `nfl/index.html` plus every local `/nfl/*.js` and `/nfl/*.css` it references. `node --check` passes. Not run (needs a browser).
- `scripts/production-health-check.mjs`: old checks 5 and 6 (Moves tab) deleted, old check 7 is now check 5 and reads the HTML plus the local nfl scripts. `node --check` passes. Not run (live network).
- `AGENTS.md` and `CLAUDE.md` line 14: sentence added.

## T5. Self-review: done
- `nfl/index.html` has no `<style>`, no inline `<script>`, only `<script src>` tags. `grep -n "<script>" nfl/index.html` prints nothing.
- `_redirects` and `_headers` need no change: nothing denies `/nfl/js/*` or `/nfl/nfl.css`, and the CSP allows `script-src 'self'`.

| file | lines |
|---|---|
| nfl/index.html (was 7,279) | 380 |
| nfl/nfl.css | 1,655 |
| nfl/js/tailwind-config.js | 80 |
| nfl/js/core.js | 728 |
| nfl/js/home.js | 456 |
| nfl/js/render.js | 196 |
| nfl/js/roster.js | 271 |
| nfl/js/matchup.js | 1,422 |
| nfl/js/league.js | 329 |
| nfl/js/routing.js | 201 |
| nfl/js/schedule.js | 895 |
| nfl/js/extensions.js | 645 |
| nfl/js/boot.js | 27 |

`nfl.css` is past 1,500 (1,655) because it is one cut as specified. Left as is. No JS file is over 1,500.

## Notes for the orchestrator
- `scripts/check_nfl_split.mjs` is not in the `_redirects` deny list, so it is publicly fetchable like any other file in `scripts/` not listed. It holds nothing sensitive. Add it to `_redirects` if you want it masked.
- The stray `<style>`/`</style>` inside the template literal in `home.js` is intentional existing code.
- Not verified here: any browser behavior. Excluded per the packet.

## Done-criteria output
```
node scripts/check_nfl_split.mjs                -> exit 0, RESULT: PASS
node check_html_scripts.mjs                     -> exit 0 (3 pages OK)
node scripts/validate-data.js                   -> "validate-data: all 18 assets pass", exit 0
node --check props-smoke.mjs && node --check scripts/production-health-check.mjs -> exit 0
node --test <8 files>                           -> tests 95, pass 95, fail 0, exit 0
grep -c "<style" nfl/index.html                 -> 0
grep -n "<script>" nfl/index.html               -> (nothing)
```
