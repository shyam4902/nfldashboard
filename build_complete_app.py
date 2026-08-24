#!/usr/bin/env python3
"""
Complete, authoritative single-pass builder for nfldashboard/index.html
"""

import subprocess

# Reset to clean git baseline first
subprocess.run(["git", "checkout", "index.html"], cwd="/Users/shyampatel/Desktop/NFL_Main/nfldashboard", check=True)

INDEX_PATH = "/Users/shyampatel/Desktop/NFL_Main/nfldashboard/index.html"

with open(INDEX_PATH, "r", encoding="utf-8") as f:
    content = f.read()

# ─────────────────────────────────────────────────────────────────────────────
# 1. CSS STYLES (Including Distinct Themes, Heatmap Badges, Command Palette)
# ─────────────────────────────────────────────────────────────────────────────
css_styles = """
/* ── THEMES ── */

/* 1. STADIUM LIGHTS (Deep Navy & Golden Field Amber) */
body.theme-stadium {
  background: radial-gradient(circle at 50% 0%, #0d224d 0%, #030814 100%) fixed !important;
  color: #f8fafc !important;
}
body.theme-stadium .glass {
  background: rgba(10, 25, 54, 0.88) !important;
  border: 1px solid rgba(245, 158, 11, 0.35) !important;
  box-shadow: 0 8px 32px rgba(245, 158, 11, 0.08) !important;
}
body.theme-stadium header {
  background: rgba(4, 11, 25, 0.98) !important;
  border-bottom: 2px solid rgba(245, 158, 11, 0.5) !important;
}
body.theme-stadium .tab-btn.active {
  background: linear-gradient(135deg, #d97706, #f59e0b) !important;
  color: #000000 !important;
  font-weight: 800 !important;
  box-shadow: 0 0 12px rgba(245, 158, 11, 0.5) !important;
}
body.theme-stadium .bg-slate-800, 
body.theme-stadium .bg-slate-800\\/80, 
body.theme-stadium .bg-slate-800\\/60, 
body.theme-stadium .bg-slate-800\\/50, 
body.theme-stadium .bg-slate-800\\/40 {
  background-color: rgba(14, 32, 68, 0.75) !important;
  border-color: rgba(245, 158, 11, 0.25) !important;
}
body.theme-stadium .text-cyan-400, 
body.theme-stadium .text-blue-400 {
  color: #fbbf24 !important;
}
body.theme-stadium .text-cyan-300 {
  color: #fde68a !important;
}
body.theme-stadium .border-slate-700, 
body.theme-stadium .border-slate-600 {
  border-color: rgba(245, 158, 11, 0.3) !important;
}
body.theme-stadium .team-tile {
  background: rgba(10, 25, 54, 0.9) !important;
  border-color: rgba(245, 158, 11, 0.3) !important;
}
body.theme-stadium .player-link:hover {
  color: #f59e0b !important;
}
body.theme-stadium .roster-modal, 
body.theme-stadium .cmd-palette-modal {
  background: #071530 !important;
  border-color: rgba(245, 158, 11, 0.4) !important;
}

/* 2. ESPN BROADCAST (Charcoal Steel & Crimson Red) */
body.theme-espn {
  background: #0d1117 fixed !important;
  color: #f3f4f6 !important;
}
body.theme-espn .glass {
  background: rgba(22, 27, 34, 0.94) !important;
  border: 1px solid rgba(239, 68, 68, 0.3) !important;
  border-left: 4px solid #dc2626 !important;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5) !important;
}
body.theme-espn header {
  background: #161b22 !important;
  border-bottom: 3px solid #dc2626 !important;
}
body.theme-espn .tab-btn.active {
  background: linear-gradient(135deg, #b91c1c, #dc2626) !important;
  color: #ffffff !important;
  font-weight: 800 !important;
  text-transform: uppercase !important;
}
body.theme-espn .bg-slate-800, 
body.theme-espn .bg-slate-800\\/80, 
body.theme-espn .bg-slate-800\\/60, 
body.theme-espn .bg-slate-800\\/50, 
body.theme-espn .bg-slate-800\\/40 {
  background-color: rgba(28, 33, 40, 0.85) !important;
  border-color: rgba(75, 85, 99, 0.4) !important;
}
body.theme-espn .text-cyan-400, 
body.theme-espn .text-blue-400 {
  color: #f87171 !important;
}
body.theme-espn .text-cyan-300 {
  color: #fca5a5 !important;
}
body.theme-espn .text-amber-400 {
  color: #ef4444 !important;
}
body.theme-espn .team-tile {
  background: rgba(22, 27, 34, 0.95) !important;
  border-left: 3px solid #dc2626 !important;
}
body.theme-espn .player-link:hover {
  color: #ef4444 !important;
}
body.theme-espn .roster-modal, 
body.theme-espn .cmd-palette-modal {
  background: #161b22 !important;
  border-color: rgba(220, 38, 38, 0.4) !important;
}

/* 3. RETRO SCOREBOARD (Monospace Terminal Green & Phosphor Amber) */
body.theme-retro {
  background: #02140b fixed !important;
  color: #fef08a !important;
  font-family: 'Courier New', Courier, monospace !important;
}
body.theme-retro .glass {
  background: rgba(4, 32, 18, 0.92) !important;
  border: 1px solid rgba(16, 185, 129, 0.45) !important;
  box-shadow: 0 0 16px rgba(16, 185, 129, 0.15) !important;
}
body.theme-retro header {
  background: #031c10 !important;
  border-bottom: 2px solid #10b981 !important;
}
body.theme-retro .tab-btn.active {
  background: #f59e0b !important;
  color: #000000 !important;
  font-weight: 900 !important;
  font-family: 'Courier New', monospace !important;
}
body.theme-retro .bg-slate-800, 
body.theme-retro .bg-slate-800\\/80, 
body.theme-retro .bg-slate-800\\/60, 
body.theme-retro .bg-slate-800\\/50, 
body.theme-retro .bg-slate-800\\/40 {
  background-color: rgba(6, 44, 25, 0.85) !important;
  border-color: rgba(16, 185, 129, 0.35) !important;
}
body.theme-retro .text-cyan-400, 
body.theme-retro .text-blue-400, 
body.theme-retro .text-slate-200 {
  color: #a7f3d0 !important;
}
body.theme-retro .text-slate-400 {
  color: #6ee7b7 !important;
  opacity: 0.85;
}
body.theme-retro .text-amber-400 {
  color: #fbbf24 !important;
  font-weight: bold;
}
body.theme-retro .team-tile {
  background: rgba(4, 32, 18, 0.9) !important;
  border: 1px solid #10b981 !important;
}
body.theme-retro input, 
body.theme-retro select {
  background: #02140b !important;
  color: #fef08a !important;
  border-color: #10b981 !important;
  font-family: 'Courier New', monospace !important;
}
body.theme-retro .roster-modal, 
body.theme-retro .cmd-palette-modal {
  background: #031c10 !important;
  border-color: #10b981 !important;
}

/* 4. CLEAN ANALYST (High-Contrast Light Workstation) */
body.theme-analyst {
  background: #f1f5f9 fixed !important;
  color: #0f172a !important;
}
body.theme-analyst .glass {
  background: #ffffff !important;
  border: 1px solid #cbd5e1 !important;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04) !important;
}
body.theme-analyst header {
  background: #ffffff !important;
  border-bottom: 1px solid #e2e8f0 !important;
}
body.theme-analyst .tab-btn {
  background: #e2e8f0 !important;
  color: #475569 !important;
  border: 1px solid #cbd5e1 !important;
}
body.theme-analyst .tab-btn.active {
  background: #0f172a !important;
  color: #ffffff !important;
  border-color: #0f172a !important;
  font-weight: 700 !important;
}
body.theme-analyst .bg-slate-800, 
body.theme-analyst .bg-slate-800\\/80, 
body.theme-analyst .bg-slate-800\\/60, 
body.theme-analyst .bg-slate-800\\/50, 
body.theme-analyst .bg-slate-800\\/40, 
body.theme-analyst .bg-slate-900 {
  background-color: #f8fafc !important;
  border-color: #e2e8f0 !important;
}
body.theme-analyst .text-white, 
body.theme-analyst .text-slate-200 {
  color: #0f172a !important;
  font-weight: 600;
}
body.theme-analyst .text-slate-300, 
body.theme-analyst .text-slate-400 {
  color: #334155 !important;
}
body.theme-analyst .text-slate-500 {
  color: #64748b !important;
}
body.theme-analyst .text-cyan-400, 
body.theme-analyst .text-blue-400 {
  color: #0284c7 !important;
  font-weight: 700;
}
body.theme-analyst .text-emerald-400 {
  color: #15803d !important;
  font-weight: 700;
}
body.theme-analyst .text-amber-400 {
  color: #b45309 !important;
  font-weight: 700;
}
body.theme-analyst .text-red-400 {
  color: #b91c1c !important;
  font-weight: 700;
}
body.theme-analyst table th {
  background-color: #f1f5f9 !important;
  color: #475569 !important;
  border-color: #e2e8f0 !important;
}
body.theme-analyst table td {
  color: #1e293b !important;
  border-color: #e2e8f0 !important;
}
body.theme-analyst table tr:hover {
  background-color: #f8fafc !important;
}
body.theme-analyst .team-tile {
  background: #ffffff !important;
  border-color: #cbd5e1 !important;
  box-shadow: 0 1px 3px rgba(0,0,0,0.05) !important;
}
body.theme-analyst input, 
body.theme-analyst select {
  background: #ffffff !important;
  color: #0f172a !important;
  border-color: #cbd5e1 !important;
}
body.theme-analyst .roster-modal, 
body.theme-analyst .cmd-palette-modal {
  background: #ffffff !important;
  color: #0f172a !important;
  border-color: #cbd5e1 !important;
}
body.theme-analyst .cmd-item:hover, 
body.theme-analyst .cmd-item.selected {
  background: #f1f5f9 !important;
}

/* Player links */
.player-link {
  cursor: pointer;
  transition: color 0.15s ease, text-decoration 0.15s ease;
}
.player-link:hover {
  color: #38bdf8 !important;
  text-decoration: underline;
}

/* Matchup matrix heatmap cell badges */
.mm-cell {
  height: 28px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  transition: transform 0.1s ease;
  cursor: default;
  user-select: none;
}
.mm-cell:hover {
  transform: scale(1.12);
  z-index: 5;
  box-shadow: 0 0 0 2px rgba(255,255,255,0.25);
}
.mm-cell-soft { background: rgba(16, 185, 129, 0.25); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.4); }
.mm-cell-above { background: rgba(13, 148, 136, 0.2); color: #5eead4; border: 1px solid rgba(13, 148, 136, 0.35); }
.mm-cell-neutral { background: rgba(51, 65, 85, 0.4); color: #cbd5e1; border: 1px solid rgba(71, 85, 105, 0.3); }
.mm-cell-tough { background: rgba(245, 158, 11, 0.25); color: #fcd34d; border: 1px solid rgba(245, 158, 11, 0.4); }
.mm-cell-brutal { background: rgba(239, 68, 68, 0.25); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.4); }
.mm-cell-bye { background: rgba(15, 23, 42, 0.5); color: #64748b; font-weight: 400; }

/* Command Palette */
.cmd-palette-backdrop {
  display: none;
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(8px);
  z-index: 200;
  align-items: flex-start;
  justify-content: center;
  padding-top: 10vh;
}
.cmd-palette-backdrop.active {
  display: flex;
}
.cmd-palette-modal {
  background: #0f172a;
  border: 1px solid rgba(71, 85, 105, 0.5);
  border-radius: 16px;
  width: 100%;
  max-width: 640px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.75);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.cmd-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 1px solid rgba(71, 85, 105, 0.2);
  transition: background 0.1s;
}
.cmd-item:hover, .cmd-item.selected {
  background: rgba(59, 130, 246, 0.15);
}
"""

content = content.replace("</style>", css_styles + "\n</style>", 1)

# ─────────────────────────────────────────────────────────────────────────────
# 2. HEADER CONTROLS (Theme Selector, Command Palette, Compare, Tabs)
# ─────────────────────────────────────────────────────────────────────────────
old_header_start = '<div class="flex items-center gap-3 w-full md:w-auto">'
old_header_end = '</header>'
start_idx = content.find(old_header_start)
end_idx = content.find(old_header_end, start_idx)

new_header_controls = """<div class="flex items-center gap-2.5 w-full md:w-auto flex-wrap">
      <div class="relative flex-1 md:w-64">
        <input id="searchBox" type="text" placeholder="Search player, team... (⌘K)" class="search-glow bg-slate-800/80 border border-slate-600 rounded-lg pl-3 pr-10 py-2 text-sm w-full focus:outline-none focus:border-blue-500 transition" oninput="filterDashboard(this.value)">
        <button onclick="openCommandPalette()" class="absolute right-2 top-2 text-[10px] bg-slate-700/80 text-slate-400 px-1.5 py-0.5 rounded font-mono hover:bg-slate-600 transition" title="Open command palette (Cmd+K / Ctrl+K)">⌘K</button>
      </div>
      <div class="flex gap-1 shrink-0 flex-wrap items-center">
        <button onclick="showTab('home')" class="tab-btn active text-xs px-3 py-2 rounded-lg font-semibold transition" data-tab="home">Home</button>
        <button onclick="showTab('feed')" class="tab-btn text-xs px-3 py-2 rounded-lg font-semibold bg-slate-800 text-slate-400 hover:bg-slate-700 transition" data-tab="feed">Transactions</button>
        <button onclick="showTab('teams')" class="tab-btn text-xs px-3 py-2 rounded-lg font-semibold bg-slate-800 text-slate-400 hover:bg-slate-700 transition" data-tab="teams">Teams</button>
        <button onclick="showTab('draft')" class="tab-btn text-xs px-3 py-2 rounded-lg font-semibold bg-slate-800 text-slate-400 hover:bg-slate-700 transition" data-tab="draft">Draft</button>
        <button onclick="showTab('projections')" class="tab-btn text-xs px-3 py-2 rounded-lg font-semibold bg-slate-800 text-slate-400 hover:bg-slate-700 transition" data-tab="projections">Projections</button>
        <button onclick="showTab('props')" class="tab-btn text-xs px-3 py-2 rounded-lg font-semibold bg-slate-800 text-slate-400 hover:bg-slate-700 transition" data-tab="props">Props & Value</button>
        <button onclick="openPlayerCompareModal()" class="text-xs px-2.5 py-2 rounded-lg font-semibold bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30 transition flex items-center gap-1 shrink-0" title="Compare any two players side-by-side">
          <span>⚖</span> Player Compare
        </button>
        <select id="themeSelector" onchange="changeTheme(this.value)" class="text-xs px-2 py-2 rounded-lg font-semibold bg-slate-800/90 text-slate-300 border border-slate-700 focus:outline-none focus:border-blue-500 cursor-pointer" title="Switch visual theme">
          <option value="default">🎨 Default Dark</option>
          <option value="stadium">🏟 Stadium Lights</option>
          <option value="espn">📺 ESPN Broadcast</option>
          <option value="retro">📟 Retro Scoreboard</option>
          <option value="analyst">📊 Clean Analyst</option>
        </select>
        <button onclick="exportRostersCSV()" class="text-xs px-2.5 py-2 rounded-lg font-semibold bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 transition flex items-center gap-1 shrink-0" title="Export rosters as CSV for Excel / Google Sheets">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          CSV
        </button>
      </div>
    </div>
  </div>"""

