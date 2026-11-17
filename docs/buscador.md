# Buscador de Ceibos

La lupa de la cabecera abre un buscador con sugerencias en PC y celular. También está al inicio del menú móvil. `Ctrl/⌘ K` o `/` abren el diálogo; las flechas eligen una sugerencia, Enter abre el destino y Escape cierra. Al cerrar se devuelve el foco al botón de apertura; si venía del menú móvil, vuelve a la lupa visible.

Secciones, deportes y categorías; equipos, grupos, fixture, resultados, goleadores y cruces del Interno; reglamento PDF, noticias y eventos publicados. Los resultados usan los enlaces reales de la web. Las categorías deportivas admiten `?deporte=futbol&categoria=Sub%2018#futbol`; los equipos mantienen `internoEquipo` y los partidos, `internoPartido`. Las noticias conservan sus anclas y cada evento obtiene una ancla estable por fecha y título.

`assets/search-model.js` genera y ordena el índice. Ignora tildes y mayúsculas, admite prefijos y alias como gym/básquet, y si no encuentra coincidencias ofrece aproximaciones para errores pequeños. Los números de categorías no se corrigen por aproximación. Las frases comunes como «partidos de Rapiñeros» llevan al equipo. El texto de consulta y los resultados se muestran como texto, nunca como HTML.

El índice se arma en el navegador. La página comparte sus datos públicos ya cargados por `ceibos:search-content` y `ceibos:interno-search-data`; el buscador no añade consultas al origen de Google ni envía las búsquedas a un servicio externo. Las actualizaciones deportivas y del Interno renuevan los resultados sin borrar lo escrito. Si aún no llegó el Interno, siguen disponibles las secciones y se explica que los equipos están cargando. No se indexan el panel privado, sus usuarios ni las inscripciones retiradas.

Validación: `node --test automation/search.test.mjs`. La verificación de navegador comprueba apertura/cierre, teclado, errores de escritura, enlaces a equipos y categorías, menú móvil, noticias/eventos, carga tardía y disposición desde 320 px.
