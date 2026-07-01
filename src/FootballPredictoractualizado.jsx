import { useState, useCallback } from "react";

const API_KEY = "0b8ed0dcd696630452ee6588fc5d2da4";
const API_BASE = "https://v3.football.api-sports.io";
const SEASON = 2024;

const C = {
  green:"#1D9E75", greenDk:"#0F6E56", greenLt:"#E1F5EE",
  blue:"#378ADD",  blueDk:"#185FA5", blueLt:"#E6F1FB",
  amber:"#EF9F27", amberLt:"#FAEEDA",
  coral:"#D85A30", coralLt:"#FAECE7",
  purple:"#7F77DD",purpleLt:"#EEEDFE",
  gold:"#C9921A",  goldLt:"#FDF3DC",
  gray:"#888780",  grayLt:"#F1EFE8",
  text:"#18181b",  textSec:"#71717a", textTer:"#a1a1aa",
  border:"rgba(24,24,27,0.12)", bg:"#ffffff", bgSec:"#f9f9f8",
};

const COMPETITIONS = [
  { id:"liga",         label:"Liga",              icon:"⚽", mode:"liga"  },
  { id:"champions",    label:"Champions League",  icon:"⭐", mode:"copa"  },
  { id:"libertadores", label:"Copa Libertadores", icon:"🏆", mode:"copa"  },
  { id:"mundial",      label:"Copa del Mundo",    icon:"🌍", mode:"copa"  },
  { id:"eurocopa",     label:"Eurocopa",          icon:"🇪🇺", mode:"copa"  },
  { id:"copaamerica",  label:"Copa América",      icon:"🌎", mode:"copa"  },
  { id:"sudamericana", label:"Sudamericana",      icon:"🥈", mode:"copa"  },
  { id:"europa",       label:"Europa League",     icon:"🔶", mode:"copa"  },
  { id:"otra",         label:"Otra",              icon:"🏅", mode:"copa"  },
];

const LEAGUES = [
  { id:"premierleague", label:"Premier League",   icon:"🏴󠁧󠁢󠁥󠁮󠁧󠁿", homeAdv:1.32, apiId:39  },
  { id:"laliga",        label:"La Liga",          icon:"🇪🇸", homeAdv:1.35, apiId:140 },
  { id:"bundesliga",    label:"Bundesliga",       icon:"🇩🇪", homeAdv:1.30, apiId:78  },
  { id:"seriea",        label:"Serie A",          icon:"🇮🇹", homeAdv:1.38, apiId:135 },
  { id:"ligue1",        label:"Ligue 1",          icon:"🇫🇷", homeAdv:1.33, apiId:61  },
  { id:"ligapro",       label:"Liga BetPlay Col", icon:"🇨🇴", homeAdv:1.40, apiId:239 },
  { id:"brasileirao",   label:"Brasileirão",      icon:"🇧🇷", homeAdv:1.38, apiId:71  },
  { id:"ligamx",        label:"Liga MX",          icon:"🇲🇽", homeAdv:1.36, apiId:262 },
  { id:"mls",           label:"MLS",              icon:"🇺🇸", homeAdv:1.28, apiId:253 },
  { id:"otra_liga",     label:"Otra liga",        icon:"🌐", homeAdv:1.33, apiId:null },
];

const PHASES = [
  { id:"grupos",   label:"Fase de grupos"   },
  { id:"octavos",  label:"Octavos de final" },
  { id:"cuartos",  label:"Cuartos de final" },
  { id:"semis",    label:"Semifinal"        },
  { id:"final",    label:"Final"            },
];

const SEDE = [
  { id:"local",     label:"Local",        icon:"🏠" },
  { id:"visitante", label:"Visitante",    icon:"✈️" },
  { id:"neutro",    label:"Sede neutral", icon:"⚖️" },
];

const PHASE_GOALS = { grupos:1.0, octavos:0.92, cuartos:0.88, semis:0.85, final:0.82 };
const SEDE_CUP    = { local:1.08, visitante:0.92, neutro:1.00 };

// ─── API ─────────────────────────────────────────────────────────────────────
async function apiCall(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "GET",
    headers: { "x-apisports-key": API_KEY },
  });
  const data = await res.json();
  return data.response || [];
}

async function searchTeam(name) {
  return await apiCall(`/teams?search=${encodeURIComponent(name)}`);
}

async function getFixtures(teamId, leagueId, isHome, season = SEASON) {
  const venue = isHome ? "home" : "away";
  const url = leagueId
    ? `/fixtures?team=${teamId}&league=${leagueId}&season=${season}&status=FT&last=10`
    : `/fixtures?team=${teamId}&season=${season}&status=FT&last=15`;
  return await apiCall(url);
}

async function getFixtureStats(fixtureId) {
  return await apiCall(`/fixtures/statistics?fixture=${fixtureId}`);
}

function extractStats(fixtures, teamId, isHome) {
  const results = [];
  for (const f of fixtures) {
    const home = f.teams.home;
    const away = f.teams.away;
    const isTeamHome = home.id === teamId;
    if (isHome !== undefined && isTeamHome !== isHome) continue;
    const scored  = isTeamHome ? f.goals.home : f.goals.away;
    const conceded= isTeamHome ? f.goals.away : f.goals.home;
    if (scored === null || conceded === null) continue;
    results.push({
      fixtureId: f.fixture.id,
      scored,
      conceded,
      isHome: isTeamHome,
      date: f.fixture.date?.split("T")[0],
      opponent: isTeamHome ? away.name : home.name,
    });
    if (results.length >= 10) break;
  }
  return results;
}

async function enrichWithStats(matches) {
  const enriched = [];
  for (const m of matches.slice(0, 10)) {
    try {
      const stats = await getFixtureStats(m.fixtureId);
      const teamStats = stats[m.isHome ? 0 : 1]?.statistics || [];
      const get = (label) => {
        const s = teamStats.find(s => s.type === label);
        return s ? (parseInt(s.value) || 0) : 0;
      };
      enriched.push({
        ...m,
        corners:       get("Corner Kicks"),
        yellowCards:   get("Yellow Cards"),
        redCards:      get("Red Cards"),
        shots:         get("Total Shots"),
        shotsOnTarget: get("Shots on Goal"),
        possession:    parseInt(teamStats.find(s=>s.type==="Ball Possession")?.value)||50,
      });
    } catch {
      enriched.push({ ...m, corners:0, yellowCards:0, redCards:0, shots:0, shotsOnTarget:0, possession:50 });
    }
  }
  return enriched;
}

// ─── ESTADÍSTICA ─────────────────────────────────────────────────────────────
function factorial(n){ let r=1; for(let i=2;i<=n;i++) r*=i; return r; }
function poissonP(λ,k){ return (Math.pow(λ,k)*Math.exp(-λ))/factorial(k); }

