import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {applyProvisionalFixtures} from './fixture-provisional.mjs';
import {mergeClubData} from './sync-club-data.mjs';
const fixtures=JSON.parse(fs.readFileSync(new URL('./fixture-provisional.json',import.meta.url))).partidos;
test('PDF: siete fechas 2026 por categoría, sin inventar horarios ni canchas',()=>{
 assert.equal(fixtures.length,21);
 for(const categoria of ['Primera','Reserva A','Reserva Verde']){
  const rows=fixtures.filter(p=>p.categoria===categoria);assert.equal(rows.length,7);assert.equal(new Set(rows.map(p=>p.rival)).size,7);
  for(const p of rows){assert.equal(p.hora,'A confirmar');assert.equal(p.cancha,'A confirmar');assert.equal(new Date(p.fecha+'T12:00:00Z').getUTCDay(),categoria==='Primera'?0:6);}
 }
});
test('la sincronización parcial conserva PDF y respeta horarios, resultados y reprogramaciones oficiales',()=>{
 const initial=applyProvisionalFixtures({partidos:[],resultados:[]},fixtures);
 assert.equal(applyProvisionalFixtures(initial,fixtures).partidos.length,21);
 const official=[{...fixtures[0],kind:'partido',hora:'10:00',cancha:'Cancha fijada',fecha:'2026-09-28'},{...fixtures[7],kind:'resultado',gf:2,gc:1}];
 const output=applyProvisionalFixtures(mergeClubData(initial,official,[]),fixtures,official);
 assert.equal(output.partidos.length,20);assert.equal(output.resultados.length,1);
 assert.ok(!output.partidos.some(p=>p.categoria==='Primera'&&p.fecha==='2026-09-27'));
 assert.equal(output.partidos.find(p=>p.categoria==='Primera'&&p.fecha==='2026-09-28').hora,'10:00');
 assert.ok(!output.partidos.some(p=>p.categoria==='Reserva A'&&p.fecha==='2026-09-26'));
});
