# Notificaciones del Interno

Activación en `/#interno` → **Elegir mis avisos**, o desde la campana de notificaciones. El Interno requiere opt-in propio: no se activa para personas que ya seguían los deportes del club. El acceso desde el Interno selecciona solo este torneo para un visitante nuevo; mantiene las preferencias de quienes ya estaban suscriptos.

Desde el 16/11 también hay una estrella en cada grupo y equipo (en Grupos y Equipos). Abre las preferencias con ese objetivo seleccionado: una persona nueva sigue solo ese objetivo, y una suscripción existente lo suma a su selección. La activación o modificación se confirma con el botón habitual. La estrella se rellena únicamente después de guardar con notificaciones habilitadas; también refleja equipos cubiertos por un grupo o una categoría completa. Una estrella ya rellena permite editar los avisos. Guardar o desactivar actualiza las estrellas sin recargar la página.

Se pueden combinar **categorías completas, grupos y varios equipos puntuales**. Por ejemplo: todo Femenino, el Grupo A de Masculino y Everton de Papi. No hace falta activar una categoría completa para elegir uno de sus grupos o equipos. Los tres criterios se suman; el filtro de tipo de aviso se aplica a todos. Si un partido coincide con más de un criterio, se envía una sola vez a cada suscripción.

Los grupos incluyen a sus equipos también en eliminatorias e interzonales: se utilizan los grupos del local y del visitante, además del grupo explícito del partido. No se inventa una tercera zona para los interzonales de Papi. Se mantienen los cinco tipos de aviso: partido nuevo, cambio/suspensión/cancelación, recordatorio del día, inicio y resultado/corrección. Las opciones se leen de `data/interno.json` (12 grupos y 44 equipos al 16/11); si falla la lectura se conservan las preferencias anteriores y siguen disponibles las categorías completas.

Las preferencias se guardan localmente y en la suscripción existente de Firebase: `deportes.interno` y `deportes.internoOpciones` con `version: 2`, `categories`, `groupIds`, `teamIds` y `events`. Las suscripciones anteriores sin esa versión siguen usando su filtro original de categoría **y** un solo `teamId`; no se amplían sus avisos por el despliegue. Al editar y guardar, la interfaz migra esa selección al formato combinado. Las reglas actuales permiten el mapa anidado y solo el dueño de la suscripción puede actualizarla. No se cambiaron permisos ni se incorporaron datos de contacto. Desactivar elimina la suscripción y cancela Web Push en el navegador. En iPhone se muestran las instrucciones para instalar Ceibos en la pantalla de inicio antes de solicitar permiso; el permiso se pide dentro del clic del usuario.

## De dónde salen los avisos

La fuente es `data/interno.json`, con sus equipos y partidos validados por `assets/interno-model.js`. Desde el 11/11/2026, Masculino y Femenino se importan cada hora desde https://interno2026.ceibosfutbol.workers.dev/ (ver `docs/interno-datos.md`). Los resultados se cargan en esa aplicación; la web no extrae resultados de Instagram. Cada partido conserva un ID estable, equipo local/visitante, categoría y `status: "finished"`, `homeGoals`, `awayGoals` al confirmarse el resultado; los penales se guardan aparte. El fixture requiere fecha para anunciarse y fecha/hora válidas para programar su inicio.

- **Nuevo:** partido programado que todavía no comenzó y tiene fecha. Si se publica el mismo día después de las 9 h, se utiliza un único aviso «Hoy se juega».
- **Día:** una vez por partido y fecha, desde las 9 h de Montevideo, antes del comienzo. No se envía de madrugada ni después de un inicio conocido.
- **Cambio:** modificaciones de fecha, hora, equipos, sede, fase o estado. Usar `cancelled`, `postponed` o `suspended` para informar ese estado; borrar una fila cancela su temporizador, pero no se interpreta como una cancelación oficial.
- **Inicio:** el vigilante existente combina el fixture del club con el del Interno. Lee de nuevo cinco minutos antes y programa el envío para la hora del fixture. Si cambia el horario, los equipos o se suspende/elimina un partido, reconstruye o cancela el temporizador. No se notifican partidos finalizados ni inicios con más de 15 minutos de demora.
- **Resultado:** al pasar a finalizado o corregir un marcador/penales. Se consideran cargas recientes (partidos de los últimos dos días o sin fecha); el historial existente en la primera puesta en marcha se toma como base, sin avisos retrospectivos.

`Notificaciones del Interno` corre al publicar cambios del JSON y cada cinco minutos, con un único proceso a la vez. Su comparación y sus reservas se guardan en Firestore (`internoNotificationControl` e `internoNotificationDispatches`), accesibles solo al servidor. No genera commits ni republicaciones periódicas. Las reservas evitan duplicar avisos si un proceso se reinicia; si falla todo el transporte, se libera la reserva y se conserva la base anterior para reintentar. Los suscriptores vencidos se retiran como en el sistema anterior.

GitHub puede demorar el arranque de trabajos programados y los servicios push pueden demorar la entrega. La preparación anticipada evita esperar a otra revisión de cron cuando el vigilante ya está activo; no garantiza el instante de recepción en un teléfono sin conexión o con las notificaciones silenciadas.

Al tocar un aviso se abre la categoría y la pestaña de fixture/resultados, resaltando el partido. Se preserva el mismo destino cuando ya hay una ventana de Ceibos abierta.

## Verificación sin molestar a los usuarios

`node automation/send-interno-notifications.mjs --dry-run` calcula eventos localmente sin conexión ni envíos. Ejecutar manualmente el workflow **Notificaciones del Interno**, con `dry_run: true`, verifica la configuración privada y los permisos de Firebase sin enviar avisos ni modificar la base de comparación. No utilizar la opción antigua `--test`, que envía pruebas a las suscripciones reales del club.

Las pruebas de `automation/interno-notifications.test.mjs` cubren filtros, correcciones, suspensiones, duplicados, enlaces y horario de Montevideo; las del temporizador comprueban la preparación cinco minutos antes. La verificación de navegador usa transporte y Firebase simulados: no registra suscripciones ficticias ni envía notificaciones de prueba al público.