content = content[:start_idx] + new_header_controls + "\n" + content[end_idx:]

# ─────────────────────────────────────────────────────────────────────────────
# 3. MODALS HTML
# ─────────────────────────────────────────────────────────────────────────────
new_modals_html = """
<!-- UNIVERSAL PLAYER PROFILE MODAL -->
<div id="playerModal" class="roster-modal-overlay" onclick="if(event.target===this)closePlayerModal()">
  <div class="roster-modal" style="max-width: 900px;">
    <button class="roster-close" onclick="closePlayerModal()">&times;</button>
    <div id="playerModalContent" class="roster-modal-content"></div>
  </div>
</div>

<!-- HEAD-TO-HEAD PLAYER COMPARE MODAL -->
<div id="playerCompareModal" class="roster-modal-overlay" onclick="if(event.target===this)closePlayerCompareModal()">
  <div class="roster-modal" style="max-width: 1100px;">
    <button class="roster-close" onclick="closePlayerCompareModal()">&times;</button>
    <div class="p-4 border-b border-slate-700/50 flex items-center justify-between">
      <div class="text-lg font-black text-white flex items-center gap-2">
        <span>⚖</span> Detailed Head-to-Head Player Comparison
      </div>
    </div>
    <div id="playerCompareContent" class="roster-modal-content"></div>
  </div>
</div>

<!-- COMMAND PALETTE MODAL -->
<div id="commandPaletteModal" class="cmd-palette-backdrop" onclick="if(event.target===this)closeCommandPalette()">
  <div class="cmd-palette-modal">
    <div class="p-3 border-b border-slate-700/50 flex items-center gap-2 bg-slate-800/40">
      <svg class="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
      <input id="cmdPaletteInput" type="text" placeholder="Type a player, team, tab, or market..." class="bg-transparent text-sm w-full text-white focus:outline-none" oninput="handleCommandSearch(this.value)" onkeydown="handleCommandKeydown(event)">
      <kbd class="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700 font-mono">ESC</kbd>
    </div>
    <div id="cmdPaletteResults" class="overflow-y-auto max-h-96 p-1"></div>
  </div>
</div>
"""

content = content.replace("<!-- MAIN -->", new_modals_html + "\n<!-- MAIN -->", 1)

# ─────────────────────────────────────────────────────────────────────────────
# 4. TAB PROPS CONTAINER
# ─────────────────────────────────────────────────────────────────────────────
props_tab_html = """
  <div id="tab-props" class="hidden">
    <h2 class="text-xl font-bold mb-3 flex items-center gap-2">
      <svg class="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20"><path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 5a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V9zm0 5a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z"/></svg>
      Props & Value
      <span class="text-xs text-slate-500 font-normal ml-1" id="propsBoardMeta"></span>
    </h2>
    <div id="propsSummary" class="flex flex-wrap gap-2 mb-4"></div>
    <div id="propsControls" class="flex flex-wrap gap-2 mb-3 items-center">
      <select id="propsVenueFilter" onchange="renderPropsBoard()" class="text-[11px] px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-800 text-slate-300 focus:outline-none focus:border-emerald-500"></select>
      <select id="propsMarketFilter" onchange="renderPropsBoard()" class="text-[11px] px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-800 text-slate-300 focus:outline-none focus:border-emerald-500"></select>
      <select id="propsSideFilter" onchange="renderPropsBoard()" class="text-[11px] px-3 py-1.5 rounded-lg border border-slate-600 bg-slate-800 text-slate-300 focus:outline-none focus:border-emerald-500">
        <option value="">All sides</option><option value="over">Over</option><option value="under">Under</option>
      </select>
      <label class="text-[11px] text-slate-400 flex items-center gap-1 ml-auto"><input type="checkbox" id="propsEdgeOnly" onchange="renderPropsBoard()" class="accent-emerald-500"> Only +EV</label>
    </div>
    <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div class="xl:col-span-2 glass rounded-xl p-4 overflow-x-auto">
        <div class="text-[10px] uppercase tracking-wider text-emerald-400 font-bold mb-2">⚡ Best Lines by Model Edge <span class="text-slate-500 normal-case font-normal">— active source, market, side, and +EV filters apply</span></div>
        <div id="propsBestLines"><p class="text-xs text-slate-500">Loading…</p></div>
      </div>
      <div class="glass rounded-xl p-4">
        <div class="text-[10px] uppercase tracking-wider text-amber-400 font-bold mb-2">Alerts</div>
        <div id="propsAlerts"><p class="text-xs text-slate-500">Loading…</p></div>
      </div>
    </div>
    <div class="glass rounded-xl p-4 mt-4 overflow-x-auto">
      <div class="text-[10px] uppercase tracking-wider text-cyan-400 font-bold mb-2">Value Board <span class="text-slate-500 normal-case font-normal">— model probability vs market, ranked by EV · <span id="propsBoardCount"></span></span></div>
      <div id="propsBoard"><p class="text-xs text-slate-500">Loading…</p></div>
    </div>
  </div>
"""
if '<div id="tab-props"' not in content:
    content = content.replace("</main>", props_tab_html + "\n</main>", 1)

# ─────────────────────────────────────────────────────────────────────────────
# 5. PLAYER LINKS IN TABLES
# ─────────────────────────────────────────────────────────────────────────────
content = content.replace(
    '<td class="px-3 py-2 font-semibold text-slate-200">${p.name}</td>',
    '<td class="px-3 py-2 font-semibold text-slate-200">${playerLinkHtml(p.name, tm)}</td>'
)
content = content.replace(
    '<td class="px-2 py-1 ${tier}">${p.name}</td>',
    '<td class="px-2 py-1 ${tier}">${playerLinkHtml(p.name, p.team)}</td>'
)
content = content.replace(
    '<div class="text-xs font-semibold text-slate-200 truncate">${s.name}</div>',
    '<div class="text-xs font-semibold text-slate-200 truncate">${playerLinkHtml(s.name, team)}</div>'
)
content = content.replace(
    '<span>Top: <span class="text-slate-300">${top.name}</span> - ${top.ppr_pts} PPR</span>',
    '<span>Top: ${playerLinkHtml(top.name, name, "text-slate-300")} - ${top.ppr_pts} PPR</span>'
)
content = content.replace(
    '<div class="cp-name">${p.name}</div>',
    '<div class="cp-name">${playerLinkHtml(p.name, team)}</div>'
)

# ─────────────────────────────────────────────────────────────────────────────
# 6. PROJ SUB TABS AND SWITCH
# ─────────────────────────────────────────────────────────────────────────────
old_proj_sub_tabs = """const PROJ_SUB_TABS = [
  { id: 'standings', label: 'Standings', icon: '🏈' },
  { id: 'categories', label: 'Leaders', icon: '🏆' },
  { id: 'sos', label: 'Schedule', icon: '📅' },
  { id: 'teamproj', label: 'Teams', icon: '🏟' },
  { id: 'qb', label: 'QB', icon: '🎯' },
  { id: 'rb', label: 'RB', icon: '🏃' },
  { id: 'wr', label: 'WR', icon: '📡' },
  { id: 'te', label: 'TE', icon: '🤲' },
  { id: 'def', label: 'Defense', icon: '🛡' },
  { id: 'idl', label: 'IDL', icon: '🛡' },
  { id: 'edge', label: 'EDGE', icon: '🛡' },
  { id: 'lb', label: 'LB', icon: '🛡' },
  { id: 'cb', label: 'CB', icon: '🛡' },
  { id: 's', label: 'S', icon: '🛡' },
  { id: 'unitgrades', label: 'Unit Grades', icon: '📊' },
  { id: 'starters', label: 'Starters', icon: '⭐' },
  { id: 'coaching', label: 'Coaching', icon: '📋' },
];"""

new_proj_sub_tabs = """const PROJ_SUB_TABS = [
  { id: 'standings', label: 'Standings', icon: '🏈' },
  { id: 'categories', label: 'Leaders', icon: '🏆' },
  { id: 'clay_delta', label: 'Clay vs Market', icon: '⚡' },
  { id: 'matchup_matrix', label: 'Matchup Matrix', icon: '🎯' },
  { id: 'consensus', label: 'Consensus Power', icon: '🏆' },
  { id: 'sos', label: 'Schedule', icon: '📅' },
  { id: 'teamproj', label: 'Teams', icon: '🏟' },
  { id: 'qb', label: 'QB', icon: '🎯' },
  { id: 'rb', label: 'RB', icon: '🏃' },
  { id: 'wr', label: 'WR', icon: '📡' },
  { id: 'te', label: 'TE', icon: '🤲' },
  { id: 'def', label: 'Defense', icon: '🛡' },
  { id: 'idl', label: 'IDL', icon: '🛡' },
  { id: 'edge', label: 'EDGE', icon: '🛡' },
  { id: 'lb', label: 'LB', icon: '🛡' },
  { id: 'cb', label: 'CB', icon: '🛡' },
  { id: 's', label: 'S', icon: '🛡' },
  { id: 'unitgrades', label: 'Unit Grades', icon: '📊' },
  { id: 'starters', label: 'Starters', icon: '⭐' },
  { id: 'coaching', label: 'Coaching', icon: '📋' },
];"""

content = content.replace(old_proj_sub_tabs, new_proj_sub_tabs, 1)

old_switch = """  switch (currentProjSubTab) {
    case 'standings': renderStandingsProj(c, data); break;
    case 'categories': renderCategories(c, data); break;"""

new_switch = """  switch (currentProjSubTab) {
    case 'standings': renderStandingsProj(c, data); break;
    case 'categories': renderCategories(c, data); break;
    case 'clay_delta': renderClayMarketDelta(c, data); break;
    case 'matchup_matrix': renderMatchupMatrix(c, data); break;
    case 'consensus': renderConsensusPower(c, data); break;"""

content = content.replace(old_switch, new_switch, 1)

if "if (tab === 'props') {" not in content:
    content = content.replace(
        "if (tab === 'projections') {\n    renderProjSubTabs();\n    renderProjContent();\n  }",
        "if (tab === 'projections') {\n    renderProjSubTabs();\n    renderProjContent();\n  }\n  if (tab === 'props') {\n    renderPropsBoard();\n  }"
    )

