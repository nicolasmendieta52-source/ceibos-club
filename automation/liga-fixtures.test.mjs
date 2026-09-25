import test from 'node:test';
import assert from 'node:assert/strict';
import {ligaFixtureLinks,parseLigaFixturesApi,mergeClubData} from './sync-club-data.mjs';
import {applyProvisionalFixtures} from './fixture-provisional.mjs';
const source={deporte:'futbol',categoria:'Reserva A',temporada:'2026',url:'https://ligauniversitaria.org.uy/partidos/phase.html'};
const aliases=['CEIBOS CLUB','CEIBOS CLUB VERDE'];
test('descubre fases publicadas sin seguir otros dominios ni tablas de resultados',()=>{
 const html=`<iframe src='/partidos/new.html'></iframe><iframe src="https://ligauniversitaria.org.uy/partidos/new.html"></iframe><iframe src='/resultados/new.html'></iframe><iframe src='https://other.example/partidos/new.html'></iframe>`;
 assert.deepEqual(ligaFixtureLinks(html,'https://ligauniversitaria.org.uy/category/'),['https://ligauniversitaria.org.uy/partidos/new.html']);
});
test('lee fecha, hora y localía directamente; la cancha Ceibos no identifica al equipo',()=>{
 const rows=[{Fecha:'2026-09-26 09:00:00',Locatario:'CEIBOS CLUB',Visitante:'TAPE',Cancha:'MONTE VI LOS CEIBOS'},
 {Fecha:'2026-10-03 11:15:00',Locatario:'TENIS EL PINAR',Visitante:'CEIBOS CLUB'},
 {Fecha:'2026-10-03 11:15:00',Locatario:'TAPE',Visitante:'OBC',Cancha:'MONTE VI LOS CEIBOS'},
 {Fecha:'2025-09-26 09:00:00',Locatario:'CEIBOS CLUB',Visitante:'TAPE'}];
 const data=parseLigaFixturesApi(rows,source,aliases);assert.equal(data.length,2);assert.equal(data[0].hora,'09:00');assert.equal(data[0].local,true);assert.equal(data[1].hora,'11:15');assert.equal(data[1].local,false);
});
test('no convierte medianoche o fecha sin hora en un horario confirmado',()=>{
 for(const Fecha of ['2026-10-03 00:00:00','2026-10-03','2026-10-03 25:99:00'])assert.equal(parseLigaFixturesApi([{Fecha,Locatario:'CEIBOS CLUB',Visitante:'TAPE'}],source,aliases)[0].hora,'A confirmar');
});
test('horario oficial sustituye PDF y siguientes revisiones actualizan una hora ya publicada',()=>{
 const provisional={deporte:'futbol',categoria:'Reserva A',fecha:'2026-09-26',rival:'TAPE',hora:'A confirmar',local:true};
 const read=hora=>parseLigaFixturesApi([{Fecha:'2026-09-26 '+hora+':00',Locatario:'CEIBOS CLUB',Visitante:'TAPE',Cancha:'Ceibos'}],source,aliases);
 let data=applyProvisionalFixtures(mergeClubData({partidos:[provisional],resultados:[]},read('09:00'),[]),[provisional],read('09:00'));
 assert.equal(data.partidos.length,1);assert.equal(data.partidos[0].hora,'09:00');
 data=mergeClubData(data,read('11:15'),[]);assert.equal(data.partidos.length,1);assert.equal(data.partidos[0].hora,'11:15');assert.equal(data.partidos[0].fuente,source.url);
});
