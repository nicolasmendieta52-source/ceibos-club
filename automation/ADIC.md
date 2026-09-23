# Papi Fútbol — ADIC 2026

`adic.json` maps the official stable team IDs to the website categories and lists
the 2026 tournaments discovered through https://portal.adic.org.uy/tournaments.
The existing `sync:club` job reads the public matches and standings endpoints
every six hours, alongside the other sports. No authentication is needed.

`data/club-data.json` contains normalized `partidos` and `resultados`, plus `adic`:
the official team names, tournament URLs, last successful fetch time, standings
for the series containing Ceibos and sporting records for Ceibos matches.

Team 719 remains **Papi Fútbol Amarillo** until the club confirms whether it is
the +35 team. Team 739 (+50) was found in the 2026 qualifying tournament only.
When confirming a mapping, update `adic.json`, home categories and the archive
together, and remove the previous category's normalized records during migration.

ADIC's timezone-less timestamps are UTC, as used by its own portal. We convert to
America/Montevideo, including changes of calendar day. Only finished matches
with two valid scores count as results. Unknown venues remain “A confirmar”.
Matches dated outside 2026 remain in the source snapshot but are excluded from
the 2026 fixture/statistics, with an explanation and source links in the website.

Each successful tournament response replaces that tournament's snapshot. If a
request fails or changes shape, retain the last successful snapshot and record
an error in `diagnostico.fuentes`. Rebuilding normalized ADIC records prevents
obsolete dates or corrected scores from lingering. Other sports are preserved.

Tests: `node --test automation/adic.test.mjs` (also included in `npm test`).
