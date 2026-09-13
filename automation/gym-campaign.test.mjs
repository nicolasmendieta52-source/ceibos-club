import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignModel, contributionLink, campaignFromCsv, BRICK_COUNT } from '../assets/gym-campaign.js';

test('el monto real llena 26 de 60 ladrillos y el 23,5% del siguiente', () => {
  const model = campaignModel({ goal: 200000, raised: 87450 });
  assert.equal(model.remaining, 112550);
  assert.equal(model.brickValue, 200000 / 60);
  assert.equal(model.fills.length, 60);
  assert.equal(model.fills.filter(fill => fill === 1).length, 26);
  assert.ok(Math.abs(model.fills[26] - .235) < 1e-10);
  assert.ok(Math.abs(model.percent - 43.725) < 1e-10);
  assert.ok(Math.abs(model.fills.reduce((sum, fill) => sum + fill, 0) * model.brickValue - 87450) < 1e-8);
});

test('cero, meta alcanzada y sobrepasada mantienen valores coherentes', () => {
  assert.ok(campaignModel({ goal: 200000, raised: 0 }).fills.every(fill => fill === 0));
  for (const raised of [200000, 250000]) {
    const model = campaignModel({ goal: 200000, raised });
    assert.equal(model.percent, 100);
    assert.equal(model.remaining, 0);
    assert.equal(model.raised, raised);
    assert.ok(model.fills.every(fill => fill === 1));
  }
});

test('aportes parciales, nuevos ladrillos y correcciones conservan el total', () => {
  for (const raised of [1, 1999, 2000, 87451, 89450, 80000]) {
    const model = campaignModel({ goal: 200000, raised });
    assert.ok(Math.abs(model.fills.reduce((sum, fill) => sum + fill, 0) * model.brickValue - raised) < 1e-8);
  }
});

const feed = (raised = '87450,00') => 'Campo,Valor\r\ngoal,"200000,00"\r\nraised,"'+raised+'"\r\nbrickCount,60\r\n'+
  Array.from({length:BRICK_COUNT},(_,i)=>`brick${i+1},${i===0?'"Familia Pérez, Ana y Luis"':i===59?'"Último aportante"':''}`).join('\r\n');

test('lee la fuente de Sheets con coma decimal, comillas y los 60 lugares', () => {
  const model = campaignFromCsv('\uFEFF'+feed());
  assert.equal(model.raised, 87450);
  assert.equal(model.brickLabels[0], 'Familia Pérez, Ana y Luis');
  assert.equal(model.brickLabels[1], '');
  assert.equal(model.brickLabels[59], 'Último aportante');
  assert.equal(campaignFromCsv(feed('87450.25')).raised,87450.25);
  assert.equal(campaignFromCsv(feed().replace('"Familia Pérez, Ana y Luis"','"Ana ""Lala""\nPérez"')).brickLabels[0],'Ana "Lala"\nPérez');
});

test('rechaza feeds incompletos, errores de fórmulas y montos mal formados', () => {
  for (const bad of ['<html>Iniciar sesión</html>',feed(''),feed('-10'),feed('NaN'),feed('87.450,00'),
    feed().replace('brickCount,60','brickCount,100'),feed().replace('brick60,"Último aportante"',''),
    feed()+'\r\nraised,0',feed().replace('Familia Pérez, Ana y Luis','#REF!'),feed()+'"']) {
    assert.throws(()=>campaignFromCsv(bad));
  }
});

test('rechaza montos inválidos y metas que no permiten calcular progreso', () => {
  for (const data of [null, {}, { goal: 0, raised: 20 }, { goal: -1, raised: 20 },
    { goal: 200000, raised: -1 }, { goal: 200000, raised: '87450' },
    { goal: Infinity, raised: 20 }, { goal: 200000, raised: NaN }]) {
    assert.throws(() => campaignModel(data), TypeError);
  }
});

test('el formulario usa HTTPS o el contacto del club', () => {
  assert.equal(contributionLink('https://example.com/form'), 'https://example.com/form');
  for (const link of ['', undefined, 'javascript:alert(1)', 'http://example.com']) {
    assert.ok(contributionLink(link).startsWith('mailto:info@ceibosclub.com?'));
  }
});
