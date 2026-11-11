# Ahora en las canchas

Tablero público en `/#interno-ahora`. Reúne los partidos de todas las categorías del Interno, independientemente de la categoría seleccionada en las pestañas del torneo. Se puede filtrar por cancha.

El reloj es **estimado según la hora de inicio cargada**. No recibe señales del árbitro, no conoce pausas reales ni modifica resultados. Usa la fecha y hora de Montevideo, aunque el visitante esté en otro huso horario. Se recalcula cada segundo y al regresar a la pestaña; la fuente `data/interno.json` mantiene su actualización automática cada 60 segundos. Si falla la red, conserva el último fixture e indica el problema.

## Duración

La indicación del usuario del 11/11/2026 establece dos tiempos de 25 minutos y 5 de entretiempo para este tablero. El campo `minutesPerHalf` de Femenino se ajustó a 25 para mantener la misma referencia en los datos; el PDF original no se modificó.

`clock.halfMinutes: 25` y `clock.breakMinutes: 5` en `data/interno.json` controlan las etapas:

- Desde el inicio hasta 24:59: primer tiempo.
- Al cumplir 25 minutos: descanso, con cuenta regresiva de 05:00.
- Al cumplir 30 minutos desde el inicio: segundo tiempo, desde 25:00 hasta 49:59 de juego.
- Al cumplir 55 minutos desde el inicio: se detiene en 50:00, con «Tiempo reglamentario cumplido» y «Resultado a confirmar». Sigue visible durante una hora, separado de los partidos activos.

El tablero también muestra la próxima tanda de partidos si empieza dentro de las siguientes 24 horas. Partidos finalizados, cancelados, suspendidos, postergados o sin fecha/hora válida no generan un reloj activo.

## Datos que hay que cargar

Cada partido requiere los campos existentes `id`, `categoryId`, `stage`, `groupId` cuando corresponda, `homeId`, `awayId`, `date`, `time` y `status: "scheduled"`. Los equipos y grupos deben existir en el torneo. `date` usa `AAAA-MM-DD` y `time`, `HH:mm` en Montevideo.

Para ubicarlo, agregar `court`, por ejemplo `"Cancha 1"`, y opcionalmente `venue`, por ejemplo `"Ceibos"`. Se muestran juntos para distinguir canchas con el mismo número en sedes distintas. Si solo existe `venue`, se usa esa referencia. Sin ambos datos se muestra «Cancha a confirmar», sin asignarle una cancha por suposición. El fixture y los avisos de notificaciones usan la misma referencia.

Si hubo un atraso confirmado, `startedAt` permite corregir el reloj: fecha/hora ISO con segundos y huso explícito, por ejemplo `"2026-11-16T20:07:00-03:00"`. Este campo corrige únicamente el reloj; el horario anunciado y los avisos de inicio siguen `date`/`time`. Una reprogramación oficial debe actualizar también esos campos del fixture.

Al confirmar el resultado se debe mantener el procedimiento existente: `status: "finished"`, `homeGoals` y `awayGoals`. El reloj nunca convierte el tiempo transcurrido en un resultado final.

Al implementar el tablero, el fixture real aún estaba vacío (`matches: []`). Los partidos de las verificaciones de navegador se simulan fuera del repositorio y no se publican.
