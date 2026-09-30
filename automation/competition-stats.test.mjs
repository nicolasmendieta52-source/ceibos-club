import test from 'node:test';import assert from 'node:assert/strict';
import {ligaTable,sourceLinks,hockeySections,rugbyTables} from './sync-competition-stats.mjs';
test('Liga conserva puntos oficiales, orden y nombres; no calcula sanciones ni suma fases',()=>{
 const r=ligaTable([{Institucion:'CEIBOS CLUB',PJ:'16',PG:'5',PE:'2',PP:'9',GF:'14',GC:'22',Puntos:'15'}],'standings');
 assert.equal(r[0].club,true);assert.equal(r[0].values.at(-1),15);
 assert.throws(()=>ligaTable([{Institucion:'Ceibos',PJ:'error'}],'standings'));
 assert.deepEqual(ligaTable([{Jugador:'Ana',Institucion:'Los Ceibos',goles:'4'}],'scorers')[0].values,[1,'Ana','Los Ceibos',4]);
});
test('descubre únicamente tablas del dominio oficial',()=>{
 assert.deepEqual(sourceLinks('<iframe src="/posiciones/current.html"><iframe src="https://evil.example/posiciones/x.html">','https://ligauniversitaria.org.uy/category/','posiciones'),['https://ligauniversitaria.org.uy/posiciones/current.html']);
});
test('hockey conserva fase 2026; ignora tablas antiguas y divisiones sin Ceibos',()=>{
 const row='<table><tr>'+['Los Ceibos',1,1,0,0,3,1,2,3].map(v=>'<td>'+v+'</td>').join('')+'</tr></table>';
 assert.equal(hockeySections('<h3>Apertura 2025</h3>'+row+'<h3>Apertura 2026</h3>'+row).length,1);
 assert.equal(hockeySections('<h3>Apertura</h3>'+row).length,0);
 assert.equal(hockeySections('<h3>Apertura</h3>'+row,2026).length,1);
 assert.equal(hockeySections('<h3>Apertura 2025</h3>'+row,2026).length,0);
});
test('rugby conserva bonus y separa grupos, temporadas y competencias',()=>{
 const c={id:'c',season:'2026',category:'M19',name:'Copa 2026'};
 const row={competition_id:'c',club_name:'Ceibos',group_name:'D',sort_order:1,played:1,won:1,drawn:0,lost:0,points_for:20,points_against:10,bonus_points:1,total_points:5};
 const tables=rugbyTables({competitions:[c,{...c,id:'old',season:'2025'}],standings:[row,{...row,competition_id:'old'},{...row,club_name:'Otro',group_name:'A'}]});
 assert.equal(tables.length,1);assert.equal(tables[0].rows.length,1);assert.deepEqual(tables[0].rows[0].values.slice(-2),[1,5]);
});