# ─────────────────────────────────────────────────────────────────────────────
# 7. FULL EXTENSION JAVASCRIPT
# ─────────────────────────────────────────────────────────────────────────────
raw_js_body = r"""
// ═══════════════════════════════════════════════════════════
// PROPS BOARD LOADER & RENDERING
// ═══════════════════════════════════════════════════════════
let PROPS_BOARD = null;

async function loadPropsBoard(){
  if (PROPS_BOARD) return PROPS_BOARD;
  try {
    const res = await fetch('./props-board.json', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    PROPS_BOARD = await res.json();
  } catch (err) {
    PROPS_BOARD = { error: err.message, summary: {}, plays: [], best_lines: [], alerts: [] };
  }
  return PROPS_BOARD;
}

const propsMarketLabels = {
  passing_yards: 'Pass Yds', passing_tds: 'Pass TDs', rushing_yards: 'Rush Yds',
  rushing_tds: 'Rush TDs', receiving_yards: 'Rec Yds', receiving_tds: 'Rec TDs',
  receptions: 'Rec', carries: 'Carries', scrimmage_yards: 'Scrim Yds',
  total_tds: 'Total TDs', fantasy_points: 'Fantasy Pts',
};

async function renderPropsBoard(){
  const board = await loadPropsBoard();
  const metaEl = document.getElementById('propsBoardMeta');
  if (!board || board.error) {
    if (metaEl) metaEl.textContent = '— no exported board (run props:export) —';
    ['propsSummary','propsBestLines','propsAlerts','propsBoard','propsVenueFilter','propsMarketFilter'].forEach(id => {
      const el = document.getElementById(id); if (el) el.innerHTML = '';
    });
    return;
  }
  const gen = board.generated_at ? new Date(board.generated_at).toLocaleString() : '';
  if (metaEl) metaEl.textContent = `Updated ${gen} · ${board.summary.plays} priced plays · ${board.summary.lines} lines · ${board.summary.venues ? Object.keys(board.summary.venues).length : 0} sources`;

  const venues = Object.keys(board.summary.venues || { Kalshi: 0, Polymarket: 0, DraftKings: 0, BetMGM: 0, FanDuel: 0, Caesars: 0 });
  const venueSel = document.getElementById('propsVenueFilter');
  const marketSel = document.getElementById('propsMarketFilter');
  if (!venueSel || !marketSel) return;
  const selectedVenue = venueSel.value;
  const selectedMarket = marketSel.value;
  venueSel.innerHTML = '<option value="">All sources (' + (board.summary.venues ? Object.entries(board.summary.venues).map(([v,c]) => v+':'+c).join(' ') : '') + ')</option>' +
    venues.map(v => `<option value="${v}">${v}</option>`).join('');
  marketSel.innerHTML = '<option value="">All markets</option>' +
    [...new Set(board.plays.map(p => p.market))].map(m => `<option value="${m}">${propsMarketLabels[m] || m}</option>`).join('');
  if (venues.includes(selectedVenue)) venueSel.value = selectedVenue;
  if ([...new Set(board.plays.map(p => p.market))].includes(selectedMarket)) marketSel.value = selectedMarket;

  const fVenue = venueSel.value, fMarket = marketSel.value,
        fSide = document.getElementById('propsSideFilter')?.value || '', edgeOnly = document.getElementById('propsEdgeOnly')?.checked || false;

  const plays = board.plays.filter(p =>
    (!fVenue || p.venue === fVenue) && (!fMarket || p.market === fMarket) && (!fSide || p.side === fSide) && (!edgeOnly || p.ev_pct > 0)
  );

  const totalEv = plays.reduce((s,p)=>s+ (p.ev_pct>0?1:0),0);
  const sumEl = document.getElementById('propsSummary');
  if (sumEl) sumEl.innerHTML = [
    statChip('+EV plays', totalEv, 'text-emerald-400'),
    statChip('Avg edge', (plays.length ? (plays.reduce((s,p)=>s+p.edge_pct,0)/plays.length) : 0).toFixed(1)+'pp', 'text-cyan-400'),
    statChip('Best EV', plays.length ? Math.max(...plays.map(p=>p.ev_pct)).toFixed(0)+'%' : '—', 'text-amber-400'),
    statChip('Sources', Object.keys(board.summary.venues || {}).length, 'text-violet-400'),
  ].join('');

  const bestByGroup = new Map();
  for (const play of plays) {
    const key = `${play.player_id}|${play.market}`;
    const group = bestByGroup.get(key) || { player: play.player, market: play.market };
    const side = play.side === 'under' ? 'under' : 'over';
    const current = group[side];
    const edge = Number(play.edge_pct);
    const currentEdge = current ? Number(current.edge_pct) : -Infinity;
    const betterLine = current && edge === currentEdge
      && (side === 'over' ? Number(play.line) < Number(current.line) : Number(play.line) > Number(current.line));
    if (!current || edge > currentEdge || betterLine) group[side] = play;
    bestByGroup.set(key, group);
  }

  const blEl = document.getElementById('propsBestLines');
  if (blEl) {
    let blHtml = '<div class="grid grid-cols-1 md:grid-cols-2 gap-2">';
    for (const [key, g] of Array.from(bestByGroup.entries()).slice(0, 12)) {
      blHtml += `
        <div class="p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/50 text-xs">
          <div class="flex justify-between items-center mb-1">
            <div class="font-bold text-slate-200">${playerLinkHtml(g.player)}</div>
            <span class="text-[10px] text-slate-400 uppercase font-semibold">${propsMarketLabels[g.market] || g.market}</span>
          </div>
          <div class="flex justify-between text-[11px] text-slate-300">
            <div>Over: <span class="font-bold text-emerald-400">${g.over ? `${g.over.line} (${g.over.venue} ${g.over.odds})` : '—'}</span></div>
            <div>Under: <span class="font-bold text-cyan-400">${g.under ? `${g.under.line} (${g.under.venue} ${g.under.odds})` : '—'}</span></div>
          </div>
        </div>
      `;
    }
    blHtml += '</div>';
    blEl.innerHTML = blHtml || '<p class="text-xs text-slate-500">No lines available</p>';
  }

  const alertsEl = document.getElementById('propsAlerts');
  if (alertsEl) {
    const alerts = board.alerts || [];
    alertsEl.innerHTML = alerts.length ? alerts.slice(0, 6).map(a => `
      <div class="p-2 mb-2 rounded bg-slate-800/40 border border-amber-500/20 text-xs">
        <div class="text-amber-400 font-bold">${a.title || 'Market Alert'}</div>
        <div class="text-slate-300 text-[11px]">${a.message || a.detail}</div>
      </div>
    `).join('') : '<p class="text-xs text-slate-500">No active alerts</p>';
  }

  const boardEl = document.getElementById('propsBoard');
  const countEl = document.getElementById('propsBoardCount');
  if (countEl) countEl.textContent = `${plays.length} matching plays`;
  if (boardEl) {
    boardEl.innerHTML = `
      <table class="w-full text-xs">
        <thead>
          <tr class="text-slate-400 border-b border-slate-700/60 bg-slate-800/50">
            <th class="py-2 px-3 text-left">Player</th>
            <th class="py-2 px-2 text-center">Market</th>
            <th class="py-2 px-2 text-center">Side</th>
            <th class="py-2 px-2 text-center">Line</th>
            <th class="py-2 px-2 text-center">Venue</th>
            <th class="py-2 px-2 text-center">Odds</th>
            <th class="py-2 px-2 text-center">Edge</th>
            <th class="py-2 px-2 text-center">EV%</th>
          </tr>
        </thead>
        <tbody>
          ${plays.slice(0, 50).map(p => `
            <tr class="border-b border-slate-800/40 hover:bg-slate-800/30">
              <td class="py-1.5 px-3 font-semibold text-slate-200">${playerLinkHtml(p.player, p.team)}</td>
              <td class="py-1.5 px-2 text-center text-slate-300">${propsMarketLabels[p.market] || p.market}</td>
              <td class="py-1.5 px-2 text-center uppercase font-bold text-[10px] ${p.side==='over'?'text-emerald-400':'text-cyan-400'}">${p.side}</td>
              <td class="py-1.5 px-2 text-center font-bold text-white">${p.line}</td>
              <td class="py-1.5 px-2 text-center text-slate-400">${p.venue}</td>
              <td class="py-1.5 px-2 text-center text-slate-300">${p.odds || '—'}</td>
              <td class="py-1.5 px-2 text-center font-bold text-cyan-400">${p.edge_pct ? p.edge_pct.toFixed(1)+'pp' : '—'}</td>
              <td class="py-1.5 px-2 text-center font-bold ${p.ev_pct>0?'text-emerald-400':'text-slate-400'}">${p.ev_pct ? (p.ev_pct>0?'+':'')+p.ev_pct.toFixed(1)+'%' : '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }
}

// ═══════════════════════════════════════════════════════════
// EXTENSIONS: THEMES, DUAL RADAR, PLAYER MODAL, COMPARE, 
// COMMAND PALETTE, CLAY VS MARKET DELTA, MATCHUP MATRIX, CONSENSUS POWER
// ═══════════════════════════════════════════════════════════

// ── 1. THEME SWITCHER ──
function changeTheme(theme) {
  document.body.className = theme === 'default' ? 'min-h-screen' : `min-h-screen theme-${theme}`;
  localStorage.setItem('nfl_dashboard_theme', theme);
  const sel = document.getElementById('themeSelector');
  if (sel) sel.value = theme;
}

function initTheme() {
  const saved = localStorage.getItem('nfl_dashboard_theme') || 'default';
  changeTheme(saved);
}

// ── 2. DUAL RADAR CHART GENERATOR ──
function createDualRadarSvg(labels, v1, v2, name1 = 'Player 1', name2 = 'Player 2', size = 250) {
  const count = labels.length;
  if (count < 3) return '';
  const center = size / 2;
  const radius = (size / 2) - 34;
  const angleStep = (Math.PI * 2) / count;

  let svg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="overflow-visible mx-auto">`;

  for (let level = 1; level <= 3; level++) {
    const r = (radius / 3) * level;
    let gridPoints = [];
    for (let i = 0; i < count; i++) {
      const angle = (i * angleStep) - (Math.PI / 2);
      const x = center + r * Math.cos(angle);
      const y = center + r * Math.sin(angle);
      gridPoints.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    svg += `<polygon points="${gridPoints.join(' ')}" fill="none" stroke="rgba(71, 85, 105, 0.35)" stroke-width="1" />`;
  }

  for (let i = 0; i < count; i++) {
    const angle = (i * angleStep) - (Math.PI / 2);
    const x = center + radius * Math.cos(angle);
    const y = center + radius * Math.sin(angle);
    svg += `<line x1="${center}" y1="${center}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(71, 85, 105, 0.3)" stroke-width="1" />`;

    const lx = center + (radius + 18) * Math.cos(angle);
    const ly = center + (radius + 18) * Math.sin(angle) + 3;
    svg += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" fill="#94a3b8" font-size="9" font-weight="700" text-anchor="middle">${labels[i]}</text>`;
  }

  let p1Points = [];
  for (let i = 0; i < count; i++) {
    const angle = (i * angleStep) - (Math.PI / 2);
    const val = Math.max(0, Math.min(10, v1[i] || 0));
    const r = (val / 10) * radius;
    const px = center + r * Math.cos(angle);
    const py = center + r * Math.sin(angle);
    p1Points.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }
  svg += `<polygon points="${p1Points.join(' ')}" fill="rgba(56, 189, 248, 0.25)" stroke="#38bdf8" stroke-width="2" />`;
  for (const pt of p1Points) {
    const [px, py] = pt.split(',');
    svg += `<circle cx="${px}" cy="${py}" r="3" fill="#38bdf8" />`;
  }

  let p2Points = [];
  for (let i = 0; i < count; i++) {
    const angle = (i * angleStep) - (Math.PI / 2);
    const val = Math.max(0, Math.min(10, v2[i] || 0));
    const r = (val / 10) * radius;
    const px = center + r * Math.cos(angle);
    const py = center + r * Math.sin(angle);
    p2Points.push(`${px.toFixed(1)},${py.toFixed(1)}`);
  }
  svg += `<polygon points="${p2Points.join(' ')}" fill="rgba(245, 158, 11, 0.25)" stroke="#f59e0b" stroke-width="2" />`;
  for (const pt of p2Points) {
    const [px, py] = pt.split(',');
    svg += `<circle cx="${px}" cy="${py}" r="3" fill="#f59e0b" />`;
  }

  svg += `</svg>`;
  return svg;
}

function createRadarSvg(labels, values, maxVal = 10, size = 200, strokeColor = '#38bdf8', fillColor = 'rgba(56, 189, 248, 0.25)') {
  return createDualRadarSvg(labels, values, values.map(()=>0), '', '', size);
}

// ── 3. UNIVERSAL PLAYER PROFILE MODAL ──
function playerLinkHtml(name, team = '', extraClass = '') {
  if (!name) return '';
  const nEsc = name.replace(/'/g, "\\'");
  const tEsc = (team || '').replace(/'/g, "\\'");
  return `<span class="player-link ${extraClass}" onclick="openPlayerModal('${nEsc}', '${tEsc}')" title="View ${name} player profile">${name}</span>`;
}

function findPlayerData(name, teamHint = '') {
  const norm = (name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/['’.\-]/g,"").replace(/\b(jr|sr|ii|iii|iv|v)\b/gi,"").replace(/\s+/g," ").trim();
  
  let pRecord = DATA.players ? DATA.players.find(p => {
    const pn = (p.name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/['’.\-]/g,"").replace(/\b(jr|sr|ii|iii|iv|v)\b/gi,"").replace(/\s+/g," ").trim();
    return pn === norm;
  }) : null;

  let clayPosProj = null;
  let posGroup = null;
  if (CLAY_DATA && CLAY_DATA.positional_projections) {
    for (const [pos, list] of Object.entries(CLAY_DATA.positional_projections)) {
      const match = list.find(p => {
        const pn = (p.name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/['’.\-]/g,"").replace(/\b(jr|sr|ii|iii|iv|v)\b/gi,"").replace(/\s+/g," ").trim();
        return pn === norm;
      });
      if (match) {
        clayPosProj = match;
        posGroup = pos;
        break;
      }
    }
  }

  let starterInfo = null;
  if (CLAY_DATA && CLAY_DATA.projected_starters) {
    for (const [conf, teams] of Object.entries(CLAY_DATA.projected_starters)) {
      for (const [tm, starters] of Object.entries(teams)) {
        const match = starters.find(s => {
          const sn = (s.name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/['’.\-]/g,"").replace(/\b(jr|sr|ii|iii|iv|v)\b/gi,"").replace(/\s+/g," ").trim();
          return sn === norm;
        });
        if (match) {
          starterInfo = { ...match, teamName: tm, conference: conf };
          break;
        }
      }
      if (starterInfo) break;
    }
  }

  let playerTxs = DATA.transactions ? DATA.transactions.filter(t => {
    const tn = (t.player_name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/['’.\-]/g,"").replace(/\b(jr|sr|ii|iii|iv|v)\b/gi,"").replace(/\s+/g," ").trim();
    return tn === norm;
  }) : [];

  let playerProps = [];
  if (PROPS_BOARD && PROPS_BOARD.plays) {
    playerProps = PROPS_BOARD.plays.filter(pl => {
      const pln = (pl.player || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/['’.\-]/g,"").replace(/\b(jr|sr|ii|iii|iv|v)\b/gi,"").replace(/\s+/g," ").trim();
      return pln === norm;
    });
  }

  return { name, norm, pRecord, clayPosProj, posGroup, starterInfo, playerTxs, playerProps };
}

async function openPlayerModal(name, teamHint = '') {
  if (!CLAY_DATA) await loadClayProjections();
  if (!PROPS_BOARD) await loadPropsBoard();

  const data = findPlayerData(name, teamHint);
  const container = document.getElementById('playerModalContent');
  if (!container) return;

  const p = data.pRecord || {};
  const cp = data.clayPosProj;
  const st = data.starterInfo;
  const pos = p.pos || cp?.pos || st?.position || 'N/A';
  const team = p.team_id ? (DATA.teams.find(t=>t.id===p.team_id)?.name || p.team_id) : (cp?.team_abbr || st?.teamName || teamHint || 'NFL');
  const jersey = p.jersey ? `#${p.jersey}` : '';
  const age = p.age ? `${p.age} yrs` : '';
  const ovr = p.ovr !== null && p.ovr !== undefined ? p.ovr : (st ? st.rating * 10 : null);
  const ratingBadgeClass = ovr ? (ovr >= 90 ? 'rating-elite' : ovr >= 80 ? 'rating-star' : ovr >= 70 ? 'rating-solid' : 'rating-dev') : '';

  let html = `
    <div class="flex items-start justify-between border-b border-slate-700/50 pb-4 mb-4">
      <div class="flex items-center gap-3">
        <div class="w-14 h-14 rounded-xl bg-slate-800 border border-slate-700 flex flex-col items-center justify-center text-center">
          <span class="text-xs font-bold text-slate-400">${pos}</span>
          <span class="text-sm font-black text-white">${jersey || '–'}</span>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-2xl font-black text-white">${name}</h2>
            ${p.is_rookie ? '<span class="badge-rook">ROOKIE</span>' : ''}
            ${p.isNew ? '<span class="badge-new">NEW</span>' : ''}
          </div>
          <div class="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
            <span class="font-semibold text-slate-300">${team}</span>
            <span>·</span>
            <span>${age || 'Age N/A'}</span>
            ${st ? `<span>·</span><span>Starter Rating: <strong class="text-amber-400">${st.rating}/10</strong> (${st.position}${st.depth})</span>` : ''}
          </div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        ${ovr ? `<div class="text-right"><div class="text-[9px] uppercase tracking-wider text-slate-500 font-bold">Madden 27</div><div class="rating-badge ${ratingBadgeClass} mx-auto">${ovr}</div></div>` : ''}
        <button onclick="openPlayerCompareModal('${name.replace(/'/g,"\\'")}')" class="text-xs px-2.5 py-1.5 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/30 transition flex items-center gap-1">
          <span>⚖</span> Compare
        </button>
      </div>
    </div>
  `;

  if (cp) {
    const isQb = cp.pos === 'QB';
    const isRb = cp.pos === 'RB';
    const isWr = cp.pos === 'WR';
    const isTe = cp.pos === 'TE';
    const isDef = ['IDL','EDGE','LB','CB','S'].includes(data.posGroup);

    const discountGames = (isQb || isWr || isTe) ? 2 : (isRb ? 3 : 2);
    const baselineMult = (17 - discountGames) / 17;

    html += `
      <div class="mb-5 glass rounded-xl p-4">
        <div class="flex items-center justify-between mb-3">
          <div class="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-2">
            <span>📊</span> MIKE CLAY 2026 PROJECTIONS
            <span class="text-slate-500 normal-case font-normal">(Pos Rank #${cp.pos_rank || '–'})</span>
          </div>
          <div class="text-xs font-black text-amber-400">
            ${cp.ff_pts ? `${cp.ff_pts} Fantasy Points` : ''}
          </div>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 mb-3">
    `;

    if (isQb) {
      html += `
        <div class="bg-slate-800/60 p-2 rounded border border-slate-700/50 text-center"><div class="text-[9px] text-slate-400">Pass Yds</div><div class="text-sm font-bold text-white">${cp.pass_yds}</div><div class="text-[9px] text-slate-500">Adj: ${(cp.pass_yds * baselineMult).toFixed(0)}</div></div>
        <div class="bg-slate-800/60 p-2 rounded border border-slate-700/50 text-center"><div class="text-[9px] text-slate-400">Pass TDs</div><div class="text-sm font-bold text-emerald-400">${cp.pass_td}</div><div class="text-[9px] text-slate-500">Adj: ${(cp.pass_td * baselineMult).toFixed(1)}</div></div>
        <div class="bg-slate-800/60 p-2 rounded border border-slate-700/50 text-center"><div class="text-[9px] text-slate-400">Pass Att/Cmp</div><div class="text-sm font-bold text-slate-300">${cp.pass_comp}/${cp.pass_att}</div></div>
        <div class="bg-slate-800/60 p-2 rounded border border-slate-700/50 text-center"><div class="text-[9px] text-slate-400">INTs</div><div class="text-sm font-bold text-red-400">${cp.interceptions}</div></div>
        <div class="bg-slate-800/60 p-2 rounded border border-slate-700/50 text-center"><div class="text-[9px] text-slate-400">Rush Yds</div><div class="text-sm font-bold text-white">${cp.rush_yds}</div><div class="text-[9px] text-slate-500">Adj: ${(cp.rush_yds * baselineMult).toFixed(0)}</div></div>
        <div class="bg-slate-800/60 p-2 rounded border border-slate-700/50 text-center"><div class="text-[9px] text-slate-400">Rush TDs</div><div class="text-sm font-bold text-emerald-400">${cp.rush_td}</div></div>
      `;
    } else if (isRb) {
      html += `
        <div class="bg-slate-800/60 p-2 rounded border border-slate-700/50 text-center"><div class="text-[9px] text-slate-400">Carries</div><div class="text-sm font-bold text-white">${cp.carries || cp.rush_att || '–'}</div><div class="text-[9px] text-slate-500">Adj: ${( (cp.carries||cp.rush_att||0) * baselineMult).toFixed(0)}</div></div>
        <div class="bg-slate-800/60 p-2 rounded border border-slate-700/50 text-center"><div class="text-[9px] text-slate-400">Rush Yds</div><div class="text-sm font-bold text-emerald-400">${cp.rush_yds}</div><div class="text-[9px] text-slate-500">Adj: ${(cp.rush_yds * baselineMult).toFixed(0)}</div></div>
        <div class="bg-slate-800/60 p-2 rounded border border-slate-700/50 text-center"><div class="text-[9px] text-slate-400">Rush TDs</div><div class="text-sm font-bold text-emerald-400">${cp.rush_td}</div></div>
        <div class="bg-slate-800/60 p-2 rounded border border-slate-700/50 text-center"><div class="text-[9px] text-slate-400">Receptions</div><div class="text-sm font-bold text-white">${cp.rec}</div><div class="text-[9px] text-slate-500">Adj: ${(cp.rec * baselineMult).toFixed(0)}</div></div>
        <div class="bg-slate-800/60 p-2 rounded border border-slate-700/50 text-center"><div class="text-[9px] text-slate-400">Rec Yds</div><div class="text-sm font-bold text-white">${cp.rec_yds}</div></div>
        <div class="bg-slate-800/60 p-2 rounded border border-slate-700/50 text-center"><div class="text-[9px] text-slate-400">Rec TDs</div><div class="text-sm font-bold text-emerald-400">${cp.rec_td}</div></div>
      `;
    } else if (isWr || isTe) {
      html += `
        <div class="bg-slate-800/60 p-2 rounded border border-slate-700/50 text-center"><div class="text-[9px] text-slate-400">Targets</div><div class="text-sm font-bold text-white">${cp.targets}</div><div class="text-[9px] text-slate-500">Adj: ${(cp.targets * baselineMult).toFixed(0)}</div></div>
        <div class="bg-slate-800/60 p-2 rounded border border-slate-700/50 text-center"><div class="text-[9px] text-slate-400">Receptions</div><div class="text-sm font-bold text-emerald-400">${cp.rec}</div><div class="text-[9px] text-slate-500">Adj: ${(cp.rec * baselineMult).toFixed(0)}</div></div>
        <div class="bg-slate-800/60 p-2 rounded border border-slate-700/50 text-center"><div class="text-[9px] text-slate-400">Rec Yds</div><div class="text-sm font-bold text-emerald-400">${cp.rec_yds}</div><div class="text-[9px] text-slate-500">Adj: ${(cp.rec_yds * baselineMult).toFixed(0)}</div></div>
        <div class="bg-slate-800/60 p-2 rounded border border-slate-700/50 text-center"><div class="text-[9px] text-slate-400">Rec TDs</div><div class="text-sm font-bold text-emerald-400">${cp.rec_td}</div></div>
        <div class="bg-slate-800/60 p-2 rounded border border-slate-700/50 text-center"><div class="text-[9px] text-slate-400">Carries</div><div class="text-sm font-bold text-slate-300">${cp.carries || cp.rush_att || 0}</div></div>
        <div class="bg-slate-800/60 p-2 rounded border border-slate-700/50 text-center"><div class="text-[9px] text-slate-400">Rush Yds</div><div class="text-sm font-bold text-slate-300">${cp.rush_yds || 0}</div></div>
      `;
    } else if (isDef) {
      html += `
        <div class="bg-slate-800/60 p-2 rounded border border-slate-700/50 text-center"><div class="text-[9px] text-slate-400">Snaps</div><div class="text-sm font-bold text-white">${cp.snaps || '–'}</div></div>
        <div class="bg-slate-800/60 p-2 rounded border border-slate-700/50 text-center"><div class="text-[9px] text-slate-400">Tackles</div><div class="text-sm font-bold text-white">${cp.total_tackles || cp.tackles || '–'}</div></div>
        <div class="bg-slate-800/60 p-2 rounded border border-slate-700/50 text-center"><div class="text-[9px] text-slate-400">Sacks</div><div class="text-sm font-bold text-amber-400">${cp.sacks || '–'}</div></div>
        <div class="bg-slate-800/60 p-2 rounded border border-slate-700/50 text-center"><div class="text-[9px] text-slate-400">INTs</div><div class="text-sm font-bold text-blue-400">${cp.interceptions || '–'}</div></div>
        <div class="bg-slate-800/60 p-2 rounded border border-slate-700/50 text-center"><div class="text-[9px] text-slate-400">TFL</div><div class="text-sm font-bold text-emerald-400">${cp.tfl || '–'}</div></div>
        <div class="bg-slate-800/60 p-2 rounded border border-slate-700/50 text-center"><div class="text-[9px] text-slate-400">Forced Fum</div><div class="text-sm font-bold text-slate-300">${cp.ff || cp.fumble_forced || '–'}</div></div>
      `;
    }

    html += `
        </div>
        <div class="text-[10px] text-slate-500 italic">
          *Mike Clay Prop Baseline: Removes ${discountGames} games worth of stats (${(baselineMult * 100).toFixed(1)}% multiplier) to discount in-season injury risk.
        </div>
      </div>
    `;
  }

  if (data.playerProps && data.playerProps.length > 0) {
    html += `
      <div class="mb-5 glass rounded-xl p-4">
        <div class="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-2">
          <span>💰</span> Active Season Props & Clay vs Market Edge
        </div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="text-slate-500 border-b border-slate-700/50">
                <th class="text-left py-1.5 px-2">Market</th>
                <th class="text-center py-1.5 px-2">Side</th>
                <th class="text-center py-1.5 px-2">Line</th>
                <th class="text-center py-1.5 px-2">Venue</th>
                <th class="text-center py-1.5 px-2">Odds</th>
                <th class="text-center py-1.5 px-2">Model Edge</th>
                <th class="text-center py-1.5 px-2">EV%</th>
              </tr>
            </thead>
            <tbody>
    `;

    for (const pr of data.playerProps.slice(0, 8)) {
      const evColor = pr.ev_pct > 0 ? 'text-emerald-400 font-bold' : 'text-slate-400';
      html += `
        <tr class="border-b border-slate-800/50 hover:bg-slate-800/30">
          <td class="py-1.5 px-2 font-semibold text-slate-300">${propsMarketLabels[pr.market] || pr.market}</td>
          <td class="py-1.5 px-2 text-center uppercase font-bold text-[10px] ${pr.side==='over'?'text-emerald-400':'text-cyan-400'}">${pr.side}</td>
          <td class="py-1.5 px-2 text-center font-bold text-white">${pr.line}</td>
          <td class="py-1.5 px-2 text-center text-slate-400">${pr.venue}</td>
          <td class="py-1.5 px-2 text-center text-slate-300">${pr.odds || '—'}</td>
          <td class="py-1.5 px-2 text-center text-cyan-400 font-bold">${pr.edge_pct ? pr.edge_pct.toFixed(1)+'pp' : '—'}</td>
          <td class="py-1.5 px-2 text-center ${evColor}">${pr.ev_pct ? (pr.ev_pct>0?'+':'')+pr.ev_pct.toFixed(1)+'%' : '—'}</td>
        </tr>
      `;
    }

    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  if (data.playerTxs && data.playerTxs.length > 0) {
    html += `
      <div class="glass rounded-xl p-4">
        <div class="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-2">
          <span>📋</span> 2026 Offseason Transactions & Contract Details
        </div>
        <div class="space-y-2">
    `;
    for (const tx of data.playerTxs) {
      const isBb = tx.blockbuster;
      html += `
        <div class="p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/40 flex items-start justify-between gap-3 text-xs ${isBb?'blockbuster':''}">
          <div>
            <div class="font-semibold text-slate-200">${tx.detail || tx.player_name}</div>
            <div class="text-[10px] text-slate-500 mt-0.5">${tx.date_str || tx.sort_date} · ${tx.from_team} &rarr; ${tx.to_team}</div>
          </div>
          <span class="tx-pill ${tx.type}">${tx.type}</span>
        </div>
      `;
    }
    html += `</div></div>`;
  }

  container.innerHTML = html;
  document.getElementById('playerModal').classList.add('active');
}

function closePlayerModal() {
  document.getElementById('playerModal')?.classList.remove('active');
}

// ── 4. DEEP HEAD-TO-HEAD PLAYER COMPARISON ──
let comparePlayer1 = null;
let comparePlayer2 = null;

async function openPlayerCompareModal(initialP1 = '', initialP2 = '') {
  const modal = document.getElementById('playerCompareModal');
  if (!modal) return;
  
  if (!CLAY_DATA) await loadClayProjections();
  if (!PROPS_BOARD) await loadPropsBoard();

  if (initialP1) comparePlayer1 = initialP1;
  if (initialP2) comparePlayer2 = initialP2;
  if (!comparePlayer1 && DATA.players && DATA.players.length > 0) comparePlayer1 = "Josh Allen";
  if (!comparePlayer2 && DATA.players && DATA.players.length > 0) comparePlayer2 = "Lamar Jackson";

  renderPlayerCompare();
  modal.classList.add('active');
}

function closePlayerCompareModal() {
  document.getElementById('playerCompareModal')?.classList.remove('active');
}

function setCompareQuick(p1, p2) {
  if (p1) comparePlayer1 = p1;
  if (p2) comparePlayer2 = p2;
  renderPlayerCompare();
}

function renderPlayerCompare() {
  const container = document.getElementById('playerCompareContent');
  if (!container) return;

  const d1 = findPlayerData(comparePlayer1);
  const d2 = findPlayerData(comparePlayer2);

  const allNames = Array.from(new Set([
    ...(DATA.players || []).map(p => p.name),
    ...Object.values(CLAY_DATA?.positional_projections || {}).flat().map(p => p.name)
  ])).filter(Boolean).sort();

  const p1 = d1.pRecord || {};
  const cp1 = d1.clayPosProj || {};
  const p2 = d2.pRecord || {};
  const cp2 = d2.clayPosProj || {};

  const pos1 = p1.pos || cp1.pos || d1.starterInfo?.position || 'QB';
  const pos2 = p2.pos || cp2.pos || d2.starterInfo?.position || 'QB';

  const ovr1 = p1.ovr !== null && p1.ovr !== undefined ? p1.ovr : (d1.starterInfo ? d1.starterInfo.rating * 10 : 75);
  const ovr2 = p2.ovr !== null && p2.ovr !== undefined ? p2.ovr : (d2.starterInfo ? d2.starterInfo.rating * 10 : 75);

  const grade1 = d1.starterInfo?.rating || (cp1.pos_rank <= 5 ? 8.5 : cp1.pos_rank <= 12 ? 7.5 : 6.5);
  const grade2 = d2.starterInfo?.rating || (cp2.pos_rank <= 5 ? 8.5 : cp2.pos_rank <= 12 ? 7.5 : 6.5);

  const team1 = p1.team_id ? (DATA.teams?.find(t=>t.id===p1.team_id)?.name || p1.team_id) : (cp1.team_abbr || d1.starterInfo?.teamName || 'NFL');
  const team2 = p2.team_id ? (DATA.teams?.find(t=>t.id===p2.team_id)?.name || p2.team_id) : (cp2.team_abbr || d2.starterInfo?.teamName || 'NFL');

  let radarLabels = ['Volume', 'Efficiency', 'Scoring', 'Film Grade', 'Madden Rating', 'Market Implied'];
  let v1 = [7, 7, 7, grade1, ovr1 / 10, 7];
  let v2 = [7, 7, 7, grade2, ovr2 / 10, 7];

  if (pos1 === 'QB' || pos2 === 'QB') {
    radarLabels = ['Pass Yds', 'Pass TDs', 'Pass Acc %', 'Rush Threat', 'Film Grade', 'Madden OVR'];
    const cmpPct1 = cp1.pass_att ? (cp1.pass_comp / cp1.pass_att * 10) : 6.5;
    const cmpPct2 = cp2.pass_att ? (cp2.pass_comp / cp2.pass_att * 10) : 6.5;
    v1 = [
      Math.min(10, ((cp1.pass_yds || 3000) / 4500) * 10),
      Math.min(10, ((cp1.pass_td || 20) / 36) * 10),
      Math.min(10, cmpPct1),
      Math.min(10, ((cp1.rush_yds || 0) / 800) * 10),
      grade1,
      ovr1 / 10
    ];
    v2 = [
      Math.min(10, ((cp2.pass_yds || 3000) / 4500) * 10),
      Math.min(10, ((cp2.pass_td || 20) / 36) * 10),
      Math.min(10, cmpPct2),
      Math.min(10, ((cp2.rush_yds || 0) / 800) * 10),
      grade2,
      ovr2 / 10
    ];
  } else if (pos1 === 'RB' || pos2 === 'RB') {
    radarLabels = ['Rush Yds', 'Rush TDs', 'Rec Share', 'Total Scrimmage', 'Film Grade', 'Madden OVR'];
    v1 = [
      Math.min(10, ((cp1.rush_yds || 500) / 1400) * 10),
      Math.min(10, ((cp1.rush_td || 5) / 14) * 10),
      Math.min(10, ((cp1.rec || 20) / 80) * 10),
      Math.min(10, (((cp1.rush_yds || 0) + (cp1.rec_yds || 0)) / 1800) * 10),
      grade1,
      ovr1 / 10
    ];
    v2 = [
      Math.min(10, ((cp2.rush_yds || 500) / 1400) * 10),
      Math.min(10, ((cp2.rush_td || 5) / 14) * 10),
      Math.min(10, ((cp2.rec || 20) / 80) * 10),
      Math.min(10, (((cp2.rush_yds || 0) + (cp2.rec_yds || 0)) / 1800) * 10),
      grade2,
      ovr2 / 10
    ];
  } else if (['WR', 'TE'].includes(pos1) || ['WR', 'TE'].includes(pos2)) {
    radarLabels = ['Targets', 'Receptions', 'Rec Yds', 'Rec TDs', 'Film Grade', 'Madden OVR'];
    v1 = [
      Math.min(10, ((cp1.targets || 50) / 160) * 10),
      Math.min(10, ((cp1.rec || 40) / 110) * 10),
      Math.min(10, ((cp1.rec_yds || 500) / 1500) * 10),
      Math.min(10, ((cp1.rec_td || 4) / 12) * 10),
      grade1,
      ovr1 / 10
    ];
    v2 = [
      Math.min(10, ((cp2.targets || 50) / 160) * 10),
      Math.min(10, ((cp2.rec || 40) / 110) * 10),
      Math.min(10, ((cp2.rec_yds || 500) / 1500) * 10),
      Math.min(10, ((cp2.rec_td || 4) / 12) * 10),
      grade2,
      ovr2 / 10
    ];
  }

  const rivals = {
    'QB': ['Josh Allen', 'Lamar Jackson', 'Patrick Mahomes', 'Joe Burrow', 'Jalen Hurts', 'C.J. Stroud', 'Jayden Daniels', 'Jordan Love', 'Brock Purdy', 'Justin Herbert'],
    'RB': ['Christian McCaffrey', 'Bijan Robinson', 'Saquon Barkley', 'Breece Hall', 'Jahmyr Gibbs', 'Jonathan Taylor', 'Derrick Henry', 'Kyren Williams', 'De\'Von Achane', 'Josh Jacobs'],
    'WR': ['Justin Jefferson', 'CeeDee Lamb', 'Ja\'Marr Chase', 'Amon-Ra St. Brown', 'Tyreek Hill', 'A.J. Brown', 'Garrett Wilson', 'Marvin Harrison Jr.', 'Puka Nacua', 'Malik Nabers'],
    'TE': ['Sam LaPorta', 'Travis Kelce', 'Trey McBride', 'Mark Andrews', 'Brock Bowers', 'George Kittle', 'Dalton Kincaid', 'Kyle Pitts'],
    'DEF': ['Micah Parsons', 'Myles Garrett', 'T.J. Watt', 'Nick Bosa', 'Maxx Crosby', 'Fred Warner', 'Roquan Smith', 'Sauce Gardner', 'Patrick Surtain II', 'Kyle Hamilton']
  };

  const posRivals = rivals[pos1] || rivals['QB'];

  let html = `
    <!-- Top Search & Quick Selector -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div class="glass rounded-xl p-3 border-l-4 border-cyan-400">
        <div class="flex items-center justify-between mb-1">
          <label class="text-[10px] uppercase font-bold text-cyan-300">Player 1 (Cyan)</label>
          <span class="text-[10px] text-slate-400 font-mono">${pos1} · ${team1}</span>
        </div>
        <input list="pCompareList1" value="${comparePlayer1 || ''}" onchange="comparePlayer1=this.value;renderPlayerCompare()" placeholder="Search Player 1..." class="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-xs w-full text-white focus:outline-none focus:border-cyan-500">
        <datalist id="pCompareList1">
          ${allNames.slice(0, 200).map(n => `<option value="${n.replace(/"/g, '&quot;')}">`).join('')}
        </datalist>
      </div>

      <div class="glass rounded-xl p-3 border-l-4 border-amber-400">
        <div class="flex items-center justify-between mb-1">
          <label class="text-[10px] uppercase font-bold text-amber-300">Player 2 (Amber)</label>
          <span class="text-[10px] text-slate-400 font-mono">${pos2} · ${team2}</span>
        </div>
        <input list="pCompareList2" value="${comparePlayer2 || ''}" onchange="comparePlayer2=this.value;renderPlayerCompare()" placeholder="Search Player 2..." class="bg-slate-800 border border-slate-600 rounded-lg px-3 py-1.5 text-xs w-full text-white focus:outline-none focus:border-amber-500">
        <datalist id="pCompareList2">
          ${allNames.slice(0, 200).map(n => `<option value="${n.replace(/"/g, '&quot;')}">`).join('')}
        </datalist>
      </div>
    </div>

    <!-- Quick Swap Rivalry Bar -->
    <div class="flex items-center gap-1.5 mb-5 overflow-x-auto pb-1 text-xs">
      <span class="text-[10px] font-bold uppercase text-slate-400 whitespace-nowrap">Quick Rivals:</span>
      ${posRivals.slice(0, 8).map(r => `
        <button onclick="setCompareQuick(null, '${r.replace(/'/g, "\\'")}')" class="px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] whitespace-nowrap transition">
          vs ${r}
        </button>
      `).join('')}
    </div>

    <!-- Visual Overlaid Radar & Hero Summary -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
      <!-- Player 1 Hero Card -->
      <div class="glass rounded-xl p-4 flex flex-col justify-between border border-cyan-500/30">
        <div>
          <div class="flex items-start justify-between mb-3">
            <div>
              <div class="text-[10px] uppercase font-black tracking-wider text-cyan-400">Player 1</div>
              <h3 class="text-xl font-black text-white">${d1.name}</h3>
              <div class="text-xs text-slate-400 mt-0.5">${pos1} · ${team1} · ${p1.age ? p1.age+' yrs' : 'Age N/A'}</div>
            </div>
            <div class="text-right">
              <div class="text-[9px] uppercase font-bold text-slate-500">Madden 27</div>
              <div class="text-xl font-black text-cyan-400">${ovr1}</div>
            </div>
          </div>
          <div class="space-y-1.5 text-xs">
            <div class="flex justify-between py-1 border-b border-slate-800/60"><span class="text-slate-400">Starter Grade</span><strong class="text-emerald-400">${grade1}/10</strong></div>
            <div class="flex justify-between py-1 border-b border-slate-800/60"><span class="text-slate-400">Clay Position Rank</span><strong class="text-slate-200">#${cp1.pos_rank || '–'}</strong></div>
            <div class="flex justify-between py-1 border-b border-slate-800/60"><span class="text-slate-400">Clay Fantasy Pts</span><strong class="text-cyan-300">${cp1.ff_pts || '–'}</strong></div>
            <div class="flex justify-between py-1 border-b border-slate-800/60"><span class="text-slate-400">Priced Prop Plays</span><strong class="text-slate-300">${d1.playerProps?.length || 0}</strong></div>
          </div>
        </div>
        <button onclick="openPlayerModal('${d1.name.replace(/'/g, "\\'")}')" class="mt-3 text-xs w-full py-1.5 rounded-lg bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-500/30 transition font-semibold">
          View Full Dossier
        </button>
      </div>

      <!-- Overlaid Visual Radar Chart -->
      <div class="glass rounded-xl p-3 flex flex-col items-center justify-center text-center">
        <div class="text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">Head-to-Head Skill Radar</div>
        <div class="flex items-center gap-4 text-[11px] font-semibold mb-2">
          <span class="flex items-center gap-1 text-cyan-400"><span class="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block"></span> ${d1.name}</span>
          <span class="flex items-center gap-1 text-amber-400"><span class="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span> ${d2.name}</span>
        </div>
        ${createDualRadarSvg(radarLabels, v1, v2, d1.name, d2.name, 230)}
      </div>

      <!-- Player 2 Hero Card -->
      <div class="glass rounded-xl p-4 flex flex-col justify-between border border-amber-500/30">
        <div>
          <div class="flex items-start justify-between mb-3">
            <div>
              <div class="text-[10px] uppercase font-black tracking-wider text-amber-400">Player 2</div>
              <h3 class="text-xl font-black text-white">${d2.name}</h3>
              <div class="text-xs text-slate-400 mt-0.5">${pos2} · ${team2} · ${p2.age ? p2.age+' yrs' : 'Age N/A'}</div>
            </div>
            <div class="text-right">
              <div class="text-[9px] uppercase font-bold text-slate-500">Madden 27</div>
              <div class="text-xl font-black text-amber-400">${ovr2}</div>
            </div>
          </div>
          <div class="space-y-1.5 text-xs">
            <div class="flex justify-between py-1 border-b border-slate-800/60"><span class="text-slate-400">Starter Grade</span><strong class="text-emerald-400">${grade2}/10</strong></div>
            <div class="flex justify-between py-1 border-b border-slate-800/60"><span class="text-slate-400">Clay Position Rank</span><strong class="text-slate-200">#${cp2.pos_rank || '–'}</strong></div>
            <div class="flex justify-between py-1 border-b border-slate-800/60"><span class="text-slate-400">Clay Fantasy Pts</span><strong class="text-amber-300">${cp2.ff_pts || '–'}</strong></div>
            <div class="flex justify-between py-1 border-b border-slate-800/60"><span class="text-slate-400">Priced Prop Plays</span><strong class="text-slate-300">${d2.playerProps?.length || 0}</strong></div>
          </div>
        </div>
        <button onclick="openPlayerModal('${d2.name.replace(/'/g, "\\'")}')" class="mt-3 text-xs w-full py-1.5 rounded-lg bg-amber-600/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition font-semibold">
          View Full Dossier
        </button>
      </div>
    </div>
  `;

  // ── Stat-by-Stat Direct Delta Table ──
  const statDefs = [
    { label: 'Madden 27 Rating', k1: ovr1, k2: ovr2, unit: '', higherIsBetter: true },
    { label: 'Starter Film Grade', k1: grade1, k2: grade2, unit: '/10', higherIsBetter: true },
    { label: 'Projected Fantasy Points', k1: cp1.ff_pts, k2: cp2.ff_pts, unit: ' pts', higherIsBetter: true },
    { label: 'Passing Yards (Raw 17g)', k1: cp1.pass_yds, k2: cp2.pass_yds, unit: ' yds', higherIsBetter: true },
    { label: 'Passing Yards (Adj Baseline)', k1: cp1.pass_yds ? Number((cp1.pass_yds * (15/17)).toFixed(0)) : null, k2: cp2.pass_yds ? Number((cp2.pass_yds * (15/17)).toFixed(0)) : null, unit: ' yds', higherIsBetter: true },
    { label: 'Passing Touchdowns', k1: cp1.pass_td, k2: cp2.pass_td, unit: ' TDs', higherIsBetter: true },
    { label: 'Interceptions Thrown', k1: cp1.interceptions, k2: cp2.interceptions, unit: ' INTs', higherIsBetter: false },
    { label: 'Pass Completions / Attempts', k1: cp1.pass_comp ? `${cp1.pass_comp}/${cp1.pass_att}` : null, k2: cp2.pass_comp ? `${cp2.pass_comp}/${cp2.pass_att}` : null, isStr: true },
    { label: 'Rushing Carries / Attempts', k1: cp1.carries || cp1.rush_att || null, k2: cp2.carries || cp2.rush_att || null, unit: ' att', higherIsBetter: true },
    { label: 'Rushing Yards (Raw 17g)', k1: cp1.rush_yds, k2: cp2.rush_yds, unit: ' yds', higherIsBetter: true },
    { label: 'Rushing Yards (Adj Baseline)', k1: cp1.rush_yds ? Number((cp1.rush_yds * (pos1==='RB'?14/17:15/17)).toFixed(0)) : null, k2: cp2.rush_yds ? Number((cp2.rush_yds * (pos2==='RB'?14/17:15/17)).toFixed(0)) : null, unit: ' yds', higherIsBetter: true },
    { label: 'Rushing Touchdowns', k1: cp1.rush_td, k2: cp2.rush_td, unit: ' TDs', higherIsBetter: true },
    { label: 'Targets', k1: cp1.targets, k2: cp2.targets, unit: ' tgt', higherIsBetter: true },
    { label: 'Receptions (Raw 17g)', k1: cp1.rec, k2: cp2.rec, unit: ' rec', higherIsBetter: true },
    { label: 'Receiving Yards (Raw 17g)', k1: cp1.rec_yds, k2: cp2.rec_yds, unit: ' yds', higherIsBetter: true },
    { label: 'Receiving Touchdowns', k1: cp1.rec_td, k2: cp2.rec_td, unit: ' TDs', higherIsBetter: true },
    { label: 'Total Scrimmage Yards', k1: (cp1.rush_yds||0)+(cp1.rec_yds||0) || null, k2: (cp2.rush_yds||0)+(cp2.rec_yds||0) || null, unit: ' yds', higherIsBetter: true },
    { label: 'Total Touchdowns', k1: (cp1.rush_td||0)+(cp1.rec_td||0)+(pos1==='QB'?(cp1.pass_td||0):0) || null, k2: (cp2.rush_td||0)+(cp2.rec_td||0)+(pos2==='QB'?(cp2.pass_td||0):0) || null, unit: ' TDs', higherIsBetter: true },
    { label: 'Defensive Snaps', k1: cp1.snaps, k2: cp2.snaps, unit: ' snaps', higherIsBetter: true },
    { label: 'Total Tackles', k1: cp1.total_tackles || cp1.tackles, k2: cp2.total_tackles || cp2.tackles, unit: ' tkl', higherIsBetter: true },
    { label: 'Sacks', k1: cp1.sacks, k2: cp2.sacks, unit: ' sacks', higherIsBetter: true },
    { label: 'Defensive Interceptions', k1: ['IDL','EDGE','LB','CB','S'].includes(d1.posGroup)?cp1.interceptions:null, k2: ['IDL','EDGE','LB','CB','S'].includes(d2.posGroup)?cp2.interceptions:null, unit: ' INTs', higherIsBetter: true },
  ];

  const activeStats = statDefs.filter(s => s.k1 !== null && s.k1 !== undefined && s.k2 !== null && s.k2 !== undefined);

  html += `
    <div class="glass rounded-xl p-4 mb-5">
      <div class="text-xs font-bold uppercase tracking-wider text-cyan-400 mb-3 flex items-center gap-2">
        <span>⚡</span> Direct Stat-by-Stat Delta Comparison
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="text-slate-400 border-b border-slate-700/60 bg-slate-800/50">
              <th class="py-2 px-3 text-left">Metric</th>
              <th class="py-2 px-3 text-center text-cyan-400 w-36">${d1.name}</th>
              <th class="py-2 px-3 text-center text-amber-400 w-36">${d2.name}</th>
              <th class="py-2 px-3 text-center w-48">Head-to-Head Advantage</th>
            </tr>
          </thead>
          <tbody>
  `;

  for (const st of activeStats) {
    let advHtml = '<span class="text-slate-500 font-mono">Tied</span>';
    if (!st.isStr && typeof st.k1 === 'number' && typeof st.k2 === 'number') {
      const diff = Number((st.k1 - st.k2).toFixed(1));
      if (diff !== 0) {
        const p1Wins = st.higherIsBetter ? diff > 0 : diff < 0;
        const absDiff = Math.abs(diff);
        const pctDiff = st.k2 !== 0 ? Math.abs((absDiff / st.k2) * 100).toFixed(1) : '–';
        if (p1Wins) {
          advHtml = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-600/30 text-cyan-300 border border-cyan-500/40">${d1.name} +${absDiff}${st.unit} (${pctDiff}%)</span>`;
        } else {
          advHtml = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-600/30 text-amber-300 border border-amber-500/40">${d2.name} +${absDiff}${st.unit} (${pctDiff}%)</span>`;
        }
      }
    }

    html += `
      <tr class="border-b border-slate-800/40 hover:bg-slate-800/30 transition">
        <td class="py-2 px-3 font-semibold text-slate-300">${st.label}</td>
        <td class="py-2 px-3 text-center font-bold text-cyan-300">${st.k1}${st.unit || ''}</td>
        <td class="py-2 px-3 text-center font-bold text-amber-300">${st.k2}${st.unit || ''}</td>
        <td class="py-2 px-3 text-center">${advHtml}</td>
      </tr>
    `;
  }

  html += `</tbody></table></div></div>`;

  const p1Props = d1.playerProps || [];
  const p2Props = d2.playerProps || [];

  if (p1Props.length > 0 || p2Props.length > 0) {
    html += `
      <div class="glass rounded-xl p-4">
        <div class="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-2">
          <span>💰</span> Active Prop Markets & Sportsbook Valuation
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <div class="font-bold text-cyan-400 mb-2">${d1.name} Prop Markets (${p1Props.length})</div>
            ${p1Props.length ? `
              <div class="space-y-1.5">
                ${p1Props.slice(0, 5).map(pr => `
                  <div class="p-2 rounded bg-slate-800/50 border border-slate-700/40 flex items-center justify-between">
                    <div>
                      <span class="font-semibold text-slate-200">${propsMarketLabels[pr.market] || pr.market}</span>
                      <div class="text-[10px] text-slate-400">${pr.venue} · ${pr.odds || '–'}</div>
                    </div>
                    <div class="text-right">
                      <span class="font-bold text-white">${pr.line} (${pr.side.toUpperCase()})</span>
                      <div class="text-[10px] ${pr.ev_pct>0?'text-emerald-400 font-bold':'text-slate-500'}">${pr.ev_pct?'+'+pr.ev_pct.toFixed(1)+'% EV':'–'}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : '<p class="text-slate-500 text-xs">No active props priced</p>'}
          </div>

          <div>
            <div class="font-bold text-amber-400 mb-2">${d2.name} Prop Markets (${p2Props.length})</div>
            ${p2Props.length ? `
              <div class="space-y-1.5">
                ${p2Props.slice(0, 5).map(pr => `
                  <div class="p-2 rounded bg-slate-800/50 border border-slate-700/40 flex items-center justify-between">
                    <div>
                      <span class="font-semibold text-slate-200">${propsMarketLabels[pr.market] || pr.market}</span>
                      <div class="text-[10px] text-slate-400">${pr.venue} · ${pr.odds || '–'}</div>
                    </div>
                    <div class="text-right">
                      <span class="font-bold text-white">${pr.line} (${pr.side.toUpperCase()})</span>
                      <div class="text-[10px] ${pr.ev_pct>0?'text-emerald-400 font-bold':'text-slate-500'}">${pr.ev_pct?'+'+pr.ev_pct.toFixed(1)+'% EV':'–'}</div>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : '<p class="text-slate-500 text-xs">No active props priced</p>'}
          </div>
        </div>
      </div>
    `;
  }

  container.innerHTML = html;
}

// ── 5. GLOBAL COMMAND PALETTE ──
let cmdPaletteActiveIndex = 0;
let cmdPaletteItems = [];

function openCommandPalette() {
  const modal = document.getElementById('commandPaletteModal');
  const input = document.getElementById('cmdPaletteInput');
  if (!modal || !input) return;
  modal.classList.add('active');
  input.value = '';
  input.focus();
  handleCommandSearch('');
}

function closeCommandPalette() {
  document.getElementById('commandPaletteModal')?.classList.remove('active');
}

function handleCommandSearch(q) {
  const resultsContainer = document.getElementById('cmdPaletteResults');
  if (!resultsContainer) return;
  const query = (q || '').trim().toLowerCase();

  cmdPaletteItems = [];

  const tabs = [
    { label: 'Home Dashboard', type: 'Tab', icon: '🏠', action: () => { showTab('home'); closeCommandPalette(); } },
    { label: 'Transactions Feed', type: 'Tab', icon: '⚡', action: () => { showTab('feed'); closeCommandPalette(); } },
    { label: 'Teams & Rosters', type: 'Tab', icon: '🛡', action: () => { showTab('teams'); closeCommandPalette(); } },
    { label: '2026 Draft Tracker', type: 'Tab', icon: '📋', action: () => { showTab('draft'); closeCommandPalette(); } },
    { label: 'Mike Clay Projections', type: 'Tab', icon: '📊', action: () => { showTab('projections'); closeCommandPalette(); } },
    { label: 'Props & Value Board', type: 'Tab', icon: '💰', action: () => { showTab('props'); closeCommandPalette(); } },
    { label: 'Clay vs Market Delta', type: 'Feature', icon: '⚡', action: () => { showTab('projections'); switchProjSubTab('clay_delta'); closeCommandPalette(); } },
    { label: 'Opponent Matchup Matrix', type: 'Feature', icon: '🎯', action: () => { showTab('projections'); switchProjSubTab('matchup_matrix'); closeCommandPalette(); } },
    { label: 'Consensus Power Index', type: 'Feature', icon: '🏆', action: () => { showTab('projections'); switchProjSubTab('consensus'); closeCommandPalette(); } },
  ];
  for (const t of tabs) {
    if (!query || t.label.toLowerCase().includes(query)) cmdPaletteItems.push(t);
  }

  if (DATA.teams) {
    for (const tm of DATA.teams) {
      if (!query || tm.name.toLowerCase().includes(query) || tm.abbr?.toLowerCase().includes(query)) {
        cmdPaletteItems.push({
          label: `${tm.name} (${tm.abbr})`,
          type: 'Team',
          icon: '🏈',
          action: () => { openRoster(tm.name, 'offense'); closeCommandPalette(); }
        });
      }
    }
  }

  if (DATA.players) {
    let matchCount = 0;
    for (const p of DATA.players) {
      if (query && p.name && p.name.toLowerCase().includes(query)) {
        cmdPaletteItems.push({
          label: `${p.name} · ${p.pos || ''} (${p.ovr ? p.ovr+' OVR' : ''})`,
          type: 'Player',
          icon: '👤',
          action: () => { openPlayerModal(p.name); closeCommandPalette(); }
        });
        matchCount++;
        if (matchCount >= 20) break;
      }
    }
  }

  cmdPaletteActiveIndex = 0;
  renderCommandPaletteItems();
}

function renderCommandPaletteItems() {
  const container = document.getElementById('cmdPaletteResults');
  if (!container) return;

  if (cmdPaletteItems.length === 0) {
    container.innerHTML = '<div class="p-4 text-center text-xs text-slate-500">No matching items found.</div>';
    return;
  }

  container.innerHTML = cmdPaletteItems.slice(0, 30).map((item, idx) => {
    const isSel = idx === cmdPaletteActiveIndex;
    return `
      <div class="cmd-item ${isSel ? 'selected' : ''}" onclick="cmdPaletteItems[${idx}].action()">
        <span class="text-base">${item.icon}</span>
        <div class="flex-1 text-xs font-semibold text-slate-200">${item.label}</div>
        <span class="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">${item.type}</span>
      </div>
    `;
  }).join('');
}

function handleCommandKeydown(e) {
  if (e.key === 'Escape') {
    closeCommandPalette();
  } else if (e.key === 'ArrowDown') {
    e.preventDefault();
    if (cmdPaletteActiveIndex < Math.min(cmdPaletteItems.length - 1, 29)) {
      cmdPaletteActiveIndex++;
      renderCommandPaletteItems();
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (cmdPaletteActiveIndex > 0) {
      cmdPaletteActiveIndex--;
      renderCommandPaletteItems();
    }
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (cmdPaletteItems[cmdPaletteActiveIndex]) {
      cmdPaletteItems[cmdPaletteActiveIndex].action();
    }
  }
}

window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    const modal = document.getElementById('commandPaletteModal');
    if (modal && modal.classList.contains('active')) {
      closeCommandPalette();
    } else {
      openCommandPalette();
    }
  }
});

// ── 6. OPPONENT-ADJUSTED WEEKLY MATCHUP MATRIX ──
let mmStartWeek = 1;
let mmEndWeek = 18;
let mmPosition = 'overall';

function setMatchupPreset(start, end) {
  mmStartWeek = start;
  mmEndWeek = end;
  const startEl = document.getElementById('mmStartWeek');
  const endEl = document.getElementById('mmEndWeek');
  if (startEl) startEl.value = start;
  if (endEl) endEl.value = end;
  const c = document.getElementById('projContent');
  if (c && CLAY_DATA) renderMatchupMatrix(c, CLAY_DATA);
}

function setMatchupPosition(pos) {
  mmPosition = pos;
  const c = document.getElementById('projContent');
  if (c && CLAY_DATA) renderMatchupMatrix(c, CLAY_DATA);
}

function renderMatchupMatrix(c, data) {
  if (!data.strength_of_schedule || !data.unit_grades) {
    c.innerHTML = '<p class="text-slate-500 text-xs">Strength of schedule or unit grades data missing.</p>';
    return;
  }

  const abbrToGrades = {};
  for (const [abbr, sos] of Object.entries(data.strength_of_schedule)) {
    const tmName = sos.team;
    const ug = data.unit_grades[tmName];
    if (ug) abbrToGrades[abbr] = ug;
  }

  const getOppGrade = (oppStr, posMode) => {
    if (!oppStr || oppStr === '0') return null;
    const oppAbbr = oppStr.replace('@', '').trim();
    const g = abbrToGrades[oppAbbr];
    if (!g) return 5.0;

    if (posMode === 'overall') return g.defense_grade || 5.0;
    if (posMode === 'pass') return Number(((g.CB * 0.4) + (g.S * 0.3) + (g.ED * 0.3)).toFixed(1));
    if (posMode === 'rush') return Number(((g.DI * 0.5) + (g.LB * 0.5)).toFixed(1));
    if (posMode === 'te') return Number(((g.LB * 0.5) + (g.S * 0.5)).toFixed(1));
    return g.defense_grade || 5.0;
  };

  const getCellClass = (grade) => {
    if (grade === null) return 'mm-cell-bye';
    if (grade <= 4.5) return 'mm-cell-soft';
    if (grade <= 5.8) return 'mm-cell-above';
    if (grade <= 6.8) return 'mm-cell-neutral';
    if (grade <= 7.8) return 'mm-cell-tough';
    return 'mm-cell-brutal';
  };

  const teamRows = [];
  for (const [abbr, sos] of Object.entries(data.strength_of_schedule)) {
    let totalGrade = 0;
    let gamesCount = 0;
    const weeklyGrades = [];

    for (let w = 1; w <= 18; w++) {
      const opp = sos.schedule[w - 1] || '';
      const grade = getOppGrade(opp, mmPosition);
      weeklyGrades.push({ week: w, opp, grade });

      if (w >= mmStartWeek && w <= mmEndWeek && grade !== null) {
        totalGrade += grade;
        gamesCount++;
      }
    }

    const avgOppGrade = gamesCount > 0 ? (totalGrade / gamesCount) : 0;
    teamRows.push({
      abbr,
      team: sos.team,
      avgOppGrade: Number(avgOppGrade.toFixed(2)),
      gamesCount,
      weeklyGrades
    });
  }

  teamRows.sort((a, b) => a.avgOppGrade - b.avgOppGrade);

  let html = `
    <div class="mb-4">
      <div class="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div>
          <h3 class="text-sm font-bold text-white flex items-center gap-2">
            <span>🎯</span> Opponent-Adjusted Weekly Matchup Matrix
          </h3>
          <p class="text-xs text-slate-400 mt-0.5">
            Opponent defensive strength across custom week windows. Lower opponent grade = softer matchup (green).
          </p>
        </div>
        <div class="flex items-center gap-1.5 flex-wrap">
          <button onclick="setMatchupPreset(1,18)" class="text-[11px] px-2.5 py-1 rounded-lg ${mmStartWeek===1&&mmEndWeek===18?'bg-cyan-600/40 text-cyan-300 border border-cyan-500/50':'bg-slate-800 text-slate-400'}">All 18 Wks</button>
          <button onclick="setMatchupPreset(1,4)" class="text-[11px] px-2.5 py-1 rounded-lg ${mmStartWeek===1&&mmEndWeek===4?'bg-cyan-600/40 text-cyan-300 border border-cyan-500/50':'bg-slate-800 text-slate-400'}">W1-4 (Early)</button>
          <button onclick="setMatchupPreset(5,9)" class="text-[11px] px-2.5 py-1 rounded-lg ${mmStartWeek===5&&mmEndWeek===9?'bg-cyan-600/40 text-cyan-300 border border-cyan-500/50':'bg-slate-800 text-slate-400'}">W5-9 (Mid)</button>
          <button onclick="setMatchupPreset(10,14)" class="text-[11px] px-2.5 py-1 rounded-lg ${mmStartWeek===10&&mmEndWeek===14?'bg-cyan-600/40 text-cyan-300 border border-cyan-500/50':'bg-slate-800 text-slate-400'}">W10-14 (Late)</button>
          <button onclick="setMatchupPreset(15,17)" class="text-[11px] px-2.5 py-1 rounded-lg ${mmStartWeek===15&&mmEndWeek===17?'bg-emerald-600/40 text-emerald-300 border border-emerald-500/50':'bg-slate-800 text-slate-400'}">W15-17 (Playoffs)</button>
        </div>
      </div>

      <div class="flex items-center justify-between flex-wrap gap-3 bg-slate-800/40 p-3 rounded-xl border border-slate-700/50 mb-4">
        <div class="flex items-center gap-2 flex-wrap">
          <span class="text-[11px] text-slate-400 font-bold uppercase">Position Group:</span>
          <button onclick="setMatchupPosition('overall')" class="text-xs px-2.5 py-1 rounded-lg ${mmPosition==='overall'?'bg-cyan-600 text-white font-bold':'bg-slate-800 text-slate-400'}">Overall Defense</button>
          <button onclick="setMatchupPosition('pass')" class="text-xs px-2.5 py-1 rounded-lg ${mmPosition==='pass'?'bg-cyan-600 text-white font-bold':'bg-slate-800 text-slate-400'}">Pass (QB / WR)</button>
          <button onclick="setMatchupPosition('rush')" class="text-xs px-2.5 py-1 rounded-lg ${mmPosition==='rush'?'bg-cyan-600 text-white font-bold':'bg-slate-800 text-slate-400'}">Rush (RB)</button>
          <button onclick="setMatchupPosition('te')" class="text-xs px-2.5 py-1 rounded-lg ${mmPosition==='te'?'bg-cyan-600 text-white font-bold':'bg-slate-800 text-slate-400'}">Tight End</button>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[11px] text-slate-400">Custom Window:</span>
          <select id="mmStartWeek" onchange="mmStartWeek=Number(this.value);renderMatchupMatrix(document.getElementById('projContent'),CLAY_DATA)" class="text-xs px-2 py-1 rounded bg-slate-800 border border-slate-600 text-slate-300">
            ${Array.from({length:18},(_,i)=>`<option value="${i+1}" ${mmStartWeek===i+1?'selected':''}>W${i+1}</option>`).join('')}
          </select>
          <span class="text-slate-500">to</span>
          <select id="mmEndWeek" onchange="mmEndWeek=Number(this.value);renderMatchupMatrix(document.getElementById('projContent'),CLAY_DATA)" class="text-xs px-2 py-1 rounded bg-slate-800 border border-slate-600 text-slate-300">
            ${Array.from({length:18},(_,i)=>`<option value="${i+1}" ${mmEndWeek===i+1?'selected':''}>W${i+1}</option>`).join('')}
          </select>
        </div>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-xs border-collapse">
        <thead>
          <tr class="text-slate-400 border-b border-slate-700/60 bg-slate-800/50">
            <th class="py-2 px-2 text-center w-10">Rk</th>
            <th class="py-2 px-3 text-left w-40">Team</th>
            <th class="py-2 px-2 text-center w-20">Avg Opp</th>
  `;

  for (let w = 1; w <= 18; w++) {
    const isHighlighted = w >= mmStartWeek && w <= mmEndWeek;
    html += `<th class="py-2 px-1 text-center font-semibold ${isHighlighted ? 'text-cyan-400 bg-cyan-950/20' : 'text-slate-500'}">W${w}</th>`;
  }
  html += `</tr></thead><tbody>`;

  teamRows.forEach((row, idx) => {
    const teamEsc = row.team.replace(/'/g, "\\'");
    html += `
      <tr class="border-b border-slate-800/40 hover:bg-slate-800/30 transition">
        <td class="py-2 px-2 text-center font-bold ${idx < 5 ? 'text-emerald-400' : idx > 26 ? 'text-red-400' : 'text-slate-400'}">${idx + 1}</td>
        <td class="py-2 px-3 font-semibold text-slate-200 proj-link-team whitespace-nowrap" onclick="openRoster('${teamEsc}', 'projections')">${row.team}</td>
        <td class="py-2 px-2 text-center font-black ${row.avgOppGrade <= 5.0 ? 'text-emerald-400' : row.avgOppGrade >= 6.8 ? 'text-red-400' : 'text-cyan-300'}">${row.avgOppGrade}</td>
    `;

    for (const wg of row.weeklyGrades) {
      const isWindow = wg.week >= mmStartWeek && wg.week <= mmEndWeek;
      const cellCls = getCellClass(wg.grade);
      const isBye = wg.opp === '0';
      const label = isBye ? 'BYE' : wg.opp;
      const title = isBye ? 'Bye Week' : `Opponent: ${wg.opp} · Defense Grade: ${wg.grade}`;

      html += `
        <td class="py-1 px-0.5 text-center ${isWindow ? 'bg-cyan-950/10' : 'opacity-60'}">
          <div class="mm-cell ${cellCls}" title="${title}">
            ${label}
          </div>
        </td>
      `;
    }
    html += `</tr>`;
  });

  html += `</tbody></table></div>`;
  c.innerHTML = html;
}

// ── 7. MIKE CLAY PROJECTIONS VS MARKET LINE DELTA ──
let clayDeltaDiscountMode = 'baseline';
let clayDeltaCustomGames = 15;
let clayDeltaPosFilter = 'all';
let clayDeltaMarketFilter = 'all';
let clayDeltaMinPct = 0;
let clayDeltaSearch = '';
let clayDeltaSortCol = 'delta_pct';
let clayDeltaSortDir = -1;

function renderClayMarketDelta(c, data) {
  if (!PROPS_BOARD || !PROPS_BOARD.plays) {
    loadPropsBoard().then(() => renderClayMarketDelta(c, data));
    return;
  }

  const clayPlayersMap = {};
  if (data.positional_projections) {
    for (const [pos, list] of Object.entries(data.positional_projections)) {
      for (const p of list) {
        const norm = (p.name || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/['’.\-]/g,"").replace(/\b(jr|sr|ii|iii|iv|v)\b/gi,"").replace(/\s+/g," ").trim();
        clayPlayersMap[norm] = { ...p, posGroup: pos };
      }
    }
  }

  const deltas = [];

  for (const play of PROPS_BOARD.plays) {
    const norm = (play.player || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/['’.\-]/g,"").replace(/\b(jr|sr|ii|iii|iv|v)\b/gi,"").replace(/\s+/g," ").trim();
    const cp = clayPlayersMap[norm];
    if (!cp) continue;

    const pos = cp.pos || cp.posGroup || play.position || '';
    if (clayDeltaPosFilter !== 'all' && pos !== clayDeltaPosFilter) continue;
    if (clayDeltaMarketFilter !== 'all' && play.market !== clayDeltaMarketFilter) continue;
    if (clayDeltaSearch && !play.player.toLowerCase().includes(clayDeltaSearch.toLowerCase())) continue;

    let rawProj = 0;
    if (play.market === 'passing_yards') rawProj = cp.pass_yds;
    else if (play.market === 'passing_tds') rawProj = cp.pass_td;
    else if (play.market === 'rushing_yards') rawProj = cp.rush_yds;
    else if (play.market === 'rushing_tds') rawProj = cp.rush_td;
    else if (play.market === 'receiving_yards') rawProj = cp.rec_yds;
    else if (play.market === 'receiving_tds') rawProj = cp.rec_td;
    else if (play.market === 'receptions') rawProj = cp.rec;
    else if (play.market === 'carries') rawProj = cp.carries || cp.rush_att;
    else if (play.market === 'fantasy_points') rawProj = cp.ff_pts;
    else if (play.market === 'scrimmage_yards') rawProj = (cp.rush_yds || 0) + (cp.rec_yds || 0);
    else if (play.market === 'total_tds') rawProj = (cp.rush_td || 0) + (cp.rec_td || 0);

    if (rawProj === undefined || rawProj === null || isNaN(rawProj)) continue;

    let mult = 1.0;
    if (clayDeltaDiscountMode === 'baseline') {
      mult = pos === 'RB' ? (14 / 17) : (15 / 17);
    } else if (clayDeltaDiscountMode === 'custom') {
      mult = clayDeltaCustomGames / 17;
    }

    const adjProj = Number((rawProj * mult).toFixed(1));
    const line = Number(play.line);
    const diff = Number((adjProj - line).toFixed(1));
    const deltaPct = Number(((diff / line) * 100).toFixed(1));
    const impliedPick = adjProj > line ? 'OVER' : 'UNDER';

    if (Math.abs(deltaPct) < clayDeltaMinPct) continue;

    deltas.push({
      player: play.player,
      team: play.team || cp.team_abbr,
      pos,
      market: play.market,
      venue: play.venue,
      odds: play.odds,
      line,
      rawProj,
      adjProj,
      diff,
      deltaPct,
      impliedPick,
      modelEv: play.ev_pct || 0,
      edgePct: play.edge_pct || 0
    });
  }

  deltas.sort((a, b) => {
    let va = a[clayDeltaSortCol], vb = b[clayDeltaSortCol];
    if (typeof va === 'string') return va.localeCompare(vb) * clayDeltaSortDir;
    return (Number(va) - Number(vb)) * clayDeltaSortDir;
  });

  const overCount = deltas.filter(d => d.impliedPick === 'OVER').length;
  const underCount = deltas.filter(d => d.impliedPick === 'UNDER').length;

  let html = `
    <div class="mb-4">
      <div class="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div>
          <h3 class="text-sm font-bold text-white flex items-center gap-2">
            <span>⚡</span> Mike Clay Projections vs Market Line Delta
          </h3>
          <p class="text-xs text-slate-400 mt-0.5">
            Direct comparison of Mike Clay 2026 stat pace against prediction market & sportsbook prop totals.
          </p>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold px-2 py-1 rounded bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">${overCount} Clay Over</span>
          <span class="text-xs font-semibold px-2 py-1 rounded bg-cyan-600/20 text-cyan-400 border border-cyan-500/30">${underCount} Clay Under</span>
        </div>
      </div>

      <div class="bg-slate-800/40 p-3 rounded-xl border border-slate-700/50 mb-4 space-y-3">
        <div class="flex items-center justify-between flex-wrap gap-3">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="text-[11px] text-slate-400 font-bold uppercase">Injury Baseline:</span>
            <button onclick="clayDeltaDiscountMode='baseline';renderClayMarketDelta(document.getElementById('projContent'),CLAY_DATA)" class="text-xs px-3 py-1 rounded-lg ${clayDeltaDiscountMode==='baseline'?'bg-amber-600 text-white font-bold':'bg-slate-800 text-slate-400'}">
              Mike Clay Baseline (-2g QB/WR/TE, -3g RB)
            </button>
            <button onclick="clayDeltaDiscountMode='raw17';renderClayMarketDelta(document.getElementById('projContent'),CLAY_DATA)" class="text-xs px-3 py-1 rounded-lg ${clayDeltaDiscountMode==='raw17'?'bg-cyan-600 text-white font-bold':'bg-slate-800 text-slate-400'}">
              Full 17 Games (Raw Pace)
            </button>
            <button onclick="clayDeltaDiscountMode='custom';renderClayMarketDelta(document.getElementById('projContent'),CLAY_DATA)" class="text-xs px-3 py-1 rounded-lg ${clayDeltaDiscountMode==='custom'?'bg-indigo-600 text-white font-bold':'bg-slate-800 text-slate-400'}">
              Custom Slider
            </button>
          </div>
          ${clayDeltaDiscountMode==='custom' ? `
            <div class="flex items-center gap-2">
              <span class="text-xs text-slate-300 font-bold">${clayDeltaCustomGames} Games</span>
              <input type="range" min="10" max="17" value="${clayDeltaCustomGames}" oninput="clayDeltaCustomGames=Number(this.value);renderClayMarketDelta(document.getElementById('projContent'),CLAY_DATA)" class="w-28 accent-indigo-500">
            </div>
          ` : ''}
        </div>

        <div class="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-700/40">
          <div class="flex items-center gap-2 flex-wrap">
            <select onchange="clayDeltaPosFilter=this.value;renderClayMarketDelta(document.getElementById('projContent'),CLAY_DATA)" class="text-xs px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-600 text-slate-300">
              <option value="all" ${clayDeltaPosFilter==='all'?'selected':''}>All Positions</option>
              <option value="QB" ${clayDeltaPosFilter==='QB'?'selected':''}>Quarterback (QB)</option>
              <option value="RB" ${clayDeltaPosFilter==='RB'?'selected':''}>Running Back (RB)</option>
              <option value="WR" ${clayDeltaPosFilter==='WR'?'selected':''}>Wide Receiver (WR)</option>
              <option value="TE" ${clayDeltaPosFilter==='TE'?'selected':''}>Tight End (TE)</option>
            </select>

            <select onchange="clayDeltaMarketFilter=this.value;renderClayMarketDelta(document.getElementById('projContent'),CLAY_DATA)" class="text-xs px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-600 text-slate-300">
              <option value="all" ${clayDeltaMarketFilter==='all'?'selected':''}>All Markets</option>
              <option value="passing_yards" ${clayDeltaMarketFilter==='passing_yards'?'selected':''}>Passing Yards</option>
              <option value="passing_tds" ${clayDeltaMarketFilter==='passing_tds'?'selected':''}>Passing TDs</option>
              <option value="rushing_yards" ${clayDeltaMarketFilter==='rushing_yards'?'selected':''}>Rushing Yards</option>
              <option value="rushing_tds" ${clayDeltaMarketFilter==='rushing_tds'?'selected':''}>Rushing TDs</option>
              <option value="receiving_yards" ${clayDeltaMarketFilter==='receiving_yards'?'selected':''}>Receiving Yards</option>
              <option value="receiving_tds" ${clayDeltaMarketFilter==='receiving_tds'?'selected':''}>Receiving TDs</option>
              <option value="receptions" ${clayDeltaMarketFilter==='receptions'?'selected':''}>Receptions</option>
              <option value="fantasy_points" ${clayDeltaMarketFilter==='fantasy_points'?'selected':''}>Fantasy Points</option>
            </select>
          </div>

          <div class="flex items-center gap-2">
            <input type="text" placeholder="Search player..." value="${clayDeltaSearch}" oninput="clayDeltaSearch=this.value;renderClayMarketDelta(document.getElementById('projContent'),CLAY_DATA)" class="text-xs px-3 py-1 rounded-lg bg-slate-800 border border-slate-600 text-white w-36 focus:outline-none focus:border-cyan-500">
          </div>
        </div>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead>
          <tr class="text-slate-400 border-b border-slate-700/60 bg-slate-800/50">
            <th class="py-2 px-3 text-left">Player</th>
            <th class="py-2 px-2 text-center">Pos</th>
            <th class="py-2 px-2 text-center">Team</th>
            <th class="py-2 px-2 text-left">Market</th>
            <th class="py-2 px-2 text-center">Venue</th>
            <th class="py-2 px-2 text-center">Book Line</th>
            <th class="py-2 px-2 text-center">Clay 17g</th>
            <th class="py-2 px-2 text-center">Clay Adj</th>
            <th class="py-2 px-2 text-center">Delta</th>
            <th class="py-2 px-2 text-center">Delta %</th>
            <th class="py-2 px-2 text-center">Clay Implied</th>
            <th class="py-2 px-2 text-center">Model EV%</th>
          </tr>
        </thead>
        <tbody>
  `;

  for (const d of deltas) {
    const isOver = d.impliedPick === 'OVER';
    const pickBadge = isOver ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/40' : 'bg-cyan-600/30 text-cyan-300 border-cyan-500/40';
    const deltaColor = d.diff > 0 ? 'text-emerald-400' : 'text-cyan-400';
    const evColor = d.modelEv > 0 ? 'text-emerald-400 font-bold' : 'text-slate-400';

    html += `
      <tr class="border-b border-slate-800/40 hover:bg-slate-800/30 transition">
        <td class="py-2 px-3 font-semibold text-slate-200 whitespace-nowrap">${playerLinkHtml(d.player, d.team)}</td>
        <td class="py-2 px-2 text-center font-bold text-slate-400">${d.pos}</td>
        <td class="py-2 px-2 text-center text-slate-400 proj-link-team" onclick="openRosterFromAbbr('${d.team}')">${d.team}</td>
        <td class="py-2 px-2 font-medium text-slate-300 whitespace-nowrap">${propsMarketLabels[d.market] || d.market}</td>
        <td class="py-2 px-2 text-center text-slate-400">${d.venue}</td>
        <td class="py-2 px-2 text-center font-bold text-white">${d.line}</td>
        <td class="py-2 px-2 text-center text-slate-400">${d.rawProj}</td>
        <td class="py-2 px-2 text-center font-bold text-cyan-300">${d.adjProj}</td>
        <td class="py-2 px-2 text-center font-bold ${deltaColor}">${d.diff > 0 ? '+' : ''}${d.diff}</td>
        <td class="py-2 px-2 text-center font-black ${deltaColor}">${d.deltaPct > 0 ? '+' : ''}${d.deltaPct}%</td>
        <td class="py-2 px-2 text-center"><span class="px-2 py-0.5 rounded text-[10px] font-black border ${pickBadge}">${d.impliedPick}</span></td>
        <td class="py-2 px-2 text-center ${evColor}">${d.modelEv > 0 ? '+' : ''}${d.modelEv.toFixed(1)}%</td>
      </tr>
    `;
  }

  html += `</tbody></table></div>`;
  c.innerHTML = html;
}

// ── 8. CALIBRATED UNIFIED CONSENSUS POWER INDEX ──
function renderConsensusPower(c, data) {
  if (!data.standings || !data.unit_grades) {
    c.innerHTML = '<p class="text-slate-500 text-xs">Standings or unit grades missing.</p>';
    return;
  }

  const rawTeams = [];
  const divisions = data.standings.divisions || {};

  for (const [div, teams] of Object.entries(divisions)) {
    for (const t of teams) {
      const tmName = t.name;
      const ug = data.unit_grades[tmName] || {};
      const projWins = Number(t.wins) || 8.5;
      const unitGrade = ug.total_grade || 5.0;

      let maddenAvg = 72;
      if (DATA.teams && DATA.players) {
        const teamRec = DATA.teams.find(tm => tm.name === tmName);
        if (teamRec) {
          const tPlayers = DATA.players.filter(p => p.team_id === teamRec.id && p.ovr !== null);
          if (tPlayers.length > 0) {
            maddenAvg = tPlayers.reduce((s, p) => s + p.ovr, 0) / tPlayers.length;
          }
        }
      }

      rawTeams.push({
        name: tmName,
        division: div,
        projWins,
        unitGrade,
        maddenAvg: Number(maddenAvg.toFixed(1)),
        diff: t.diff || 0
      });
    }
  }

  const minW = Math.min(...rawTeams.map(t => t.projWins));
  const maxW = Math.max(...rawTeams.map(t => t.projWins));
  const minUG = Math.min(...rawTeams.map(t => t.unitGrade));
  const maxUG = Math.max(...rawTeams.map(t => t.unitGrade));
  const minM = Math.min(...rawTeams.map(t => t.maddenAvg));
  const maxM = Math.max(...rawTeams.map(t => t.maddenAvg));

  for (const t of rawTeams) {
    const wNorm = ((t.projWins - minW) / (maxW - minW || 1)) * 100;
    const ugNorm = ((t.unitGrade - minUG) / (maxUG - minUG || 1)) * 100;
    const mNorm = ((t.maddenAvg - minM) / (maxM - minM || 1)) * 100;
    t.rawScore = (wNorm * 0.40) + (ugNorm * 0.35) + (mNorm * 0.25);
  }

  const minRaw = Math.min(...rawTeams.map(t => t.rawScore));
  const maxRaw = Math.max(...rawTeams.map(t => t.rawScore));

  for (const t of rawTeams) {
    t.compositeScore = Number((15 + ((t.rawScore - minRaw) / (maxRaw - minRaw || 1)) * 83).toFixed(1));
  }

  rawTeams.sort((a, b) => b.compositeScore - a.compositeScore);

  let html = `
    <div class="mb-4">
      <div class="flex items-center justify-between flex-wrap gap-3 mb-3">
        <div>
          <h3 class="text-sm font-bold text-white flex items-center gap-2">
            <span>🏆</span> 2026 Unified Consensus Power Index
          </h3>
          <p class="text-xs text-slate-400 mt-0.5">
            Calibrated 0–100 power index blending Mike Clay projected wins (40%), unit grade film analysis (35%), and Madden 27 roster strength (25%).
          </p>
        </div>
        <div class="flex items-center gap-2 text-xs flex-wrap">
          <span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">👑 Tier 1: Elite (>=75)</span>
          <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">🛡 Tier 2: Contender (60-74)</span>
          <span class="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold">🎯 Tier 3: Playoff Hunt (42-59)</span>
          <span class="px-2 py-0.5 rounded bg-slate-700/40 text-slate-400 border border-slate-600/40 font-bold">🔨 Tier 4: Rebuilding (<42)</span>
        </div>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="w-full text-xs">
        <thead>
          <tr class="text-slate-400 border-b border-slate-700/60 bg-slate-800/50">
            <th class="py-2 px-3 text-center w-12">Rk</th>
            <th class="py-2 px-3 text-left">Team</th>
            <th class="py-2 px-2 text-center">Division</th>
            <th class="py-2 px-2 text-center">Consensus Score</th>
            <th class="py-2 px-2 text-center">Tier</th>
            <th class="py-2 px-2 text-center">Clay Wins</th>
            <th class="py-2 px-2 text-center">Unit Grade</th>
            <th class="py-2 px-2 text-center">Madden Avg</th>
            <th class="py-2 px-2 text-center">Point Diff</th>
          </tr>
        </thead>
        <tbody>
  `;

  let idx = 1;
  for (const t of rawTeams) {
    let tier = 'Tier 4: Rebuilding';
    let tierColor = 'bg-slate-700/40 text-slate-400 border-slate-600/40';
    let tierIcon = '🔨';

    if (t.compositeScore >= 75) {
      tier = 'Tier 1: Elite';
      tierColor = 'bg-amber-500/25 text-amber-300 border-amber-500/50 font-black shadow-sm';
      tierIcon = '👑';
    } else if (t.compositeScore >= 60) {
      tier = 'Tier 2: Contender';
      tierColor = 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 font-bold';
      tierIcon = '🛡';
    } else if (t.compositeScore >= 42) {
      tier = 'Tier 3: Playoff Hunt';
      tierColor = 'bg-cyan-500/25 text-cyan-300 border-cyan-500/50 font-bold';
      tierIcon = '🎯';
    }

    const teamEsc = t.name.replace(/'/g, "\\'");

    html += `
      <tr class="border-b border-slate-800/40 hover:bg-slate-800/30 transition ${idx <= 5 ? 'bg-amber-950/10' : ''}">
        <td class="py-2 px-3 text-center font-bold ${idx <= 5 ? 'text-amber-400 font-black' : 'text-slate-400'}">${idx}</td>
        <td class="py-2 px-3 font-semibold text-slate-200 proj-link-team whitespace-nowrap" onclick="openRoster('${teamEsc}', 'projections')">${t.name}</td>
        <td class="py-2 px-2 text-center text-slate-400">${t.division}</td>
        <td class="py-2 px-2 text-center font-black text-cyan-400 text-sm">${t.compositeScore}</td>
        <td class="py-2 px-2 text-center"><span class="px-2 py-0.5 rounded text-[10px] border ${tierColor}">${tierIcon} ${tier}</span></td>
        <td class="py-2 px-2 text-center font-bold ${t.projWins >= 10 ? 'text-emerald-400' : 'text-slate-300'}">${t.projWins} W</td>
        <td class="py-2 px-2 text-center text-slate-300">${t.unitGrade}</td>
        <td class="py-2 px-2 text-center text-slate-400">${t.maddenAvg}</td>
        <td class="py-2 px-2 text-center font-bold ${t.diff > 0 ? 'text-emerald-400' : 'text-red-400'}">${t.diff > 0 ? '+' : ''}${t.diff}</td>
      </tr>
    `;
    idx++;
  }

  html += `</tbody></table></div>`;
  c.innerHTML = html;
}

// ── INIT THEME ON START ──
initTheme();
"""

target_ending = "</script>\n</body>\n</html>"
if target_ending in content:
    content = content.replace(target_ending, raw_js_body + "\n</script>\n</body>\n</html>")
else:
    last_idx = content.rfind("</script>")
    if last_idx != -1:
        content = content[:last_idx] + raw_js_body + "\n" + content[last_idx:]

with open(INDEX_PATH, "w", encoding="utf-8") as f:
    f.write(content)

print("[build_complete_app] Successfully built clean expanded index.html.")
