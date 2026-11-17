import test from 'node:test';import assert from 'node:assert/strict';
import {answerClubQuestion,questionDate,clubToday} from '../assets/club-assistant-model.js';import {retrieveClubFacts} from '../assets/club-assistant-facts.js';
const now=Date.parse('2026-11-17T15:00:00Z');
const interno={categories:[{id:'masculino',name:'Masculino',minutesPerHalf:25,points:{win:3,draw:1,loss:0}},{id:'femenino',name:'Femenino',minutesPerHalf:20,points:{win:3,draw:1,loss:0}},{id:'mas38',name:'Papi fútbol (+38)',minutesPerHalf:25,points:null}],groups:[{id:'mas-c',categoryId:'masculino',name:'Grupo C'}],teams:[{id:'rapineros',name:'Rapiñeros',categoryId:'masculino',groupId:'mas-c'},{id:'la-vuelta',name:'La Vuelta',categoryId:'masculino',groupId:'mas-c'},{id:'la-jeringa',name:'La Jeringa',categoryId:'masculino',groupId:'mas-c'},{id:'fishermans',name:'Los Fishermans',categoryId:'masculino',groupId:'mas-c'},{id:'city',name:'Manchester City',categoryId:'mas38'},{id:'united',name:'Manchester United',categoryId:'mas38'},{id:'birraited',name:'Manchester Birraited',categoryId:'femenino'}],matches:[{id:'rapi-previo',categoryId:'masculino',homeId:'rapineros',awayId:'la-vuelta',groupId:'mas-c',stage:'groups',status:'finished',date:'2026-11-16',time:'20:00',court:'Cancha 1',homeGoals:1,awayGoals:0},{id:'rapi-miercoles',categoryId:'masculino',homeId:'rapineros',awayId:'la-jeringa',groupId:'mas-c',stage:'groups',status:'scheduled',date:'2026-11-18',time:'20:00',court:'Cancha 5'},{id:'rapi-lunes',categoryId:'masculino',homeId:'rapineros',awayId:'fishermans',groupId:'mas-c',stage:'groups',status:'scheduled',date:'2026-11-23',time:'22:00',court:'Cancha 1'}],sourceInfo:{checkedAt:'2026-11-17T14:00:00Z'}};
const facts=[{title:'Historia del club',text:'Nació el 25 de enero de 2014 y desde entonces no paró de crecer.',href:'#club'},{title:'Tienda oficial',text:'Encontrá la indumentaria oficial de Ceibos, disponible durante todo el año en la tienda de Bulk.',href:'#shop'},{title:'El club',text:'Nuestro lema, Totus Tuus («todo tuyo»), resume el espíritu del club.',href:'#club'}];
const state={interno,facts,sports:[{slug:'rugby',name:'Rugby',categories:['Primera','M19']},{slug:'futbol',name:'Fútbol',categories:['Primera','Sub 18']},{slug:'basketball',name:'Basketball',categories:['Basketball','Divisional B']}],clubResults:[{deporte:'Basketball',categoria:'Basketball',rival:'Náutico',fecha:'2026-10-24',gf:72,gc:64}],events:[{fecha:'2026-11-26',titulo:'CMC',desc:'Cena Mensual de Ceibos.'},{fecha:'2026-12-19',titulo:'Cena Ceibos',desc:'Agendá el 19 de diciembre.'}],gym:{goal:225000,raised:151000,status:'live',checkedAt:'2026-11-17T14:59:00Z'}};
const ask=(q,context={})=>answerClubQuestion(q,state,context,now);
test('fechas relativas usan Uruguay incluso cerca de medianoche y validan las fechas explícitas',()=>{
 assert.equal(clubToday(Date.parse('2026-11-17T02:30:00Z')),'2026-11-16');
 assert.deepEqual(questionDate('el miércoles',now),{date:'2026-11-18'});assert.deepEqual(questionDate('mañana',now),{date:'2026-11-18'});assert.deepEqual(questionDate('pasado mañana',now),{date:'2026-11-19'});assert.deepEqual(questionDate('ayer',now),{date:'2026-11-16'});
 assert.deepEqual(questionDate('miércoles pasado',now),{date:'2026-11-11'});assert.deepEqual(questionDate('18/11',now),{date:'2026-11-18'});assert.equal(questionDate('31/02/2026',now).invalid,true);
});
test('la pregunta del usuario responde rival, fecha, horario y cancha reales y conserva contexto',()=>{
 const answer=ask('¿Contra quién juega Rapiñeros el miércoles?');assert.match(answer.text,/La Jeringa/);assert.match(answer.text,/miércoles 18 de noviembre/);assert.match(answer.text,/20:00 h/);assert.match(answer.text,/Cancha 5/);assert.doesNotMatch(answer.text,/La Vuelta/);assert.match(answer.items[0].href,/internoPartido=/);
 const follow=ask('¿Y en qué cancha?',answer.context);assert.match(follow.text,/Cancha 5/);assert.equal(follow.context.matchId,answer.context.matchId);
 const next=ask('¿Contra quién juega Rapiñeros?');assert.match(next.text,/La Jeringa/);assert.doesNotMatch(next.text,/16 de noviembre/);
});
test('sin partido o resultado publicado lo aclara y nunca inventa cero a cero ni una hora',()=>{
 assert.match(ask('Rapiñeros juega el viernes?').text,/No tengo un partido confirmado/);
 assert.match(ask('Resultado de Rapiñeros el miércoles').text,/No tengo un resultado confirmado/);
 const copy=structuredClone(state);const game=copy.interno.matches.find(m=>m.homeId==='rapineros'&&m.date==='2026-11-18');delete game.time;delete game.court;
 const answer=answerClubQuestion('Rapiñeros el miércoles',copy,{},now);assert.match(answer.text,/horario a confirmar/);assert.match(answer.text,/cancha a confirmar/);assert.doesNotMatch(answer.text,/20:00|0–0/);
 assert.match(ask('¿Cómo salió Rapiñeros ayer?').text,/Resultado confirmado: 1–0/);
});
test('nombres ambiguos o con errores requieren elegir el equipo; no adivina',()=>{
 const answer=ask('¿Contra quién juega Manchester mañana?');assert.ok(answer.choices.length>=2);assert.doesNotMatch(answer.text,/juega contra/);
 const typo=ask('¿Contra quién juega Rapineors el miércoles?');assert.ok(typo.choices.some(c=>c.label==='Rapiñeros'));
});
test('Gym usa los importes compartidos por el muro, conserva USD y diferencia respaldo de lectura verificada',()=>{
 const answer=ask('¿Cuánta plata va recaudando el gym?');assert.match(answer.text,/USD 151.000/);assert.match(answer.text,/USD 225.000/);assert.match(answer.text,/67,11%/);assert.match(answer.text,/USD 74.000/);assert.match(answer.source,/Última lectura verificada/);
 const copy={...state,gym:{...state.gym,status:'fallback'}};assert.match(answerClubQuestion('cuánto recaudó el Gym',copy,{},now).text,/último dato disponible.*No pude verificar/);
 assert.match(ask('cuánto cuesta el gimnasio').text,/No tengo una tarifa publicada/);
 assert.equal(answerClubQuestion('gym recaudación',{}, {},now).waiting,'gym');
});
test('eventos concretos y cenas ambiguas se responden desde la agenda',()=>{
 assert.match(ask('¿Cuándo es Cena Ceibos?').text,/sábado 19 de diciembre/);
 assert.equal(ask('¿Cuándo es la cena?').choices.length,2);assert.match(ask('¿Cuál es el próximo evento?').text,/CMC/);
});
test('contenido general recupera texto publicado y no confunde ropa con el equipo La Tropa',()=>{
 const birth=ask('¿Cuándo se fundó Ceibos?');assert.ok(birth.items.some(row=>row.text.includes('25 de enero de 2014')));
 const shop=ask('¿Dónde comprar ropa de Ceibos?');assert.ok(shop.items.some(row=>row.text.includes('Bulk')));assert.equal(shop.choices.length,0);
 const noisy=retrieveClubFacts('Dónde comprar ropa de Ceibos',[...facts,{title:'¿Te ponés la camiseta?',text:'Correo de contacto: info@ceibosclub.com',href:'#contacto'},{title:'Dirección del club',text:'Camino de los Gigantes, Montevideo.',href:'#predio',keywords:'ubicacion'}]);assert.ok(noisy[0].text.includes('Bulk'));assert.ok(noisy.every(row=>row.href!=='#contacto'));
 const motto=ask('¿Qué significa Totus Tuus?');assert.ok(motto.items.some(row=>row.text.includes('todo tuyo')));
 assert.match(ask('¿A qué hora entrena Sub18?').text,/No encontré ese dato confirmado/);
 assert.equal(retrieveClubFacts('precio de la remera',facts).length,0);assert.equal(retrieveClubFacts('puesto Sub 20',[{title:'Sub 18',text:'Puesto 2, tres puntos.',href:'#futbol'}]).length,0);
});
test('deportes del club y fuentes ausentes conservan límites claros',()=>{
 assert.match(ask('¿Cuál fue el resultado del basket?').text,/Náutico/);assert.match(ask('¿Cuál fue el resultado del basket?').text,/72–64/);
 assert.equal(answerClubQuestion('contra quién juega Rapiñeros mañana',{}, {},now).waiting,'interno');
 assert.match(ask('¿Cuántas lunas tiene Marte?').text,/No encontré ese dato/);
 const empty=ask('');assert.ok(empty.text);assert.ok(!JSON.stringify(ask('hola')).includes('/panel'));
});
test('reglas generales y de Masculino/Femenino conservan el alcance del PDF, sin reabrir inscripción',()=>{
 const players=ask('¿Cuántos jugadores en cancha permite el Interno?');assert.ok(players.items.some(row=>row.text.includes('máximo de ocho jugadores')));
 const changes=ask('¿Los cambios del Interno son ilimitados?');assert.ok(changes.items.some(row=>row.text.includes('cambios son ilimitados')));
 const papi=ask('¿Cuántos penales se patean en Papi?');assert.ok(!papi.items.some(row=>row.text.includes('tres penales')));
 assert.ok(!JSON.stringify(players).includes('091 393 252'));assert.ok(players.items.some(row=>row.href.includes('.pdf#page=')));
});
