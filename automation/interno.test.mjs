import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateInterno,publicInternoUrl,sortedMatches,internoStandings,internoScorers} from '../assets/interno-model.js';
import {internoPanelMarkup} from '../assets/interno.js';

function tournament(){return {version:1,season:2026,categories:[{id:'masculino',name:'Masculino',points:{win:3,draw:1,loss:0}},{id:'femenino',name:'Femenino',points:{win:3,draw:1,loss:0}},{id:'mas38',name:'Masculino +38',points:null}],groups:[{id:'a',categoryId:'masculino',name:'Serie A'}],teams:[{id:'a',name:'Equipo A',categoryId:'masculino',groupId:'a'},{id:'b',name:'Equipo B',categoryId:'masculino',groupId:'a'},{id:'c',name:'Equipo C',categoryId:'masculino',groupId:'a'},{id:'f',name:'Femenino',categoryId:'femenino'}],matches:[]};}
function game(id,homeId,awayId,homeGoals,awayGoals,extra={}){return {id,categoryId:'masculino',stage:'groups',groupId:'a',homeId,awayId,status:'finished',date:'2026-11-16',homeGoals,awayGoals,...extra};}

test('datos publicados: edición 2026 válida y sin equipos de ejemplo',async()=>{
  const data=validateInterno(JSON.parse(await readFile(new URL('../data/interno.json',import.meta.url),'utf8')));
  assert.equal(data.startDate,'2026-11-16');assert.equal(data.registrationDeadline,'2026-11-09');
  for(const team of data.teams){assert.ok(team.sourceUrl);assert.doesNotMatch(team.name,/Equipo [ABC]|Ejemplo/i);}
});
test('rechaza equipos duplicados, categorías cruzadas, fechas imposibles y resultados incompletos',()=>{
  for(const mutate of [d=>d.teams.push({...d.teams[0]}),d=>d.matches.push(game('x','a','f',1,0)),d=>d.matches.push(game('x','a','b',1,null)),d=>d.matches.push(game('x','a','b',1,0,{date:'2026-02-30'})),d=>d.matches.push(game('x','a','b',1,0,{time:'24:10'}))]){
    const data=tournament();mutate(data);assert.throws(()=>validateInterno(data));
  }
});
test('fixture ordena fechas y horas, deja desconocidas al final y separa resultados',()=>{
  const d=tournament();d.matches=[game('later','a','b',0,0,{status:'scheduled',date:'2026-11-18',time:'20:00'}),game('unknown','a','b',0,0,{status:'scheduled',date:null}),game('soon','a','c',0,0,{status:'scheduled',time:'21:00'}),game('early','b','c',0,0,{status:'postponed',time:'20:00'}),game('played','a','b',1,0),game('cancel','a','b',0,0,{status:'cancelled'})];
  assert.deepEqual(sortedMatches(d,'masculino').map(m=>m.id),['early','soon','later','unknown']);
  assert.deepEqual(sortedMatches(d,'masculino',true).map(m=>m.id),['played']);
});
test('tablas cuentan solo partidos de grupo finalizados, respetan GF/GC y ajustes justificados',()=>{
  const d=tournament();d.teams[0].pointsAdjustment=-1;d.teams[0].adjustmentNote='Resolución oficial';
  d.matches=[game('one','a','b',2,0),game('two','a','c',1,1),game('future','b','c',4,0,{status:'scheduled'}),game('cup','a','b',8,0,{stage:'playoffs',groupId:null})];
  const rows=internoStandings(validateInterno(d),'masculino')[0].rows;
  assert.equal(rows[0].teamId,'a');assert.deepEqual([rows[0].played,rows[0].won,rows[0].drawn,rows[0].gf,rows[0].ga,rows[0].points],[2,1,1,3,1,3]);
  assert.equal(rows.find(r=>r.teamId==='b').played,1);
  delete d.teams[0].adjustmentNote;assert.throws(()=>validateInterno(d));
});
test('desempate por enfrentamiento directo cuando puntos, DG y GF coinciden',()=>{
  const d=tournament();d.matches=[game('ab','a','b',1,0),game('ca','c','a',1,0),game('bc','b','c',2,1),game('ac2','a','c',1,1),game('bc2','b','c',0,0)];
  const rows=internoStandings(d,'masculino')[0].rows;
  // A y B: 4 puntos, DG 0 y 2 GF; A ganó su enfrentamiento.
  assert.deepEqual(rows.slice(1).map(r=>r.teamId),['a','b']);assert.equal(rows[1].tied,false);
});
test('igualdad no resuelta comparte puesto; antes de jugar no inventa posiciones',()=>{
  const d=tournament();assert.ok(internoStandings(d,'masculino')[0].rows.every(r=>r.position===null));
  d.matches=[game('ab','a','b',1,0),game('bc','b','c',1,0),game('ca','c','a',1,0)];
  assert.ok(internoStandings(d,'masculino')[0].rows.every(r=>r.position===1&&r.tied));
  assert.equal(internoStandings(d,'mas38'),null);
});
test('doble incomparecencia no suma puntos ni goles; penales son solo de eliminatorias',()=>{
  const d=tournament();d.matches=[game('wo','a','b',0,0,{doubleForfeit:true})];
  const rows=internoStandings(validateInterno(d),'masculino')[0].rows;assert.ok(rows.every(r=>r.points===0&&r.gf===0&&r.ga===0));
  d.matches=[game('pen','a','b',1,1,{penalties:{home:3,away:2}})];assert.throws(()=>validateInterno(d));
  d.matches[0].stage='playoffs';assert.doesNotThrow(()=>validateInterno(d));
});
test('goleadores suman solo goles registrados y finalizados, sin mezclar categorías',()=>{
  const d=tournament();d.matches=[game('one','a','b',2,1,{scorers:[{player:'Ana',teamId:'a',goals:2},{player:'Juan',teamId:'b',goals:1}]}),game('two','a','c',1,0,{scorers:[{player:'ana',teamId:'a',goals:1}]}),game('future','b','c',9,0,{status:'scheduled',scorers:[{player:'Juan',teamId:'b',goals:9}]})];
  assert.deepEqual(internoScorers(validateInterno(d),'masculino').map(r=>[r.player,r.goals]),[['Ana',3],['Juan',1]]);
  assert.deepEqual(internoScorers(d,'femenino'),[]);
  d.matches[0].scorers[0].goals=3;assert.throws(()=>validateInterno(d));
});
test('nombres se muestran como texto y enlaces inseguros no se publican',()=>{
  const d=tournament();d.teams[0].name='<img src=x onerror=alert(1)>';d.teams[0].sourceUrl='javascript:alert(1)';
  assert.throws(()=>validateInterno(d));const html=internoPanelMarkup(d,'masculino','equipos');
  assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('<img src=x'));assert.ok(!html.includes('href="javascript:'));
  assert.equal(publicInternoUrl(null),null);assert.equal(publicInternoUrl(undefined),null);assert.equal(publicInternoUrl('data:text/html,x'),null);
});
test('presentación conserva local/visitante, hora y penales sin asignar canchas',()=>{
  const d=tournament();d.matches=[game('final','b','a',2,2,{stage:'playoffs',groupId:null,time:'21:30',penalties:{home:3,away:2}})];
  const html=internoPanelMarkup(validateInterno(d),'masculino','resultados');
  assert.ok(html.indexOf('Equipo B')<html.indexOf('Equipo A'));assert.match(html,/21:30 h/);assert.match(html,/Penales: 3–2/);assert.doesNotMatch(html,/confirmar|Cancha/);
  for(const category of d.categories)for(const tab of ['equipos','fixture','resultados','posiciones','goleadores'])assert.ok(internoPanelMarkup(d,category.id,tab));
});

