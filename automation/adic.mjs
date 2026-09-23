// ADIC publishes UTC timestamps without a suffix. Its own portal converts them
// to Uruguay time; retain the original values alongside the normalized fixture.
const api = 'https://api2-adic.solcre.dev/public/tournaments';
const clock = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Montevideo', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});

export function adicDate(value) {
  if (!value) return null;
  const date = new Date(/[Zz]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = Object.fromEntries(clock.formatToParts(date).map(p => [p.type, p.value]));
  return { fecha: `${parts.year}-${parts.month}-${parts.day}`, hora: `${parts.hour}:${parts.minute}` };
}

export function parseAdicMatches(matches, tournament, teams, season) {
  if (!Array.isArray(matches)) throw new Error('ADIC: partidos inválidos');
  const records = [];
  for (const match of matches) {
    const date = adicDate(match.scheduled_at);
    if (!date || !date.fecha.startsWith(`${season}-`)) continue;
    for (const team of teams.filter(t => t.category)) {
      const local = match.home_team?.id === team.id;
      if (!local && match.away_team?.id !== team.id) continue;
      const rival = (local ? match.away_team : match.home_team)?.name;
      if (!rival) continue;
      const common = { deporte: 'futbol', categoria: team.category, rival,
        ...date, local, fase: `ADIC · ${tournament.name}`, fuente: tournament.url,
        adicId: match.id, equipoAdic: team.name };
      if (match.status === 'finished') {
        const valid = value => value !== null && value !== '' && Number.isInteger(Number(value)) && Number(value) >= 0;
        if (!valid(match.home_goals) || !valid(match.away_goals)) continue;
        records.push({ ...common, kind: 'resultado',
          gf: Number(local ? match.home_goals : match.away_goals),
          gc: Number(local ? match.away_goals : match.home_goals) });
      } else if (['pending', 'confirmed', 'postponed', 'suspended'].includes(match.status)) {
        records.push({ ...common, kind: 'partido', cancha: 'A confirmar',
          estado: ({ pending: 'Programado', confirmed: 'Confirmado', postponed: 'Postergado', suspended: 'Suspendido' })[match.status] });
      }
    }
  }
  return records;
}

async function getJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000),
    headers: { accept: 'application/json', 'user-agent': 'CeibosClubFixtureBot/1.0' } });
  if (!response.ok) throw new Error(`ADIC HTTP ${response.status}`);
  return response.json();
}

export async function syncAdic(config, previous = {}, request = getJson) {
  const tournaments = [];
  const diagnostics = [];
  for (const tournament of config.tournaments) {
    try {
      const [matches, standings] = await Promise.all([
        request(`${api}/${tournament.id}/matches`), request(`${api}/${tournament.id}/standings`)
      ]);
      if (!Array.isArray(matches.played) || !Array.isArray(matches.upcoming) || !Array.isArray(standings.series)) {
        throw new Error('ADIC cambió el formato de partidos o tablas');
      }
      const ids = new Set(config.teams.map(t => t.id));
      const games = [...matches.played, ...matches.upcoming].filter(m => ids.has(m.home_team?.id) || ids.has(m.away_team?.id));
      if (!games.length) throw new Error('ADIC no devolvió los partidos conocidos de Ceibos');
      const tables = standings.series.filter(s => s.standings.some(row => ids.has(row.team_id)))
        .map(s => ({ id: s.series_id, name: s.series_name,
          rows: s.standings.map(row => ({ position: row.position, teamId: row.team_id, name: row.team.name,
            pj: row.played, pg: row.won, pe: row.drawn, pp: row.lost,
            gf: row.goals_for, gc: row.goals_against, points: row.points })) }));
      // Store only sporting data. Never request registration/player-card records.
      tournaments.push({ ...tournament, updatedAt: new Date().toISOString(), tables,
        matches: games.map(m => ({ id: m.id, matchday: m.matchday, status: m.status,
          scheduled_at: m.scheduled_at, home_goals: m.home_goals, away_goals: m.away_goals,
          home_team: { id: m.home_team.id, name: m.home_team.name },
          away_team: { id: m.away_team.id, name: m.away_team.name } })) });
      diagnostics.push({ deporte: 'futbol', url: tournament.url, registros: games.length, estado: 'ok' });
    } catch (error) {
      const saved = previous.tournaments?.find(t => t.id === tournament.id);
      if (saved) tournaments.push(saved);
      diagnostics.push({ deporte: 'futbol', url: tournament.url, registros: 0, estado: 'error', detalle: error.message });
    }
  }
  const snapshot = { season: config.season, teams: config.teams, tournaments };
  const records = tournaments.flatMap(t => parseAdicMatches(t.matches, t, config.teams, config.season));
  return { snapshot, records, diagnostics };
}

export function replaceAdicData(previous, snapshot) {
  // Replace by stable team/tournament records, so postponed or deleted dates do
  // not linger. Failed requests use the last successful tournament snapshot.
  const covered = new Set(snapshot.teams.filter(team => team.category && snapshot.tournaments.some(t =>
    t.matches.some(m => m.home_team.id === team.id || m.away_team.id === team.id))).map(t => t.category));
  const keep = row => row.deporte !== 'futbol' || !covered.has(row.categoria);
  return { ...previous, partidos: (previous.partidos ?? []).filter(keep), resultados: (previous.resultados ?? []).filter(keep) };
}
