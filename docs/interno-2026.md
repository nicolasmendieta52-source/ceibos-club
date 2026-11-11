# Interno 2026

La sección `/#interno` conserva inscripción por WhatsApp (091 393 252), reglamento PDF, anuncio del 16 de noviembre y recuerdos de 2025. Los datos de esta edición están en `data/interno.json`. El navegador vuelve a leer ese archivo cada minuto mientras la página está visible; después de editarlo hay que publicar el cambio. No se extraen automáticamente historias de Instagram.

Las notificaciones del Interno se activan desde **Elegir mis avisos** o desde la campana, con preferencias de categoría, equipo y tipo de aviso. Consumen los partidos de este mismo JSON; su funcionamiento, filtros y revisión automática están documentados en `docs/interno-notificaciones.md`.

## Fuente y categorías

Los nombres de 2026 deben comprobarse en la destacada oficial: https://www.instagram.com/stories/highlights/18091351253226215/. Cada equipo lleva `sourceUrl`; `teamsVerifiedAt` indica la fecha real de comprobación. No trasladar campeones de 2025 a 2026 por suposición. Si todavía no se pueden verificar, la lista permanece vacía.

El 28/10/2026 se incorporaron 33 nombres y escudos extraídos de la grabación de esa destacada aportada por el usuario. El detalle y los segundos del video están en `docs/interno-equipos-2026.md`. Los escudos se sirven desde `assets/interno/equipos/2026/`.

El 10/11/2026 se actualizaron los equipos y grupos con las tres placas del 9/11 aportadas por el usuario: 22 masculinos (A–F) y 16 femeninos (A–D). Se agregaron Orleans, La Vuelta, Dep. Resaca, Pata de Palo y Ramillete. Las placas originales están en `assets/interno/grupos/2026/`; cada grupo conserva su `sourceUrl`. La pestaña inicial es Grupos; Equipos conserva la lista completa y Posiciones calcula una tabla por grupo. Sin partidos finalizados, las tablas muestran cero partidos y ningún puesto asignado.

Los cinco escudos nuevos se muestran desde los píxeles de esas placas mediante un SVG con `viewBox`, sin recrearlos. `logoCrop` guarda `x`, `y`, `width`, `height`, `imageWidth` e `imageHeight`; `shape: "ellipse"` permite ocultar las esquinas del fondo de las placas alrededor de los escudos ovalados/circulares. La validación rechaza encuadres fuera de la imagen. Los 33 escudos anteriores, incluido Atlético Sin GPS completo, conservan sus archivos originales.

La pestaña **Formato y cruces** usa `categories[].format`: etapas, copas, cruces por posición, recorrido de jornadas y video local. Los tres videos aportados por el usuario el 10/11 completan el formato de Masculino, Femenino y Papi fútbol. Aunque los títulos originales dicen «Propuesta de formato», el usuario confirmó expresamente que son definitivos y que Papi fútbol es la categoría +38 existente (`mas38`). El detalle de fuentes y reglas está en `docs/interno-formatos-2026.md`.

No se generan emparejamientos con nombres ni fechas a partir de los diagramas. En Femenino deben evitarse cruces de cuartos entre equipos del mismo grupo. Papi tiene dos zonas de tres plazas confirmadas, pero aún no se cargaron nombres: las zonas conservan `expectedTeams: 3` y la nómina queda pendiente. Su puntuación permanece sin definir hasta tener esa información específica; la confirmación del recorrido no confirma los criterios de puntos.

El reglamento local `assets/reglamento-interno-f8-ceibos-2026.pdf` confirma Masculino, Femenino y Masculino +38, inicio el 16/11, cierre de inscripción el 9/11 y jornadas nocturnas de lunes/miércoles. +38 tiene reglas propias: no se calcula su tabla hasta confirmar y configurar su puntuación. No publicar información privada de las inscripciones.

## Cargar equipos, series y partidos

Los siguientes objetos son ejemplos de formato; **no son participantes reales** y no deben copiarse a producción sin reemplazar sus datos.

```json
{
  "teams": [
    {"id":"equipo-a","name":"Nombre confirmado A","categoryId":"masculino","groupId":"mas-a","sourceUrl":"https://www.instagram.com/stories/highlights/18091351253226215/"},
    {"id":"equipo-b","name":"Nombre confirmado B","categoryId":"masculino","groupId":"mas-a","sourceUrl":"https://www.instagram.com/stories/highlights/18091351253226215/"}
  ],
  "groups": [{"id":"mas-a","categoryId":"masculino","name":"Serie A"}],
  "matches": [
    {"id":"mas-fecha1-a-b","categoryId":"masculino","stage":"groups","groupId":"mas-a","round":"Fecha 1 · Serie A","homeId":"equipo-a","awayId":"equipo-b","date":"2026-11-16","time":"21:00","status":"scheduled"}
  ]
}
```

Categorías: `masculino`, `femenino`, `mas38`. IDs únicos de letras minúsculas, números y guiones. Equipos sin serie conocida: omitir `groupId`. Escudos verificados: agregar `logoUrl` con ruta del sitio o URL HTTPS. No usar enlaces temporales a imágenes de historias de Instagram: vencen.

El primer equipo (`homeId`) queda a la izquierda. El fixture ordena fecha/hora ascendente, los resultados descendente por fecha. Omitir `date`, `time` o `venue` si no están confirmados; nunca asignar una cancha por categoría. Estados: `scheduled`, `postponed`, `suspended`, `finished`, `cancelled`. Fases: `groups` y `playoffs`. Un partido de grupos requiere una serie existente y dos equipos de esa serie.

Para finalizar un partido, cambiar a `status: "finished"` y agregar `homeGoals`, `awayGoals` (números enteros). Una tanda de eliminatorias se agrega como `"penalties":{"home":3,"away":2}` sobre un marcador empatado; no sumar los penales al resultado ni a goleadores. Se puede añadir `sourceUrl` con la publicación oficial.

Goleadores dentro del partido:

```json
"scorers": [
  {"player":"Nombre público del jugador","teamId":"equipo-a","goals":2}
]
```

Se suman automáticamente los goles registrados en partidos finalizados, por jugador y equipo. No se inventan autores de goles faltantes. Verificar la ortografía para no duplicar jugadores.

## Posiciones

Masculino/Femenino: victoria 3, empate 1, derrota 0. Solo cuentan resultados de grupos; se aplican diferencia de goles, goles a favor y enfrentamientos entre los equipos empatados. Si persiste igualdad, comparten puesto con asterisco hasta resolución oficial. Las eliminatorias no alteran las tablas de grupos.

Una quita oficial puede cargarse en el equipo con `pointsAdjustment: -3` y `adjustmentNote` obligatorio. WO simple: registrar el 2–0 reglamentario (o marcador que corresponda según resolución). Doble incomparecencia: resultado 0–0 y `doubleForfeit: true`; ambos suman partido perdido sin puntos ni goles.

El enlace de formulario es opcional: solo reemplaza WhatsApp si `registrationOpen` es `true` y `registrationUrl` contiene un enlace HTTPS válido. Si falla la actualización, la página conserva los últimos datos correctos y avisa que no pudo refrescar.

Validación: `node --test automation/interno.test.mjs`; regresión del sitio: `npm test`.
