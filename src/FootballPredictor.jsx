import { useState } from "react";

const C = {
  green:"#1D9E75", greenDk:"#0F6E56", greenLt:"#E1F5EE",
  blue:"#378ADD",  blueDk:"#185FA5", blueLt:"#E6F1FB",
  amber:"#EF9F27", amberLt:"#FAEEDA",
  coral:"#D85A30", coralLt:"#FAECE7",
  purple:"#7F77DD",purpleLt:"#EEEDFE",
  teal:"#1D9E75",  tealLt:"#E1F5EE",
  gray:"#888780",  grayLt:"#F1EFE8",
  text:"#18181b",  textSec:"#71717a", textTer:"#a1a1aa",
  border:"rgba(24,24,27,0.12)", bg:"#ffffff", bgSec:"#f9f9f8",
};

// ─── ESTADÍSTICA ─────────────────────────────────────────────────────────────
function factorial(n){ let r=1; for(let i=2;i<=n;i++) r*=i; return r; }
function poissonP(λ,k){ return (Math.pow(λ,k)*Math.exp(-λ))/factorial(k); }

function allProbs(λL,λV,maxG=8){
  const grid=[];
  for(let i=0;i<=maxG;i++){
    grid[i]=[];
    for(let j=0;j<=maxG;j++) grid[i][j]=poissonP(λL,i)*poissonP(λV,j);
  }
  return grid;
}

function eloFactor(a,b){ const d=Math.max(-400,Math.min(400,a-b)); return 1+d/1200; }

function compute(ld,vd){
  const avgLS=ld.ga/ld.p, avgLC=ld.gr/ld.p;
  const avgVS=vd.ga/vd.p, avgVC=vd.gr/vd.p;
  const xgL=Math.max(0.1,((avgLS+avgVC)/2)*eloFactor(ld.elo,vd.elo));
  const xgV=Math.max(0.1,((avgVS+avgLC)/2)*eloFactor(vd.elo,ld.elo));
  const total=xgL+xgV;
  const grid=allProbs(xgL,xgV,9);

  // 1X2
  let pL=0,pD=0;
  for(let i=0;i<=9;i++) for(let j=0;j<=9;j++){
    if(i>j) pL+=grid[i][j]; else if(i===j) pD+=grid[i][j];
  }
  const pV=Math.max(0,1-pL-pD);

  // Totales partido
  const sumGrid=(fn)=>{ let s=0; for(let i=0;i<=9;i++) for(let j=0;j<=9;j++) if(fn(i,j)) s+=grid[i][j]; return s; };
  const pOver15=sumGrid((i,j)=>i+j>1);
  const pOver25=sumGrid((i,j)=>i+j>2);
  const pOver35=sumGrid((i,j)=>i+j>3);
  const pUnder25=1-pOver25;
  const pBTTS=sumGrid((i,j)=>i>0&&j>0);

  // Goles por equipo
  const localGoals =(fn)=>{ let s=0; for(let i=0;i<=9;i++) for(let j=0;j<=9;j++) if(fn(i)) s+=grid[i][j]; return s; };
  const visitorGoals=(fn)=>{ let s=0; for(let i=0;i<=9;i++) for(let j=0;j<=9;j++) if(fn(j)) s+=grid[i][j]; return s; };

  const pL05=localGoals(i=>i>=1);
  const pL15=localGoals(i=>i>=2);
  const pL25=localGoals(i=>i>=3);
  const pV05=visitorGoals(j=>j>=1);
  const pV15=visitorGoals(j=>j>=2);
  const pV25=visitorGoals(j=>j>=3);

  // Hándicap asiático
  const pHLocal1=sumGrid((i,j)=>i-j>=1);   // local gana por 1+
  const pHLocal2=sumGrid((i,j)=>i-j>=2);   // local gana por 2+
  const pHVisitor1=sumGrid((i,j)=>j-i>=1); // visitante gana por 1+
  const pHVisitor2=sumGrid((i,j)=>j-i>=2); // visitante gana por 2+

  // Marcadores exactos top 8
  const scores=[];
  for(let i=0;i<=6;i++) for(let j=0;j<=6;j++) scores.push({i,j,p:grid[i]?.[j]||0});
  scores.sort((a,b)=>b.p-a.p);
  const topScores=scores.slice(0,8);

  // Mejor marcador
  const bestScore=topScores[0];

  return{
    avgLS,avgLC,avgVS,avgVC,xgL,xgV,total,
    pL,pD,pV,pBTTS,pOver15,pOver25,pOver35,pUnder25,
    pL05,pL15,pL25,pV05,pV15,pV25,
    pHLocal1,pHLocal2,pHVisitor1,pHVisitor2,
    topScores,bestScore,
    p1X:pL+pD,pX2:pD+pV,
    eloL:ld.elo,eloV:vd.elo,eloDiff:ld.elo-vd.elo,
  };
}

