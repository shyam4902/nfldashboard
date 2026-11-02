// Written by design/polish/freeze.mjs (or by hand for the first set). Loaded
// by the variant pages before shim.js. Every file listed here is a raw ESPN
// response saved as-is; nothing is edited or made up.
window.POLISH = {
  date: '20261022',
  // 23:59 ET on the frozen date, so "today" on the page is that day.
  now: '2026-10-23T03:59:00Z',
  featured: '401909093',
  away: '5',
  home: '20',
  label: 'Thu, Oct 22, 2026',
  note: 'Copied from nba/fixtures (captured from ESPN on Oct 22-23). Only the points leaders board, one summary and Cleveland\'s statistics (no schedule) were captured; run design/polish/freeze.mjs on a machine that can reach ESPN for a full set.',
  files: [
    'scoreboard-20261022.json',
    'summary-401909093.json',
    'standings.json',
    'leaders-points.json',
    'team-20-statistics.json',
    'team-20-schedule.json',
    'team-20-roster.json',
    'team-5-statistics.json',
    'athlete-4431678.json',
    'athlete-4431678-overview.json',
    'athlete-4431678-gamelog.json',
  ],
};
