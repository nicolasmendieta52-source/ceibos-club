import test from 'node:test';import assert from 'node:assert/strict';
import {answerClubConversation} from '../assets/club-assistant-conversation.js';
import {normalizeClubQuestion,teamCandidates} from '../assets/club-assistant-language.js';
const now=Date.parse('2026-11-17T15:00:00Z');
const categories=[{id:'masculino',name:'Masculino',minutesPerHalf:25,points:{win:3,draw:1,loss:0}},{id:'femenino',name:'Femenino',minutesPerHalf:20,points:{win:3,draw:1,loss:0}},{id:'mas38',name:'Papi fútbol (+38)',minutesPerHalf:25,points:null}];
const teams=[['rapi','Rapiñeros','masculino','mas-c'],['jeringa','La Jeringa','masculino','mas-c'],['vuelta','La Vuelta','masculino','mas-c'],['city','Manchester City','mas38','papi-a'],['united','Manchester United','mas38','papi-b'],['birra','Manchester Birraited','femenino','fem-c'],['maradonas','Maradoñas','femenino','fem-a'],['rejunte','Rejunte FC','femenino','fem-a']].map(([id,name,categoryId,groupId])=>({id,name,categoryId,groupId}));
const groups=[['mas-c','Grupo C','masculino'],['fem-c','Grupo C','femenino'],['fem-a','Grupo A','femenino'],['papi-a','Zona A','mas38'],['papi-b','Zona B','mas38']].map(([id,name,categoryId])=>({id,name,categoryId}));
const match=(id,homeId,awayId,date,time,court,status='scheduled',extra={})=>({id,homeId,awayId,date,time,court,status,categoryId:teams.find(t=>t.id===homeId).categoryId,groupId:teams.find(t=>t.id===homeId).groupId,stage:'groups',...extra});
const interno={categories,teams,groups,matches:[match('one','rapi','vuelta','2026-11-16','20:00','Cancha 1','finished',{homeGoals:1,awayGoals:0,scorers:[{teamId:'rapi',player:'Juan Pérez',goals:1}]}),match('two','rapi','jeringa','2026-11-18','20:00','Cancha 5'),match('female','maradonas','rejunte','2026-11-18','18:00','Cancha 10'),match('city-next','city','united','2026-11-23','21:00','Cancha 6')],sourceInfo:{checkedAt:'2026-11-17T14:00:00Z'}};
const columns=['Pos.','Equipo','PJ','PG','PE','PP','GF','GC','Pts.'];
const standings=(title,points,pos=3)=>({sport:'futbol',category:'Reserva Verde',season:2026,kind:'standings',title,columns,rows:[{club:false,values:[1,'RIVAL',10,10,0,0,80,0,99]},{club:true,values:[pos,'CEIBOS',10,5,2,3,15,12,points]}],updatedAt:'2026-11-16T12:00:00Z'});
const state={interno,sports:[{slug:'futbol',name:'Fútbol',categories:['Primera','Reserva A','Reserva Verde']},{slug:'hockey',name:'Hockey',categories:['Reserva','Primera']},{slug:'rugby',name:'Rugby',categories:['Primera','M19']},{slug:'basketball',name:'Basketball',categories:['Basketball']}],tablesReady:true,tables:[standings('Primera rueda',17),standings('Segunda rueda',7,2),{sport:'futbol',category:'Reserva Verde',season:2026,kind:'scorers',title:'Goleadores',columns:['Pos.','Jugador','Equipo','Goles'],rows:[{club:false,values:[1,'Rival goleador','RIVAL',99]},{club:true,values:[3,'Nicolás Ruiz','CEIBOS',4]}],updatedAt:'2026-11-16T12:00:00Z'}],clubResultsReady:true,clubResults:[{deporte:'futbol',categoria:'Reserva Verde',rival:'Rival 1',fecha:'2026-11-14',gf:2,gc:0},{deporte:'futbol',categoria:'Reserva Verde',rival:'Rival 2',fecha:'2026-10-10',gf:0,gc:1},{deporte:'futbol',categoria:'Reserva A',rival:'Rival 3',fecha:'2026-10-11',gf:3,gc:1}],clubMatches:[{deporte:'futbol',categoria:'Reserva Verde',rival:'Próximo rival',fecha:'2026-11-18',hora:'21:00',cancha:'Casuarinas'}],gym:{goal:225000,raised:145440,brickCount:100,occupied:58,status:'live',checkedAt:'2026-11-17T14:00:00Z'},events:[{titulo:'CMC',fecha:'2026-11-26',desc:'Cena Mensual de Ceibos.'},{titulo:'Cena Ceibos',fecha:'2026-12-19',desc:'Agendá el 19 de diciembre.'}],facts:[{title:'Historia del club',text:'Ceibos nació el 25 de enero de 2014.',href:'#club'},{title:'Tienda oficial',text:'La indumentaria oficial de Ceibos se consigue en la tienda de Bulk.',href:'#shop'},{title:'Dirección',text:'Camino de los Gigantes, Montevideo.',href:'#predio',keywords:'ubicacion direccion llegar'},{title:'Fútbol Reserva Verde',text:'Pos.: 1 · Equipo: RIVAL · Puntos: 99',href:'#futbol',table:true}]};
const ask=(q,context={},data=state)=>answerClubConversation(q,data,context,now);
const choose=(answer,name)=>{const c=answer.choices.find(c=>c.label.includes(name));assert.ok(c,'choice '+name);return ask(c.question,{...answer.context,...(c.resolution?{resolution:c.resolution}:{})});};

