// ═══════════════════════════════════════════════════════════
// COMPUTED: derive gains and losses per team from transactions
// ═══════════════════════════════════════════════════════════
function getTeamGains(team) {
  return DATA.transactions.filter(t => t.to_team === team && t.from_team !== team);
}
function getTeamLosses(team) {
  return DATA.transactions.filter(t => t.from_team === team && t.to_team !== team);
}

// ═══════════════════════════════════════════════════════════
// RENDER FUNCTIONS
// ═══════════════════════════════════════════════════════════
function formatCap(v){const a=Math.abs(v);if(a>=1e6)return(v<0?'-':'')+'$'+(a/1e6).toFixed(1)+'M';return(v<0?'-':'')+'$'+(a/1e3).toFixed(0)+'K';}
function getStatusColor(s){
  const m={"All-In":"text-green-400","Competing":"text-blue-400","Building":"text-cyan-400","Reloading":"text-teal-400",
    "Rising":"text-emerald-400","Flexible":"text-sky-400","Retooling":"text-yellow-400","Rebuilding":"text-orange-400",
    "Cap Crunch":"text-red-400","Cap Hell":"text-red-500","Dynasty Tax":"text-red-600"};
  return m[s]||"text-slate-400";
}
let compareModeActive=false;
let compareSelections=[];

function toggleCompareMode(){
  compareModeActive=!compareModeActive;
  compareSelections=[];
  document.querySelectorAll('.team-tile').forEach(t=>t.classList.remove('cmp-sel'));
  const btn=document.getElementById('compareModeBtn');
  const lbl=document.getElementById('compareBtnLabel');
  const sub=document.getElementById('compareBtnSub');
  if(btn){
    if(compareModeActive){
      btn.style.cssText='background:rgba(217,164,65,0.15);border-color:#d9a441;';
      if(lbl){lbl.textContent='Pick 2 teams…';lbl.classList.add('text-amber-400');}
      if(sub){sub.textContent='Click any two team tiles below to compare';sub.classList.add('text-amber-300/80');}
    } else {
      btn.style.cssText='';
      if(lbl){lbl.textContent='Compare Teams';lbl.classList.remove('text-amber-400');}
      if(sub){sub.textContent='Compare any two teams or explore matchups';sub.classList.remove('text-amber-300/80');}
    }
  }
}

function openCompare(t1,t2){
  const modal=document.getElementById('compareModal');
  const body=document.getElementById('compareBody');
  if(!modal||!body)return;
  body.innerHTML=renderComparePanel(t1)+renderComparePanel(t2);
  modal.classList.add('active');
  document.body.style.overflow='hidden';
}

function closeCompare(){
  const modal=document.getElementById('compareModal');
  if(modal)modal.classList.remove('active');
  document.body.style.overflow='';
  compareSelections=[];
  document.querySelectorAll('.team-tile').forEach(t=>t.classList.remove('cmp-sel'));
  if(compareModeActive)toggleCompareMode();
}

function renderComparePanel(team){
  const color=DATA.teamColors[team]||'#64748b';
  const abbr=DATA.teamAbbr[team]||'';
  const cap=DATA.capData[team]||{};
  const capValue = Number.isFinite(Number(cap.space)) ? Number(cap.space) : null;
  const capLabel = capValue === null ? 'Unavailable' : formatCap(capValue);
  const capClass = capValue === null ? 'text-slate-400' : capValue >= 0 ? 'cap-positive' : 'cap-negative';
  const roster=DATA.fullRosters[team]||{offense:[],defense:[],special:[]};
  const all=[...roster.offense,...roster.defense,...roster.special];
  const GRP={QB:['QB'],RB:['RB','FB'],WR:['WR'],TE:['TE'],OL:['OT','OG','C'],IDL:['DT','NT'],EDGE:['EDGE','DE'],LB:['LB','MLB','OLB'],CB:['CB'],S:['S','SS','FS'],ST:['K','P','LS']};
  let rows='';
  for(const[grp,pos] of Object.entries(GRP)){
    const players=all.filter(p=>pos.includes(p.pos)).sort((a,b)=>(b.ovr||0)-(a.ovr||0));
    if(!players.length)continue;
    rows+=`<div style="font-size:9px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:0.8px;padding:7px 16px 3px;background:rgba(30,41,59,0.4)">${grp}</div>`;
    for(const p of players){
      const rc=p.ovr==null?'rating-unrated':p.ovr>=90?'rating-elite':p.ovr>=80?'rating-star':p.ovr>=70?'rating-solid':'rating-dev';
      const badge=p.isRookie?'<span class="badge-rook" style="margin-left:auto;flex-shrink:0">ROOK</span>':p.acquisitionType?'<span class="badge-new" style="margin-left:auto;flex-shrink:0">NEW</span>':'';
      rows+=`<div style="display:flex;align-items:center;gap:7px;padding:3px 16px;font-size:11px;border-bottom:1px solid rgba(71,85,105,0.08)">
        <div class="rating-badge ${rc}" style="width:24px;height:24px;font-size:11px;flex-shrink:0">${p.ovr??'—'}</div>
        <span style="color:#e2e8f0;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.name}</span>
        <span style="color:#64748b;font-size:10px;min-width:30px;text-align:right">${p.pos}</span>
        ${badge}
      </div>`;
    }
  }
  return `<div style="overflow-y:auto;display:flex;flex-direction:column;border-right:1px solid rgba(71,85,105,0.3);">
    <div style="height:4px;background:linear-gradient(90deg,${color},transparent);flex-shrink:0"></div>
    <div style="padding:12px 16px 10px;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(71,85,105,0.25);flex-shrink:0;background:#0f1729;position:sticky;top:0;z-index:1">
      <div style="width:4px;height:36px;border-radius:2px;background:${color};flex-shrink:0"></div>
      <div style="flex:1">
        <div style="font-size:20px;font-weight:900;color:#fff;letter-spacing:-0.5px">${abbr}</div>
        <div style="font-size:11px;color:#94a3b8">${team}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:9px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px">Cap Space</div>
        <div style="font-size:13px;font-weight:700" class="${capClass}">${capLabel}</div>
        <div style="font-size:10px;font-weight:600" class="${getStatusColor(cap.status)}">${cap.status||''}</div>
      </div>
    </div>
    ${rows}
  </div>`;
}

// renderTeams() (the Teams grid) lives in nfl/js/roster.js.
