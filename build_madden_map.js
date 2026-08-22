const fs = require('fs');
const path = require('path');

function normalizeName(name) {
  if (!name) return "";
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/['’.\-]/g, "")
    .replace(/\b(jr|sr|ii|iii|iv|v)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function inferUnit(ea) {
  const s = ea.stats || {};
  const kickPower = s.kickPower?.value || 0;
  const kickAcc = s.kickAccuracy?.value || 0;
  if (kickPower >= 65 || kickAcc >= 65) return 'SPECIAL';

  const tackle = s.tackle?.value || 0;
  const bShed = s.blockShedding?.value || 0;
  const manCov = s.manCoverage?.value || 0;
  const zoneCov = s.zoneCoverage?.value || 0;
  const pwrMoves = s.powerMoves?.value || 0;
  const finMoves = s.finesseMoves?.value || 0;
  const hitPwr = s.hitPower?.value || 0;

  if (tackle >= 65 || bShed >= 65 || manCov >= 65 || zoneCov >= 65 || pwrMoves >= 65 || finMoves >= 65 || hitPwr >= 70) {
    return 'DEFENSE';
  }
  return 'OFFENSE';
}

async function buildMaddenRatingMap() {
  console.log("Fetching official Madden ratings from EA Sports API...");
  let eaPlayers = [];
  let offset = 0;
  const limit = 100;
  while (true) {
    const url = `https://drop-api.ea.com/rating/madden-nfl?limit=${limit}&offset=${offset}`;
    const res = await fetch(url);
    const data = await res.json();
    const items = data.items || [];
    eaPlayers = eaPlayers.concat(items);
    if (items.length < limit || eaPlayers.length >= (data.totalItems || 2500)) break;
    offset += limit;
  }

  console.log(`Fetched ${eaPlayers.length} total players from EA Sports API.`);

  const maddenMap = {};
  for (const ea of eaPlayers) {
    const fullName = `${ea.firstName || ''} ${ea.lastName || ''}`.trim();
    const norm = normalizeName(fullName);
    if (!norm || !ea.overallRating) continue;

    const unit = inferUnit(ea);
    const entry = {
      name: fullName,
      firstName: ea.firstName || '',
      lastName: ea.lastName || '',
      ovr: ea.overallRating,
      age: ea.age,
      jersey: ea.jerseyNum,
      weight: ea.weight,
      height: ea.height,
      college: ea.college,
      yearsPro: ea.yearsPro,
      inferred_unit: unit
    };

    if (!maddenMap[norm]) {
      maddenMap[norm] = {
        name: fullName,
        ovr: entry.ovr,
        age: entry.age,
        jersey: entry.jersey,
        weight: entry.weight,
        height: entry.height,
        college: entry.college,
        yearsPro: entry.yearsPro,
        inferred_unit: entry.inferred_unit,
        entries: [entry]
      };
    } else {
      maddenMap[norm].entries.push(entry);
      // Keep primary fields as highest rated entry
      if (entry.ovr > maddenMap[norm].ovr) {
        maddenMap[norm].name = entry.name;
        maddenMap[norm].ovr = entry.ovr;
        maddenMap[norm].age = entry.age;
        maddenMap[norm].jersey = entry.jersey;
        maddenMap[norm].weight = entry.weight;
        maddenMap[norm].height = entry.height;
        maddenMap[norm].college = entry.college;
        maddenMap[norm].yearsPro = entry.yearsPro;
        maddenMap[norm].inferred_unit = entry.inferred_unit;
      }
    }
  }

  const jsonPath = path.join(__dirname, 'madden_official_ratings.json');
  fs.writeFileSync(jsonPath, JSON.stringify(maddenMap, null, 2), 'utf8');
  console.log(`Saved official EA Madden rating map (${Object.keys(maddenMap).length} unique names) to ${jsonPath}`);
}

buildMaddenRatingMap().catch(err => console.error(err));