function allProbs(λL,λV,max=9){
  const g=[];
  for(let i=0;i<=max;i++){ g[i]=[]; for(let j=0;j<=max;j++) g[i][j]=poissonP(λL,i)*poissonP(λV,j); }
  return g;
}

function eloFactor(a,b){ const d=Math.max(-400,Math.min(400,a-b)); return 1+d/1200; }

function h2hFactor(w,d,l){
  const t=w+d+l; if(!t) return{fL:1,fV:1};
  const fL=1+((w/t)-0.33)*0.15, fV=1+((l/t)-0.33)*0.15;
  return{fL:Math.max(0.85,Math.min(1.15,fL)),fV:Math.max(0.85,Math.min(1.15,fV))};
}

function avg(arr, key) {
  if (!arr.length) return 0;
  return arr.reduce((s,m)=>s+(m[key]||0),0)/arr.length;
}

function computeFromMatches(localMatches, visitorMatches, ctx, eloL, eloV) {
  const avgLS = avg(localMatches,   "scored");
  const avgLC = avg(localMatches,   "conceded");
  const avgVS = avg(visitorMatches, "scored");
  const avgVC = avg(visitorMatches, "conceded");

  const avgLCorners = avg(localMatches,   "corners");
  const avgVCorners = avg(visitorMatches, "corners");
  const avgLYellow  = avg(localMatches,   "yellowCards");
  const avgVYellow  = avg(visitorMatches, "yellowCards");
  const avgLShots   = avg(localMatches,   "shots");
  const avgVShots   = avg(visitorMatches, "shots");

  const compInfo = COMPETITIONS.find(c=>c.id===ctx.comp)||COMPETITIONS[0];
  const mode = compInfo.mode;
  const league = LEAGUES.find(l=>l.id===ctx.liga)||LEAGUES[0];

  let xgL = (avgLS + avgVC) / 2;
  let xgV = (avgVS + avgLC) / 2;

  xgL *= eloFactor(eloL, eloV);
  xgV *= eloFactor(eloV, eloL);

  if (mode === "liga") {
    xgL *= league.homeAdv;
    xgV *= (2 - league.homeAdv);
  } else {
    const sf = SEDE_CUP[ctx.sede]||1;
    xgL *= sf;
    xgV *= (ctx.sede==="local"?SEDE_CUP.visitante:ctx.sede==="visitante"?SEDE_CUP.local:1);
    const pf = PHASE_GOALS[ctx.fase]||1;
    xgL *= pf; xgV *= pf;
  }

  const { fL, fV } = h2hFactor(ctx.h2hWins||0, ctx.h2hDraws||0, ctx.h2hLosses||0);
  xgL *= fL; xgV *= fV;

  xgL = Math.max(0.1, xgL);
  xgV = Math.max(0.1, xgV);
  const total = xgL + xgV;
  const grid = allProbs(xgL, xgV, 9);
  const sum = (fn) => { let s=0; for(let i=0;i<=9;i++) for(let j=0;j<=9;j++) if(fn(i,j)) s+=grid[i][j]; return s; };

  let pL=0, pD=0;
  for(let i=0;i<=9;i++) for(let j=0;j<=9;j++){
    if(i>j) pL+=grid[i][j]; else if(i===j) pD+=grid[i][j];
  }
  const pV = Math.max(0, 1-pL-pD);

  const pOver15=sum((i,j)=>i+j>1), pOver25=sum((i,j)=>i+j>2);
  const pOver35=sum((i,j)=>i+j>3), pUnder25=1-pOver25;
  const pBTTS=sum((i,j)=>i>0&&j>0);
  const pL05=sum((i)=>i>=1), pL15=sum((i)=>i>=2);
  const pV05=sum((_,j)=>j>=1), pV15=sum((_,j)=>j>=2);
  const pH1L=sum((i,j)=>i-j>=1), pH2L=sum((i,j)=>i-j>=2);
  const pH1V=sum((i,j)=>j-i>=1), pH2V=sum((i,j)=>j-i>=2);
  const isElim = mode==="copa" && ctx.fase!=="grupos";
  const pExtraTime = isElim ? pD : 0;
  const pPenalties = isElim ? pD*0.5 : 0;

  const scores=[];
  for(let i=0;i<=6;i++) for(let j=0;j<=6;j++) scores.push({i,j,p:grid[i]?.[j]||0});
  scores.sort((a,b)=>b.p-a.p);

  return {
    avgLS,avgLC,avgVS,avgVC,xgL,xgV,total,
    pL,pD,pV,pBTTS,pOver15,pOver25,pOver35,pUnder25,
    pL05,pL15,pV05,pV15,pH1L,pH2L,pH1V,pH2V,
    pExtraTime,pPenalties,isElim,
    topScores:scores.slice(0,8),
    eloL,eloV,eloDiff:eloL-eloV,
    p1X:pL+pD, pX2:pD+pV,
    // Estadísticas extra
    avgLCorners, avgVCorners, avgLYellow, avgVYellow, avgLShots, avgVShots,
    localMatches, visitorMatches,
    nL: localMatches.length, nV: visitorMatches.length,
  };
}

function buildBets(r, nameL, nameV) {
  const bets = [];
  const add = (group,key,label,pct,thr,color) => {
    const rec = pct>=thr+0.08?"SI":pct>=thr?"CUIDADO":"NO";
    bets.push({group,key,label,pct,rec,color,cuota:""});
  };
  const w = r.pL>r.pV&&r.pL>r.pD?{label:`Victoria ${nameL}`,p:r.pL,color:C.green}
    :r.pV>r.pD?{label:`Victoria ${nameV}`,p:r.pV,color:C.blue}:{label:"Empate",p:r.pD,color:C.amber};
  add("1X2","1x2",w.label,w.p,0.45,w.color);
  add("1X2","1x",`1X — ${nameL} o empate`,r.p1X,0.60,C.green);
  add("1X2","x2",`X2 — empate o ${nameV}`,r.pX2,0.60,C.blue);
  add("TOTALES","o15","Over 1.5 goles",r.pOver15,0.65,C.amber);
  add("TOTALES","o25","Over 2.5 goles",r.pOver25,0.55,C.amber);
  add("TOTALES","u25","Under 2.5 goles",r.pUnder25,0.55,C.blue);
  add("TOTALES","o35","Over 3.5 goles",r.pOver35,0.40,C.coral);
  add("TOTALES","bttsY","BTTS — Sí",r.pBTTS,0.52,C.purple);
  add("TOTALES","bttsN","BTTS — No",1-r.pBTTS,0.52,C.gray);
  add(`GOLES ${nameL.toUpperCase()}`,"l05",`${nameL} anota +0.5`,r.pL05,0.55,C.green);
  add(`GOLES ${nameL.toUpperCase()}`,"l15",`${nameL} anota +1.5`,r.pL15,0.45,C.green);
  add(`GOLES ${nameV.toUpperCase()}`,"v05",`${nameV} anota +0.5`,r.pV05,0.55,C.blue);
  add(`GOLES ${nameV.toUpperCase()}`,"v15",`${nameV} anota +1.5`,r.pV15,0.45,C.blue);
  add("HÁNDICAP","hl1",`${nameL} gana por 1+`,r.pH1L,0.40,C.green);
  add("HÁNDICAP","hl2",`${nameL} gana por 2+`,r.pH2L,0.30,C.green);
  add("HÁNDICAP","hv1",`${nameV} gana por 1+`,r.pH1V,0.40,C.blue);
  add("HÁNDICAP","hv2",`${nameV} gana por 2+`,r.pH2V,0.30,C.blue);
  if(r.isElim){
    add("ELIMINATORIA","ext","Va a prórroga",r.pExtraTime,0.30,C.gold);
    add("ELIMINATORIA","pen","Va a penales",r.pPenalties,0.25,C.gold);
    add("ELIMINATORIA","lL",`${nameL} clasifica`,r.pL+(r.pD*0.5),0.45,C.green);
    add("ELIMINATORIA","lV",`${nameV} clasifica`,r.pV+(r.pD*0.5),0.45,C.blue);
  }
  return bets;
}

