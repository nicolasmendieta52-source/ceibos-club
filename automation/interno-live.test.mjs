import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {liveKickoff,matchClock,liveBoard,validClockStart,DEFAULT_CLOCK} from '../assets/interno-live-clock.js';
import {liveCardMarkup} from '../assets/interno-live.js';import {validateInterno} from '../assets/interno-model.js';
const match={id:'clock-test',status:'scheduled',date:'2026-11-16',time:'20:00',court:'Cancha 2'},start=Date.parse('2026-11-16T23:00:00Z');
test('límites exactos 25 + 5 + 25, sin convertir la hora estimada en resultado final',()=>{
  for(const [seconds,phase,text] of [[-1,'upcoming','00:01'],[0,'first','00:00'],[1499,'first','24:59'],[1500,'halftime','05:00'],[1799,'halftime','00:01'],[1800,'second','25:00'],[3299,'second','49:59'],[3300,'awaiting','50:00'],[9000,'awaiting','50:00']]){const clock=matchClock(match,DEFAULT_CLOCK,start+seconds*1000);assert.equal(clock.phase,phase);assert.equal(clock.text,text);}
  assert.equal(match.status,'scheduled');assert.equal(match.homeGoals,undefined);
});
test('horario de Montevideo, cruce de medianoche y comienzo ajustado no dependen del huso del dispositivo',()=>{
  assert.equal(liveKickoff(match),start);
  assert.equal(liveKickoff({...match,date:'2026-11-17',time:'00:05'}),Date.parse('2026-11-17T03:05:00Z'));
  const adjusted={...match,startedAt:'2026-11-16T20:07:00-03:00'};assert.equal(matchClock(adjusted,DEFAULT_CLOCK,start+7*60000).text,'00:00');
  assert.equal(validClockStart('2026-11-31T20:00:00-03:00'),false);assert.equal(validClockStart('2026-11-16T20:00:00'),false);
});
test('horarios desconocidos, partidos terminados o suspendidos no generan relojes activos',()=>{
  for(const change of [{time:null},{date:null},{date:'2026-02-30'},{time:'24:00'},{status:'finished'},{status:'suspended'},{status:'postponed'},{status:'cancelled'}])assert.equal(matchClock({...match,...change},DEFAULT_CLOCK,start).phase,'unavailable');
});
test('tablero reúne categorías, ordena canchas naturales y muestra solo la próxima tanda',()=>{
  const data={matches:[match,{...match,id:'other',categoryId:'femenino',court:'Cancha 10'},{...match,id:'earlier',court:'Cancha 1',time:'19:40'},{...match,id:'unknown',court:''},{...match,id:'next',time:'21:00'},{...match,id:'same-next',time:'21:00',court:'Cancha 3'},{...match,id:'far',time:'22:00'}]};
  const board=liveBoard(data,start+10*60000);assert.deepEqual(board.active.map(row=>row.match.id),['earlier','clock-test','other','unknown']);assert.deepEqual(board.next.map(row=>row.match.id),['next','same-next']);
  assert.equal(board.active[0].clock.phase,'second');assert.equal(liveBoard(data,start+10*60000,'Cancha 2').active.length,1);
  const ended=liveBoard({matches:[match]},start+55*60000);assert.equal(ended.active.length,0);assert.equal(ended.awaiting.length,1);assert.equal(liveBoard({matches:[match]},start+115*60000).awaiting.length,0);
});
test('sedes diferentes no se confunden aunque tengan el mismo número de cancha',()=>{
  const data={matches:[{...match,venue:'ASPROE'},{...match,id:'ceibos',venue:'Ceibos'}]};assert.deepEqual(liveBoard(data,start).active.map(row=>row.court),['ASPROE · Cancha 2','Ceibos · Cancha 2']);
});
test('datos y tarjetas conservan nombres, cancha no asignada y enlaces al partido sin inventar un marcador',async()=>{
  const data=JSON.parse(await readFile(new URL('../data/interno.json',import.meta.url),'utf8'));assert.deepEqual(data.clock,DEFAULT_CLOCK);
  const game={...match,categoryId:'masculino',stage:'groups',groupId:'mas-a',homeId:'la-desidia',awayId:'kiwis',court:undefined};data.matches=[game];assert.doesNotThrow(()=>validateInterno(data));
  const row=liveBoard(data,start).active[0],markup=liveCardMarkup(data,row);assert.match(markup,/Cancha a confirmar/);assert.match(markup,/La Desidia/);assert.match(markup,/Kiwis/);assert.match(markup,/internoPartido=clock-test/);assert.doesNotMatch(markup,/0–0|Finalizado/);
  for(const mutate of [d=>d.clock.breakMinutes=-1,d=>d.matches[0].court=3,d=>d.matches[0].startedAt='2026-11-16T20:00']){const invalid=structuredClone(data);mutate(invalid);assert.throws(()=>validateInterno(invalid));}
});