test('posiciones y puntos leen exclusivamente las filas de Ceibos y distinguen fases',()=>{
 for(const q of ['cuántos puntos tiene Reserva Verde','en qué posición está Reserva Verde','tabla de Reserva Verde']){const a=ask(q);assert.match(a.text,/17 puntos/);assert.match(a.text,/7 puntos/);assert.doesNotMatch(a.text,/99|Rival goleador|Nicolás/);assert.match(a.text,/Cada fase/);}
 assert.match(ask('quién va primero en la tabla de Reserva Verde').text,/RIVAL tiene 99 puntos/);
 const old=ask('cuántos puntos tiene Reserva Verde en 2025');assert.match(old.text,/No hay.*2025/);assert.doesNotMatch(old.text,/17 puntos/);
 assert.match(ask('cuántos puntos tenía Reserva Verde el año pasado').text,/No hay.*2025/);assert.match(ask('cuántos puntos tenía Reserva Verde en octubre').text,/No hay una tabla histórica/);
});

test('goleador del equipo se diferencia del goleador del campeonato',()=>{
 assert.match(ask('quién es el goleador de Reserva Verde').text,/Nicolás Ruiz · 4 goles/);assert.doesNotMatch(ask('quién es el goleador de Reserva Verde').text,/99|Rival goleador/);
 assert.match(ask('quién es el goleador del campeonato de Reserva Verde').text,/Rival goleador · 99 goles/);
 const none=structuredClone(state);none.tables[2].rows=none.tables[2].rows.filter(r=>!r.club);assert.match(ask('goleador de Reserva Verde',{},none).text,/no publica goleadores/);
});

test('categorías ambiguas de tablas conservan la consulta al aclarar por botón o texto',()=>{
 const a=ask('cuántos puntos tiene reserva');assert.ok(a.choices.length>=3);assert.match(choose(a,'Reserva Verde').text,/17 puntos/);assert.match(ask('Reserva Verde',a.context).text,/17 puntos/);
});

test('grupos del Interno muestran equipos y piden categoría cuando la letra se repite',()=>{
 const a=ask('quiénes están en el grupo C del Interno masculino');assert.match(a.text,/Rapiñeros.*La Jeringa.*La Vuelta/);assert.doesNotMatch(a.text,/octavos|copas|Manchester/);
 const ambiguous=ask('qué equipos hay en el grupo C del Interno');assert.equal(ambiguous.choices.length,3);assert.match(choose(ambiguous,'Femenino').text,/Manchester Birraited/);assert.doesNotMatch(choose(ambiguous,'Femenino').text,/Rapiñeros/);
 assert.match(ask('cuántos equipos tiene el Interno').text,/8 equipos/);assert.match(ask('cuántos equipos hay en el grupo C del Interno masculino').text,/3 equipos/);
 assert.match(ask('quiénes están en el grupo Z del Interno masculino').text,/No hay un grupo Z/);
 assert.match(ask('cuántos grupos tiene el Interno').text,/5 grupos/);assert.match(ask('cuántos grupos tiene el Interno femenino').text,/2 grupos/);
});

test('tablas, puntos y goleadores del Interno usan su fuente específica',()=>{
 assert.match(ask('cuántos puntos tiene Rapiñeros').text,/3 puntos/);assert.match(ask('tabla del grupo C del Interno masculino').text,/Rapiñeros.*3 puntos/);assert.match(ask('quién es el goleador de Rapiñeros').text,/Juan Pérez.*1 goles/);
 assert.match(ask('tabla del Interno papi').text,/No hay una tabla confirmada/);
});