// ─── APUESTAS ─────────────────────────────────────────────────────────────────
function buildBets(r,nameL,nameV){
  const bets=[];
  const add=(group,key,label,pct,threshold,color)=>{
    const rec=pct>=threshold+0.08?"SI":pct>=threshold?"CUIDADO":"NO";
    bets.push({group,key,label,pct,rec,color,cuota:""});
  };

  // 1X2
  const winner=r.pL>r.pV&&r.pL>r.pD?{label:`Victoria ${nameL}`,p:r.pL,color:C.green}
    :r.pV>r.pD?{label:`Victoria ${nameV}`,p:r.pV,color:C.blue}:{label:"Empate",p:r.pD,color:C.amber};
  add("1X2","1x2",winner.label,winner.p,0.45,winner.color);
  add("1X2","1x",`1X — ${nameL} o empate`,r.p1X,0.60,C.green);
  add("1X2","x2",`X2 — empate o ${nameV}`,r.pX2,0.60,C.blue);

  // Totales partido
  add("TOTALES PARTIDO","o15","Over 1.5 goles",r.pOver15,0.65,C.amber);
  add("TOTALES PARTIDO","o25","Over 2.5 goles",r.pOver25,0.55,C.amber);
  add("TOTALES PARTIDO","u25","Under 2.5 goles",r.pUnder25,0.55,C.blue);
  add("TOTALES PARTIDO","o35","Over 3.5 goles",r.pOver35,0.40,C.coral);
  add("TOTALES PARTIDO","bttsY","BTTS — Ambos anotan Sí",r.pBTTS,0.52,C.purple);
  add("TOTALES PARTIDO","bttsN","BTTS — Ambos anotan No",1-r.pBTTS,0.52,C.gray);

  // Goles equipo local
  add(`GOLES ${nameL.toUpperCase()}`,"l05",`${nameL} anota +0.5 (al menos 1)`,r.pL05,0.55,C.green);
  add(`GOLES ${nameL.toUpperCase()}`,"l15",`${nameL} anota +1.5 (al menos 2)`,r.pL15,0.45,C.green);
  add(`GOLES ${nameL.toUpperCase()}`,"l25",`${nameL} anota +2.5 (al menos 3)`,r.pL25,0.35,C.green);

  // Goles equipo visitante
  add(`GOLES ${nameV.toUpperCase()}`,"v05",`${nameV} anota +0.5 (al menos 1)`,r.pV05,0.55,C.blue);
  add(`GOLES ${nameV.toUpperCase()}`,"v15",`${nameV} anota +1.5 (al menos 2)`,r.pV15,0.45,C.blue);
  add(`GOLES ${nameV.toUpperCase()}`,"v25",`${nameV} anota +2.5 (al menos 3)`,r.pV25,0.35,C.blue);

  // Hándicap asiático
  add("HÁNDICAP ASIÁTICO","hl1",`${nameL} gana por 1+ goles`,r.pHLocal1,0.40,C.green);
  add("HÁNDICAP ASIÁTICO","hl2",`${nameL} gana por 2+ goles`,r.pHLocal2,0.30,C.green);
  add("HÁNDICAP ASIÁTICO","hv1",`${nameV} gana por 1+ goles`,r.pHVisitor1,0.40,C.blue);
  add("HÁNDICAP ASIÁTICO","hv2",`${nameV} gana por 2+ goles`,r.pHVisitor2,0.30,C.blue);

  return bets;
}

