import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {partidosInterno,detectarEventosInterno,crearMensajeInterno,siguePartidoInterno,destinoInterno} from './interno-notification-utils.mjs';
import {reservarEventoInterno,terminarEventoInterno} from './send-interno-notifications.mjs';
import {planificarInicios,clavePartido} from './notification-utils.mjs';
import {enviarGrupo} from './send-notifications.mjs';
import {leerFixtureVigente} from './watch-match-starts.mjs';
import {opcionesInterno} from '../assets/interno-notification-preferences.js';
import vm from 'node:vm';
const source=JSON.parse(await readFile(new URL('../data/interno.json',import.meta.url),'utf8'));
const tournament=(extra={})=>{const data=structuredClone(source);data.matches=[{id:'prueba-mas',categoryId:'masculino',groupId:'mas-a',stage:'groups',homeId:'la-desidia',awayId:'kiwis',date:'2026-11-16',time:'20:00',status:'scheduled',...extra}];return data;};
const now=new Date('2026-11-15T15:00:00Z');
const mark=(detection,at=now)=>{for(const event of detection.events)detection.state.sent[event.key]=at.toISOString();return detection.state;};

test('Interno requiere opt-in propio; categorías, equipos y tipos se intersectan',()=>{
  const match=partidosInterno(tournament())[0];
  assert.equal(siguePartidoInterno({futbol:true},match,'start'),false);
  assert.equal(siguePartidoInterno({interno:true},match,'start'),true);
  const prefs={interno:true,internoOpciones:{categories:['femenino'],teamId:'la-desidia'}};assert.equal(siguePartidoInterno(prefs,match,'start'),false);
  prefs.internoOpciones.categories=['masculino'];assert.equal(siguePartidoInterno(prefs,match,'start'),true);
  prefs.internoOpciones.teamId='rapineros';assert.equal(siguePartidoInterno(prefs,match,'start'),false);
  prefs.internoOpciones.teamId='';prefs.internoOpciones.events={result:false};assert.equal(siguePartidoInterno(prefs,match,'result'),false);assert.equal(siguePartidoInterno(prefs,match,'start'),true);
  assert.deepEqual(opcionesInterno({categories:[]}).categories,[]);
});

test('fixture nuevo se anuncia una vez, y el recordatorio del día comienza a las 9 de Montevideo',()=>{
  const data=tournament(),first=detectarEventosInterno(data,{},now);assert.deepEqual(first.events.map(event=>event.tipo),['new']);
  const state=mark(first);assert.equal(detectarEventosInterno(data,state,now).events.length,0);
  assert.equal(detectarEventosInterno(data,state,new Date('2026-11-16T11:59:00Z')).events.length,0);
  const today=detectarEventosInterno(data,state,new Date('2026-11-16T12:00:00Z'));assert.deepEqual(today.events.map(event=>event.tipo),['today']);
  assert.equal(detectarEventosInterno(data,mark(today),new Date('2026-11-16T12:05:00Z')).events.length,0);
  assert.deepEqual(detectarEventosInterno(data,{},new Date('2026-11-16T13:00:00Z')).events.map(event=>event.tipo),['today']);
  assert.equal(detectarEventosInterno(data,state,new Date('2026-11-16T23:01:00Z')).events.length,0);
});

test('horario, suspensión y cancelación generan cambios; nunca programan un inicio cancelado',()=>{
  let data=tournament(),state=mark(detectarEventosInterno(data,{},now));data.matches[0].time='21:00';
  let next=detectarEventosInterno(data,state,now);assert.deepEqual(next.events.map(event=>event.tipo),['change']);state=mark(next);
  for(const status of ['suspended','postponed','cancelled']){
    data.matches[0].status=status;next=detectarEventosInterno(data,state,now);assert.equal(next.events[0].tipo,'change');state=mark(next);
    assert.equal(planificarInicios({partidos:partidosInterno(data)}, {},Date.parse('2026-11-16T23:00:00Z')).length,0);
  }
  assert.match(crearMensajeInterno('change',[partidosInterno(data)[0]]).title,/cancelado/);
});

test('resultados y correcciones incluyen penales, no se repiten ni notifican el historial inicial',()=>{
  const data=tournament(),state=mark(detectarEventosInterno(data,{},now));Object.assign(data.matches[0],{status:'finished',homeGoals:2,awayGoals:1});
  const at=new Date('2026-11-17T01:00:00Z'),first=detectarEventosInterno(data,state,at);assert.deepEqual(first.events.map(event=>event.tipo),['result']);
  assert.match(crearMensajeInterno('result',[first.events[0].partido]).body,/La Desidia 2–1 Kiwis/);
  const sent=mark(first,at);assert.equal(detectarEventosInterno(data,sent,at).events.length,0);
  Object.assign(data.matches[0],{homeGoals:3});const corrected=detectarEventosInterno(data,sent,at);assert.equal(corrected.events[0].partido.resultUpdated,true);assert.match(crearMensajeInterno('result',[corrected.events[0].partido]).title,/actualizado/);
  assert.equal(detectarEventosInterno(data,{},at).events.length,0);
  const penalty=tournament({stage:'playoffs',groupId:null,status:'finished',homeGoals:1,awayGoals:1,penalties:{home:4,away:3}});assert.match(crearMensajeInterno('result',partidosInterno(penalty)).body,/1–1.*Penales 4–3/);
});