test('grupos publicados conservan el sorteo y los reemplazos oficiales: 22 masculinos y 16 femeninos',async()=>{
  const data=validateInterno(JSON.parse(await readFile(new URL('../data/interno.json',import.meta.url),'utf8')));
  // Names can legitimately change in the official source. Keep the confirmed
  // group sizes under test without freezing a withdrawn participant forever.
  const expected={'mas-a':4,'mas-b':4,'mas-c':4,'mas-d':4,'mas-e':3,'mas-f':3,'fem-a':4,'fem-b':4,'fem-c':4,'fem-d':4};
  assert.equal(data.groups.filter(group=>group.categoryId!=='mas38').length,10);assert.equal(data.teams.length,38);
  for(const [groupId,count] of Object.entries(expected))assert.equal(data.teams.filter(team=>team.groupId===groupId).length,count);
  assert.equal(data.teams.filter(team=>team.categoryId==='masculino').length,22);
  assert.equal(data.teams.filter(team=>team.categoryId==='femenino').length,16);
  const beforePlay=structuredClone(data);beforePlay.matches=[];delete beforePlay.sourceStandings;
  for(const categoryId of ['masculino','femenino'])for(const group of internoStandings(beforePlay,categoryId))assert.ok(group.rows.every(row=>row.position===null&&row.played===0&&row.points===0));
});

test('grupos y escudos se presentan por categoría y conservan el orden de la placa',async()=>{
  const data=validateInterno(JSON.parse(await readFile(new URL('../data/interno.json',import.meta.url),'utf8')));
  const male=internoPanelMarkup(data,'masculino','grupos'),female=internoPanelMarkup(data,'femenino','grupos');
  assert.match(male,/22 equipos · 6 grupos/);assert.match(female,/16 equipos · 4 grupos/);
  assert.ok(male.indexOf('La Desidia')<male.indexOf('Kiwis'));assert.ok(male.indexOf('Kiwis')<male.indexOf('La Tropa'));
  assert.match(male,/Orleans|La Vuelta/);assert.doesNotMatch(male,/Maradoñas|Pata de Palo/);
  assert.match(female,/Dep\. Resaca/);assert.match(female,/Ramillete/);assert.doesNotMatch(female,/Orleans|La Vuelta/);
  assert.match(female,/<svg viewBox=/);assert.match(female,/<image href="https:\/\/ceibosclub.com\/assets\/interno\/grupos\/2026\/femenino.jpeg"/);
  assert.match(internoPanelMarkup(data,'mas38','grupos'),/6 equipos · 2 zonas confirmadas/);
  assert.match(internoPanelMarkup(data,'mas38','grupos'),/Nómina por anunciar/);
});