test('el fixture semanal incluye cada día y no se limita a la primera fecha',()=>{
 const a=ask('qué partidos hay en el Interno esta semana');assert.match(a.text,/: 3/);assert.ok(a.items.some(i=>i.text.includes('lunes 16')));assert.ok(a.items.some(i=>i.text.includes('miércoles 18')));assert.ok(a.items.some(i=>i.text.includes('Finalizado 1–0')));assert.ok(!a.items.some(i=>i.text.includes('lunes 23')));
 const next=ask('próximos partidos del Interno esta semana');assert.match(next.text,/: 2/);assert.ok(!next.items.some(i=>i.text.includes('Finalizado')));
 const pair=ask('cómo salió Rapiñeros contra La Vuelta');assert.match(pair.text,/Rapiñeros vs. La Vuelta: 1–0/);assert.equal(pair.choices.length,0);
});

test('aclarar Manchester no cambia mañana por el siguiente partido disponible',()=>{
 const a=ask('contra quién juega Manchester mañana');assert.equal(a.choices.length,3);const city=ask('City',a.context);assert.match(city.text,/No tengo un partido confirmado.*18 de noviembre/);assert.doesNotMatch(city.text,/23 de noviembre|Cancha 6/);
 const button=choose(a,'Manchester City');assert.match(button.text,/18 de noviembre/);
});

test('errores de escritura de equipos se confirman sin perder la operación ni la fecha',()=>{
 const a=ask('contra quién juega Rapineors el miércoles');assert.equal(a.choices.length,1);assert.match(choose(a,'Rapiñeros').text,/La Jeringa.*18 de noviembre.*20:00.*Cancha 5/);
 assert.match(ask('contra quién juega Rapi el miércoles').text,/La Jeringa/);assert.equal(teamCandidates('cuánto falta para la meta',interno).teams.length,0);
 assert.equal(normalizeClubQuestion('Che, cuantos partidso gano?'),'cuantos partidos gano?');assert.ok(normalizeClubQuestion('el 18/11/2026').includes('18/11/2026'));
 const data=structuredClone(state);data.interno.teams.push({id:'fecha',name:'La Fecha',categoryId:'masculino',groupId:'mas-c'});assert.match(ask('cuál es la fecha del próximo partido de Rapiñeros',{},data).text,/La Jeringa.*18 de noviembre/);
});

test('el contexto permite repreguntar por el Gym y cambiar luego de tema',()=>{
 const a=ask('cuánto recaudó el Gym'),b=ask('y cuánto falta',a.context);assert.match(b.text,/79.560/);assert.doesNotMatch(b.text,/Alta Gama|Qué equipo/);
 assert.match(ask('y qué porcentaje',a.context).text,/64,64%/);assert.match(ask('y cómo colaboro',a.context).text,/formulario/);
 const sport=ask('contra quién juega Rapiñeros el miércoles',a.context);assert.match(sport.text,/La Jeringa/);assert.doesNotMatch(sport.text,/145.440/);
});

test('corregir categoría conserva el conteo solicitado y el año',()=>{
 const a=ask('cuántos partidos ganó Reserva Verde en 2026');assert.match(a.text,/ganó 1 partido/);assert.match(ask('no, la Reserva A',a.context).text,/Reserva A ganó 1 partido en 2026/);
 const old=ask('cuántos partidos ganó Reserva Verde en 2025');assert.match(ask('no, la Reserva A',old.context).text,/No tengo resultados confirmados.*2025/);
 const fixture=ask('contra quién juega Rapiñeros el lunes');assert.match(ask('no, el miércoles',fixture.context).text,/La Jeringa.*18 de noviembre/);
 assert.match(ask('no, en 2025',a.context).text,/No tengo resultados confirmados.*2025/);
 const data=structuredClone(state);data.clubResults[0].local=true;data.clubResults[1].local=false;const home=ask('cuántos partidos ganó Reserva Verde este año',{},data);assert.match(ask('no, de visitante',home.context,data).text,/ganó 0 partidos.*de visitante/);
});

test('datos no publicados no se sustituyen por información de otro atributo',()=>{
 for(const q of ['cuánto cuesta Cena Ceibos','precio de la Cena Ceibos']){const a=ask(q);assert.match(a.text,/precio.*no está publicado/i);assert.doesNotMatch(a.text,/es el sábado/);}
 assert.match(ask('dónde es Cena Ceibos').text,/lugar.*no está confirmado/);assert.match(ask('a qué hora es Cena Ceibos').text,/horario.*no está confirmado/);
 const event=ask('cuándo es Cena Ceibos');assert.match(ask('y dónde es',event.context).text,/lugar.*no está confirmado/);
 assert.match(ask('cuándo inauguran el gimnasio').text,/No hay una fecha de inauguración/);assert.match(ask('a qué hora entrena Reserva Verde').text,/No encontré ese dato confirmado/);
 const shop=ask('dónde comprar ropa de Ceibos');assert.match(ask('y qué talles hay',shop.context).text,/No encontré ese dato confirmado/);
});

