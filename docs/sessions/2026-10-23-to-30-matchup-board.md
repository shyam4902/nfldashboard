# Matchup Board: from NFL dashboard to a two-league site (2026-10-23 to 10-30)

One Claude Code session, run from `~/Desktop/second-brain` with `~/Desktop/NFL_Main` attached.
Claude planned, wrote packets, verified and pushed. Freebuff and Gemini wrote most of the code.

Site map now: [diagrams/site-map-2026-10-30.svg](../../diagrams/site-map-2026-10-30.svg)

## Where things stand

- Live at **https://matchupboard.com**. `/` is a sport picker, NFL is at `/nfl/`, NBA is at `/nba/`.
  `nfldashboard.pages.dev` still works and serves the same site.
- Repo: `~/Desktop/NFL_Main/nfldashboard` → `github.com/shyam4902/nfldashboard`, `main`.
  Pushing `main` deploys (Cloudflare Pages, about 1-2 minutes). The score-sync bot commits to
  `main` hourly, so always `git pull --ff-only` first.
- Last commit from this session: `459472e`.

## Decisions (Shyam's, keep them)

1. **Two separate products.** Matchup Board (scores, matchups, stats) on matchupboard.com.
   The props/betting terminal (Edge, `edgeplay-analytics`) stays separate; its domain pick is
   **propstoday.app** ($9.99, not bought yet). No props, odds, predictions, news or fantasy on
   Matchup Board, ever. Each NBA view greps for those words as a check.
2. **The pitch is "more than scores".** Data you'd use to size up a matchup, in a clean layout
   you'd otherwise pay for or build yourself. ESPN/Sleeper density, no bloat.
3. **Every league is a sub-page.** `/nfl/`, `/nba/`, later others; `/` is only the picker. This
   rule is in `nfldashboard/AGENTS.md` and `CLAUDE.md` ("Site layout rule").
4. **Domain.** matchupboard.com bought 2026-10-30 through Vercel (registrar Name.com). DNS moved
   to Cloudflare (`brady.ns.cloudflare.com`, `treasure.ns.cloudflare.com`); both apex and `www`
   are custom domains on the `nfldashboard` Pages project. Shyam later liked matchupdesk.com
   better; it's still available and could redirect here.
5. **Freebuff sessions are one-hour blocks**, and as of 10-30 Shyam gets about one a day. Size
   packets to fill 20-40+ minutes, and queue the next packet before the timer runs out (freebuff
   finishes a packet started before expiry). Rule saved in the delegate skill and Claude memory.

## What shipped, in order

| Commit | What | Who |
|---|---|---|
| `52953a4` | NBA scores page at `/nba/` (scores, standings, team, box score) + NFL matchup-switching fix ported from September | freebuff (packet 1) + Claude |
| `1f9624c` | NBA visual polish, live scores refresh in place | Gemini (packet 2) |
| `d7a78f0` | Matchup Board rebrand, one NFL/NBA switch, favicon, share card (`og-image.png`), robots, sitemap; NBA team compare, pre-game matchup page, player pages | freebuff (packet 3) + Claude (fixed a stray `<style>`, rendered the PNG) |
| `184a53a` | NBA leaders (6 boards), player search, live box-score refresh, game log by season type, team data cache, standings PPG/OPP/DIFF, date picker | freebuff (packet 4) |
| `3887448` | Top scorer on score cards, phone search fixes, team season-stats card, player vs player compare | freebuff (packet 5) |
| `79a9718` | NFL page moved to `nfl/index.html` with root-absolute data URLs; `/` is the picker and forwards old `/#...` links to `/nfl/#...`; tests and scripts repointed | freebuff (packet 6) |
| `459472e` | NBA finish: images through ESPN's resizer (207KB → 8KB headshots), per-view page titles, team stats on game pages, accessibility pass, league-wide standings, `404.html` | freebuff (packet 7) + Claude (whole-number counts) |

Packets and walkthroughs: `nfldashboard/delegation/PACKET-2026-10-23-{1,2}*` and
`PACKET-2026-10-30-{3..7}*`. Each walkthrough has a "Known gaps" section.

Also: `fantasyfootball` commit `a1f48a2` makes the local preview installer copy `nfl/index.html`
(committed, not pushed).

## How the NBA side works

- `nba/index.html` (one page, hash routes) + `nba/nba.js` (pure parsers, exported) +
  `nba/nba.test.mjs` (21 tests against `nba/fixtures/`).
- Routes: `#scores[/YYYYMMDD]`, `#standings[/league]`, `#leaders`, `#compare/<a>/<b>`,
  `#players/<a>/<b>`, `#team/<id>`, `#player/<id>`, `#game/<id>` (box score when live/final,
  matchup page when not started).
- Data comes straight from ESPN in the browser. No keys, no cron, no Supabase. All endpoints
  send `access-control-allow-origin: *` (checked 10-23 and 10-30):
  `site.api.espn.com/apis/site/v2/sports/basketball/nba/{scoreboard,summary,teams,teams/<id>/{schedule,roster,statistics}}`,
  `site.api.espn.com/apis/v2/sports/basketball/nba/standings`,
  `site.web.api.espn.com/apis/common/v3/sports/basketball/nba/athletes/<id>[/overview|/gamelog]`,
  `.../statistics/byathlete` (leaders), `site.web.api.espn.com/apis/common/v3/search` (filter `league === 'nba'`),
  and `a.espncdn.com/combiner/i?img=<path>&w=&h=` for small images.
- ESPN's `?dates=` is the Eastern date (`etDate`). Early in the season ESPN gives tied teams the
  same playoff seed, so seeds aren't unique.

## How the NFL side moved

Only the HTML moved. Every data file stays at the repo root because the hourly GitHub Action and
the daily publish job write there, so `nfl/index.html` loads `/schedule.json`, `/data/shared/...`,
`/scripts/load_team_tendencies.js` by absolute path. `_redirects` hides internal files
(fixtures, delegation, diagrams, docs, tests) from the public site.

## Verification habits that paid off

- Re-run every done command from a packet yourself; treat the walkthrough as a claim.
- Check in the browser at 375px before pushing. That caught: the stray `<style>` that dropped a
  CSS rule, PCT showing `.1000`, schedule rows missing the opponent score, and `46.0` rebounds.
- Push each packet before the next one starts editing the same files, so diffs stay clean.
- Local DNS on this Mac (VPN) cached the old Vercel records for a while. Check the domain with
  DNS-over-HTTPS (`dns.google/resolve`) or `curl --resolve`, not plain `dig`.

## Open items

- **Next packet:** bring compare and player pages to `/nfl/` so both leagues match.
- Live box-score refresh hasn't been watched during a real live game yet.
- September power rankings sit on local branch `wip/2026-09-power-rankings` (never pushed, Week 1 data).
- Untracked September leftovers in nfldashboard (`audit_mobile.py`, `screenshots_mobile/`, mobile reports,
  `.superpowers/`) were never reviewed.
- Edge terminal: back-link (ticket 04), retire the Lovable deployment, buy propstoday.app.
- Smaller NBA gaps listed in packets 5 and 7 walkthroughs (header search debounce, Firefox date
  field width, one-player compare prefill).