// ─── EV ───────────────────────────────────────────────────────────────────────
function calcEV(prob,cuota){
  const c=parseFloat(cuota);
  if(!c||c<1.01) return null;
  return (prob*c)-1;
}
function evColor(ev){ if(ev===null) return C.border; if(ev>0.05) return C.green; if(ev>0) return C.amber; return C.coral; }
function evInfo(ev){
  if(ev===null) return null;
  if(ev>0.05)  return{icon:"✓",text:`EV +${(ev*100).toFixed(1)}% — Vale apostar`,bg:C.greenLt,color:C.greenDk};
  if(ev>0)     return{icon:"~",text:`EV +${(ev*100).toFixed(1)}% — Valor marginal`,bg:C.amberLt,color:"#854F0B"};
  return{icon:"✗",text:`EV ${(ev*100).toFixed(1)}% — Sin valor`,bg:C.coralLt,color:"#4A1B0C"};
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
const card=(ex={})=>({background:C.bg,border:`0.5px solid ${C.border}`,borderRadius:12,padding:"1.25rem",...ex});

function SectionLabel({children,sub}){
  return(<div style={{marginBottom:"0.75rem",paddingBottom:"0.4rem",borderBottom:`0.5px solid ${C.border}`}}>
    <span style={{fontSize:11,fontWeight:700,color:C.textSec,textTransform:"uppercase",letterSpacing:"1px"}}>{children}</span>
    {sub&&<span style={{fontSize:10,color:C.textTer,marginLeft:8}}>{sub}</span>}
  </div>);
}

function ProbBar({pct,color}){
  return(<div style={{height:5,background:C.grayLt,borderRadius:3,overflow:"hidden",marginTop:4}}>
    <div style={{height:"100%",width:`${Math.min(100,pct).toFixed(0)}%`,background:color,borderRadius:3}}/>
  </div>);
}

function Metric({label,value,color,sub}){
  return(<div style={{background:C.bgSec,borderRadius:8,padding:"0.75rem 1rem",borderLeft:`3px solid ${color}`}}>
    <div style={{fontSize:10,color:C.textSec,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:3}}>{label}</div>
    <div style={{fontSize:"1.5rem",fontWeight:800,color,lineHeight:1}}>{value}</div>
    {sub&&<div style={{fontSize:10,color:C.textTer,marginTop:2}}>{sub}</div>}
  </div>);
}

function NumInput({label,value,onChange,placeholder,min=0,hint,accent}){
  return(<div>
    <div style={{fontSize:11,fontWeight:600,color:C.textSec,textTransform:"uppercase",letterSpacing:"0.5px",marginBottom:5}}>{label}</div>
    <input type="number" min={min} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
      style={{width:"100%",padding:"9px 12px",fontSize:"1.1rem",fontWeight:600,border:`1.5px solid ${value?accent:C.border}`,borderRadius:8,background:C.bgSec,color:C.text,fontFamily:"inherit",outline:"none",textAlign:"center",transition:"border-color 0.15s"}}/>
    {hint&&<div style={{fontSize:10,color:C.textTer,marginTop:3}}>{hint}</div>}
  </div>);
}

function TeamPanel({team,up,isLocal}){
  const accent=isLocal?C.green:C.blue, accentLt=isLocal?C.greenLt:C.blueLt;
  return(<div style={{...card(),borderTop:`3px solid ${accent}`}}>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
      <div style={{width:34,height:34,borderRadius:"50%",background:accentLt,color:accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>⚽</div>
      <input value={team.name} onChange={e=>up("name",e.target.value)}
        style={{flex:1,fontWeight:700,fontSize:"1.05rem",background:"transparent",border:"none",borderBottom:`1.5px solid ${C.border}`,color:C.text,padding:"3px 0",outline:"none",fontFamily:"inherit"}}/>
    </div>
    <div style={{marginBottom:14}}>
      <NumInput label="Partidos analizados" value={team.p} onChange={v=>up("p",v)} placeholder="10" min={1} accent={accent} hint="Úsalos de local (local) o visitante (visitante) para mayor precisión"/>
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:14}}>
      <NumInput label="Goles anotados (total)" value={team.ga} onChange={v=>up("ga",v)} placeholder="Ej: 14" accent={accent}
        hint={team.ga&&team.p?`→ ${(team.ga/team.p).toFixed(2)} por partido`:"total en esos partidos"}/>
      <NumInput label="Goles recibidos (total)" value={team.gr} onChange={v=>up("gr",v)} placeholder="Ej: 7" accent={accent}
        hint={team.gr&&team.p?`→ ${(team.gr/team.p).toFixed(2)} por partido`:"total en esos partidos"}/>
    </div>
    <div>
      <NumInput label="ELO del equipo" value={team.elo} onChange={v=>up("elo",v)} placeholder="Ej: 1650" min={500} accent={accent} hint="clubelo.com · Rango: 1000 (débil) – 2000 (élite)"/>
      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:8}}>
        {[["Élite",1900],["Alto",1700],["Medio",1500],["Bajo",1300],["Débil",1100]].map(([lbl,val])=>(
          <button key={lbl} onClick={()=>up("elo",String(val))}
            style={{padding:"2px 8px",fontSize:10,fontWeight:600,border:`0.5px solid ${team.elo==val?accent:C.border}`,borderRadius:20,background:team.elo==val?accentLt:"transparent",color:team.elo==val?accent:C.textSec,cursor:"pointer",fontFamily:"inherit"}}>
            {lbl} {val}
          </button>
        ))}
      </div>
    </div>
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
    {[0.1,0.2,0.3,0.4].filter(v=>v<=maxP+0.04).map(v=>(
      <line key={v} x1={pl.l} x2={W-pl.r} y1={ys(v)} y2={ys(v)} stroke={C.border} strokeWidth={0.5}/>))}
    {labels.map((lbl,i)=>{
      const cx=pl.l+i*gW+gW/2,hL=(pL[i]/maxP)*iH,hV=(pV[i]/maxP)*iH;
      return(<g key={i}>
        <rect x={cx-bW-1} y={ys(pL[i])} width={bW} height={hL} fill={C.green} rx={2} opacity={0.85}/>
        <rect x={cx+1} y={ys(pV[i])} width={bW} height={hV} fill={C.blue} rx={2} opacity={0.85}/>
        <text x={cx} y={H-4} textAnchor="middle" fontSize={9} fill={C.textTer}>{lbl}</text>
      </g>);})}
    {[0,0.1,0.2,0.3].filter(v=>v<=maxP+0.04).map(v=>(
      <text key={v} x={pl.l-3} y={ys(v)+3} textAnchor="end" fontSize={8} fill={C.textTer}>{(v*100).toFixed(0)}%</text>))}
  </svg>);
}

