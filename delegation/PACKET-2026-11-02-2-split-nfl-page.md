# PACKET-2026-11-02-2: split nfl/index.html into plain files
Repo: /Users/shyampatel/Desktop/NFL_Main/nfldashboard (work directly in this tree; base commit 52aa24a)
Plan diagram: /Users/shyampatel/Desktop/second-brain/projects/matchup-board/diagrams/nfl-split-plan.svg

`nfl/index.html` is 7,279 lines: CSS, JavaScript and markup in one file. Every agent has to read and edit all of it, so packets run slowly and two can't run at once. This packet moves the CSS and JS into separate files. It is cut and paste only. The page must behave exactly as it does now. Read AGENTS.md first.

## The one rule that matters

Use plain classic scripts: `<script src="/nfl/js/core.js"></script>`. Do NOT use `type="module"`, `defer` or `async`. The page has about 100 inline handlers (`onclick="openRoster(...)"` and so on) that need functions on the global scope, and classic scripts placed in the same spot, in the same order, share that scope.

There is one trap. Inside a single script, function declarations are hoisted, so code near the top could call a function defined lower down. Once split, a top-level call in `core.js` that runs while the page loads cannot see a function that `schedule.js` hasn't defined yet. The same goes for a `let`/`const` declared in a later file (temporal dead zone). Fix it by moving every statement that runs at load time and touches a later file into `nfl/js/boot.js`, which loads last. Function and variable *declarations* stay where they are. Only top-level calls and listeners move. `initTheme();` at the very end is one of them. Find the rest with the T3 harness.

Tip: do the cut with a short Python script that slices by line number. Don't hand-edit 7,000 lines. Line numbers below are from commit 52aa24a. The bot never touches this file, but check each boundary line before cutting.

## Tasks

T1. CSS. Move the `<style>` block (lines 92-1748, the content between the tags) to `nfl/nfl.css`. Put `<link rel="stylesheet" href="/nfl/nfl.css">` where the `<style>` tag was. The `@import url(fonts.googleapis...)` line moves with it and must stay first in the file.

T2. JS. Move the head script (lines 9-90, the Tailwind config) to `nfl/js/tailwind-config.js`, loaded at the same spot, right after the Tailwind CDN tag. Split the main script (content of lines 2106-7277) at the existing `// ═══` banner lines into these files, in this order:
- `core.js`: 2107-2834 (Supabase client, data loading, shared game helpers)
- `home.js`: 2835-3290 (home 2a hero, scorestrip)
- `render.js`: 3291-3486 (computed gains/losses, render functions)
- `roster.js`: 3487-3757 (roster modal)
- `matchup.js`: 3758-5179 (Pro Matchup Center)
- `league.js`: 5180-5508
- `routing.js`: 5509-5733 (interactions, hash routing, PROPS_BOARD and EFFICIENCY_DATA loaders)
- `schedule.js`: 5734-6628 (schedule, live game lines)
- `extensions.js`: 6629-7273 (themes, radar, player modal, compare, command palette)
- `boot.js`: `initTheme();` plus every load-time statement T3 shows must move.

Replace the main `<script>...</script>` with one `<script src="/nfl/js/<name>.js"></script>` per file, same position, same order. Use absolute `/nfl/...` paths so `/nfl` without a trailing slash still works. Don't rename, reformat or "improve" anything.

T3. Load-order harness: `scripts/check_nfl_split.mjs` (Node stdlib only, `node:vm`).
- Build one vm context with a stub global: `window`, `document`, `localStorage`, `fetch`, `supabase`, `tailwind`, `matchMedia`, `IntersectionObserver`, `setTimeout` and so on. Each returns a recursive Proxy whose properties and calls return the same kind of Proxy. `then` returns undefined, so awaits don't hang, and `Symbol.toPrimitive` returns `() => ''`. Set `window` to the context itself so globals line up.
- Mode A: read the script `src` list from `nfl/index.html`, run each local file in order in that one context with `vm.runInContext`, and collect any thrown error with its file name.
- Mode B (baseline): pull the original single main script out of `git show 52aa24a:nfl/index.html` and run it the same way.
- Pass when Mode A throws nothing that Mode B didn't, and especially no `ReferenceError` or `... is not a function`. Print both results.
- Also check the cut is lossless: the local JS files concatenated in load order, minus the lines moved to `boot.js`, equal the original script content line for line. Print the moved lines.
- Done: `node scripts/check_nfl_split.mjs` exits 0.

T4. Keep the checks that read the page working.
- `check_html_scripts.mjs`: for each page, also `node --check` every local `<script src="/...">` file. Each page then needs inline OR local scripts, not inline only.
- `props-smoke.mjs`: its source-text checks read `nfl/index.html` only. Make `sourceHtml` the HTML plus every local script and `nfl/nfl.css` it references. Its server already serves `.js` and `.css`.
- `scripts/production-health-check.mjs`: delete checks 5 and 6. They test the Moves tab, which was removed in commit 52aa24a. Check 7 (Madden isolation) reads the HTML plus the local nfl scripts.
- AGENTS.md and CLAUDE.md line 14: add one sentence. "NFL page code: markup in `nfl/index.html`, styles in `nfl/nfl.css`, scripts in `nfl/js/` (classic scripts, load order matters, startup calls in `boot.js`)."

T5. Self-review. Confirm `nfl/index.html` has no inline `<script>` left except `<script src>` tags and the JSON-LD/meta tags if any, and no `<style>` block. List each file's line count. No new file should go much past 1,500 lines. If `matchup.js` does, leave it and say so. Don't split further.

## Done: all of these exit 0
- `node scripts/check_nfl_split.mjs`
- `node check_html_scripts.mjs`
- `node scripts/validate-data.js`
- `node --check props-smoke.mjs && node --check scripts/production-health-check.mjs`
- `node --test validate_data.test.js sync_scores.test.js persist_espn_transactions.test.js update_rosters_from_espn.test.js concurrent_publish.test.js scripts/league_data.test.js scripts/team_tendencies.test.js nba/nba.test.mjs`
- `grep -c "<style" nfl/index.html` prints 0, and `grep -n "<script>" nfl/index.html` prints nothing

## Hard rules
- No git commands of any kind. Leave changes in the working tree.
- No dependencies, no build step, no bundler, no npm or pip install.
- Don't touch `nba/`, the root `index.html`, any data file, Supabase or the sync and publish scripts.
- No refactors, renames or behavior changes. If something looks broken, note it in the walkthrough and leave it.
- No dev server, no browser, no Playwright (its browser isn't installed).
- Stop after T5. If one task takes over 20 minutes, write what you have and mark the rest SKIPPED.

## Required output
`delegation/PACKET-2026-11-02-2-walkthrough.md`. For each task: files touched, what changed, and the command output that proves it. Include the list of lines moved to `boot.js` and the before/after line counts. Write the walkthrough as you go, so a cut-off run still leaves it. Draw what changed with reladraw (`reladraw --help`) as `delegation/PACKET-2026-11-02-2-changes.reladraw`, render it to .svg, and link it at the top of the walkthrough.

## Excluded (orchestrator-side)
- Browser check of every tab, the roster modal and a matchup at phone and desktop width, with no console errors.
- Commit and deploy.
