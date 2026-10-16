import test from 'node:test';
import assert from 'node:assert/strict';
import {MatchStartTimer} from './match-start-timer.mjs';
import {instanteInicio, planificarInicios} from './notification-utils.mjs';
import {enviarGrupo, crearMensaje} from './send-notifications.mjs';
import {reserveStarts, completeStarts, releaseStarts, reserveWatcher, releaseWatcher} from './notification-start-store.mjs';
import {solicitarRelevo} from './watch-match-starts.mjs';

const match = {deporte:'futbol', categoria:'Primera', rival:'Rival', fecha:'2026-10-17', hora:'15:00'};
const kickoff = Date.parse('2026-10-17T18:00:00.000Z');
const plan = () => planificarInicios({partidos:[match]}, {}, kickoff - 10 * 60_000)[0];

class Clock {
  constructor(now = kickoff - 10 * 60_000) { this.time=now;this.tasks=new Map();this.id=0; }
  now = () => this.time;
  setTimer = (fn, delay) => { const id=++this.id;this.tasks.set(id,{fn,at:this.time+delay});return id; };
  clearTimer = id => this.tasks.delete(id);
  async advance(target) {
    while (true) {
      const entry=[...this.tasks].sort((a,b)=>a[1].at-b[1].at)[0];
      if (!entry || entry[1].at>target) break;
      this.time=entry[1].at;this.tasks.delete(entry[0]);await entry[1].fn();
    }
    this.time=target;
  }
}

function setup(options={}) {
  const clock=new Clock(options.now);const calls=[];const errors=[];
  const timer=new MatchStartTimer({now:clock.now,setTimer:clock.setTimer,clearTimer:clock.clearTimer,
    prepare:async job=>{calls.push(['prepare',clock.now()]);return {preparedFor:job.id};},
    send:async(job,snapshot)=>calls.push(['send',clock.now(),snapshot.preparedFor]),
    onError:error=>errors.push(error),...options});
  return {clock,timer,calls,errors};
}

test('fixture uses Montevideo time, prepares five minutes early and rejects invalid or suspended matches',()=>{
  assert.equal(instanteInicio(match),kickoff);
  assert.equal(instanteInicio({...match,fecha:'2026-10-18',hora:'00:02'}),Date.parse('2026-10-18T03:02:00Z'));
  for (const values of [{hora:'A confirmar'},{hora:'24:00'},{hora:'09:99'},{fecha:'2026-02-30'}]) assert.equal(instanteInicio({...match,...values}),null);
  const plans=planificarInicios({partidos:[match,{...match,categoria:'Reserva',estado:'Suspendido'},{...match,deporte:'tenis'}]}, {}, kickoff-600_000);
  assert.equal(plans.length,1);assert.equal(plans[0].preparar,kickoff-300_000);
  assert.equal(planificarInicios({partidos:[match]}, {}, kickoff-600_000,kickoff-1).length,0);
});

test('preloads exactly five minutes before kickoff and sends only at kickoff',async()=>{
  const {clock,timer,calls}=setup();timer.reconcile([plan()]);
  await clock.advance(kickoff-300_001);assert.deepEqual(calls,[]);
  await clock.advance(kickoff-300_000);assert.deepEqual(calls,[['prepare',kickoff-300_000]]);
  await clock.advance(kickoff-1);assert.equal(calls.length,1);
  await clock.advance(kickoff);assert.deepEqual(calls[1],['send',kickoff,plan().id]);
  timer.reconcile([plan()]);await clock.advance(kickoff+60_000);assert.equal(calls.length,2);
});

test('a changed kickoff cancels the old timer and rebuilds preparation and send times',async()=>{
  const {clock,timer,calls}=setup();timer.reconcile([plan()]);await clock.advance(kickoff-300_000);
  const changed=planificarInicios({partidos:[{...match,hora:'16:00'}]}, {},clock.now())[0];
  timer.reconcile([changed]);await clock.advance(kickoff);assert.equal(calls.length,1);
  await clock.advance(changed.preparar);assert.equal(calls.at(-1)[0],'prepare');
  await clock.advance(changed.inicio);assert.deepEqual(calls.at(-1),['send',changed.inicio,changed.id]);
});

test('removing a match after preparation prevents sending',async()=>{
  const {clock,timer,calls}=setup();timer.reconcile([plan()]);await clock.advance(kickoff-300_000);
  timer.reconcile([]);await clock.advance(kickoff);assert.equal(calls.length,1);
});

test('a last-moment fixture refresh can cancel a cold-start preparation without sending',async()=>{
  const clock=new Clock(kickoff);let sent=0;let timer;
  timer=new MatchStartTimer({now:clock.now,setTimer:clock.setTimer,clearTimer:clock.clearTimer,
    prepare:async()=>{timer.reconcile([]);return {};},send:async()=>sent++});
  timer.reconcile([plan()]);await clock.advance(kickoff);assert.equal(sent,0);
});