// Tarjeta marcador exacto
function ScoreCard({score,nameL,nameV,onCuotaChange,cuota}){
  const ev=calcEV(score.p,cuota);
  const info=evInfo(ev);
  const impl=cuota?(1/parseFloat(cuota)*100).toFixed(1):null;
  return(<div style={{...card(),display:"flex",flexDirection:"column",gap:5}}>
    <div style={{fontSize:"1.4rem",fontWeight:800,textAlign:"center",color:C.text,letterSpacing:2}}>
      {score.i} – {score.j}
    </div>
    <div style={{fontSize:10,color:C.textSec,textAlign:"center"}}>
      {score.i>score.j?nameL:score.i===score.j?"Empate":nameV}
    </div>
    <div style={{fontSize:"1rem",fontWeight:700,color:C.purple,textAlign:"center"}}>{(score.p*100).toFixed(2)}%</div>
    <ProbBar pct={score.p*100} color={C.purple}/>
    <div style={{fontSize:10,fontWeight:600,color:C.textSec,textTransform:"uppercase",letterSpacing:"0.4px",marginTop:4}}>Cuota casa</div>
    <input type="number" min="1.01" step="0.05" value={cuota} onChange={e=>onCuotaChange(e.target.value)} placeholder="Ej: 8.50"
      style={{width:"100%",padding:"6px 8px",fontSize:"0.95rem",fontWeight:700,border:`1.5px solid ${cuota?evColor(ev):C.border}`,borderRadius:8,background:C.bgSec,color:C.text,fontFamily:"inherit",outline:"none",textAlign:"center"}}/>
    {impl&&<div style={{fontSize:9,color:C.textTer}}>Casa asigna ~{impl}% · tú calculas {(score.p*100).toFixed(2)}%</div>}
    {info&&(<div style={{display:"flex",alignItems:"center",gap:4,background:info.bg,color:info.color,fontSize:9,fontWeight:700,padding:"4px 7px",borderRadius:6}}>
      {info.icon} {info.text}
    </div>)}
    {ev!==null&&<div style={{fontSize:9,color:C.textTer,fontFamily:"monospace"}}>({(score.p*100).toFixed(2)}%×{parseFloat(cuota).toFixed(2)})−1={ev>=0?"+":""}{(ev*100).toFixed(1)}%</div>}
  </div>);
}

