import test from 'node:test';import assert from 'node:assert/strict';
import {answerClubQuestion} from '../assets/club-assistant-model.js';
import {interpretMatchQuestion,resolveClubCategories} from '../assets/club-assistant-matches.js';
const now=Date.parse('2026-11-17T15:00:00Z');
const game=(fecha,gf,gc,local,rival='Rival '+fecha)=>({deporte:'futbol',categoria:'Reserva Verde',fecha,gf,gc,local,rival});
const results=[game('2026-01-10',3,1,true),game('2026-01-17',0,0,false),game('2026-02-15',0,2,true),game('2026-09-05',2,0,false),game('2026-10-10',1,2,false),game('2026-11-14',1,0,true),game('2025-12-01',4,2,true),game('2026-12-30',9,0,true),game(null,20,0,true),game('2026-03-01',null,0,true),game('2026-01-10',3,1,true),{...game('2026-01-01',99,0,true),categoria:'Reserva A'},{...game('2026-01-01',100,0,true),deporte:'hockey',categoria:'Reserva'}];
const state={sports:[{slug:'futbol',name:'Fútbol',categories:['Primera','Reserva A','Reserva Verde']},{slug:'hockey',name:'Hockey',categories:['Reserva']},{slug:'rugby',name:'Rugby',categories:['Primera']}],clubResults:results,clubResultsReady:true,clubMatches:[{deporte:'futbol',categoria:'Reserva Verde',rival:'Rival miércoles',fecha:'2026-11-18',hora:'20:00',cancha:'Cancha 4'}]};
const ask=(question,context={})=>answerClubQuestion(question,state,context,now);

test('reproduce la pregunta original con error de escritura sin confundir Reserva Verde con Hockey',()=>{
 const answer=ask('cuantos partidso gano la reserva verde este año');assert.match(answer.text,/Reserva Verde ganó 3 partidos en 2026/);assert.equal(answer.choices.length,0);assert.ok(answer.items.some(i=>i.text==='6 jugados · 3 victorias · 1 empate · 2 derrotas.'));assert.doesNotMatch(answer.text,/último|100|99/);
 assert.equal(resolveClubCategories('reserva verde',state.sports).length,1);assert.equal(resolveClubCategories('fútbol primera',state.sports)[0].sport,'futbol');
});

