import test from 'node:test';
import assert from 'node:assert/strict';
import {fetchLigaFixtureIndex,parseLigaResultsApi,mergeClubData} from './sync-club-data.mjs';

const source={deporte:'basketball',categoria:'Basketball',temporada:'2026',url:'https://ligauniversitaria.org.uy/estadisticas-basquetbol-b/'};
const aliases=['CEIBOS CLUB'];

test('basket discovers new playoff phases, reads scores without requesting football scorers, and keeps home/away',async t=>{
  const requests=[];
  t.mock.method(globalThis,'fetch',async input=>{
    const url=new URL(input);requests.push(url);
    if(url.pathname==='/estadisticas-basquetbol-b/')return new Response(`<iframe src="/resultados/B221B4B.html"></iframe><iframe src="/partidos/B221B4B.html"></iframe>`);
    if(url.pathname.endsWith('.html'))return new Response('<meta name="config-id" content="162">');
    if(url.pathname==='/config/config.json')return Response.json([{ID:'162',Temporada:'113',Deporte:'B',Torneo:'22',Categoria:'1',Serie:'B4B'}]);
    assert.equal(url.searchParams.get('action'),'cargarPartidos','basket must not query GolesLocatario/GolesVisitante');
    if(url.pathname==='/resultados/api.php')return Response.json([{ID:'10',Fecha_Hora:'2026-10-10 17:30:00',Locatario:'CEIBOS CLUB',Visitante:'UNIVERSIDAD DE MONTEVIDEO',GL:'73',GV:'64'}]);
    if(url.pathname==='/partidos/api.php')return Response.json([{Fecha:'2026-10-17 19:45:00',Locatario:'UNIVERSIDAD DE MONTEVIDEO',Visitante:'CEIBOS CLUB',Cancha:'G. TROUVILLE'}]);
    throw Error('Unexpected request '+url);
  });
  const records=await fetchLigaFixtureIndex(source,aliases);
  const output=mergeClubData({partidos:[],resultados:[{deporte:'basketball',categoria:'Basketball',fecha:'2026-09-24',rival:'ORT BLANCO',gf:52,gc:56}]},records,[]);
  assert.equal(output.resultados.at(-1).fecha,'2026-10-10');
  assert.equal(output.resultados.at(-1).gf,73);assert.equal(output.resultados.at(-1).gc,64);
  assert.equal(output.partidos[0].local,false);assert.equal(output.partidos[0].hora,'19:45');
  assert.equal(output.resultados.length,2,'retain previous season results');
  assert.equal(requests.filter(u=>u.pathname==='/resultados/api.php').length,1);
});

test('basket ignores empty, unplayed 0-0 and other seasons; it accepts a 20-0 forfeit',()=>{
 const base={Fecha_Hora:'2026-10-10 17:30:00',Locatario:'CEIBOS CLUB',Visitante:'Rival'};
 const rows=[{...base,GL:null,GV:null},{...base,GL:'',GV:''},{...base,GL:'0',GV:'0'},
 {...base,Fecha_Hora:'2025-10-10 17:30:00',GL:'73',GV:'64'},
 {...base,GL:'20',GV:'0'}];
 const records=parseLigaResultsApi(rows,source,aliases);
 assert.equal(records.length,1);assert.equal(records[0].gf,20);assert.equal(records[0].gc,0);
});

test('el 72-64 ante Náutico confirmado por el club no desaparece con una fuente atrasada',()=>{
 const confirmed={deporte:'basketball',categoria:'Basketball',fecha:'2026-10-24',rival:'CLUB NAUTICO',gf:72,gc:64,confirmadoPorClub:true,confirmadoEl:'2026-10-27'};
 const earlier={...confirmed,fecha:'2026-10-19',rival:'UNIVERSIDAD DE MONTEVIDEO',gf:62,gc:36,confirmadoPorClub:undefined,confirmadoEl:undefined};
 const pending={kind:'partido',deporte:'basketball',categoria:'Basketball',fecha:'2026-10-24',rival:'NÁUTICO CARRASCO Y PUNTA GORDA',hora:'19:15',local:false};
 const output=mergeClubData({partidos:[],resultados:[earlier,confirmed]},[pending],[{...confirmed,kind:'resultado',gf:70,confirmadoPorClub:undefined}]);
 assert.equal(output.resultados.length,2);assert.equal(output.partidos.length,0);
 assert.equal(output.resultados.at(-1).gf,72);assert.equal(output.resultados.at(-1).gc,64);
 assert.equal(output.resultados.at(-1).confirmadoPorClub,true);assert.equal(output.resultados.at(-1).confirmadoEl,'2026-10-27');
 assert.deepEqual(mergeClubData(output,[],[]),output,'las revisiones posteriores no duplican ni pierden la confirmación');
 const released={...confirmed};delete released.confirmadoPorClub;
 const corrected=mergeClubData({resultados:[released]},[{...confirmed,kind:'resultado',gf:73,confirmadoPorClub:undefined}],[]);
 assert.equal(corrected.resultados[0].gf,73,'al retirar la confirmación vuelve a prevalecer la federación');
});

test('un 404 de una llave ajena no bloquea la Copa de Ceibos; un 404 en su propia llave sí falla', async t=>{
  let ceibosInMissing=false;
  t.mock.method(globalThis,'fetch',async input=>{
    const url=new URL(input);
    if(url.pathname==='/estadisticas-basquetbol-b/')return new Response(`<h2>Play Off · Título</h2><p>${ceibosInMissing?'Ceibos':'Reducto'}</p><iframe src="https://ligauniversitaria.org.uy/partidos/B221B5A.html"></iframe><h2>Copa de Plata</h2><p>Ceibos</p><iframe src="https://ligauniversitaria.org.uy/resultados/B221B4B.html"></iframe><iframe src="https://ligauniversitaria.org.uy/partidos/B221B4B.html"></iframe>`);
    if(url.pathname.endsWith('B221B5A.html'))return new Response('',{status:404});
    if(url.pathname.endsWith('.html'))return new Response('<meta name="config-id" content="162">');
    if(url.pathname==='/config/config.json')return Response.json([{ID:'162',Temporada:'113',Deporte:'B',Torneo:'22',Categoria:'1',Serie:'B4B'}]);
    if(url.pathname==='/resultados/api.php')return Response.json([{ID:'20',Fecha_Hora:'2026-10-19 20:00:00',Locatario:'CEIBOS CLUB',Visitante:'UNIVERSIDAD DE MONTEVIDEO',GL:'62',GV:'36'}]);
    if(url.pathname==='/partidos/api.php')return Response.json([]);
    throw Error('Unexpected '+url);
  });
  const records=await fetchLigaFixtureIndex(source,aliases);
  assert.equal(records.length,1);assert.equal(records[0].gf,62);
  ceibosInMissing=true;
  await assert.rejects(fetchLigaFixtureIndex(source,aliases),/HTTP 404/);
});
