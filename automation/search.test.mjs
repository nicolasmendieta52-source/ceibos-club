import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {buildSearchIndex,searchIndex,searchText} from '../assets/search-model.js';
const sports=[{slug:'futbol',name:'Fútbol',categories:['Primera','Sub 18','Sub 20']},{slug:'basketball',name:'Basketball',categories:['Divisional B']}],events=[{fecha:'2026-12-19',titulo:'Cena Ceibos',tipo:'social',desc:'Agendá el 19 de diciembre.'}];
const interno=JSON.parse(await readFile(new URL('../data/interno.json',import.meta.url),'utf8')),index=buildSearchIndex({sports,events,interno});
test('buscador entiende tildes, abreviaturas, prefijos y frases con palabras comunes',()=>{
 assert.equal(searchText(' FÚTBOL Sub18 '),'futbol sub 18');
 for(const query of ['Rapiñeros','rapineros','rapi','partidos de rapineros','donde juega rapineros'])assert.equal(searchIndex(index,query).results[0].id,'team-rapineros');
 assert.ok(searchIndex(index,'basquet').results.some(row=>row.href.includes('basketball')));
 assert.equal(searchIndex(index,'sub18').results[0].id,'category-futbol-Sub 18');
 assert.ok(searchIndex(index,'sub18').results.every(row=>!row.title.includes('Sub 20')));
});
test('ayuda con errores de escritura sin confundir los números de las categorías',()=>{
 const typo=searchIndex(index,'rapineors');assert.equal(typo.approximate,true);assert.equal(typo.results[0].id,'team-rapineros');
 assert.ok(searchIndex(index,'Sub 19').results.every(row=>!row.title.includes('Sub 18')&&!row.title.includes('Sub 20')));
 assert.equal(searchIndex(index,'zzq imposible').results.length,0);assert.deepEqual(searchIndex(index,''),{results:[],approximate:false});
});
test('equipos, grupos, noticias, eventos y partidos apuntan a su información pública',()=>{
 const rapi=searchIndex(index,'Rapiñeros').results[0];assert.match(rapi.href,/internoTab=equipos&internoEquipo=rapineros#interno/);
 const event=searchIndex(index,'Cena Ceibos').results[0];assert.equal(event.href,'#evento-2026-12-19-cena-ceibos');assert.match(event.description,/19 de diciembre/);
 assert.ok(searchIndex(index,'reglamento interno').results.some(row=>row.href.endsWith('.pdf')));
 const sample=interno.matches.find(match=>match.status==='finished');if(sample){const row=index.find(entry=>entry.id==='match-'+sample.id);assert.match(row.href,/internoTab=resultados/);assert.ok(row.description.includes(sample.homeGoals+'–'+sample.awayGoals));}
 const next=interno.matches.find(match=>match.status==='scheduled');if(next){const row=index.find(entry=>entry.id==='match-'+next.id);assert.match(row.href,/internoTab=fixture/);assert.doesNotMatch(row.description,/undefined|NaN|0–0/);}
 assert.ok(index.every(row=>!row.href.includes('/panel')&&!row.title.toLowerCase().includes('inscripci')));
 const news=buildSearchIndex({content:[{id:'m19',title:'M19 Copa Uruguay',href:'#noticia-m19',description:'Rugby',keywords:'campeona'}]});assert.equal(searchIndex(news,'m19 campeona').results[0].href,'#noticia-m19');
});
test('no necesita servicios externos ni los datos del Interno para buscar secciones',()=>{
 const base=buildSearchIndex();assert.equal(searchIndex(base,'gym').results[0].href,'#gym-campaign');assert.ok(searchIndex(base,'horarios').results.some(row=>row.href==='#fixture'));
 assert.equal(buildSearchIndex({content:[{id:'bad',title:'Enlace inválido',href:'javascript:alert(1)'}]}).some(row=>row.id==='content-bad'),false);
 assert.ok(searchIndex(index,'a'.repeat(10000)).results.length===0);
});