// Tarjeta de apuesta mercado
function BetCard({b,onCuotaChange}){
  const recCfg={
    SI:     {bg:C.greenLt,color:C.greenDk,   icon:"✓",label:"APOSTAR"},
    CUIDADO:{bg:C.amberLt,color:"#854F0B",   icon:"⚠",label:"CUIDADO"},
    NO:     {bg:C.coralLt,color:"#4A1B0C",   icon:"✗",label:"EVITAR"},
  }[b.rec];
  const ev=calcEV(b.pct,b.cuota);
  const info=evInfo(ev);
  const impl=b.cuota?(1/parseFloat(b.cuota)*100).toFixed(1):null;
  return(<div style={{...card(),display:"flex",flexDirection:"column",gap:6}}>
    <div style={{fontSize:10,fontWeight:600,color:C.textSec,textTransform:"uppercase",letterSpacing:"0.5px",lineHeight:1.3}}>{b.label}</div>
    <div style={{display:"flex",alignItems:"baseline",gap:6}}>
      <div style={{fontSize:"1.2rem",fontWeight:800,color:b.color||C.text}}>{(b.pct*100).toFixed(1)}%</div>
      <div style={{fontSize:10,color:C.textTer}}>prob.</div>
    </div>
    <ProbBar pct={b.pct*100} color={b.rec==="SI"?C.green:b.rec==="CUIDADO"?C.amber:C.coral}/>
    <div style={{display:"inline-flex",alignItems:"center",gap:4,background:recCfg.bg,color:recCfg.color,fontSize:10,fontWeight:700,padding:"3px 9px",borderRadius:20,alignSelf:"flex-start"}}>
      {recCfg.icon} {recCfg.label}
    </div>
    <div style={{borderTop:`0.5px solid ${C.border}`,paddingTop:7,marginTop:2}}>
      <div style={{fontSize:10,fontWeight:600,color:C.textSec,textTransform:"uppercase",letterSpacing:"0.4px",marginBottom:4}}>Cuota casa</div>
      <input type="number" min="1.01" step="0.05" value={b.cuota} onChange={e=>onCuotaChange(b.key,e.target.value)} placeholder="Ej: 1.85"
        style={{width:"100%",padding:"6px 10px",fontSize:"1rem",fontWeight:700,border:`1.5px solid ${b.cuota?evColor(ev):C.border}`,borderRadius:8,background:C.bgSec,color:C.text,fontFamily:"inherit",outline:"none",textAlign:"center"}}/>
      {impl&&<div style={{fontSize:9,color:C.textTer,marginTop:3}}>
        Casa: ~{impl}% · Modelo: {(b.pct*100).toFixed(1)}%
        <span style={{color:parseFloat(impl)<b.pct*100?C.green:C.coral,fontWeight:600}}> ({parseFloat(impl)<b.pct*100?"✓ tú ves más valor":"✗ casa más optimista"})</span>
      </div>}
      {info&&<div style={{marginTop:5,display:"flex",alignItems:"center",gap:5,background:info.bg,color:info.color,fontSize:10,fontWeight:700,padding:"4px 8px",borderRadius:7}}>
        {info.icon} {info.text}
      </div>}
      {ev!==null&&<div style={{fontSize:9,color:C.textTer,marginTop:3,fontFamily:"monospace"}}>
        ({(b.pct*100).toFixed(1)}%×{parseFloat(b.cuota).toFixed(2)})−1={ev>=0?"+":""}{(ev*100).toFixed(1)}%
      </div>}
    </div>
  </div>);
}

// Grupo de apuestas por categoría
function BetGroup({label,color,bets,onCuotaChange}){
  const apostar=bets.filter(b=>b.rec==="SI");
  const cuidado=bets.filter(b=>b.rec==="CUIDADO");
  const evitar =bets.filter(b=>b.rec==="NO");
  const tagFor=(list,rec)=>{
    if(!list.length) return null;
    const cfg={SI:{bg:C.greenLt,c:C.greenDk,icon:"✓",lbl:"APOSTAR"},CUIDADO:{bg:C.amberLt,c:"#854F0B",icon:"⚠",lbl:"CUIDADO"},NO:{bg:C.coralLt,c:"#4A1B0C",icon:"✗",lbl:"EVITAR"}}[rec];
    return(<>
      <div style={{display:"inline-flex",alignItems:"center",gap:5,background:cfg.bg,color:cfg.c,fontSize:10,fontWeight:700,padding:"2px 9px",borderRadius:20,marginBottom:8}}>
        {cfg.icon} {cfg.lbl}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(195px,1fr))",gap:10,marginBottom:12}}>
        {list.map(b=><BetCard key={b.key} b={b} onCuotaChange={onCuotaChange}/>)}
      </div>
    </>);
  };
  return(<div style={{marginBottom:"1.5rem"}}>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
      <div style={{width:4,height:18,borderRadius:2,background:color}}/>
      <div style={{fontSize:12,fontWeight:700,color:C.text,textTransform:"uppercase",letterSpacing:"0.8px"}}>{label}</div>
    </div>
    {tagFor(apostar,"SI")}
    {tagFor(cuidado,"CUIDADO")}
    {tagFor(evitar,"NO")}
  </div>);
}

