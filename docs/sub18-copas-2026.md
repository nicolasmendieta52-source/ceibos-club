# Sub 18: Copas 2026

El 20/10/2026 se confirmó que Ceibos juega la **Copa de Oro** de Sub 18 en la Liga Universitaria. La página pública de Copas es https://ligauniversitaria.org.uy/estadisticas-futbol-sub-18-copas/ y publica los iframes de posiciones, resultados, próximos partidos y goleadores. La copa de Ceibos utiliza `F181818O.html` (configuración 74, temporada 113 = 2026).

La fuente se agregó como `liga-fixture-index` en `automation/fuentes.json`, para releer sus enlaces en cada ejecución. Se conservan las fuentes de la primera y segunda rueda. Las tablas y goleadores de Sub 18 se actualizan juntos, una vez por categoría, separando la Copa de Oro de la Serie 5.

La lectura inicial confirma Maristas Deportivo 4–2 Ceibos del 18/10/2026 y seis próximas fechas. Los horarios de medianoche de la Liga se mantienen como «A confirmar»; no se deducen horarios de otros partidos. La actualización utiliza el workflow existente de datos del club, cada seis horas, sin crear una automatización aparte.

Verificación: `node --test automation/sub18-sync.test.mjs`, más la suite completa existente. Los casos cubren la transición a Copas, localía, reemplazo del partido ya disputado, preservación del historial, goleadores y tablas de cada fase sin sumar sus totales.
