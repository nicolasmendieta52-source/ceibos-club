import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fetchLigaFixtureIndex,mergeClubData} from './sync-club-data.mjs';
import {liga} from './sync-competition-stats.mjs';

const config=JSON.parse(fs.readFileSync(new URL('./fuentes.json',import.meta.url),'utf8'));
const source=config.sources.find(s=>s.deporte==='futbol'&&s.categoria==='Sub 18'&&s.formato==='liga-fixture-index');
const aliases=['CEIBOS CLUB'];

test('Sub 18 discovers the cup, replaces its played fixture and preserves earlier rounds',async t=>{
 assert.ok(source,'Sub 18 must follow the public Copas page');
 const paths=[];
 t.mock.method(globalThis,'fetch',async input=>{
  const url=new URL(input);paths.push(url.pathname);
  if(url.href===source.url)return new Response('<iframe src="/partidos/F181818O.html"></iframe><iframe src="/resultados/F181818O.html"></iframe>');
  if(url.pathname.endsWith('.html'))return new Response('<meta name="config-id" content="74">');
  if(url.pathname==='/config/config.json')return Response.json([{ID:'74',Temporada:'113',Deporte:'F',Torneo:'18',Categoria:'18',Serie:'18O'}]);
  if(url.pathname==='/partidos/api.php')return Response.json([{Fecha:'2026-10-25 00:00:00',Locatario:'CEIBOS CLUB',Visitante:'OLD CHRISTIANS CLUB',Cancha:'CANCHA A FIJAR'}]);
  if(url.searchParams.get('action')==='GolesVisitante')return Response.json([{Nombre:'FRANCISCO ROSSIGUOLO',minutos:'45'},{Nombre:'BENJAMIN FERNANDEZ',minutos:'60'}]);
  if(url.pathname==='/resultados/api.php')return Response.json([{ID:'103056',Fecha_Hora:'2026-10-18 15:30:00',Locatario:'MARISTAS DEPORTIVO',Visitante:'CEIBOS CLUB',GL:'4',GV:'2'}]);
  throw Error('Unexpected request '+url);
 });
 const records=(await fetchLigaFixtureIndex(source,aliases)).map(r=>({...r,fase:source.fase}));
 const previous={partidos:[{deporte:'futbol',categoria:'Sub 18',fecha:'2026-10-18',rival:'Maristas Deportivo',hora:'15:30',local:false}],resultados:[{deporte:'futbol',categoria:'Sub 18',fecha:'2026-10-11',rival:'HCA UNIVERSITARIO',gf:5,gc:5,fase:'Segunda rueda · Serie 5'}]};
 const merged=mergeClubData(previous,records,[]);
 assert.equal(merged.partidos.length,1);
 assert.equal(merged.partidos[0].rival,'OLD CHRISTIANS CLUB');
 assert.equal(merged.partidos[0].hora,'A confirmar');
 assert.equal(merged.partidos[0].local,true);
 assert.equal(merged.resultados.length,2);
 const latest=merged.resultados.at(-1);
 assert.equal(latest.fase,'Copa de Oro');assert.equal(latest.gf,2);assert.equal(latest.gc,4);
 assert.deepEqual(latest.goleadores,["FRANCISCO ROSSIGUOLO (45')","BENJAMIN FERNANDEZ (60')"]);
 assert.ok(paths.includes('/resultados/api.php'));
});

test('Sub 18 keeps series standings and adds cup standings and scorers without mixing totals',async t=>{
 const legacy=config.sources.find(s=>s.deporte==='futbol'&&s.categoria==='Sub 18'&&s.url.includes('/partidos/'));
 t.mock.method(globalThis,'fetch',async input=>{
  const url=new URL(input);
  if(url.href===source.url)return new Response('<iframe src="/posiciones/F181818O.html"></iframe><iframe src="/posiciones/F181818P.html"></iframe>');
  if(url.pathname.endsWith('.html'))return new Response(`<meta name="config-id" content="${url.pathname.includes('-52')?'series':url.pathname.includes('18P')?'75':'74'}">`);
  if(url.pathname==='/config/config.json')return Response.json([{ID:'series',Temporada:'113',Deporte:'F',Torneo:'18',Categoria:'18',Serie:'18-52'},{ID:'74',Temporada:'113',Deporte:'F',Torneo:'18',Categoria:'18',Serie:'18O'},{ID:'75',Temporada:'113',Deporte:'F',Torneo:'18',Categoria:'18',Serie:'18P'}]);
  if(url.pathname==='/posiciones/api.php')return Response.json([{Institucion:url.searchParams.get('serie')==='18P'?'OTRO CLUB':'CEIBOS CLUB',PJ:'1',PG:'0',PE:'0',PP:'1',GF:'2',GC:'4',Puntos:'0'}]);
  if(url.pathname==='/goleadores/api.php')return Response.json([{Jugador:'BENJAMIN FERNANDEZ',Institucion:'CEIBOS CLUB',goles:'1'}]);
  throw Error('Unexpected request '+url);
 });
 const tables=await liga(config,[legacy,source]);
 assert.equal(tables.length,4);
 assert.equal(new Set(tables.map(t=>t.id)).size,4);
 assert.equal(tables.filter(t=>t.title==='Copa de Oro').length,2);
 assert.equal(tables.filter(t=>t.title==='Segunda rueda · Serie 5').length,2);
 assert.ok(tables.every(t=>t.season===2026));
 assert.ok(tables.every(t=>!t.source.includes('18P')),'only the cup where Ceibos competes is published');
});
