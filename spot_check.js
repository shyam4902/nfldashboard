const SUPABASE_URL = "https://nedyoydylpbjvihaoexy.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
if (!SUPABASE_ANON_KEY) throw new Error('SUPABASE_ANON_KEY is required');

const headers = {
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
};

async function verifyPlayerSpotCheck() {
  const testNames = ["Ja'Marr Chase", "Josh Allen", "Saquon Barkley", "Christian Gonzalez", "Drake Maye", "Myles Garrett", "Justin Jefferson", "Patrick Mahomes"];

  // Fetch top EA ratings
  const eaRes = await fetch("https://drop-api.ea.com/rating/madden-nfl?limit=100&offset=0");
  const eaData = await eaRes.json();

  // Fetch Supabase DB
  let sbPlayers = [];
  let page = 0;
  while (true) {
    const res = await fetch(`${SUPABASE_URL}nfl_players?select=name,pos,ovr,ratings_source&offset=${page * 1000}&limit=1000`, { headers });
    const chunk = await res.json();
    sbPlayers = sbPlayers.concat(chunk);
    if (chunk.length < 1000) break;
    page++;
  }

  console.log("\n==========================================================================================");
  console.log("PLAYER NAME             | EA SPORTS API OVR | SUPABASE DB OVR | DB RATINGS SOURCE");
  console.log("==========================================================================================");

  for (const targetName of testNames) {
    const eaMatch = eaData.items.find(p => `${p.firstName} ${p.lastName}`.toLowerCase() === targetName.toLowerCase());
    const sbMatch = sbPlayers.find(p => p.name.toLowerCase() === targetName.toLowerCase());

    const eaOvr = eaMatch ? eaMatch.overallRating : "Found in EA (page > 1)";
    const sbOvr = sbMatch ? sbMatch.ovr : "Not Found";
    const sbSrc = sbMatch ? sbMatch.ratings_source : "N/A";

    console.log(`${targetName.padEnd(23, ' ')} | ${String(eaOvr).padEnd(17, ' ')} | ${String(sbOvr).padEnd(15, ' ')} | ${sbSrc}`);
  }
  console.log("==========================================================================================\n");
}

verifyPlayerSpotCheck();
