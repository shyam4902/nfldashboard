# NFL Dashboard — State

- updated: 2026-08-26
- live: https://nfldashboard.pages.dev/ (Cloudflare Pages, auto-deploys on push to main)
- repo: https://github.com/shyam4902/nfldashboard · single-file app in `index.html` + Supabase + static JSON

## Shipped recently
- Roster modal redesign: player chips ~40% bigger with bold typography, fill every grid row
  (no dead right space); new summary strip (projected record, cap space, draft capital, top
  player); Madden ratings demoted to muted right-aligned badges (hover for value).
- Teams UI: sub-tabs are now large pill buttons with icons + live Moves count; division nav
  rebuilt as card-style buttons with conference color stripes and press feedback.
- Full-season schedule (weeks 1-18, 272 games) with week-chip selector defaulting to the
  current week; week-keyed live nflverse lines; home marquee follows current week.
- Draft capital extended to 2027/2028/2029 (incl. Wallace pick swap); comp-pick schema
  reserved; per-year pick counts on team tiles. Wallace trade added to Moves feed (373 moves).
- Earlier: Teams → Moves newswire, home showcase, Week 1 schedule, defense rebuild, STATE.md.

## In flight
- Nothing — working tree clean aside from test-runner screenshot regenerations.

## Next
- **Formation view (user's idea):** Madden ratings move off the main pages into a football
  formation graphic (X's and O's) with each player + rating placed by position — for offense
  and defense. The killer use case: open two tabs, one team's offense vs the other's defense,
  for next week's matchup, to see where the advantage is. This is the intended long-term home
  for ratings.
- Add comp picks to draft capital when a reliable 2027+ source exists.
- In-season: weekly actuals vs Clay projections once games are played.

## Blockers
- None.