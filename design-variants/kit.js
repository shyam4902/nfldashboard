/* Shared helpers for the design variants: colour contrast, kickoff formatting,
   and the slices of window.MB every page needs. No styling lives here. */
(function () {
  const MB = window.MB;
  const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const delin = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  const lum = h => { const [r, g, b] = hex2rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  // OKLab round trip so lightening keeps the team's hue instead of washing to grey.
  function toOklab(h) {
    const [r, g, b] = hex2rgb(h).map(lin);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  }
  function fromOklab([L, a, b]) {
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
    if (rgb.some(c => c < -0.001 || c > 1.001)) return null;
    return '#' + rgb.map(c => Math.round(Math.min(1, Math.max(0, delin(c))) * 255).toString(16).padStart(2, '0')).join('');
  }
  // A readable version of a team colour for text/strokes on a dark ground.
  const inkCache = {};
  function ink(h, bg = '#111214', target = 4.6) {
    const key = h + bg + target;
    if (inkCache[key]) return inkCache[key];
    if (contrast(h, bg) >= target) return (inkCache[key] = h);
    let [L, a, b] = toOklab(h);
    let out = h;
    for (let i = 0; i < 60 && contrast(out, bg) < target; i++) {
      L = Math.min(0.97, L + 0.02);
      let k = 1, c = null;
      while (!(c = fromOklab([L, a * k, b * k])) && k > 0) k -= 0.05;
      out = c || out;
    }
    return (inkCache[key] = out);
  }
  // Text colour that sits on a team-colour fill.
  const on = h => (contrast(h, '#ffffff') >= contrast(h, '#0b0c0e') ? '#ffffff' : '#0b0c0e');

  const tz = 'America/New_York';
  const fmt = (iso, o) => new Intl.DateTimeFormat('en-US', { timeZone: tz, ...o }).format(new Date(iso));
  const kick = iso => ({
    day: fmt(iso, { weekday: 'short' }),
    date: fmt(iso, { month: 'short', day: 'numeric' }),
    time: fmt(iso, { hour: 'numeric', minute: '2-digit' }).replace(':00', ''),
    full: fmt(iso, { weekday: 'short', hour: 'numeric', minute: '2-digit' }) + ' ET',
  });
  const T = a => MB.teams[a];
  const rec = a => { const t = T(a); return t.t ? `${t.w}-${t.l}-${t.t}` : `${t.w}-${t.l}`; };
  const week = w => MB.games.filter(g => g.week === w).sort((x, y) => x.kickoff.localeCompare(y.kickoff));
  const thisWeek = week(MB.week);
  const lastWeek = week(MB.week - 1);
  const playing = new Set(thisWeek.flatMap(g => [g.away, g.home]));
  const byes = Object.keys(MB.teams).filter(a => !playing.has(a)).sort();
  const slot = g => {
    const d = fmt(g.kickoff, { weekday: 'short' }); const h = +fmt(g.kickoff, { hour: 'numeric', hour12: false });
    if (d === 'Thu') return 'TNF'; if (d === 'Mon') return 'MNF';
    if (d === 'Sun' && h >= 19) return 'SNF'; if (d === 'Sun' && h >= 16) return 'Late'; return 'Early';
  };
  const ranked = Object.values(MB.teams).sort((a, b) => (b.pct ?? -1) - (a.pct ?? -1) || b.diff - a.diff);
  const power = Object.entries(MB.clayWins).sort((a, b) => b[1] - a[1]).map(([abbr, wins]) => ({ abbr, wins }));
  const winner = g => (!g.final ? null : g.as > g.hs ? g.away : g.hs > g.as ? g.home : 'TIE');
  const synced = fmt(MB.scoresSyncedAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET';
  // The Sunday-night game is the featured matchup, as on the live NFL home.
  const featured = thisWeek.find(g => slot(g) === 'SNF') || thisWeek.find(g => !g.final);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  window.KIT = { MB, T, rec, ink, on, contrast, kick, week, thisWeek, lastWeek, byes, slot, ranked, power, winner, synced, featured, esc };
})();
