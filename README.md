# NFL Dashboard

> Edge app URL policy: use `https://edge.shyamsapps.qzz.io`, the live custom
> domain. `https://edgeplay-analytics.pages.dev` is the fallback for the same
> deployment. Lovable is historical only.

Static dashboard app, single-file (`index.html` + JSON assets).

## Deploy (confirmed 2026-09-01)

`https://nfldashboard.pages.dev/` is **git-connected to the GitHub repo
(`shyam4902/nfldashboard`, branch `main`) and auto-deploys on push**. To ship a
change:

```bash
git push origin main
```

Cloudflare Pages builds the pushed commit and publishes it (takes ~1–2 min).
Verified 2026-09-01: live site matched `origin/main` byte-for-byte before a
push, and the new build appeared ~1 min after `c805bff..503f3d2` landed.

Verification after deploy:

```bash
curl -s https://nfldashboard.pages.dev/ | grep -o "<marker text>"
# or load the URL in a browser and check console for errors
```

## Data files

The dashboard fetches its data from the repo itself: `props-board.json`
(copied from the fantasyfootball export), `schedule.json`, `nfl_rosters_2026.json`,
`clay_projections_2026.json`, `team_season_efficiency.json`, and the
`data/shared/` unified layer. Keep every JSON the page fetches committed, or
the deployed page 404s on it.

> The Props & Value tab is gone (ticket 13); props live in the Edge Analytics
> app. The dashboard reads `props-board.json` only for the Home insight line,
> the player modal, and the Schedule cross-link.

## Local dev preview

`~/Library/Application Support/nfldashboard-props/nfldashboard/` is a *local*
runtime copy maintained by `fantasyfootball/scripts/install-launchd.sh` (used
by the launchd pipeline jobs). It is **not** the public deployment — editing it
does not ship anything. For a quick local preview, either serve this checkout
(`python3 -m http.server`) or refresh that runtime copy; neither touches
pages.dev.