test('a failed preparation is retried at kickoff without an early notification',async()=>{
  let attempts=0;const {clock,timer,calls,errors}=setup({prepare:async()=>{if(++attempts===1)throw Error('temporary read failure');return {preparedFor:'ok'};}});
  timer.reconcile([plan()]);await clock.advance(kickoff-300_000);assert.equal(errors.length,1);assert.equal(calls.length,0);
  await clock.advance(kickoff);assert.equal(attempts,2);assert.deepEqual(calls,[['send',kickoff,'ok']]);
});

test('same-time categories are grouped by sport; newly added categories are not lost',async()=>{
  const data={partidos:[match,{...match,categoria:'Reserva A'},match,{...match,deporte:'rugby'}]};
  const plans=planificarInicios(data,{},kickoff-600_000);assert.equal(plans.length,2);assert.equal(plans[0].partidos.length,2);
  const {clock,timer,calls}=setup();timer.reconcile([plan()]);await clock.advance(kickoff);
  timer.reconcile([plans[0]]);await clock.advance(kickoff);assert.equal(calls.filter(c=>c[0]==='send').length,2);
});

test('push sends selected subscribers concurrently with high priority',async()=>{
  let active=0,maxActive=0;const endpoints=[];
  const docs=Array.from({length:5},(_,i)=>({data:()=>({enabled:true,deportes:{futbol:i!==4},endpoint:String(i),keys:{p256dh:'test',auth:'test'}})}));
  const result=await enviarGrupo({docs},'futbol',{title:'Inicio',renotify:true,ttl:3600},async(subscription,payload,options)=>{
    active++;maxActive=Math.max(maxActive,active);endpoints.push(subscription.endpoint);
    assert.equal(options.urgency,'high');assert.equal(options.TTL,3600);assert.equal(JSON.parse(payload).ttl,undefined);
    await Promise.resolve();active--;
  });
  assert.deepEqual(result,{enviados:4,eliminados:0,fallidos:0});assert.ok(maxActive>1);assert.equal(endpoints.includes('4'),false);
  assert.match(crearMensaje('start','futbol',[match],new Date(kickoff)).title,/Arranca ahora/);
  assert.doesNotMatch(crearMensaje('start','futbol',[match],new Date(kickoff+5*60_000)).title,/Arranca ahora/);
});

class Store {
  constructor(){this.records=new Map();this.queue=Promise.resolve();}
  collection(){return {doc:id=>({id})};}
  runTransaction(callback){
    const run=this.queue.then(()=>callback({get:async ref=>({data:()=>this.records.get(ref.id)}),set:(ref,data)=>this.records.set(ref.id,{...this.records.get(ref.id),...data})}));
    this.queue=run.catch(()=>{});return run;
  }
}

test('persistent claims prevent duplicate workers and expired claims can be recovered',async()=>{
  const db=new Store();
  const [first,second]=await Promise.all([reserveStarts(db,[match],'first',kickoff),reserveStarts(db,[match],'second',kickoff)]);
  assert.equal(first.entries.length,1);assert.equal(second.entries.length,0);assert.equal(second.busy.length,1);
  const retry=await reserveStarts(db,[match],'retry',kickoff+120_001);assert.equal(retry.entries.length,1);
  await completeStarts(db,first.entries,'first',{enviados:4,fallidos:0},kickoff+120_002);
  assert.equal([...db.records.values()][0].status,'sending');
  await completeStarts(db,retry.entries,'retry',{enviados:4,fallidos:0},kickoff+120_003);
  await releaseStarts(db,retry.entries,'retry');
  const duplicate=await reserveStarts(db,[match],'third',kickoff+200_000);
  assert.equal(duplicate.entries.length,0);assert.deepEqual(duplicate.alreadySent,[match]);
});

test('one watcher leads; handoff releases its lease without cancelling existing match timers',async()=>{
  const db=new Store();
  assert.equal(await reserveWatcher(db,'first',kickoff),true);
  assert.equal(await reserveWatcher(db,'other',kickoff),false);
  await releaseWatcher(db,'other');assert.equal(await reserveWatcher(db,'other',kickoff),false);
  await releaseWatcher(db,'first');assert.equal(await reserveWatcher(db,'next',kickoff),true);
  assert.equal(await reserveWatcher(db,'recovered',kickoff+180_001),true);
});

test('handoff dispatch uses an explicit event and a simulation never starts a live sender',async()=>{
  const previous=process.env.GITHUB_TOKEN;process.env.GITHUB_TOKEN='test-only';
  try {
    let payload;
    await solicitarRelevo({dryRun:true,fetchImpl:async(url,options)=>{
      assert.match(url,/avisar-inicio-partidos.yml\/dispatches$/);
      assert.equal(options.method,'POST');payload=JSON.parse(options.body);
      return {ok:true};
    }});
    assert.deepEqual(payload,{ref:'main',inputs:{dry_run:true}});
  } finally {
    if(previous===undefined)delete process.env.GITHUB_TOKEN;else process.env.GITHUB_TOKEN=previous;
  }
});
