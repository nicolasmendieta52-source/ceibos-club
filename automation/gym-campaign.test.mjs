import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignModel, contributionLink } from '../assets/gym-campaign.js';

test('el monto real llena 43 ladrillos y el 72,5% del siguiente', () => {
  const model = campaignModel({ goal: 200000, raised: 87450 });
  assert.equal(model.remaining, 112550);
  assert.equal(model.brickValue, 2000);
  assert.equal(model.fills.filter(fill => fill === 1).length, 43);
  assert.ok(Math.abs(model.fills[43] - .725) < 1e-10);
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
    assert.ok(Math.abs(model.fills.reduce((sum, fill) => sum + fill, 0) * 2000 - raised) < 1e-8);
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
