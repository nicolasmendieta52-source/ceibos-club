# Investigación del archivo histórico de Ceibos Club

Fecha de corte: 1 de septiembre de 2026.

## Criterio aplicado

- Se priorizaron fuentes institucionales: Liga Universitaria de Deportes, Federación Uruguaya de Hockey y Unión de Rugby del Uruguay.
- Un dato histórico se publica solo si puede vincularse con una fuente identificable.
- La estadística de la temporada 2026 no se copia a este archivo: la web la calcula desde `data/club-data.json`, que sigue siendo actualizado por la automatización.
- La ausencia de un logro en las fuentes consultadas no se interpreta como prueba de que el logro no exista. En la web se informa como dato todavía no documentado.
- La fecha de afiliación institucional no se usa como fecha de inicio de cada categoría.

## Hallazgos confirmados

### Fútbol

| Año | Categoría | Hallazgo | Fuente |
|---|---|---|---|
| 1998 | Institución | Ceibos Club figura afiliado a la Liga Universitaria el 18/03/1998. | Liga Universitaria — Afiliación de instituciones por fecha |
| 2022 | Sub 20 | Campeón de la Divisional A. | Liga Universitaria — “¡Náutico campeón en Sub 20!” |
| 2022 | Sub 20 | Finalista de la Copa de Campeones; derrota 0-1 ante Náutico. | Misma nota oficial |
| 2025 | Reserva | Vicecampeón de la Divisional B y ascenso. | Liga Universitaria — Campeones y ascensos 2025 |

### Rugby

| Año | Categoría | Hallazgo | Fuente |
|---|---|---|---|
| 2017 | Primera | Debut en la Zona Campeonato del Uruguayo de Clubes. | URU |
| 2017 | M19 | Campeón de Copa de Plata del Valentín Martínez. | URU |
| 2017 | Seven | Finalista de Copa de Oro y reconocimiento Fair Play/equipo revelación. | URU |
| 2018 | Seven | Campeón de Copa de Plata del Seven URU. | URU |
| 2021 | Primera | Campeón del Torneo Reubicación; final 16-11 ante Champagnat. | URU |
| 2026 | Primera | Finalista de Copa de Plata del Apertura; derrota 19-28 ante Lobos. | URU |

### Hockey

- Se encontró participación oficial de Los Ceibos en la Divisional A de la Liga Universitaria en 2016.
- Los resultados 2026 de Intermedia A, Intermedia B y Sub 18 tienen páginas públicas de la FUH.
- La FUH también publica una página de Reserva (`category_id=2`).

### Basketball

- La web institucional lo identifica como la disciplina más joven.
- La Liga Universitaria publica el fixture y los resultados de la Divisional B 2026.

## Información que no se pudo confirmar

- Año exacto de inicio de cada categoría de fútbol.
- Relación histórica exacta entre la afiliación de Ceibos Club en 1998 y la identidad institucional actual que comunica 2014.
- Palmarés completo de Primera, Reserva Verde, PreSenior y Sub 18 de fútbol.
- Palmarés completo de Intermedia y Pre Intermedia de rugby.
- Palmarés histórico de las cinco categorías actuales de hockey.
- Año de comienzo y palmarés histórico de Basketball.
- Goleadores históricos acumulados por disciplina. Solo fútbol ofrece autores de goles en parte de los resultados actuales; por eso la web muestra goleadores de 2026 cuando están disponibles y no fabrica una tabla histórica.

## Discrepancias y decisiones

1. **1998 y 2014 no se unifican.** 1998 se muestra como fecha de afiliación que publica la Liga. 2014 se conserva como año que comunica el club en su identidad actual.
2. **Reserva 2025.** La fuente oficial la denomina “Ceibos” en Reserva B. En el archivo se asocia el logro a la actual tarjeta “Reserva A”, indicando expresamente el cambio de divisional por el ascenso.
3. **Hockey histórico y actual.** El antecedente 2016 proviene de la Liga Universitaria; los datos actuales provienen de la FUH. La interfaz muestra ambos contextos sin presentarlos como la misma competencia.
4. **Datos incompletos.** Las tarjetas permanecen visibles para todas las categorías actuales, pero muestran un estado “A documentar” cuando no existe evidencia oficial suficiente.

## Arquitectura implementada

- Datos históricos curados: `data/sports-history.json`.
- Datos deportivos actuales y automatizados: `data/club-data.json`.
- Presentación y cálculo de estadísticas: `index.html`.
- Rutas internas: `#archivo/{deporte}` y `#archivo/{deporte}/{categoria}`.

Esta separación permite ampliar el archivo histórico sin tocar el scraper ni mezclar hechos históricos verificados con resultados que cambian cada semana.
