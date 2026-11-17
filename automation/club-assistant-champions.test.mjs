import test from 'node:test';import assert from 'node:assert/strict';
import {answerClubQuestion} from '../assets/club-assistant-model.js';
import {answerChampionQuestion} from '../assets/club-assistant-facts.js';
const fact=(team,category,categoryId,cup,year=2025)=>({title:'Campeones del Interno '+year,text:team+' ganó la Copa de '+cup+' del Interno '+year+' ('+category+').',href:'#interno-'+year,champion:{team,category,categoryId,cup,year}});
const facts=[fact('Rapiñeros','Masculino','masculino','Oro'),fact('La Favela','Masculino','masculino','Plata'),fact('Maradoñas','Femenino','femenino','Oro'),fact('Naranja Mecánica','Femenino','femenino','Plata'),fact('Leganés','+38','papi','Oro'),{title:'Los campeones',text:'Edición 2025 · Todas las copas',href:'#interno-2025'},{title:'Rapiñeros',text:'Último campeón · Copa de Oro masculina',href:'#interno-2025'}];
const now=Date.parse('2026-11-17T15:00:00Z'),ask=q=>answerClubQuestion(q,{facts},{},now);

test('responde campeón, copa y edición directamente sin devolver rótulos de publicaciones',()=>{
 const answer=ask('quién fue el último campeón del Interno masculino');assert.equal(answer.text,'Rapiñeros ganó la Copa de Oro del Interno 2025 (Masculino).');assert.equal(answer.items.length,1);assert.equal(answer.items[0].href,'#interno-2025');assert.doesNotMatch(answer.text,/Según|Edición 2025 · Todas las copas|https:/);
 assert.equal(ask('de qué copa fue campeón Rapiñeros').text,answer.text);
 assert.match(ask('quién ganó la copa de plata del interno femenino 2025').text,/Naranja Mecánica ganó la Copa de Plata/);
 assert.match(ask('quién fue la campeona del Interno 2025').text,/Maradoñas ganó la Copa de Oro/);
});

test('varias categorías se responden explícitamente y comparten una única referencia',()=>{
 const answer=ask('quién fue campeón del Interno 2025');assert.match(answer.text,/Masculino · Oro: Rapiñeros/);assert.match(answer.text,/Femenino · Oro: Maradoñas/);assert.match(answer.text,/\+38 · Oro: Leganés/);assert.doesNotMatch(answer.text,/La Favela/);assert.equal(answer.items.length,1);
 const all=ask('todos los campeones de cada copa del Interno 2025');assert.match(all.text,/La Favela/);assert.match(all.text,/Naranja Mecánica/);assert.equal(all.items.length,1);
});

test('no atribuye campeones de otra edición ni responde campeones a consultas de partidos',()=>{
 assert.match(ask('quién fue campeón del Interno 2026').text,/No tengo un campeón publicado del Interno 2026/);
 assert.match(ask('quién fue campeón del Interno este año').text,/No tengo un campeón publicado del Interno 2026/);assert.match(ask('quién fue campeón del Interno masculino el año pasado').text,/Rapiñeros ganó/);
 assert.equal(answerChampionQuestion('cuántos partidos ganó Rapiñeros este año',facts),null);assert.equal(answerChampionQuestion('contra quién juega Rapiñeros el miércoles',facts),null);assert.equal(answerChampionQuestion('M19 campeona de la Copa Uruguay',facts),null);
 assert.equal(answerChampionQuestion('quién ganó el último partido de Rapiñeros en el Interno',facts),null);
 assert.match(answerChampionQuestion('quién fue campeón del Interno 2025',[]).text,/No tengo ese campeón publicado/);
});