for(const [question,expected]of [
 ['cuantas victorias tiene reserva verde este año',/ganó 3 partidos/],
 ['cuantos partidos perdio reserva verde en 2026',/perdió 2 partidos/],
 ['cuantos empates tiene reserva verde este año',/empató 1 partido/],
 ['cuantos partidos no gano reserva verde este año',/no ganó 3 partidos/],
 ['cuantos partidos jugo reserva verde este año',/jugó 6 partidos/],
 ['porcentaje de victorias de reserva verde este año',/50%.*3 de 6/],
 ['que porcentaje de partidos perdió reserva verde este año',/33,33%.*2 de 6/],
 ['porcentaje de empates de reserva verde en 2026',/16,67%.*1 de 6/],
 ['cuantos partidos ha ganado reserva verde este año',/ganó 3 partidos/],
 ['cuantos goles hizo reserva verde en 2026',/marcó 7 goles/],
 ['cuantos goles recibio reserva verde en 2026',/recibió 5 goles/],
 ['cuantos goles hizo reserva verde en partidos ganados en 2026',/marcó 6 goles en los partidos ganados.*3 partidos registrados/],
 ['promedio de goles recibidos de reserva verde en partidos perdidos en 2026',/promedió 2 goles recibidos.*partidos perdidos/],
 ['promedio de goles a favor de reserva verde en 2026',/promedió 1,17 goles/],
 ['cuantos partidos gano reserva verde de local este año',/ganó 2 partidos.*de local/],
 ['cuantos partidos gano reserva verde de visitante este año',/ganó 1 partido.*de visitante/],
 ['cuantos partidos gano reserva verde este mes',/ganó 1 partido en noviembre de 2026/],
 ['cuantos partidos gano reserva verde en octubre',/ganó 0 partidos en octubre de 2026/],
 ['cuantos partidos gano reserva verde en 2025',/ganó 1 partido en 2025/],
 ['cuantos partidos gano reserva verde el año pasado',/ganó 1 partido en 2025/],
 ['cuantos partidos gano reserva verde entre 1\/9\/2026 y 31\/10\/2026',/ganó 1 partido del 01\/09\/2026 al 31\/10\/2026/],
 ['cuantos partidos gano reserva verde la semana pasada',/ganó 1 partido del 09\/11\/2026 al 15\/11\/2026/],
 ['cuantos gano reserva verde de los ultimos tres partidos',/ganó 2 partidos en los últimos 3/],
 ['cuantos partidos ganados consecutivos lleva reserva verde',/lleva 1 victoria consecutiva/],
 ['cuantos partidos lleva sin perder reserva verde',/lleva 1 partido sin perder/],
 ['cuantos partidos lleva sin ganar reserva verde',/lleva 0 partidos sin ganar/],
 ['ultimo resultado de reserva verde',/ganó 1–0.*14\/11\/2026/],
 ['cuanto salio reserva verde',/ganó 1–0.*14\/11\/2026/],
 ['cuanto quedó reserva verde el 10 de octubre',/perdió 1–2.*10\/10\/2026/],
 ['por cuanto perdió reserva verde el 10/10',/perdió 1–2.*10\/10\/2026/],
 ['contra quien juega reserva verde el miércoles',/Rival miércoles.*18\/11\/2026.*20:00/]
])test('interpreta: '+question,()=>assert.match(ask(question).text,expected));

test('listar victorias y últimos resultados no se reduce a un marcador',()=>{
 const wins=ask('mostrame todos los partidos ganados de reserva verde en 2026');assert.match(wins.text,/3 partidos registrados/);assert.equal(wins.items.filter(i=>i.text.includes('vs.')).length,3);
 const last=ask('mostrame los ultimos 2 resultados de reserva verde');assert.equal(last.items.filter(i=>i.text.includes('vs.')).length,2);assert.ok(last.items.some(i=>i.text.includes('14/11/2026')));assert.ok(last.items.some(i=>i.text.includes('10/10/2026')));
 const recent=ask('ultimos resultados de reserva verde');assert.equal(recent.items.filter(i=>i.text.includes('vs.')).length,5);
 const upcoming=ask('mostrame todos los próximos partidos de reserva verde');assert.ok(upcoming.items.some(i=>i.text.includes('Rival miércoles')));assert.ok(upcoming.text.includes('Próximos partidos publicados'));
 const threeWins=ask('mostrame las ultimas 3 victorias de reserva verde');assert.equal(threeWins.items.filter(i=>i.text.includes('vs.')).length,3);assert.ok(threeWins.items.some(i=>i.text.includes('10/01/2026')));
 const balance=ask('balance de reserva verde en 2026');assert.match(balance.text,/6 jugados.*3 victorias.*1 empate.*2 derrotas/);
});