function calcEV(p,c){ const cv=parseFloat(c); if(!cv||cv<1.01) return null; return(p*cv)-1; }
function evColor(ev){ if(ev===null) return C.border; if(ev>0.05) return C.green; if(ev>0) return C.amber; return C.coral; }
function evInfo(ev){
  if(ev===null) return null;
  if(ev>0.10) return{icon:"✓",text:`EV +${(ev*100).toFixed(1)}% — Valor fuerte`,bg:C.greenLt,color:C.greenDk};
  if(ev>0.05) return{icon:"✓",text:`EV +${(ev*100).toFixed(1)}% — Vale apostar`,bg:C.greenLt,color:C.greenDk};
  if(ev>0)    return{icon:"~",text:`EV +${(ev*100).toFixed(1)}% — Valor marginal`,bg:C.amberLt,color:"#854F0B"};
  return{icon:"✗",text:`EV ${(ev*100).toFixed(1)}% — Sin valor`,bg:C.coralLt,color:"#4A1B0C"};
}

// ─── UI ───────────────────────────────────────────────────────────────────────
const card=(ex={})=>({background:C.bg,border:`0.5px solid ${C.border}`,borderRadius:12,padding:"1.25rem",...ex});

function SLabel({children}){
  return(<div style={{fontSize:11,fontWeight:700,color:C.textSec,textTransform:"uppercase",letterSpacing:"1px",marginBottom:"0.75rem",paddingBottom:"0.4rem",borderBottom:`0.5px solid ${C.border}`}}>{children}</div>);
}

function ProbBar({pct,color}){
  return(<div style={{height:5,background:C.grayLt,borderRadius:3,overflow:"hidden",marginTop:4}}>
    <div style={{height:"100%",width:`${Math.min(100,pct).toFixed(0)}%`,background:color,borderRadius:3}}/>
  </div>);
}

function Metric({label,value,color,sub}){
  return(<div style={{background:C.bgSec,borderRadius:8,padding:"0.75rem 1rem",borderLeft:`3px solid ${color}`}}>
    <div style={{fontSize:10,color:C.textSec,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:3}}>{label}</div>
    <div style={{fontSize:"1.4rem",fontWeight:800,color,lineHeight:1}}>{value}</div>
    {sub&&<div style={{fontSize:10,color:C.textTer,marginTop:2}}>{sub}</div>}
  </div>);
}

function StatRow({label,valL,valV,colorL,colorV}){
  return(<div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",gap:8,alignItems:"center",marginBottom:6}}>
    <div style={{fontSize:"1rem",fontWeight:700,color:colorL||C.green,textAlign:"right"}}>{valL}</div>
    <div style={{fontSize:10,color:C.textTer,textAlign:"center",minWidth:80}}>{label}</div>
    <div style={{fontSize:"1rem",fontWeight:700,color:colorV||C.blue,textAlign:"left"}}>{valV}</div>
  </div>);
}

function PoissonSVG({xgL,xgV}){
  const labels=["0","1","2","3","4","5+"];
  const pL=[0,1,2,3,4].map(k=>poissonP(xgL,k)); pL.push(Math.max(0,1-pL.reduce((s,p)=>s+p,0)));
  const pV=[0,1,2,3,4].map(k=>poissonP(xgV,k)); pV.push(Math.max(0,1-pV.reduce((s,p)=>s+p,0)));
  const W=300,H=120,pl={t:6,r:6,b:20,l:28};
  const iW=W-pl.l-pl.r,iH=H-pl.t-pl.b,maxP=Math.max(...pL,...pV,0.01);
  const gW=iW/6,bW=gW*0.33,ys=v=>pl.t+iH-(v/maxP)*iH;
  return(<svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%",height:"auto"}}>
    {[0.1,0.2,0.3].filter(v=>v<=maxP+0.04).map(v=>(
      <line key={v} x1={pl.l} x2={W-pl.r} y1={ys(v)} y2={ys(v)} stroke={C.border} strokeWidth={0.5}/>))}
    {labels.map((lbl,i)=>{
      const cx=pl.l+i*gW+gW/2,hL=(pL[i]/maxP)*iH,hV=(pV[i]/maxP)*iH;
      return(<g key={i}>
        <rect x={cx-bW-1} y={ys(pL[i])} width={bW} height={hL} fill={C.green} rx={2} opacity={0.85}/>
        <rect x={cx+1} y={ys(pV[i])} width={bW} height={hV} fill={C.blue} rx={2} opacity={0.85}/>
        <text x={cx} y={H-4} textAnchor="middle" fontSize={9} fill={C.textTer}>{lbl}</text>
      </g>);})}
    {[0,0.1,0.2].filter(v=>v<=maxP+0.04).map(v=>(
      <text key={v} x={pl.l-3} y={ys(v)+3} textAnchor="end" fontSize={8} fill={C.textTer}>{(v*100).toFixed(0)}%</text>))}
  </svg>);
}

