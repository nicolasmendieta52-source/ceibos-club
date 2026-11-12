import test from 'node:test';
import assert from 'node:assert/strict';
import {internoSyncDue} from './interno-sync-due.mjs';
test('la lectura horaria se basa en la última consulta exitosa, aunque no hubiera cambios',()=>{
  const now=Date.parse('2026-11-12T20:05:00Z');
  assert.equal(internoSyncDue({sourceInfo:{checkedAt:'2026-11-12T19:00:00Z'}},now),true);
  assert.equal(internoSyncDue({sourceInfo:{checkedAt:'2026-11-12T20:00:01Z',importedAt:'2026-11-11T12:00:00Z'}},now),false);
  assert.equal(internoSyncDue({sourceInfo:{importedAt:'2026-11-12T20:03:00Z'}},now),false);
  assert.equal(internoSyncDue({sourceInfo:{checkedAt:'2026-11-12T19:59:59Z'}},now),true);
  for(const data of [{},{sourceInfo:{checkedAt:'inválida'}},{sourceInfo:{checkedAt:'2026-11-12T21:00:00Z'}}])assert.equal(internoSyncDue(data,now),true);
});