test('estadísticas del Interno usan resultados finalizados y orientan el marcador al equipo consultado',()=>{
 const interno={categories:[{id:'masculino',name:'Masculino'}],groups:[],teams:[{id:'a',name:'Rapiñeros',categoryId:'masculino'},{id:'b',name:'La Vuelta',categoryId:'masculino'},{id:'c',name:'La Jeringa',categoryId:'masculino'}],matches:[{id:'one',homeId:'a',awayId:'b',categoryId:'masculino',status:'finished',homeGoals:2,awayGoals:0,date:'2026-11-16'},{id:'two',homeId:'c',awayId:'a',categoryId:'masculino',status:'finished',homeGoals:4,awayGoals:1,date:'2026-11-15'},{id:'future-score',homeId:'a',awayId:'b',categoryId:'masculino',status:'finished',homeGoals:10,awayGoals:0,date:'2026-11-18'},{id:'future',homeId:'a',awayId:'c',categoryId:'masculino',status:'scheduled',date:'2026-11-19',time:'20:00',court:'Cancha 3'}]};
 const data={sports:[],clubResults:[],clubResultsReady:true,interno},answer=answerClubQuestion('cuantos gano Rapiñeros este año',data,{},now);assert.match(answer.text,/ganó 1 partido/);assert.match(answer.items[0].text,/2 jugados.*1 victoria.*1 derrota/);
 assert.match(answerClubQuestion('cuantos goles hizo Rapiñeros este año',data,{},now).text,/marcó 3 goles/);
 assert.match(answerClubQuestion('y de visitante',data,answer.context,now).text,/ganó 0 partidos.*de visitante/);
 const prompt=answerClubQuestion('y en que cancha',data,answer.context,now);assert.equal(prompt.choices.length,2);const selected=prompt.choices[0],next=answerClubQuestion(selected.question,data,{...prompt.context,resolution:selected.resolution},now);assert.match(next.text,/19\/11\/2026.*20:00.*Cancha 3/);
});

test('fechas mensuales respetan el orden, y setiembre se reconoce como septiembre',()=>{
 assert.match(ask('cuantos gano reserva verde en setiembre').text,/ganó 1 partido en septiembre de 2026/);assert.match(ask('cuantos gano reserva verde de octubre a agosto').text,/período indicado no es válido/);
});

test('aclarar categoría por botón o escribiendo conserva contar victorias y el año',()=>{
 const original='cuantos partidos gano primera en 2025',pending=ask(original);assert.equal(pending.choices.length,2);const selection=pending.choices.find(c=>c.resolution.sport==='futbol');assert.equal(selection.question,original);
 const picked=ask(selection.question,{...pending.context,resolution:selection.resolution});assert.match(picked.text,/No tengo resultados confirmados.*2025/);assert.equal(picked.context.matchQuery.plan.operation,'count');assert.equal(picked.context.matchQuery.plan.outcome,'win');assert.equal(picked.context.matchQuery.plan.period.year,2025);
 const reserve=ask('cuantos partidos gano reserva este año');assert.equal(reserve.choices.length,3);const typed=ask('Reserva Verde',reserve.context);assert.match(typed.text,/ganó 3 partidos en 2026/);
 const football=ask('Fútbol',reserve.context);assert.equal(football.choices.length,2);assert.ok(football.choices.every(c=>c.resolution.sport==='futbol'));
});

test('repreguntas mantienen sujeto e intención y cambian solo el filtro pedido',()=>{
 const first=ask('cuantos gano reserva verde este año');assert.match(ask('y de visitante',first.context).text,/ganó 1 partido.*de visitante/);assert.match(ask('y en 2025',first.context).text,/ganó 1 partido en 2025/);assert.match(ask('y cuantos perdio',first.context).text,/perdió 2 partidos/);
 assert.match(ask('y los empates',first.context).text,/empató 1 partido/);assert.match(ask('cuantos gano en 2025',first.context).text,/ganó 1 partido en 2025/);
 const location=ask('y en que cancha',first.context);assert.equal(location.choices.length,2);assert.match(location.text,/próximo partido o del último/);
 const window=ask('cuantos ganó reserva verde de los ultimos tres partidos'),away=ask('y de visitante',window.context);assert.equal(away.context.matchQuery.plan.lastN,3);assert.match(away.text,/ganó 1 partido en los últimos 3 partidos registrados de visitante/);
 const future=ask('cuantos partidos le quedan a reserva verde este año');assert.match(future.text,/1 partido futuro publicado/);assert.match(ask('y de local',future.context).text,/0 partidos futuros publicados/);
 assert.match(ask('cuantos partidos le quedan a reserva verde contra Inventado este año').text,/No encontré el rival/);
 const goals=ask('cuantos goles hizo reserva verde en partidos ganados este año');assert.match(ask('y en los perdidos',goals.context).text,/marcó 1 gol en los partidos perdidos/);
 assert.match(ask('y cuantos goles hizo en los ganados',first.context).text,/marcó 6 goles/);
 const rate=ask('porcentaje de victorias de reserva verde');assert.match(ask('y los empates',rate.context).text,/16,67%/);assert.match(ask('y cuantos perdió',rate.context).text,/perdió 2 partidos/);
});