function BetCard({b,onCuotaChange}){
  const rcfg={SI:{bg:C.greenLt,color:C.greenDk,icon:"✓",label:"APOSTAR"},CUIDADO:{bg:C.amberLt,color:"#854F0B",icon:"⚠",label:"CUIDADO"},NO:{bg:C.coralLt,color:"#4A1B0C",icon:"✗",label:"EVITAR"}}[b.rec];
  const ev=calcEV(b.pct,b.cuota), info=evInfo(ev);
  const impl=b.cuota?(1/parseFloat(b.cuota)*100).toFixed(1):null;
  return(<div style={{...card(),display:"flex",flexDirection:"column",gap:6}}>
    <div style={{fontSize:10,fontWeight:600,color:C.textSec,textTransform:"uppercase",letterSpacing:"0.5px",lineHeight:1.3}}>{b.label}</div>
    <div style={{display:"flex",alignItems:"baseline",gap:6}}>
      <div style={{fontSize:"1.2rem",fontWeight:800,color:b.color||C.text}}>{(b.pct*100).toFixed(1)}%</div>
      <div style={{fontSize:10,color:C.textTer}}>prob.</div>
    </div>
    <ProbBar pct={b.pct*100} color={b.rec==="SI"?C.green:b.rec==="CUIDADO"?C.amber:C.coral}/>
    <div style={{display:"inline-flex",alignItems:"center",gap:4,background:rcfg.bg,color:rcfg.color,fontSize:10,fontWeight:700,padding:"3px 9px",borderRadius:20,alignSelf:"flex-start"}}>
      {rcfg.icon} {rcfg.label}
    </div>
    <div style={{borderTop:`0.5px solid ${C.border}`,paddingTop:7,marginTop:2}}>
      <div style={{fontSize:10,fontWeight:600,color:C.textSec,textTransform:"uppercase",letterSpacing:"0.4px",marginBottom:4}}>Cuota casa</div>
      <input type="number" min="1.01" step="0.05" value={b.cuota} onChange={e=>onCuotaChange(b.key,e.target.value)} placeholder="Ej: 1.85"
        style={{width:"100%",padding:"6px 10px",fontSize:"1rem",fontWeight:700,border:`1.5px solid ${b.cuota?evColor(ev):C.border}`,borderRadius:8,background:C.bgSec,color:C.text,fontFamily:"inherit",outline:"none",textAlign:"center"}}/>
      {impl&&<div style={{fontSize:9,color:C.textTer,marginTop:3}}>
        Casa: ~{impl}% · Modelo: {(b.pct*100).toFixed(1)}%
        <span style={{color:parseFloat(impl)<b.pct*100?C.green:C.coral,fontWeight:600}}> ({parseFloat(impl)<b.pct*100?"✓ valor":"✗ sin valor"})</span>
      </div>}
      {info&&<div style={{marginTop:5,display:"flex",alignItems:"center",gap:5,background:info.bg,color:info.color,fontSize:10,fontWeight:700,padding:"4px 8px",borderRadius:7}}>{info.icon} {info.text}</div>}
      {ev!==null&&<div style={{fontSize:9,color:C.textTer,marginTop:3,fontFamily:"monospace"}}>({(b.pct*100).toFixed(1)}%×{parseFloat(b.cuota).toFixed(2)})−1={ev>=0?"+":""}{(ev*100).toFixed(1)}%</div>}
    </div>
  </div>);
}

function BetGroup({label,color,bets,onCuotaChange}){
  const ap=bets.filter(b=>b.rec==="SI"), cu=bets.filter(b=>b.rec==="CUIDADO"), ev=bets.filter(b=>b.rec==="NO");
  const tag=(list,rec)=>{
    if(!list.length) return null;
    const cfg={SI:{bg:C.greenLt,c:C.greenDk,icon:"✓",lbl:"APOSTAR"},CUIDADO:{bg:C.amberLt,c:"#854F0B",icon:"⚠",lbl:"CUIDADO"},NO:{bg:C.coralLt,c:"#4A1B0C",icon:"✗",lbl:"EVITAR"}}[rec];
    return(<><div style={{display:"inline-flex",alignItems:"center",gap:5,background:cfg.bg,color:cfg.c,fontSize:10,fontWeight:700,padding:"2px 9px",borderRadius:20,marginBottom:8}}>{cfg.icon} {cfg.lbl}</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(185px,1fr))",gap:10,marginBottom:12}}>
        {list.map(b=><BetCard key={b.key} b={b} onCuotaChange={onCuotaChange}/>)}
      </div></>);
  };
  return(<div style={{marginBottom:"1.5rem"}}>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
      <div style={{width:4,height:18,borderRadius:2,background:color}}/>
      <div style={{fontSize:12,fontWeight:700,color:C.text,textTransform:"uppercase",letterSpacing:"0.8px"}}>{label}</div>
    </div>
    {tag(ap,"SI")}{tag(cu,"CUIDADO")}{tag(ev,"NO")}
  </div>);
}

