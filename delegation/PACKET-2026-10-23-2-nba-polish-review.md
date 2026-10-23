# PACKET-2026-10-23-2: NBA page polish and review
Repo: /Users/shyampatel/Desktop/NFL_Main/nfldashboard — work directly in this tree.
Executor: Gemini. Run only after PACKET-2026-10-23-1 is done (its walkthrough exists at
delegation/PACKET-2026-10-23-1-walkthrough.md).

## Context

PACKET-2026-10-23-1 built `nba/index.html` + `nba/nba.js`, a plain NBA scores site
(scores, standings, team, box score) that reads ESPN in the browser. Read that packet
first. The goal is an ESPN or Sleeper scores page with no bloat. Dense, fast to scan,
built for a phone. No props, odds, news, or fantasy, ever.

## Tasks

T1. Review. Check every T1-T4 claim in PACKET-2026-10-23-1 against the working tree by
running each done-criteria command yourself. Do not trust the walkthrough. Also read
`nba/nba.js` for: stats read by array index instead of by label/name, any date key built
from UTC instead of `etDate`, a polling timer that keeps running when no game is live or
that stacks a second timer on route change, and `innerHTML` built from API strings
without escaping.
- Done: `delegation/PACKET-2026-10-23-2-VERDICTS.md` has one line per packet-1 task:
  `T<n> — PASS | BROKEN — command run — output — file:line if BROKEN`, then a
  "Code findings" list with file:line for each problem from the read-through.

T2. Visual polish, `nba/index.html` only (markup and CSS; leave `nba/nba.js` alone unless
a T1 finding needs a fix, and say so in the verdicts).
- Score cards: team rows stacked (away above home) like ESPN's scoreboard, score
  right-aligned in tabular numerals (`font-variant-numeric: tabular-nums`), status in
  the top-right corner, live status in the accent color with a small pulsing dot.
- Two cards per row from 640px, one below. Standings and box score tables use
  tabular numerals and right-aligned number columns.
- Keep the NFL page's palette (warm charcoal, single gold accent) and fonts. No new colors
  outside the existing CSS variables and the Tailwind config block.
- Light text on dark must keep at least 4.5:1 contrast for body text.
- Done:
  - `node --test nba/nba.test.mjs` still passes.
  - `grep -c "tabular-nums" nba/index.html` ≥ 1.
  - `grep -cE "pickcenter|againstTheSpread|odds" nba/index.html` prints 0.
  - The packet-1 T3 inline-script syntax command still prints ok.

## Hard rules
- Do NOT run any git commands. Leave changes in the working tree.
- Do NOT add dependencies or external scripts. Tailwind CDN and Google Fonts only.
- Do NOT edit any file except `nba/index.html`, `nba/nba.js` (only for T1 fixes), and the verdicts file.
- BUDGET: static edits only. No dev server, no browser, no builds.

## Required output
`delegation/PACKET-2026-10-23-2-VERDICTS.md` as described in T1, plus a short T2 section:
what changed in `nba/index.html` (file:line) and the output of each T2 done command.

## Excluded (orchestrator-side, do not attempt)
- Browser check at 375px and desktop, live ESPN data, screenshots.
- Commit, push, domain setup.
