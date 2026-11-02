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
function getPickRound(p){if(p<=32)return 1;if(p<=64)return 2;if(p<=100)return 3;if(p<=135)return 4;if(p<=172)return 5;if(p<=215)return 6;return 7;}
function formatCap(v){const a=Math.abs(v);if(a>=1e6)return(v<0?'-':'')+'$'+(a/1e6).toFixed(1)+'M';return(v<0?'-':'')+'$'+(a/1e3).toFixed(0)+'K';}
function getStatusColor(s){
  const m={"All-In":"text-green-400","Competing":"text-blue-400","Building":"text-cyan-400","Reloading":"text-teal-400",
    "Rising":"text-emerald-400","Flexible":"text-sky-400","Retooling":"text-yellow-400","Rebuilding":"text-orange-400",
    "Cap Crunch":"text-red-400","Cap Hell":"text-red-500","Dynasty Tax":"text-red-600"};
  return m[s]||"text-slate-400";
}
function ratingClass(r){if(r>=90)return'rating-elite';if(r>=80)return'rating-star';if(r>=70)return'rating-solid';return'rating-dev';}

function scrollToDiv(divName){
  const el=document.getElementById('div-'+divName.replace(/ /g,'-').toLowerCase());
  if(el)el.scrollIntoView({behavior:'smooth',block:'start'});
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

function selectForCompare(team){
  const abbr=DATA.teamAbbr[team];
  const tile=document.getElementById('tile-'+abbr);
  if(compareSelections.includes(team)){
    compareSelections=compareSelections.filter(t=>t!==team);
    if(tile)tile.classList.remove('cmp-sel');
  } else if(compareSelections.length<2){
    compareSelections.push(team);
    if(tile)tile.classList.add('cmp-sel');
    if(compareSelections.length===2)openCompare(compareSelections[0],compareSelections[1]);
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

function renderTeams(){
  const c=document.getElementById('teamsContainer');
  if(!c)return;
  const allDivs=Object.entries(DATA.divisions);
  const afcDivs=allDivs.filter(([k])=>k.startsWith('AFC'));
  const nfcDivs=allDivs.filter(([k])=>k.startsWith('NFC'));

  const renderTile=(team)=>{
    const abbr=DATA.teamAbbr[team] || team.slice(0, 3).toUpperCase();
    const color=DATA.teamColors[team] || '#d9a441';
    const cap=DATA.capData[team]||{};
    const capValue = Number.isFinite(Number(cap.space)) ? Number(cap.space) : null;
    const capLabel = capValue === null ? (cap.status || '—') : formatCap(capValue);
    const capClass = capValue === null ? 'text-slate-400' : capValue >= 0 ? 'cap-positive' : 'cap-negative';
    const tEsc=team.replace(/'/g,"\\'");
    const logo = getNflTeamLogo(team);

    return `<div class="team-tile" id="tile-${abbr}" onclick="compareModeActive?selectForCompare('${tEsc}'):openRoster('${tEsc}')">
      <div class="team-tile-rail" style="background:${color}"></div>
      <div class="team-tile-inner">
        <div class="team-tile-top">
          <img src="${logo}" alt="${homeEsc(abbr)}" class="team-tile-logo" loading="lazy">
          <div class="team-tile-info">
            <span class="team-tile-abbr">${abbr}</span>
            <span class="team-tile-name">${homeEsc(team)}</span>
          </div>
        </div>
        <div class="team-tile-meta font-mono">
          <span class="team-tile-cap"><span class="team-tile-cap-lbl">Cap Space</span> <b class="${capClass}">${capLabel}</b></span>
        </div>
      </div>
    </div>`;
  };

  const renderConf=(confDivs,confName,colorCls)=>{
    let col=`<div class="conf-block">
      <div class="conf-head" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #2b3037">
        <div class="flex items-center gap-2">
          <span class="w-2 h-2 rounded-full" style="background:${confName === 'AFC' ? '#ef4444' : '#5c7490'}"></span>
          <span style="font:800 18px 'Archivo',sans-serif;letter-spacing:-0.02em" class="${colorCls}">${confName}</span>
        </div>
        <span class="studio-kicker" style="color:#868a91;font-size:10.5px">16 TEAMS · 4 DIVISIONS</span>
      </div>
      <div class="divisions-cols-grid">`;
    for(const[divName,teams] of confDivs){
      const divId='div-'+divName.replace(/ /g,'-').toLowerCase();
      const divShort = divName.replace(/AFC |NFC /,'');
      col+=`<div class="division-col">
        <div id="${divId}" class="division-header rounded-md px-3 py-1.5 mb-2.5 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-1 h-3 rounded-full" style="background:${confName === 'AFC' ? '#ef4444' : '#5c7490'}"></span>
            <h3 style="font:800 11.5px 'Archivo',sans-serif;letter-spacing:0.04em;text-transform:uppercase" class="${colorCls}">${divShort}</h3>
          </div>
        </div>
        <div class="division-content">
          <div class="division-grid flex flex-col gap-2">
            ${teams.map(renderTile).join('')}
          </div>
        </div>
      </div>`;
    }
    return col+'</div></div>';
  };

  c.innerHTML=`<div class="conf-split">
    ${renderConf(afcDivs,'AFC','text-red-400')}
    ${renderConf(nfcDivs,'NFC','text-blue-400')}
  </div>`;
}

