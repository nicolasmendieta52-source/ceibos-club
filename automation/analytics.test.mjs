import test from 'node:test';
import assert from 'node:assert/strict';
import {summarize,referrerHost,deviceInfo,csvValue,emptyCounts,SECTIONS,ACTIONS} from '../assets/analytics-model.js';
test('estadísticas distinguen visitas de navegadores y no convierten clics en pagos',()=>{
 const visit={ownerUid:'anon1',createdMs:Date.now(),lastSeenMs:Date.now(),activeSeconds:20,interactions:1,scrollDepth:50,actions:{gym_form:1},sections:{'gym-campaign':1},device:'Móvil',browser:'Safari',os:'iOS',referrer:'instagram.com'};
 const s=summarize([visit,{...visit,activeSeconds:0,interactions:0,actions:{},sections:{}}]);
 assert.equal(s.visits,2);assert.equal(s.visitors,1);assert.equal(s.engaged,1);assert.equal(s.sections['gym-campaign'],1);assert.equal(s.actions.gym_form,1);assert.equal(s.seconds,20);assert.equal(s.devices['Móvil'],2);
 assert.ok(!('payments' in s));assert.equal(summarize([]).visits,0);
});
test('se guarda dominio de origen sin consultas, fragmentos ni credenciales',()=>{
 assert.equal(referrerHost('https://user:password@instagram.com/private?email=personal@example.com#secret'),'instagram.com');
 assert.equal(referrerHost('https://ceibosclub.com/panel/'),'Interno');assert.equal(referrerHost(''),'Directo / no informado');
});
test('exportación evita fórmulas CSV y metadatos de dispositivo son generales',()=>{
 assert.equal(csvValue('=1+2'),'"\'=1+2"');assert.equal(csvValue('a"b'),'"a""b"');
 assert.deepEqual(deviceInfo('Mozilla iPhone Safari',390),{device:'Móvil',browser:'Safari',os:'iOS'});
 assert.equal(Object.keys(emptyCounts(SECTIONS)).length,15);assert.ok(ACTIONS.includes('gym_form'));
});