test('una pregunta sin sujeto pide equipo o categoría y conserva la operación al responder',()=>{
 const prompt=ask('cuantos partidos ganó este año');assert.match(prompt.text,/De qué equipo/);const answer=ask('Reserva Verde',prompt.context);assert.match(answer.text,/ganó 3 partidos en 2026/);
 assert.match(ask('como viene reserva verde este año').text,/Balance.*6 jugados.*3 victorias/);
});

test('preguntar si ganó no busca una victoria antigua: responde el resultado del partido consultado',()=>{
 assert.match(ask('¿Ganó Reserva Verde el 10/10/2026?').text,/perdió 1–2.*10\/10\/2026/);
 assert.match(ask('¿Ganó Reserva Verde el 10 de octubre de 2026?').text,/perdió 1–2.*10\/10\/2026/);
 assert.match(ask('¿Perdió Reserva Verde el 14/11/2026?').text,/ganó 1–0.*14\/11\/2026/);
 assert.match(ask('última derrota de reserva verde').text,/perdió 1–2.*10\/10\/2026/);
 assert.match(ask('última victoria de reserva verde').text,/ganó 1–0.*14\/11\/2026/);
});

test('no ignora un rival especificado y conserva la consulta al aclararlo',()=>{
 const subject=ask('cuantos partidos gano reserva verde contra Rival 2026 09 05 este año');assert.match(subject.text,/ganó 1 partido/);assert.ok(subject.text.includes('contra Rival 2026-09-05'));
 const unknown=ask('cuantos partidos gano reserva verde contra Inventado este año');assert.match(unknown.text,/No encontré el rival/);assert.doesNotMatch(unknown.text,/ganó 3 partidos/);
 const clarified=ask(unknown.choices[0].question,{...unknown.context,resolution:unknown.choices[0].resolution});assert.equal(clarified.context.matchQuery.plan.operation,'count');
 assert.equal(clarified.context.matchQuery.plan.opponent,unknown.choices[0].resolution.opponent);assert.ok(!JSON.stringify(ask('y cuantos perdió',clarified.context)).includes('Inventado'));
});

test('no contar programados, futuros, duplicados, fechas/marcadores faltantes ni resultados contradictorios',()=>{
 assert.match(ask('cuantos gano reserva verde este año').text,/ganó 3 partidos/);
 const conflicting={...state,clubResults:[...results,game('2026-01-10',0,4,true)]},answer=answerClubQuestion('cuantos gano reserva verde este año',conflicting,{},now);assert.match(answer.text,/ganó 2 partidos/);assert.match(answer.source,/1 resultados contradictorios/);
 const missing={...state,clubResults:results.map(r=>{const copy={...r};delete copy.local;return copy;})};assert.match(answerClubQuestion('cuantos gano reserva verde de visitante',missing,{},now).text,/no tienen registrada la condición/);
 assert.match(ask('cuantos gano reserva verde en agosto').text,/No tengo resultados confirmados/);assert.equal(answerClubQuestion('cuantos gano reserva verde',{...state,clubResultsReady:false},{},now).waiting,'club');
});

test('plan de consulta diferencia contar, listar y último sin depender de escribir partido perfecto',()=>{
 assert.equal(interpretMatchQuestion('cuantos partidso gano',now).operation,'count');assert.equal(interpretMatchQuestion('mostrame todos los resultados',now).operation,'list');assert.equal(interpretMatchQuestion('ultimo resultado',now).operation,'last');assert.equal(interpretMatchQuestion('cuantos campeonatos gano primera',now),null);
});