// ─── TEAM SEARCH PANEL ────────────────────────────────────────────────────────
function TeamSearchPanel({ team, onTeamLoaded, isLocal, leagueApiId, mode }) {
  const [query, setQuery]       = useState("");
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [selected, setSelected] = useState(null);
  const [eloInput, setEloInput] = useState("");
  const [error, setError]       = useState("");

  const accent    = isLocal ? C.green : C.blue;
  const accentLt  = isLocal ? C.greenLt : C.blueLt;
  const condition = isLocal ? "de LOCAL" : "de VISITANTE";

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true); setResults([]); setError("");
    try {
      const data = await searchTeam(query);
      setResults(data.slice(0, 6));
      if (!data.length) setError("No se encontró el equipo. Prueba con otro nombre.");
    } catch {
      setError("Error conectando con la API. Verifica tu conexión.");
    }
    setLoading(false);
  };

  const selectTeam = async (t) => {
    setSelected(t);
    setResults([]);
    setQuery(t.team.name);
  };

  const loadMatches = async () => {
    if (!selected) return;
    setLoadingStats(true); setError("");
    try {
      const fixtures = await getFixtures(selected.team.id, leagueApiId, isLocal);
      const matches  = extractStats(fixtures, selected.team.id, isLocal ? true : false);
      if (!matches.length) {
        setError("No se encontraron partidos para este equipo en esta liga/temporada. Prueba sin filtrar liga.");
        setLoadingStats(false); return;
      }
      const enriched = await enrichWithStats(matches);
      onTeamLoaded({
        name:    t.team.name,
        logo:    selected.team.logo,
        teamId:  selected.team.id,
        matches: enriched,
        elo:     parseInt(eloInput) || 1500,
      });
    } catch(e) {
      setError("Error cargando partidos. Intenta de nuevo.");
    }
    setLoadingStats(false);
  };

  const t = selected;

  return(
    <div style={{...card(), borderTop:`3px solid ${accent}`}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <div style={{width:34,height:34,borderRadius:"50%",background:accentLt,color:accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
          {isLocal ? "🏠" : "✈️"}
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:10,fontWeight:600,color:accent,textTransform:"uppercase",letterSpacing:"0.5px"}}>
            Equipo {isLocal?"local":"visitante"} — partidos {condition}
          </div>
        </div>
      </div>

      {/* Búsqueda */}
      <div style={{marginBottom:10}}>
        <div style={{fontSize:11,fontWeight:600,color:C.textSec,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:5}}>
          Buscar equipo
        </div>
        <div style={{display:"flex",gap:6}}>
          <input value={query} onChange={e=>setQuery(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&search()}
            placeholder="Ej: Real Madrid, Millonarios, Barcelona..."
            style={{flex:1,padding:"8px 12px",fontSize:13,border:`1.5px solid ${C.border}`,borderRadius:8,background:C.bgSec,color:C.text,fontFamily:"inherit",outline:"none"}}/>
          <button onClick={search}
            style={{padding:"8px 14px",background:accent,color:"white",border:"none",borderRadius:8,cursor:"pointer",fontFamily:"inherit",fontWeight:600,fontSize:12}}>
            {loading ? "..." : "Buscar"}
          </button>
        </div>
      </div>

      {/* Resultados búsqueda */}
      {results.length>0&&(
        <div style={{marginBottom:10,border:`0.5px solid ${C.border}`,borderRadius:8,overflow:"hidden"}}>
          {results.map((r,i)=>(
            <div key={i} onClick={()=>selectTeam(r)}
              style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",cursor:"pointer",background:i%2===0?C.bg:C.bgSec,borderBottom:i<results.length-1?`0.5px solid ${C.border}`:"none"}}>
              {r.team.logo&&<img src={r.team.logo} alt="" style={{width:24,height:24,objectFit:"contain"}}/>}
              <div>
                <div style={{fontSize:12,fontWeight:600,color:C.text}}>{r.team.name}</div>
                <div style={{fontSize:10,color:C.textTer}}>{r.venue?.country||r.team.country} · {r.venue?.city||""}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Equipo seleccionado */}
      {t&&(
        <div style={{marginBottom:10,padding:"10px 12px",background:accentLt,borderRadius:8,display:"flex",alignItems:"center",gap:10}}>
          {t.team.logo&&<img src={t.team.logo} alt="" style={{width:32,height:32,objectFit:"contain"}}/>}
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:700,color:accent}}>{t.team.name}</div>
            <div style={{fontSize:10,color:C.textSec}}>Se cargarán los últimos 10 partidos {condition}</div>
          </div>
        </div>
      )}

      {/* ELO */}
      <div style={{marginBottom:10}}>
        <div style={{fontSize:11,fontWeight:600,color:C.textSec,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:5}}>ELO del equipo</div>
        <input type="number" value={eloInput} onChange={e=>setEloInput(e.target.value)} placeholder="Ej: 1700"
          style={{width:"100%",padding:"8px 12px",fontSize:"1rem",fontWeight:600,border:`1.5px solid ${eloInput?accent:C.border}`,borderRadius:8,background:C.bgSec,color:C.text,fontFamily:"inherit",outline:"none",textAlign:"center"}}/>
        <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>
          {[["Élite",1900],["Alto",1700],["Medio",1500],["Bajo",1300],["Débil",1100]].map(([lbl,val])=>(
            <button key={lbl} onClick={()=>setEloInput(String(val))}
              style={{padding:"2px 8px",fontSize:10,fontWeight:600,border:`0.5px solid ${eloInput==val?accent:C.border}`,borderRadius:20,background:eloInput==val?accentLt:"transparent",color:eloInput==val?accent:C.textSec,cursor:"pointer",fontFamily:"inherit"}}>
              {lbl} {val}
            </button>
          ))}
        </div>
        <div style={{fontSize:10,color:C.textTer,marginTop:4}}>clubelo.com para consultarlo</div>
      </div>

      {/* Cargar partidos */}
      {t&&(
        <button onClick={loadMatches} disabled={loadingStats}
          style={{width:"100%",padding:"10px",background:loadingStats?C.grayLt:accent,color:loadingStats?C.textSec:"white",border:"none",borderRadius:8,cursor:loadingStats?"not-allowed":"pointer",fontFamily:"inherit",fontWeight:700,fontSize:12,textTransform:"uppercase",letterSpacing:"0.5px"}}>
          {loadingStats ? "⏳ Cargando partidos y estadísticas..." : `📊 Cargar últimos 10 partidos ${condition}`}
        </button>
      )}

      {error&&<div style={{marginTop:8,fontSize:11,color:C.coral,background:C.coralLt,padding:"6px 10px",borderRadius:6}}>{error}</div>}

      {/* Preview partidos cargados */}
      {team?.matches?.length>0&&(
        <div style={{marginTop:10}}>
          <div style={{fontSize:11,fontWeight:600,color:C.green,marginBottom:6}}>
            ✓ {team.matches.length} partidos cargados — {team.name}
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:3}}>
            {team.matches.map((m,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"auto 1fr auto auto auto auto",gap:6,alignItems:"center",fontSize:10,color:C.textSec,padding:"3px 6px",background:i%2===0?C.bgSec:C.bg,borderRadius:4}}>
                <span style={{color:C.textTer}}>{m.date}</span>
                <span style={{color:C.text,fontWeight:500}} title={m.opponent}>vs {m.opponent?.slice(0,12)}</span>
                <span style={{fontWeight:700,color:m.scored>m.conceded?C.green:m.scored===m.conceded?C.amber:C.coral}}>{m.scored}-{m.conceded}</span>
                <span title="Corners">🔄{m.corners||0}</span>
                <span title="Tarjetas amarillas">🟨{m.yellowCards||0}</span>
                <span title="Tiros">🎯{m.shots||0}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ESTADO INICIAL ───────────────────────────────────────────────────────────
const dCtx = () => ({ comp:"liga", fase:"grupos", sede:"local", liga:"premierleague", h2hWins:0, h2hDraws:0, h2hLosses:0 });

export default function FootballPredictor() {
  const [localTeam,   setLocalTeam]   = useState(null);
  const [visitorTeam, setVisitorTeam] = useState(null);
  const [ctx,         setCtx]         = useState(dCtx());
  const [result,      setResult]      = useState(null);
  const [bets,        setBets]        = useState([]);
  const [sc,          setSc]          = useState({});
  const [error,       setError]       = useState("");
  const [tab,         setTab]         = useState("mercados");

  const upCtx = (k,v) => setCtx(p=>({...p,[k]:v}));
  const compInfo  = COMPETITIONS.find(c=>c.id===ctx.comp)||COMPETITIONS[0];
  const mode      = compInfo.mode;
  const leagueInfo= LEAGUES.find(l=>l.id===ctx.liga)||LEAGUES[0];
  const accentColor = mode==="liga" ? C.green : C.gold;

  const analyze = () => {
    if (!localTeam?.matches?.length || !visitorTeam?.matches?.length) {
      setError("Carga los partidos de ambos equipos primero."); return;
    }
    setError("");
    const ctxP = { ...ctx, h2hWins:parseInt(ctx.h2hWins)||0, h2hDraws:parseInt(ctx.h2hDraws)||0, h2hLosses:parseInt(ctx.h2hLosses)||0 };
    const r = computeFromMatches(localTeam.matches, visitorTeam.matches, ctxP, localTeam.elo, visitorTeam.elo);
    setResult(r);
    setBets(buildBets(r, localTeam.name, visitorTeam.name));
    setSc({});
  };

  const nameL = localTeam?.name   || "Local";
  const nameV = visitorTeam?.name || "Visitante";
  const leagueApiId = mode==="liga" ? leagueInfo.apiId : null;

  const groups = [
    {label:"Resultado final (1X2)",  color:C.green,  keys:["1x2","1x","x2"]},
    {label:"Totales del partido",    color:C.amber,  keys:["o15","o25","u25","o35","bttsY","bttsN"]},
    {label:`Goles de ${nameL}`,      color:C.green,  keys:["l05","l15"]},
    {label:`Goles de ${nameV}`,      color:C.blue,   keys:["v05","v15"]},
    {label:"Hándicap asiático",      color:C.purple, keys:["hl1","hl2","hv1","hv2"]},
    ...(result?.isElim?[{label:"Mercados eliminatoria",color:C.gold,keys:["ext","pen","lL","lV"]}]:[]),
  ];

  return(
    <div style={{maxWidth:960,margin:"0 auto",padding:"1.5rem 1rem 3rem",fontFamily:"'DM Sans','Segoe UI',sans-serif",color:C.text}}>

      {/* HEADER */}
      <div style={{textAlign:"center",marginBottom:"2rem",paddingBottom:"1.5rem",borderBottom:`0.5px solid ${C.border}`}}>
        <div style={{display:"inline-block",background:mode==="liga"?C.greenLt:C.goldLt,color:accentColor,fontSize:11,fontWeight:700,padding:"3px 14px",borderRadius:20,marginBottom:10}}>
          API-FOOTBALL · BÚSQUEDA AUTOMÁTICA · ELO · EV
        </div>
        <h1 style={{fontSize:"clamp(1.8rem,5vw,2.6rem)",fontWeight:800,margin:0,lineHeight:1}}>
          FOOTBALL<span style={{color:accentColor}}>STAT</span> PREDICTOR
        </h1>
        <p style={{marginTop:10,fontSize:13,color:C.textSec,fontWeight:300}}>
          Escribe el nombre del equipo · la app trae automáticamente goles, corners y tarjetas
        </p>
      </div>

      {/* COMPETICIÓN */}
      <div style={{...card(),marginBottom:"1rem"}}>
        <SLabel>COMPETICIÓN</SLabel>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:6,marginBottom:mode==="liga"?14:0}}>
          {COMPETITIONS.map(c=>{
            const sc2=c.mode==="liga"?C.green:C.gold, sb=c.mode==="liga"?C.greenLt:C.goldLt;
            const active=ctx.comp===c.id;
            return(<button key={c.id} onClick={()=>upCtx("comp",c.id)}
              style={{padding:"8px 10px",fontSize:12,fontWeight:active?700:400,border:`1.5px solid ${active?sc2:C.border}`,borderRadius:8,background:active?sb:"transparent",color:active?sc2:C.textSec,cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",gap:6}}>
              <span>{c.icon}</span><span>{c.label}</span>
            </button>);})}
        </div>

        {mode==="liga"&&(
          <div style={{marginTop:14,paddingTop:14,borderTop:`0.5px solid ${C.border}`}}>
            <div style={{fontSize:11,fontWeight:600,color:C.textSec,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8}}>Liga específica</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(165px,1fr))",gap:6}}>
              {LEAGUES.map(l=>(
                <button key={l.id} onClick={()=>upCtx("liga",l.id)}
                  style={{padding:"7px 10px",fontSize:11,fontWeight:ctx.liga===l.id?700:400,border:`1.5px solid ${ctx.liga===l.id?C.green:C.border}`,borderRadius:8,background:ctx.liga===l.id?C.greenLt:"transparent",color:ctx.liga===l.id?C.green:C.textSec,cursor:"pointer",fontFamily:"inherit",textAlign:"left",display:"flex",alignItems:"center",justifyContent:"space-between",gap:6}}>
                  <span>{l.icon} {l.label}</span>
                  <span style={{fontSize:9,color:ctx.liga===l.id?C.green:C.textTer}}>H={l.homeAdv}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {mode==="copa"&&(
          <div style={{marginTop:14,paddingTop:14,borderTop:`0.5px solid ${C.border}`,display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:C.textSec,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8}}>Fase</div>
              {PHASES.map(f=>(
                <button key={f.id} onClick={()=>upCtx("fase",f.id)}
                  style={{width:"100%",padding:"7px 12px",fontSize:12,fontWeight:ctx.fase===f.id?700:400,border:`1.5px solid ${ctx.fase===f.id?C.purple:C.border}`,borderRadius:8,background:ctx.fase===f.id?C.purpleLt:"transparent",color:ctx.fase===f.id?C.purple:C.textSec,cursor:"pointer",fontFamily:"inherit",textAlign:"left",marginBottom:4,display:"flex",justifyContent:"space-between"}}>
                  <span>{f.label}</span>
                  {f.id!=="grupos"&&<span style={{fontSize:9,color:ctx.fase===f.id?C.purple:C.textTer}}>-{((1-PHASE_GOALS[f.id])*100).toFixed(0)}% goles</span>}
                </button>
              ))}
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:C.textSec,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:8}}>Sede</div>
              {SEDE.map(s=>(
                <button key={s.id} onClick={()=>upCtx("sede",s.id)}
                  style={{width:"100%",padding:"7px 12px",fontSize:12,fontWeight:ctx.sede===s.id?700:400,border:`1.5px solid ${ctx.sede===s.id?C.amber:C.border}`,borderRadius:8,background:ctx.sede===s.id?C.amberLt:"transparent",color:ctx.sede===s.id?C.gold:C.textSec,cursor:"pointer",fontFamily:"inherit",textAlign:"left",marginBottom:4,display:"flex",alignItems:"center",gap:6}}>
                  <span>{s.icon}</span><span>{s.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* H2H */}
      <div style={{...card(),marginBottom:"1rem"}}>
        <SLabel>HISTORIAL H2H (opcional)</SLabel>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          {[{label:`Victorias ${nameL}`,key:"h2hWins",color:C.green},{label:"Empates",key:"h2hDraws",color:C.amber},{label:`Victorias ${nameV}`,key:"h2hLosses",color:C.blue}].map(({label,key,color})=>(
            <div key={key}>
              <div style={{fontSize:10,fontWeight:600,color,textTransform:"uppercase",marginBottom:4}}>{label}</div>
              <input type="number" min="0" value={ctx[key]} onChange={e=>upCtx(key,e.target.value)} placeholder="0"
                style={{width:"100%",padding:"7px 10px",fontSize:"1.1rem",fontWeight:700,border:`1.5px solid ${ctx[key]>0?color:C.border}`,borderRadius:8,background:C.bgSec,color:C.text,fontFamily:"inherit",outline:"none",textAlign:"center"}}/>
            </div>
          ))}
        </div>
      </div>

      {/* EQUIPOS */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1rem",marginBottom:"1rem"}}>
        <TeamSearchPanel isLocal={true}  team={localTeam}   onTeamLoaded={setLocalTeam}   leagueApiId={leagueApiId} mode={mode}/>
        <TeamSearchPanel isLocal={false} team={visitorTeam} onTeamLoaded={setVisitorTeam} leagueApiId={leagueApiId} mode={mode}/>
      </div>

      {error&&<div style={{background:C.coralLt,color:C.coral,fontSize:13,padding:"10px 14px",borderRadius:8,marginBottom:"0.75rem"}}>⚠ {error}</div>}

      <div style={{display:"flex",gap:10,marginBottom:"1.5rem"}}>
        <button onClick={analyze}
          style={{flex:1,padding:"14px",fontWeight:700,fontSize:"1rem",letterSpacing:"1.5px",background:localTeam&&visitorTeam?accentColor:C.grayLt,color:localTeam&&visitorTeam?"white":C.textSec,border:"none",borderRadius:12,cursor:localTeam&&visitorTeam?"pointer":"not-allowed",textTransform:"uppercase",fontFamily:"inherit"}}>
          {compInfo.icon} ANALIZAR → {compInfo.label.toUpperCase()}
        </button>
        <button onClick={()=>{setLocalTeam(null);setVisitorTeam(null);setCtx(dCtx());setResult(null);setBets([]);setSc({});setError("");}}
          style={{padding:"14px 20px",fontWeight:500,fontSize:"0.9rem",background:"transparent",color:C.textSec,border:`0.5px solid ${C.border}`,borderRadius:12,cursor:"pointer",fontFamily:"inherit"}}>
          Reiniciar
        </button>
      </div>

      {/* RESULTADOS */}
      {result&&(<div>

        {/* Badges */}
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:"1rem"}}>
          <span style={{background:mode==="liga"?C.greenLt:C.goldLt,color:accentColor,fontSize:11,fontWeight:700,padding:"4px 12px",borderRadius:20}}>{compInfo.icon} {compInfo.label}</span>
          {mode==="liga"&&<span style={{background:C.greenLt,color:C.greenDk,fontSize:11,fontWeight:700,padding:"4px 12px",borderRadius:20}}>{leagueInfo.icon} {leagueInfo.label}</span>}
          <span style={{background:C.bgSec,color:C.textSec,fontSize:11,fontWeight:600,padding:"4px 12px",borderRadius:20}}>📊 {result.nL} + {result.nV} partidos analizados</span>
        </div>

        {/* ELO */}
        <SLabel>ELO Y VENTAJA</SLabel>
        <div style={{...card(),marginBottom:"1rem"}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,fontWeight:600,marginBottom:10}}>
            <span style={{color:C.green}}>{nameL} · ELO {result.eloL}</span>
            <span style={{fontSize:11,color:C.textSec}}>{result.eloDiff>100?`${nameL} favorito`:result.eloDiff<-100?`${nameV} favorito`:"Muy parejos"}</span>
            <span style={{color:C.blue}}>{nameV} · ELO {result.eloV}</span>
          </div>
          <div style={{height:12,borderRadius:6,overflow:"hidden",display:"flex",marginBottom:5}}>
            <div style={{width:`${(result.eloL/(result.eloL+result.eloV)*100).toFixed(1)}%`,background:C.green}}/>
            <div style={{flex:1,background:C.blue}}/>
          </div>
        </div>

        {/* Estadísticas extra */}
        <SLabel>ESTADÍSTICAS PROMEDIO (ÚLTIMOS PARTIDOS)</SLabel>
        <div style={{...card(),marginBottom:"1rem"}}>
          <StatRow label="Goles anotados"   valL={result.avgLS.toFixed(2)} valV={result.avgVS.toFixed(2)} colorL={C.green} colorV={C.blue}/>
          <StatRow label="Goles recibidos"  valL={result.avgLC.toFixed(2)} valV={result.avgVC.toFixed(2)} colorL={C.coral} colorV={C.coral}/>
          <StatRow label="Corners"          valL={result.avgLCorners.toFixed(1)} valV={result.avgVCorners.toFixed(1)} colorL={C.green} colorV={C.blue}/>
          <StatRow label="Tarjetas amarillas" valL={result.avgLYellow.toFixed(1)} valV={result.avgVYellow.toFixed(1)} colorL={C.amber} colorV={C.amber}/>
          <StatRow label="Tiros totales"    valL={result.avgLShots.toFixed(1)} valV={result.avgVShots.toFixed(1)} colorL={C.green} colorV={C.blue}/>
        </div>

        {/* xG */}
        <SLabel>xG CALCULADO</SLabel>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10,marginBottom:"1.5rem"}}>
          <Metric label={`${nameL} xG`}      value={result.xgL.toFixed(2)} color={C.green}  sub="goles esperados"/>
          <Metric label={`${nameV} xG`}      value={result.xgV.toFixed(2)} color={C.blue}   sub="goles esperados"/>
          <Metric label="Total esperado"     value={result.total.toFixed(2)} color={C.amber} sub="goles en el partido"/>
          <Metric label="Marcador más prob." value={`${result.topScores[0].i}-${result.topScores[0].j}`} color={C.purple} sub={`${(result.topScores[0].p*100).toFixed(2)}% prob.`}/>
        </div>

        {/* 1X2 */}
        <SLabel>PROBABILIDADES 1X2</SLabel>
        <div style={{...card(),marginBottom:"1.5rem"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",alignItems:"center",gap:"1rem",marginBottom:14}}>
            {[{name:nameL,p:result.pL,color:C.green,lbl:"Victoria"},{name:"Empate",p:result.pD,color:C.amber,lbl:"X"},{name:nameV,p:result.pV,color:C.blue,lbl:"Victoria"}].map(({name,p,color,lbl})=>(
              <div key={name} style={{textAlign:"center"}}>
                <div style={{fontSize:12,color:C.textSec,marginBottom:4}}>{name}</div>
                <div style={{fontSize:"2.2rem",fontWeight:800,color,lineHeight:1}}>{(p*100).toFixed(0)}%</div>
                <div style={{fontSize:11,color:C.textSec,marginTop:2}}>{lbl}</div>
              </div>
            ))}
          </div>
          <div style={{height:14,borderRadius:7,overflow:"hidden",display:"flex"}}>
            <div style={{width:`${(result.pL*100).toFixed(0)}%`,background:C.green}}/>
            <div style={{width:`${(result.pD*100).toFixed(0)}%`,background:C.amber}}/>
            <div style={{flex:1,background:C.blue}}/>
          </div>
          {result.isElim&&(
            <div style={{marginTop:12,display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <div style={{background:C.goldLt,borderRadius:8,padding:"10px",textAlign:"center"}}>
                <div style={{fontSize:10,color:C.gold,fontWeight:600,marginBottom:3}}>VA A PRÓRROGA</div>
                <div style={{fontSize:"1.4rem",fontWeight:800,color:C.gold}}>{(result.pExtraTime*100).toFixed(0)}%</div>
              </div>
              <div style={{background:C.purpleLt,borderRadius:8,padding:"10px",textAlign:"center"}}>
                <div style={{fontSize:10,color:C.purple,fontWeight:600,marginBottom:3}}>VA A PENALES</div>
                <div style={{fontSize:"1.4rem",fontWeight:800,color:C.purple}}>{(result.pPenalties*100).toFixed(0)}%</div>
              </div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:0,marginBottom:"1.25rem",border:`0.5px solid ${C.border}`,borderRadius:10,overflow:"hidden",width:"fit-content"}}>
          {[["mercados","Mercados"],["marcadores","Marcadores exactos"]].map(([v,lbl])=>(
            <button key={v} onClick={()=>setTab(v)}
              style={{padding:"9px 20px",fontSize:12,fontWeight:tab===v?700:500,background:tab===v?accentColor:"transparent",color:tab===v?"white":C.textSec,border:"none",cursor:"pointer",fontFamily:"inherit"}}>
              {lbl}
            </button>
          ))}
        </div>

        {tab==="mercados"&&groups.map(g=>(
          <BetGroup key={g.label} label={g.label} color={g.color}
            bets={bets.filter(b=>g.keys.includes(b.key))}
            onCuotaChange={(key,val)=>setBets(prev=>prev.map(b=>b.key===key?{...b,cuota:val}:b))}/>
        ))}

        {tab==="marcadores"&&(
          <div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:10,marginBottom:"1.5rem"}}>
              {result.topScores.map((score,idx)=>{
                const ev=calcEV(score.p,sc[idx]||""), info=evInfo(ev);
                return(<div key={idx} style={{...card(),display:"flex",flexDirection:"column",gap:5}}>
                  <div style={{fontSize:"1.4rem",fontWeight:800,textAlign:"center",color:C.text,letterSpacing:2}}>{score.i} – {score.j}</div>
                  <div style={{fontSize:10,color:C.textSec,textAlign:"center"}}>{score.i>score.j?nameL:score.i===score.j?"Empate":nameV}</div>
                  <div style={{fontSize:"1rem",fontWeight:700,color:C.purple,textAlign:"center"}}>{(score.p*100).toFixed(2)}%</div>
                  <ProbBar pct={score.p*100} color={C.purple}/>
                  <input type="number" min="1.01" step="0.1" value={sc[idx]||""} onChange={e=>setSc(p=>({...p,[idx]:e.target.value}))} placeholder="Cuota"
                    style={{width:"100%",padding:"6px 8px",fontSize:"0.9rem",fontWeight:700,border:`1.5px solid ${sc[idx]?evColor(ev):C.border}`,borderRadius:8,background:C.bgSec,color:C.text,fontFamily:"inherit",outline:"none",textAlign:"center"}}/>
                  {info&&<div style={{display:"flex",alignItems:"center",gap:4,background:info.bg,color:info.color,fontSize:9,fontWeight:700,padding:"4px 7px",borderRadius:6}}>{info.icon} {info.text}</div>}
                </div>);})}
            </div>
            <div style={card()}>
              <div style={{fontSize:11,fontWeight:600,color:C.textSec,textTransform:"uppercase",letterSpacing:"0.6px",marginBottom:10}}>Tabla completa 0–5</div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead>
                    <tr>
                      <th style={{padding:"6px 8px",background:C.bgSec,color:C.textSec,fontWeight:600,textAlign:"center",border:`0.5px solid ${C.border}`}}>{nameL} \ {nameV}</th>
                      {[0,1,2,3,4,5].map(j=><th key={j} style={{padding:"6px 8px",background:C.blueLt,color:C.blueDk,fontWeight:700,textAlign:"center",border:`0.5px solid ${C.border}`}}>{j}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {[0,1,2,3,4,5].map(i=>(
                      <tr key={i}>
                        <td style={{padding:"6px 8px",background:C.greenLt,color:C.greenDk,fontWeight:700,textAlign:"center",border:`0.5px solid ${C.border}`}}>{i}</td>
                        {[0,1,2,3,4,5].map(j=>{
                          const p=poissonP(result.xgL,i)*poissonP(result.xgV,j)*100;
                          const isTop=result.topScores.slice(0,3).some(s=>s.i===i&&s.j===j);
                          return(<td key={j} style={{padding:"6px 8px",textAlign:"center",border:`0.5px solid ${C.border}`,background:isTop?"#EEEDFE":i===j?C.amberLt:i>j?"#F0FFF8":"#FFF0F0",color:isTop?C.purple:C.text,fontWeight:isTop?700:400}}>
                            {p.toFixed(2)}%
                          </td>);})}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <div style={{...card(),marginTop:"1.5rem",marginBottom:"1rem"}}>
          <div style={{fontSize:11,fontWeight:600,color:C.textSec,textTransform:"uppercase",marginBottom:6}}>Distribución Poisson</div>
          <div style={{display:"flex",gap:14,marginBottom:8}}>
            {[{label:nameL,color:C.green},{label:nameV,color:C.blue}].map(({label,color})=>(
              <span key={label} style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:C.textSec}}>
                <span style={{width:10,height:10,borderRadius:2,background:color,display:"inline-block"}}/>{label}
              </span>
            ))}
          </div>
          <PoissonSVG xgL={result.xgL} xgV={result.xgV}/>
        </div>

        <div style={{padding:"0.75rem 1rem",background:C.grayLt,borderRadius:8,fontSize:11,color:C.textSec,lineHeight:1.7}}>
          <strong>Datos vía API-Football:</strong> goles, corners, tarjetas y tiros obtenidos automáticamente de los últimos 10 partidos. xG calculado con distribución de Poisson + ajuste ELO ±33%. EV = (prob × cuota) − 1. Herramienta académica.
        </div>
      </div>)}
    </div>
  );
}