test('octavos masculinos respetan 1–16 a 8–9 y cada categoría tiene sus cruces propios',async()=>{
  const data=validateInterno(JSON.parse(await readFile(new URL('../data/interno.json',import.meta.url),'utf8')));
  assert.deepEqual(data.categories.find(category=>category.id==='masculino').format.brackets[0].pairs,[[1,16],[2,15],[3,14],[4,13],[5,12],[6,11],[7,10],[8,9]]);
  const matchesBefore=structuredClone(data.matches),male=internoPanelMarkup(data,'masculino','cruces');assert.deepEqual(data.matches,matchesBefore);
  assert.match(male,/Cuartos de Oro\/Plata/);assert.match(male,/Cuartos de Bronce/);assert.match(male,/cuando se defina ese orden/);assert.doesNotMatch(male,/Rapiñeros|Orleans|Maradoñas/);
  assert.match(internoPanelMarkup(data,'femenino','cruces'),/Cuartos · Oro\/Plata/);
  assert.doesNotMatch(internoPanelMarkup(data,'femenino','cruces'),/Octavos de final/);
  assert.match(internoPanelMarkup(data,'mas38','cruces'),/1\.º A|1\.º B/);
  assert.doesNotMatch(internoPanelMarkup(data,'mas38','cruces'),/Octavos de final|Copa Lata/);
  const invalid=structuredClone(data);invalid.categories[0].format.brackets[0].pairs[0]=[1,15];assert.throws(()=>validateInterno(invalid));
});

test('formatos confirmados reflejan los videos y no generan equipos ni fechas de fixture',async()=>{
  const data=validateInterno(JSON.parse(await readFile(new URL('../data/interno.json',import.meta.url),'utf8')));
  const [male,female,papi]=data.categories.map(category=>category.format);
  assert.deepEqual([male.teamCount,female.teamCount,papi.teamCount],[22,16,6]);
  assert.match(male.stages[1].text,/tres primeros.*dos primeros/);assert.match(male.stages[3].text,/1.º, 3.º y 5.º.*2.º, 4.º y 6.º/);
  assert.deepEqual(female.brackets.map(block=>block.pairs),[[[1,8],[2,7],[3,6],[4,5]],[[9,16],[10,15],[11,14],[12,13]]]);
  assert.match(female.stages[2].text,/evitar equipos del mismo grupo/);assert.equal(female.schedule.length,7);assert.equal(female.schedule[3].text,'Descanso');
  assert.match(female.matchesLabel,/5 partidos/);assert.match(female.stages[3].text,/seis partidos/);
  assert.deepEqual(papi.brackets[0].pairs,[['1.º A','1.º B'],['2.º A','2.º B'],['3.º A','3.º B']]);
  assert.equal(papi.schedule.length,4);assert.match(papi.stages[1].text,/tres partidos.*cada zona/);
  assert.equal(data.teams.filter(team=>team.categoryId==='mas38').length,0);assert.equal(data.categories[2].points,null);
  for(const category of data.categories){
    const before=structuredClone(data.matches),html=internoPanelMarkup(data,category.id,'cruces');
    assert.deepEqual(data.matches,before);assert.match(html,/<video controls playsinline preload="none"/);assert.doesNotMatch(html,/autoplay|<iframe/);
  }
});

test('rechaza formatos con videos inseguros, destinos inválidos y posiciones duplicadas',async()=>{
  const data=JSON.parse(await readFile(new URL('../data/interno.json',import.meta.url),'utf8'));
  for(const mutate of [format=>format.videoUrl='javascript:alert(1)',format=>format.brackets[0].destinations[0].text='',format=>format.brackets[0].pairs[0]=[1,1],format=>format.cups.push({...format.cups[0]})]){
    const invalid=structuredClone(data);mutate(invalid.categories[0].format);assert.throws(()=>validateInterno(invalid));
  }
});

test('rechaza encuadres de escudos fuera de la placa y fuentes de grupos inseguras',async()=>{
  const data=JSON.parse(await readFile(new URL('../data/interno.json',import.meta.url),'utf8'));
  for(const crop of [{x:-1},{width:0},{x:1079,width:2},{y:1349,height:2},{imageWidth:'1080'}]){
    const invalid=structuredClone(data),team=invalid.teams.find(team=>team.logoCrop);Object.assign(team.logoCrop,crop);assert.throws(()=>validateInterno(invalid));
  }
  data.groups[0].sourceUrl='javascript:alert(1)';assert.throws(()=>validateInterno(data));
});