test('inicio incluye ID de partido, prepara cinco minutos antes y no usa horarios ni resultados inexistentes',()=>{
  const data=tournament(),match=partidosInterno(data)[0],kickoff=Date.parse('2026-11-16T23:00:00Z');
  const plans=planificarInicios({partidos:[match]}, {},kickoff-600000);assert.equal(plans[0].inicio,kickoff);assert.equal(plans[0].preparar,kickoff-300000);
  assert.notEqual(clavePartido(match),clavePartido({...match,internoId:'2026|otro-partido'}));
  for(const change of [{hora:''},{internoStatus:'finished'},{internoStatus:'cancelled'}])assert.equal(planificarInicios({partidos:[{...match,...change}]},{},kickoff).length,0);
  assert.equal(planificarInicios({partidos:[match]},{},kickoff+15*60000).length,0);
  assert.match(crearMensajeInterno('start',[match],new Date(kickoff)).title,/Arranca ahora/);assert.doesNotMatch(crearMensajeInterno('start',[match],new Date(kickoff+60000)).title,/Arranca ahora/);
  const target=new URL(destinoInterno(match,'result'),'https://ceibosclub.com');assert.equal(target.searchParams.get('internoTab'),'resultados');assert.equal(target.searchParams.get('internoCategoria'),'masculino');assert.equal(target.searchParams.get('internoPartido'),'prueba-mas');
});

test('envío simultáneo filtra el mensaje por suscriptor y preserva los deportes anteriores',async()=>{
  const male=partidosInterno(tournament())[0],female={...male,internoId:'2026|fem',internoMatchId:'fem',internoCategoryId:'femenino',categoria:'Femenino',internoTeamIds:['maradonas','rejunte-fc'],homeName:'Maradoñas',awayName:'Rejunte FC'};
  const docs=[{deportes:{futbol:true}},{deportes:{interno:true,internoOpciones:{categories:['femenino']}}},{deportes:{interno:true,internoOpciones:{categories:['masculino'],teamId:'la-desidia'}}},{deportes:{interno:true,internoOpciones:{events:{start:false}}}}].map((value,id)=>({data:()=>({enabled:true,endpoint:String(id),keys:{p256dh:'test',auth:'test'},...value})}));
  const sent=[];const result=await enviarGrupo({docs},'interno',{},async(subscription,payload)=>sent.push({id:subscription.endpoint,message:JSON.parse(payload)}),{tipo:'start',partidos:[male,female]});
  assert.equal(result.enviados,2);assert.doesNotMatch(sent.find(item=>item.id==='1').message.body,/Desidia|Kiwis/);assert.doesNotMatch(sent.find(item=>item.id==='2').message.body,/Maradoñas/);assert.ok(sent.every(item=>item.message.url.includes('#interno')));
});

class Store{constructor(){this.records=new Map();this.queue=Promise.resolve();}collection(){return{doc:id=>({id})};}runTransaction(callback){const run=this.queue.then(()=>callback({get:async ref=>({data:()=>this.records.get(ref.id)}),set:(ref,data)=>this.records.set(ref.id,{...this.records.get(ref.id),...data})}));this.queue=run.catch(()=>{});return run;}}
test('reserva persistente evita duplicados y permite reintentar un fallo sin perder el evento',async()=>{
  const db=new Store(),event=detectarEventosInterno(tournament(),{},now).events[0],time=now.getTime();
  assert.equal(await reservarEventoInterno(db,event,'a',time),'reserved');assert.equal(await reservarEventoInterno(db,event,'b',time),'busy');await terminarEventoInterno(db,event,'a',null,time);assert.equal(await reservarEventoInterno(db,event,'b',time),'reserved');
  await terminarEventoInterno(db,event,'a',{enviados:1,fallidos:0},time);assert.equal([...db.records.values()][0].status,'sending');await terminarEventoInterno(db,event,'b',{enviados:1,fallidos:0},time);assert.equal(await reservarEventoInterno(db,event,'c',time),'sent');
});

test('vigilante lee el fixture vigente del club y del Interno en paralelo',async()=>{
  const interno=tournament(),club={partidos:[{deporte:'futbol',categoria:'Primera',rival:'Rival',fecha:'2026-11-16',hora:'21:00'}]},requests=[];
  const result=await leerFixtureVigente({fetchImpl:async url=>{requests.push(url);return{ok:true,json:async()=>({content:Buffer.from(JSON.stringify(url.includes('/interno.json')?interno:club)).toString('base64')})};}});
  assert.equal(requests.length,2);assert.deepEqual(result.partidos.map(match=>match.deporte),['futbol','interno']);
  const retained=partidosInterno(interno);
  const partial=await leerFixtureVigente({fallbackPartidosInterno:retained,fetchImpl:async url=>url.includes('/interno.json')?{ok:false,status:503}:{ok:true,json:async()=>({content:Buffer.from(JSON.stringify(club)).toString('base64')})}});
  assert.deepEqual(partial.partidos,[...club.partidos,...retained]);
});

test('al tocar el aviso, el service worker conserva el partido y solo abre URLs del club',async()=>{
  const script=await readFile(new URL('../service-worker.js',import.meta.url),'utf8'),handlers={},opened=[];
  const self={location:{origin:'https://ceibosclub.com'},addEventListener:(type,callback)=>handlers[type]=callback,clients:{matchAll:async()=>[],openWindow:async url=>opened.push(url)}};
  vm.runInNewContext(script,{self,URL});
  const match=partidosInterno(tournament())[0],target=destinoInterno(match,'result');
  for(const url of [target,'https://example.invalid/','http://[']){
    let finished;handlers.notificationclick({notification:{close(){},data:{url}},waitUntil:promise=>finished=promise});await finished;
  }
  assert.equal(opened[0],'https://ceibosclub.com'+target);assert.deepEqual(opened.slice(1),['https://ceibosclub.com/#fixture','https://ceibosclub.com/#fixture']);
});
