import test from 'node:test';
import assert from 'node:assert/strict';
import { adicDate, parseAdicMatches, syncAdic, replaceAdicData } from './adic.mjs';
import { mergeClubData } from './sync-club-data.mjs';
const teams = [{ id: 653, name: 'Ceibos Club senior 40', category: 'Papi Fútbol +40' },
  { id: 719, name: 'Ceibos Club amarillo', category: null }];
const tournament = { id: 1467, name: 'Clasificatorio', url: 'https://portal.adic.org.uy/calendar/tournaments/1467' };
const match = { id: 1, scheduled_at: '2026-03-27T00:00:00', status: 'finished', home_goals: 2, away_goals: 4,
  home_team: { id: 11, name: 'Rival' }, away_team: { id: 653, name: teams[0].name } };

test('ADIC UTC dates become Uruguay dates, including the preceding evening', () => {
  assert.deepEqual(adicDate(match.scheduled_at), { fecha: '2026-03-26', hora: '21:00' });
  assert.equal(adicDate('invalid'), null);
});
test('away scores and team identities stay separate; finished zero draws count', () => {
  const [row] = parseAdicMatches([match], tournament, teams, 2026);
  assert.equal(row.gf, 4); assert.equal(row.gc, 2); assert.equal(row.local, false);
  const merged = mergeClubData({}, [row], []);
  assert.equal(merged.resultados[0].adicId, 1); assert.equal(merged.resultados[0].local, false);
  assert.equal(parseAdicMatches([{ ...match, away_team: { id: 719, name: 'Ceibos amarillo' } }], tournament, teams, 2026).length, 0);
  assert.equal(parseAdicMatches([{ ...match, home_goals: 0, away_goals: 0 }], tournament, teams, 2026)[0].kind, 'resultado');
});
test('unplayed zero scores, missing scores, cancellations and other years are not results', () => {
  assert.equal(parseAdicMatches([{ ...match, status: 'pending', home_goals: 0, away_goals: 0 }], tournament, teams, 2026)[0].kind, 'partido');
  for (const change of [{ home_goals: null }, { status: 'cancelled' }, { scheduled_at: '2027-02-21T12:00:00' }])
    assert.equal(parseAdicMatches([{ ...match, ...change }], tournament, teams, 2026).length, 0);
});
test('failed ADIC refresh retains previous data; successful refresh removes rescheduled duplicates only for ADIC', async () => {
  const previous = { tournaments: [{ ...tournament, matches: [match], tables: [] }] };
  const result = await syncAdic({ season: 2026, teams, tournaments: [tournament] }, previous, async () => { throw Error('offline'); });
  assert.equal(result.records.length, 1); assert.equal(result.diagnostics[0].estado, 'error');
  const other = { deporte: 'futbol', categoria: 'Primera', fecha: '2026-03-26', rival: 'Other' };
  const cleaned = replaceAdicData({ partidos: [{ ...other, categoria: 'Papi Fútbol +40' }, other] }, result.snapshot);
  assert.deepEqual(cleaned.partidos, [other]);
});
