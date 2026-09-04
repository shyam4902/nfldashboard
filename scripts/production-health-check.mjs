import fs from 'fs';

async function check() {
  console.log("=== Production Health Check ===");
  const results = [];

  // 1. Transaction date freshness
  const resTx = await fetch("https://nedyoydylpbjvihaoexy.supabase.co/rest/v1/nfl_transactions?select=sort_date,date_str&order=sort_date.desc&limit=1", {
    headers: { apikey: "sb_publishable_cQOHCiQh2kZQQUn5sEEfIA_t9NScNZz" }
  });
  const latestTx = (await resTx.json())[0];
  const txDate = latestTx ? new Date(latestTx.sort_date || latestTx.date_str) : null;
  const now = new Date();
  const txAgeDays = txDate ? (now - txDate) / (1000 * 60 * 60 * 24) : 999;
  const espnRes = await fetch("https://site.api.espn.com/apis/site/v2/sports/football/nfl/transactions?limit=1");
  const espnLatest = (await espnRes.json()).transactions?.[0]?.date?.slice(0, 10);
  const passTxAge = txAgeDays <= 30 && latestTx?.sort_date === espnLatest;
  results.push({
    name: "Newest transaction <= 30 days old and matches ESPN latest",
    pass: passTxAge,
    detail: `Live latest: ${latestTx?.sort_date}, ESPN latest: ${espnLatest}, Age: ${txAgeDays.toFixed(1)} days`
  });

  // 2. Supabase roster count
  const resP = await fetch("https://nedyoydylpbjvihaoexy.supabase.co/rest/v1/nfl_players?select=id", {
    headers: { apikey: "sb_publishable_cQOHCiQh2kZQQUn5sEEfIA_t9NScNZz", Prefer: "count=exact", Range: "0-0" }
  });
  const countHeader = resP.headers.get("content-range");
  const rosterCount = countHeader ? parseInt(countHeader.split("/")[1], 10) : 0;
  const passRosterCount = rosterCount === 1699;
  results.push({
    name: "Supabase roster count matches ESPN active snapshot (1,699)",
    pass: passRosterCount,
    detail: `Current count: ${rosterCount} (expected 1,699)`
  });

  // 3. Team active roster counts (52-54 per team)
  const resT = await fetch("https://nedyoydylpbjvihaoexy.supabase.co/rest/v1/nfl_teams?select=id,abbr", {
    headers: { apikey: "sb_publishable_cQOHCiQh2kZQQUn5sEEfIA_t9NScNZz" }
  });
  const teams = await resT.json();
  const teamCounts = {};
  for (let page = 0; ; page++) {
    const resPlayers = await fetch(`https://nedyoydylpbjvihaoexy.supabase.co/rest/v1/nfl_players?select=team_id&offset=${page*1000}&limit=1000`, {
      headers: { apikey: "sb_publishable_cQOHCiQh2kZQQUn5sEEfIA_t9NScNZz" }
    });
    const players = await resPlayers.json();
    for (const p of players) teamCounts[p.team_id] = (teamCounts[p.team_id] || 0) + 1;
    if (players.length < 1000) break;
  }
  const sizes = teams.map(t => teamCounts[t.id] || 0);
  const teamCountsPass = sizes.length === 32 && Math.min(...sizes) >= 52 && Math.max(...sizes) <= 54;
  results.push({
    name: "Every NFL team has expected active roster count (52-54)",
    pass: teamCountsPass,
    detail: `32 teams: min ${Math.min(...sizes)}, max ${Math.max(...sizes)}, total ${sizes.reduce((a,b)=>a+b, 0)}`
  });

  // 4. Duplicate tx_id
  const resTxId = await fetch("https://nedyoydylpbjvihaoexy.supabase.co/rest/v1/nfl_transactions?select=tx_id&tx_id=not.is.null&limit=1000", {
    headers: { apikey: "sb_publishable_cQOHCiQh2kZQQUn5sEEfIA_t9NScNZz" }
  });
  const txIdData = await resTxId.json();
  const hasTxIdCol = Array.isArray(txIdData);
  const seenTx = new Set();
  let hasDupes = false;
  if (hasTxIdCol) {
    for (const r of txIdData) {
      if (seenTx.has(r.tx_id)) { hasDupes = true; break; }
      seenTx.add(r.tx_id);
    }
  }
  results.push({
    name: "Transactions table has tx_id column and no duplicates",
    pass: hasTxIdCol && !hasDupes,
    detail: hasTxIdCol ? (hasDupes ? "Duplicates found" : "0 duplicates found") : "tx_id column missing"
  });

  // 5. Moves default list contains no draft rows
  const indexHtml = fs.readFileSync("index.html", "utf8");
  const defaultFilterMatch = indexHtml.match(/let txTypeFilter\s*=\s*'([a-z]+)';/);
  const defaultFilter = defaultFilterMatch ? defaultFilterMatch[1] : "unknown";
  const defaultNoDraft = defaultFilter === "moves";
  results.push({
    name: "Default Moves view excludes draft rows",
    pass: defaultNoDraft,
    detail: `Current txTypeFilter default: "${defaultFilter}"`
  });

  // 6. Draft filter still shows draft rows
  const hasDraftButton = indexHtml.includes("typeButton('draft', 'Draft')");
  results.push({
    name: "Draft filter button exists and enables draft viewing",
    pass: hasDraftButton,
    detail: hasDraftButton ? "typeButton('draft', 'Draft') present" : "Draft filter missing"
  });

  // 7. Madden does not mutate identity fields in index.html
  const maddenMutatesAge = indexHtml.includes("p.age = match.age");
  const maddenMutatesJersey = indexHtml.includes("p.jersey = match.jersey");
  const passMaddenIsolation = !maddenMutatesAge && !maddenMutatesJersey;
  results.push({
    name: "Roster identity fields come from ESPN/Supabase, not Madden",
    pass: passMaddenIsolation,
    detail: `Madden overwrites age: ${maddenMutatesAge}, jersey: ${maddenMutatesJersey}`
  });

  console.log("\nSummary of Health Checks:");
  let failures = 0;
  for (const r of results) {
    const mark = r.pass ? "✓ PASS" : "✗ FAIL";
    console.log(`${mark} - ${r.name} (${r.detail})`);
    if (!r.pass) failures++;
  }
  console.log(`\nResult: ${results.length - failures}/${results.length} checks PASSED (${failures} failures).`);
  if (failures > 0) process.exit(1);
}

check().catch(err => { console.error(err); process.exit(1); });