const defaultTeam=(name="")=>({name,p:"10",ga:"",gr:"",elo:""});

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function FootballPredictor(){
  const [local,   setLocal]  =useState(defaultTeam("Equipo Local"));
  const [visitor, setVisitor]=useState(defaultTeam("Equipo Visitante"));
  const [result,  setResult] =useState(null);
  const [bets,    setBets]   =useState([]);
  const [scoreCuotas,setScoreCuotas]=useState({});
  const [error,   setError]  =useState("");
  const [tab,     setTab]    =useState("mercados"); // "mercados" | "marcadores"

  const upL=(k,v)=>setLocal(p=>({...p,[k]:v}));
  const upV=(k,v)=>setVisitor(p=>({...p,[k]:v}));

  const validate=(t,lbl)=>{
    if(!parseInt(t.p)||parseInt(t.p)<1) return `${lbl}: partidos inválido.`;
    if(isNaN(parseFloat(t.ga))) return `${lbl}: ingresa goles anotados.`;
    if(isNaN(parseFloat(t.gr))) return `${lbl}: ingresa goles recibidos.`;
    if(!parseInt(t.elo)||parseInt(t.elo)<500) return `${lbl}: ELO inválido.`;
    return null;
  };

  const generate=()=>{
    const e=validate(local,local.name||"Local")||validate(visitor,visitor.name||"Visitante");
    if(e){setError(e);return;}
    setError("");
    const td=t=>({ga:parseFloat(t.ga),gr:parseFloat(t.gr),p:parseInt(t.p),elo:parseInt(t.elo)});
    const r=compute(td(local),td(visitor));
    setResult(r);
    setBets(buildBets(r,local.name||"Local",visitor.name||"Visitante"));
    setScoreCuotas({});
  };

  const updateCuota=(key,val)=>setBets(prev=>prev.map(b=>b.key===key?{...b,cuota:val}:b));
  const updateScoreCuota=(idx,val)=>setScoreCuotas(p=>({...p,[idx]:val}));

  const nameL=local.name||"Local", nameV=visitor.name||"Visitante";

  // Agrupación de mercados
  const groups=[
    {label:"Resultado final (1X2 / Doble oportunidad)", color:C.green,  keys:["1x2","1x","x2"]},
    {label:"Totales del partido",                        color:C.amber,  keys:["o15","o25","u25","o35","bttsY","bttsN"]},
    {label:`Goles de ${nameL}`,                          color:C.green,  keys:["l05","l15","l25"]},
    {label:`Goles de ${nameV}`,                          color:C.blue,   keys:["v05","v15","v25"]},
    {label:"Hándicap asiático",                          color:C.purple, keys:["hl1","hl2","hv1","hv2"]},
  ];

  // Resumen EV
  const betsConCuota=bets.filter(b=>b.cuota&&!isNaN(parseFloat(b.cuota)));
  const nValor=betsConCuota.filter(b=>calcEV(b.pct,b.cuota)>0.05).length;
  const nSinValor=betsConCuota.filter(b=>calcEV(b.pct,b.cuota)<=0).length;

  return(
    <div style={{maxWidth:960,margin:"0 auto",padding:"1.5rem 1rem 3rem",fontFamily:"'DM Sans','Segoe UI',sans-serif",color:C.text}}>

      {/* HEADER */}
      <div style={{textAlign:"center",marginBottom:"2rem",paddingBottom:"1.5rem",borderBottom:`0.5px solid ${C.border}`}}>
        <div style={{display:"inline-block",background:C.greenLt,color:C.greenDk,fontSize:11,fontWeight:600,padding:"3px 14px",borderRadius:20,marginBottom:10,letterSpacing:"0.5px"}}>
          POISSON · ELO · EV · MARCADORES EXACTOS
        </div>
        <h1 style={{fontSize:"clamp(1.8rem,5vw,2.8rem)",fontWeight:800,margin:0,lineHeight:1}}>
          FOOTBALL<span style={{color:C.green}}>STAT</span> PREDICTOR
        </h1>
        <p style={{marginTop:10,fontSize:13,color:C.textSec,fontWeight:300}}>
          Predicciones por equipo · marcadores exactos · EV por cuota de la casa
        </p>
      </div>

      {/* INPUTS */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1rem",marginBottom:"1rem"}}>
        <TeamPanel team={local}   up={upL} isLocal={true}/>
        <TeamPanel team={visitor} up={upV} isLocal={false}/>
      </div>

      {error&&<div style={{background:C.coralLt,color:C.coral,fontSize:13,padding:"10px 14px",borderRadius:8,marginBottom:"0.75rem"}}>⚠ {error}</div>}

      <div style={{display:"flex",gap:10,marginBottom:"1.5rem"}}>
        <button onClick={generate}
          style={{flex:1,padding:"14px",fontWeight:700,fontSize:"1rem",letterSpacing:"1.5px",background:C.green,color:"white",border:"none",borderRadius:12,cursor:"pointer",textTransform:"uppercase",fontFamily:"inherit"}}>
          ANALIZAR Y PREDECIR →
        </button>
        <button onClick={()=>{setLocal(defaultTeam("Equipo Local"));setVisitor(defaultTeam("Equipo Visitante"));setResult(null);setBets([]);setScoreCuotas({});setError("");}}
          style={{padding:"14px 20px",fontWeight:500,fontSize:"0.9rem",background:"transparent",color:C.textSec,border:`0.5px solid ${C.border}`,borderRadius:12,cursor:"pointer",fontFamily:"inherit"}}>
          Reiniciar
        </button>
      </div>

      {result&&(<div>

        {/* ELO */}
        <SectionLabel>ANÁLISIS ELO</SectionLabel>
        <div style={{...card(),marginBottom:"1rem"}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:12,fontWeight:600,marginBottom:10}}>
            <span style={{color:C.green}}>{nameL} · ELO {result.eloL}</span>
            <span style={{fontSize:11,color:C.textSec}}>
              {result.eloDiff>100?`${nameL} favorito (+${result.eloDiff})`:result.eloDiff<-100?`${nameV} favorito (+${Math.abs(result.eloDiff)})`:"Equipos parejos"}
            </span>
            <span style={{color:C.blue}}>{nameV} · ELO {result.eloV}</span>
          </div>
          <div style={{height:12,borderRadius:6,overflow:"hidden",display:"flex",marginBottom:5}}>
            <div style={{width:`${(result.eloL/(result.eloL+result.eloV)*100).toFixed(1)}%`,background:C.green}}/>
            <div style={{flex:1,background:C.blue}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:C.textTer}}>
            <span>{(result.eloL/(result.eloL+result.eloV)*100).toFixed(1)}%</span>
            <span>{(result.eloV/(result.eloL+result.eloV)*100).toFixed(1)}%</span>
          </div>
        </div>

        {/* xG métricas */}
        <SectionLabel>xG Y MÉTRICAS</SectionLabel>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10,marginBottom:"1rem"}}>
          <Metric label={`${nameL} xG`}      value={result.xgL.toFixed(2)} color={C.green}  sub={`base ${((result.avgLS+result.avgVC)/2).toFixed(2)} → ELO adj.`}/>
          <Metric label={`${nameV} xG`}      value={result.xgV.toFixed(2)} color={C.blue}   sub={`base ${((result.avgVS+result.avgLC)/2).toFixed(2)} → ELO adj.`}/>
          <Metric label="Total esperado"     value={result.total.toFixed(2)} color={C.amber} sub="goles en el partido"/>
          <Metric label="Marcador más prob." value={`${result.bestScore.i}-${result.bestScore.j}`} color={C.purple} sub={`${(result.bestScore.p*100).toFixed(2)}% de prob.`}/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:10,marginBottom:"1.5rem"}}>
          <Metric label={`${nameL} prom. anotados`}  value={result.avgLS.toFixed(2)} color={C.green}/>
          <Metric label={`${nameL} prom. recibidos`} value={result.avgLC.toFixed(2)} color={C.coral}/>
          <Metric label={`${nameV} prom. anotados`}  value={result.avgVS.toFixed(2)} color={C.blue}/>
          <Metric label={`${nameV} prom. recibidos`} value={result.avgVC.toFixed(2)} color={C.coral}/>
        </div>

        {/* 1X2 visual */}
        <SectionLabel>PROBABILIDADES 1X2</SectionLabel>
        <div style={{...card(),marginBottom:"1.5rem"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr auto 1fr",alignItems:"center",gap:"1rem",marginBottom:14}}>
            {[{name:nameL,p:result.pL,color:C.green,lbl:"Victoria local"},{name:"Empate",p:result.pD,color:C.amber,lbl:"X"},{name:nameV,p:result.pV,color:C.blue,lbl:"Victoria visitante"}].map(({name,p,color,lbl})=>(
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
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:0,marginBottom:"1.25rem",border:`0.5px solid ${C.border}`,borderRadius:10,overflow:"hidden",width:"fit-content"}}>
          {[["mercados","Todos los mercados"],["marcadores","Marcadores exactos"]].map(([v,lbl])=>(
            <button key={v} onClick={()=>setTab(v)}
              style={{padding:"9px 20px",fontSize:12,fontWeight:tab===v?700:500,background:tab===v?C.green:"transparent",color:tab===v?"white":C.textSec,border:"none",cursor:"pointer",fontFamily:"inherit",transition:"background 0.15s"}}>
              {lbl}
            </button>
          ))}
        </div>

        {/* Resumen EV */}
        {betsConCuota.length>0&&tab==="mercados"&&(
          <div style={{...card({background:C.bgSec,border:"none"}),marginBottom:"1.25rem",display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:12,fontWeight:600,color:C.textSec}}>Cuotas ingresadas:</span>
            {nValor>0&&<span style={{background:C.greenLt,color:C.greenDk,padding:"3px 12px",borderRadius:20,fontSize:11,fontWeight:700}}>✓ {nValor} con valor</span>}
            {nSinValor>0&&<span style={{background:C.coralLt,color:"#4A1B0C",padding:"3px 12px",borderRadius:20,fontSize:11,fontWeight:700}}>✗ {nSinValor} sin valor</span>}
          </div>
        )}

        {/* MERCADOS */}
        {tab==="mercados"&&groups.map(g=>(
          <BetGroup key={g.label} label={g.label} color={g.color}
            bets={bets.filter(b=>g.keys.includes(b.key))}
            onCuotaChange={updateCuota}/>
        ))}

        {/* MARCADORES EXACTOS */}
        {tab==="marcadores"&&(
          <div>
            <div style={{marginBottom:10}}>
              <div style={{fontSize:12,color:C.textSec,marginBottom:12,lineHeight:1.6}}>
                Los 8 marcadores exactos con mayor probabilidad calculada. Ingresa la cuota de la casa para ver si tiene valor esperado (EV) positivo.
              </div>
              <div style={{...card({background:C.bgSec,border:"none",padding:"0.6rem 1rem"}),marginBottom:12,fontSize:11,color:C.textSec}}>
                💡 Las cuotas de marcadores exactos suelen estar entre 5.00 y 20.00. EV positivo en estos mercados es raro pero cuando aparece el beneficio es alto.
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))",gap:10,marginBottom:"1.5rem"}}>
              {result.topScores.map((score,idx)=>(
                <ScoreCard key={idx} score={score} nameL={nameL} nameV={nameV}
                  cuota={scoreCuotas[idx]||""}
                  onCuotaChange={val=>updateScoreCuota(idx,val)}/>
              ))}
            </div>

            {/* Tabla de probabilidades completa */}
            <div style={card()}>
              <div style={{fontSize:11,fontWeight:600,color:C.textSec,textTransform:"uppercase",letterSpacing:"0.6px",marginBottom:10}}>Tabla completa de probabilidades (goles 0–5)</div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
                  <thead>
                    <tr>
                      <th style={{padding:"6px 8px",background:C.bgSec,color:C.textSec,fontWeight:600,textAlign:"center",border:`0.5px solid ${C.border}`}}>{nameL} \ {nameV}</th>
                      {[0,1,2,3,4,5].map(j=>(
                        <th key={j} style={{padding:"6px 8px",background:C.blueLt,color:C.blueDk,fontWeight:700,textAlign:"center",border:`0.5px solid ${C.border}`}}>{j}</th>
                      ))}
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
                          </td>);
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{display:"flex",gap:12,marginTop:8,flexWrap:"wrap",fontSize:10,color:C.textSec}}>
                <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:"#EEEDFE",display:"inline-block",borderRadius:2}}/> Top 3 más probables</span>
                <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:C.amberLt,display:"inline-block",borderRadius:2}}/> Empate</span>
                <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:"#F0FFF8",display:"inline-block",borderRadius:2}}/> Victoria local</span>
                <span style={{display:"flex",alignItems:"center",gap:4}}><span style={{width:10,height:10,background:"#FFF0F0",display:"inline-block",borderRadius:2}}/> Victoria visitante</span>
              </div>
            </div>
          </div>
        )}

        {/* Distribución Poisson */}
        <div style={{...card(),marginTop:"1.5rem",marginBottom:"1rem"}}>
          <div style={{fontSize:11,fontWeight:600,color:C.textSec,textTransform:"uppercase",letterSpacing:"0.6px",marginBottom:6}}>Distribución de Poisson — prob. goles por equipo</div>
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
          <strong>Metodología:</strong> xG con distribución de Poisson ajustado por ELO (±33% máx). Mercados individuales calculados integrando la grilla completa gol a gol hasta 9×9. EV = (prob_modelo × cuota_casa) − 1. EV &gt;5% = valor real. Tabla de marcadores muestra prob. independientes para cada resultado exacto. Herramienta académica — no es asesoramiento financiero.
        </div>
      </div>)}
    </div>
  );
}
