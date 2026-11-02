// INIT
loadAllData().then(() => {
  console.log('[DATA loaded]', {
    teams: DATA.teams.length,
    players: DATA.players.length,
    transactions: DATA.transactions.length,
    rookies: DATA.players.filter(p => p.is_rookie === true || p.is_rookie === 'Yes').length,
    rated: DATA.players.filter(p => p.ovr !== null).length
  });
  loadFreshness().then(() => {  // ticket 01/14: manifest for data-age stamps
    ['scheduleFreshness', 'teamsFreshness', 'matchupFreshness'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = dataAgeBadge({ schedule: 'schedule', teams: 'rosters', matchup: 'team_efficiency' }[id.replace('Freshness', '')]);
    });
  });
  loadPipelineStatus();        // checkpoint 4: owner-visible failed-update banner
  renderHome();                 // first-run showcase (hero, features, spotlights)
  applyHash();                  // honour a shared #tab / #matchup/<id> link
  renderTeams();
}).catch(e => {
  document.body.innerHTML = '<div style="padding:40px;color:#ef4444;font-family:monospace">Failed to load data from Supabase: ' + e.message + '</div>';
  console.error('[loadAllData failed]', e);
});

// ── INIT THEME ON START ──
initTheme();