test('una respuesta incorrecta se puede reformular sin perder el tema',()=>{
 const a=ask('contra quién juega Rapiñeros el miércoles'),b=ask('no me entendiste',a.context);assert.match(b.text,/Qué querías saber de Rapiñeros/);assert.equal(b.choices.length,3);assert.match(choose(b,'Último resultado').text,/1–0/);assert.ok(b.repair);
 const gym=ask('cuánto recaudó el Gym'),fix=ask('eso no',gym.context);assert.match(fix.text,/Qué querías saber del Gym/);assert.match(choose(fix,'Cuánto falta').text,/79.560/);
});

test('agradecimientos y ayuda no se interpretan como nombres de equipos',()=>{
 const context=ask('contra quién juega Rapiñeros').context;for(const text of ['gracias','muchas gracias','perfecto'])assert.match(ask(text,context).text,/De nada/);
 const help=ask('qué puedo consultar');assert.ok(help.choices.some(c=>c.label==='Deportes y categorías'));
 assert.match(ask('cuántos años tiene Ceibos').text,/12 años.*25 de enero de 2014/);
 const thanks=ask('gracias',ask('cuánto recaudó el Gym').context);assert.match(ask('y cuánto falta',thanks.context).text,/79.560/);assert.match(ask('y cuánto falta').text,/Sobre qué equipo o tema/);
 assert.match(ask('qué deportes hay en Ceibos').text,/Fútbol.*Hockey.*Rugby.*Basketball/);
});

test('las fuentes conservan su fecha y advierten cuando se usa una tabla anterior',()=>{
 const data=structuredClone(state);data.tables[0].stale=true;data.tables[0].note='ADIC también registra partidos de otros años.';const a=ask('cuántos puntos tiene Reserva Verde',{},data);assert.match(a.source,/No se pudo verificar/);assert.match(a.source,/16\/11\/26/);assert.match(a.source,/otros años/);
});

test('las repreguntas de tablas y grupos conservan el atributo pedido',()=>{
 const table=ask('cuántos puntos tiene Reserva Verde');assert.match(ask('y en 2025',table.context).text,/No hay.*2025/);assert.match(ask('y de visitante',table.context).text,/no ofrece un desglose/);
 const group=ask('quiénes están en el grupo C del Interno masculino');assert.match(ask('y femenino',group.context).text,/Manchester Birraited/);assert.doesNotMatch(ask('y femenino',group.context).text,/Rapiñeros/);
});

test('dos preguntas explícitas se responden sin omitir la segunda',()=>{
 const a=ask('¿Cuánto recaudó el Gym? ¿Contra quién juega Rapiñeros el miércoles?');assert.match(a.text,/145.440/);assert.match(a.text,/La Jeringa.*20:00/);assert.ok(a.items.some(i=>i.href==='#gym-campaign'));assert.ok(a.items.some(i=>i.href.includes('#interno')));
 assert.match(ask('¿Cuánto recaudó el Gym? ¿Y cuánto falta?').text,/145.440.*\n\n.*79.560/);
});

test('puntos anotados de basket se calculan como marcadores y no como puntos de la tabla',()=>{
 const data=structuredClone(state);data.clubResults.push({deporte:'Basketball',categoria:'Basketball',rival:'Náutico',fecha:'2026-10-24',gf:72,gc:64});
 assert.match(ask('cuántos puntos anotó basket este año',{},data).text,/marcó 72 puntos/);assert.match(ask('cuántos puntos recibió basket este año',{},data).text,/recibió 64 puntos/);
});

test('una fecha inválida o un período invertido no se ignoran para dar otro resultado',()=>{
 assert.match(ask('cómo salió Rapiñeros contra La Vuelta el 31/11/2026').text,/fecha no es válida/);
 assert.match(ask('cuántos puntos tenía Reserva Verde entre 20/11/2026 y 10/11/2026').text,/período indicado no es válido/);
});

test('consultar partidos en vivo conserva el tablero y su reloj estimado',()=>{
 assert.match(ask('qué partidos se juegan ahora en el Interno').text,/Ahora no hay partidos en horario de juego/);
 const live=answerClubConversation('qué partidos se juegan ahora en el Interno',state,{},Date.parse('2026-11-18T23:10:00Z'));assert.match(live.text,/Hay 1 partido.*reloj es estimado/);assert.ok(live.items.some(i=>i.text.includes('La Jeringa')&&i.text.includes('10:00')));
});
