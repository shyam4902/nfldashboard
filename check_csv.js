const fs = require('fs');

const csv = fs.readFileSync('nfl_rosters_2026.csv', 'utf8').split('\n');
const testPlayers = ["Saquon Barkley", "Christian Gonzalez", "Drake Maye", "Justin Jefferson", "Ja'Marr Chase", "Josh Allen", "Patrick Mahomes", "Myles Garrett"];

console.log("\n==========================================================================================");
console.log("PLAYER NAME             | TEAM                  | OVR RATING | POSITION");
console.log("==========================================================================================");

testPlayers.forEach(name => {
  const lines = csv.filter(l => l.toLowerCase().includes(name.toLowerCase()));
  lines.forEach(line => {
    const cols = line.split(',');
    const team = cols[0].replace(/"/g, '');
    const playerName = cols[3].replace(/"/g, '');
    const ovr = cols[6];
    const pos = cols[4].replace(/"/g, '');
    console.log(`${playerName.padEnd(23, ' ')} | ${team.padEnd(21, ' ')} | ${String(ovr).padEnd(10, ' ')} | ${pos}`);
  });
});
console.log("==========================================================================================\n");
