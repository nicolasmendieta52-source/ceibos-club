const key = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const category = p => `${key(p.deporte)}|${key(p.categoria)}`;

// PDF fixtures fill missing dates; published results and later official fixes win.
export function applyProvisionalFixtures(data, fixtures, officialRecords = []) {
  const partidos = [...data.partidos];
  const known = [...data.partidos, ...data.resultados, ...officialRecords];
  for (const fixture of fixtures) {
    const start = fixtures.filter(p => category(p) === category(fixture)).map(p => p.fecha).sort()[0];
    const present = known.some(p => category(p) === category(fixture) &&
      (p.fecha === fixture.fecha || (p.fecha >= start && key(p.rival) === key(fixture.rival))));
    if (!present) {
      const { documento, ...match } = fixture;
      partidos.push(match);
    }
  }
  partidos.sort((a,b) => a.fecha.localeCompare(b.fecha) || a.categoria.localeCompare(b.categoria));
  return {...data, partidos};
}
