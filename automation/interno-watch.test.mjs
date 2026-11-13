import test from 'node:test';
import assert from 'node:assert/strict';
import {createInternoWatcher} from './watch-interno-sync.mjs';

function setup(){
  let clock=Date.parse('2026-11-13T21:58:00Z'),checkedAt='2026-11-13T21:50:00Z',runs=[],fail=false;
  const calls=[],requests=[];
  const watcher=createInternoWatcher({token:'temporary-test-token',repository:'club/ceibos',now:()=>clock,fetchImpl:async(url,options)=>{
    calls.push(url);
    if(url.includes('/contents/'))return {ok:true,status:200,json:async()=>({content:Buffer.from(JSON.stringify({sourceInfo:{checkedAt}})).toString('base64')})};
    if(url.includes('/runs?'))return {ok:true,status:200,json:async()=>({workflow_runs:runs})};
    requests.push({url,body:JSON.parse(options.body)});
    return {ok:!fail,status:fail?503:204};
  }});
  return {watcher,calls,requests,setNow:value=>clock=Date.parse(value),setChecked:value=>checkedAt=value,setRuns:value=>runs=value,setFailure:value=>fail=value};
}

test('al pasar a otra hora solicita una lectura y la verificación exitosa detiene los pedidos',async()=>{
  const s=setup();assert.equal((await s.watcher.tick()).due,false);assert.equal(s.calls.length,1);
  s.setNow('2026-11-13T22:00:01Z');assert.equal((await s.watcher.tick()).requested,true);
  assert.match(s.requests[0].url,/actualizar-interno.yml\/dispatches$/);assert.deepEqual(s.requests[0].body,{ref:'main',inputs:{dry_run:false}});
  s.setChecked('2026-11-13T22:00:45Z');s.setNow('2026-11-13T22:01:00Z');assert.equal((await s.watcher.tick()).due,false);assert.equal(s.requests.length,1);
});
test('no duplica una lectura en marcha; reintenta un fallo cada diez minutos',async()=>{
  const s=setup();s.setChecked('2026-11-13T20:00:00Z');
  for(const status of ['pending','queued','in_progress']){s.setRuns([{status}]);assert.equal((await s.watcher.tick()).active,true);}
  assert.equal(s.requests.length,0);s.setRuns([{status:'completed',conclusion:'failure'}]);s.setFailure(true);
  await assert.rejects(s.watcher.tick(),/HTTP 503/);s.setFailure(false);
  assert.equal((await s.watcher.tick()).retryAfter,true);assert.equal(s.requests.length,1);
  s.setNow('2026-11-13T22:08:00Z');assert.equal((await s.watcher.tick()).requested,true);assert.equal(s.requests.length,2);
});
test('la comprobación no dispara lecturas y el relevo usa un token temporal y el modo indicado',async()=>{
  const s=setup();s.setChecked('2026-11-12T20:00:00Z');assert.equal((await s.watcher.tick({allowDispatch:false})).due,true);assert.equal(s.requests.length,0);
  await s.watcher.relay('verify');assert.deepEqual(s.requests[0].body,{ref:'main',inputs:{mode:'verify'}});
  await s.watcher.relay();assert.deepEqual(s.requests[1].body,{ref:'main',inputs:{mode:'watch'}});
  await assert.rejects(s.watcher.relay('admin'),/inválido/);
});
