# Estadísticas deportivas 2026

`automation/sync-competition-stats.mjs` consulta posiciones y goleadores desde las fuentes públicas y escribe `data/competition-stats-2026.json`. El workflow existente `actualizar-datos-club.yml` lo ejecuta cada seis horas, todos los días incluidos sábados y domingos. Los resultados y sus goleadores también se consultan para todas las fases que publica la Liga en las páginas de cada categoría.

Fuentes: Liga Universitaria (JSON de posiciones y goleadores, temporada 113 = 2026), FUH (tablas HTML y ranking público de cada torneo), 50/22 (posiciones, bonus y rankings de Top 12 respaldados por las noticias de la fuente), ADIC (tablas existentes en club-data). Reserva FUH no rotula el año en el título: usa la temporada 2026 configurada en fuentes.json; un año explícito diferente siempre se excluye.

Cada tabla mantiene el orden y los puntos de su fuente: no se reconstruyen sanciones, bonus ni desempates. Los rankings se separan por fase y no se suman. Algunos rankings publicados tienen cobertura limitada; no sustituyen el recuento de goleadores de Ceibos a partir de actas. Para datos de rugby provenientes de artículos se muestra también la fecha original del artículo.

Se exportan únicamente nombres deportivos y cifras, no objetos completos de las APIs, usuarios administradores ni correos. Ante un fallo se conserva la última tabla con su fecha original y una advertencia. La ejecución informa el fallo después de guardar las fuentes que sí respondieron. Una categoría sin tabla o ranking público muestra esa limitación en lugar de inventar datos (por ejemplo, Pre Intermedia de rugby o goleadores ADIC).

Validación: `node --test automation/*.test.mjs`. Sincronización: `node automation/sync-competition-stats.mjs`.
