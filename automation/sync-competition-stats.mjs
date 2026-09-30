import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const SEASON=2026;
const file=new URL('../data/competition-stats-2026.json',import.meta.url);
const clean=v=>String(v??'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/\s+/g,' ').trim();
export const isCeibos=v=>/\bceibos\b/i.test(clean(v));
const number=v=>{if(v===null||v===undefined||String(v).trim()===''||!Number.isFinite(Number(v)))throw Error('Valor estadístico inválido');return Number(v);};
const standingsColumns=['Pos.','Equipo','PJ','PG','PE','PP','GF','GC','Pts.'];
async function get(url,options={}){const r=await fetch(url,{...options,headers:{'cache-control':'no-cache',...options.headers},cache:'no-store',signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('HTTP '+r.status);return r;}
export function ligaTable(rows,kind){
 if(!Array.isArray(rows))throw Error('Tabla Liga inválida');
 return rows.map((r,i)=>({club:isCeibos(r.Institucion),values:kind==='standings'?[i+1,clean(r.Institucion),...['PJ','PG','PE','PP','GF','GC','Puntos'].map(k=>number(r[k]))]:[i+1,clean(r.Jugador),clean(r.Institucion),number(r.goles)]}));
}
export function sourceLinks(html,base,kind){return [...new Set([...html.matchAll(/<iframe\b[^>]*\bsrc=["']([^"']+)/gi)].flatMap(m=>{try{const u=new URL(m[1],base);return u.origin===new URL(base).origin&&u.pathname.startsWith('/'+kind+'/')?[u.href]:[];}catch{return [];}}))];}
const phase=serie=>/PD$/.test(serie)?'Segunda rueda · Permanencia y descenso':/(?:TA|AT|CT)$/.test(serie)?'Segunda rueda · Título y ascenso':/(?:RS|PS)[A-Z]*T$/.test(serie)?'Segunda rueda · Título':'Serie '+serie;
async function liga(config,definitions){
 const configurations=await(await get('https://ligauniversitaria.org.uy/config/config.json')).json();
 // The public League config identifies its 2026 season as 113. Never silently roll into 2027.
 const tables=[];
 for(const def of definitions){
  let links;
  if(def.formato==='liga-fixture-index')links=sourceLinks(await(await get(def.url)).text(),def.url,'posiciones');
  else links=[def.url.replace('/partidos/','/posiciones/')];
  for(const url of links){
   const html=await(await get(url)).text();const id=html.match(/name=["']config-id["']\s+content=["']([^"']+)/)?.[1];
   const c=configurations.find(c=>c.ID===id);if(!c)throw Error('Config de Liga no encontrada');if(String(c.Temporada)!=='113')continue;
   const query={temporada:c.Temporada,deporte:c.Deporte,torneo:c.Torneo,categoria:c.Categoria,serie:c.Serie};
   const api=new URL('api.php',url);api.search=new URLSearchParams({action:'cargarPosiciones',...query});
   const rows=ligaTable(await(await get(api)).json(),'standings');if(!rows.some(r=>r.club))continue;
   const base={sport:def.deporte,category:def.categoria,title:phase(c.Serie),season:SEASON,updatedAt:new Date().toISOString()};
   tables.push({...base,id:url,kind:'standings',source:url,columns:standingsColumns,rows});
   if(def.deporte==='futbol'){
    const src=url.replace('/posiciones/','/goleadores/');const api=new URL('api.php',src);api.search=new URLSearchParams({action:'cargarPartidos',...query});
    const ranks=ligaTable(await(await get(api)).json(),'scorers');
    tables.push({...base,id:src,kind:'scorers',source:src,columns:['Pos.','Jugador','Equipo','Goles'],rows:ranks});
   }
  }
 }
 return tables.filter((t,i,a)=>a.findIndex(o=>o.id===t.id)===i);
}
export function hockeySections(html,seasonHint){
 const headings=[...html.matchAll(/<h3>([\s\S]*?)<\/h3>/g)];let season=Number(seasonHint)||null;
 return headings.flatMap((m,i)=>{const title=clean(m[1]);const year=title.match(/\b20\d{2}\b/);if(year)season=Number(year[0]);if(season!==SEASON)return [];
 const block=html.slice(m.index,headings[i+1]?.index??html.length);const table=block.match(/<table[\s\S]*?<\/table>/)?.[0]||'';
 const rows=[...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(m=>[...m[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(c=>clean(c[1]))).filter(c=>c.length===9).map((c,i)=>({club:isCeibos(c[0]),values:[i+1,c[0],...c.slice(1,7).map(number),number(c[8])]}));
 const id=block.match(/cargarDatos\((\d+)\)/)?.[1];return rows.some(r=>r.club)?[{title,rows,id}]:[];
 });
}
async function hockey(source){
 const response=await get(source.url),html=await response.text();const tag=html.match(/<input[^>]*id=["']token["'][^>]*>/)?.[0];const token=tag?.match(/value=["']([^"']+)/)?.[1];
 const cookie=response.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');const tables=[];
 for(const section of hockeySections(html,source.temporada)){
  const base={sport:'hockey',category:source.categoria,title:section.title,season:SEASON,source:source.url,updatedAt:new Date().toISOString()};
  tables.push({...base,id:source.url+'#table-'+section.id,kind:'standings',columns:standingsColumns,rows:section.rows});
  if(!token||!section.id)throw Error('FUH no informa el acceso a goleadoras');
  const r=await(await get('https://admin.hockey.com.uy/torneos/data/'+section.id,{method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded','x-requested-with':'XMLHttpRequest'},body:new URLSearchParams({_token:token})})).json();
  if(r.status!==200||!Array.isArray(r.data?.scorers))throw Error('FUH goleadoras inválidas');
  const rows=r.data.scorers.map((s,i)=>({club:isCeibos(s.club),values:[i+1,clean(s.name),clean(s.club),number(s.total)]}));
  tables.push({...base,id:source.url+'#scorers-'+section.id,kind:'scorers',columns:['Pos.','Jugadora','Equipo','Goles'],rows});
 }
 return tables;
}
export function rugbyTables(data){
 if(!Array.isArray(data.competitions)||!Array.isArray(data.standings))throw Error('Tablas 50/22 inválidas');
 const tables=[];
 for(const c of data.competitions.filter(c=>String(c.season)==='2026')){
  const category=/Top 12|Primera/i.test(c.category)?'Primera':c.category==='Intermedia'?'Intermedia':c.category==='M19'?'M19':null;if(!category)continue;
  const standings=data.standings.filter(s=>s.competition_id===c.id);
  for(const group of new Set(standings.filter(s=>isCeibos(s.club_name)).map(s=>s.group_name||''))){
   const rows=standings.filter(s=>(s.group_name||'')===group).sort((a,b)=>number(a.sort_order)-number(b.sort_order)).map((s,i)=>({club:isCeibos(s.club_name),values:[i+1,clean(s.club_name),...['played','won','drawn','lost','points_for','points_against','bonus_points','total_points'].map(k=>number(s[k]))]}));
   tables.push({id:'rugby-'+c.id+'-'+group,sport:'rugby',category,season:SEASON,kind:'standings',title:clean(c.name)+(group?' · '+group:''),source:'https://50-22.base44.app',columns:['Pos.','Equipo','PJ','PG','PE','PP','PF','PC','Bonus','Pts.'],rows,updatedAt:new Date().toISOString()});
  }
 }
 const cats=(data.statsCategories||[]).filter(c=>c.published===true&&c.year===2026&&c.subject_type==='player'&&['points','tries'].includes(c.unit)&&/top.?12/i.test((c.article_title||'')+' '+(c.article_url||'')+' '+((data.news||[]).find(n=>n.external_id===c.article_url||n.external_url===c.article_url)?.content||''))).sort((a,b)=>String(b.published_date).localeCompare(String(a.published_date))||String(b.updated_date).localeCompare(String(a.updated_date)));
 const seen=new Set();for(const c of cats){const key=c.tournament+'|'+c.unit;if(seen.has(key))continue;seen.add(key);
 const rows=(data.statsEntries||[]).filter(s=>s.category_id===c.id).sort((a,b)=>number(a.position)-number(b.position)).map((s,i)=>({club:isCeibos(s.club),values:[i+1,clean(s.name),clean(s.club),number(s.value)]}));
 tables.push({id:'rugby-scorers-'+key,sport:'rugby',category:'Primera',season:SEASON,kind:'scorers',title:c.tournament+' · '+c.title,source:c.article_url,sourceDate:c.published_date,columns:['Pos.','Jugador','Equipo',c.unit==='points'?'Puntos':'Tries'],rows,updatedAt:new Date().toISOString()});
 }
 return tables;
}
export async function syncStats(){
 const config=JSON.parse(await fs.readFile(new URL('./fuentes.json',import.meta.url),'utf8'));
 const previous=JSON.parse(await fs.readFile(file,'utf8').catch(()=>'{}'));const tables=[],diagnostics=[];
 const jobs=[];
 const indexes=config.sources.filter(s=>s.formato==='liga-fixture-index');
 for(const s of indexes)jobs.push({key:s.deporte+'|'+s.categoria,run:()=>liga(config,[s])});
 for(const cat of ['Sub 18','Basketball']){const defs=config.sources.filter(s=>s.categoria===cat&&s.url.includes('ligauniversitaria.org.uy/partidos/'));jobs.push({key:defs[0].deporte+'|'+cat,run:()=>liga(config,defs)});}
 for(const s of config.sources.filter(s=>s.formato==='hockey-admin'))jobs.push({key:'hockey|'+s.categoria,run:()=>hockey(s)});
 jobs.push({key:'rugby',run:async()=>rugbyTables(await(await get('https://50-22.base44.app/functions/getPublicContent',{method:'POST',headers:{'content-type':'application/json'},body:'{}'})).json())});
 for(const job of jobs){try{const rows=await job.run();if(!rows.length)throw Error('Sin tablas de Ceibos para 2026');tables.push(...rows.map(t=>({...t,sourceKey:job.key})));diagnostics.push({source:job.key,status:'ok',tables:rows.length});console.log(job.key,rows.length,'tablas');}catch(e){tables.push(...(previous.tables||[]).filter(t=>t.sourceKey===job.key).map(t=>({...t,stale:true})));diagnostics.push({source:job.key,status:'error',message:e.message});console.error(job.key,e.message);}}
 if(!diagnostics.some(d=>d.status==='ok'))throw Error('Ninguna fuente de estadísticas respondió; se conserva el archivo anterior');
 await fs.writeFile(file,JSON.stringify({season:SEASON,checkedAt:new Date().toISOString(),tables,diagnostics},null,2)+'\n');
 if(diagnostics.some(d=>d.status==='error'))process.exitCode=1;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))syncStats().catch(e=>{console.error(e.message);process.exitCode=1;});
