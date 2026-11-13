# Fuente de datos del Interno 2026

Fuente indicada por el usuario: https://interno2026.ceibosfutbol.workers.dev/ . Ese sitio es una pantalla que carga la vista pública de una aplicación de Google Apps Script. El importador verifica ese enlace y lee el mismo estado público que recibe el visitante (`getPublicData` / `S.data`), con un navegador aislado y sin iniciar sesión. No utiliza funciones administrativas ni modifica la aplicación de origen.

El workflow **Actualizar Interno 2026** realiza una lectura por hora, además de permitir ejecución manual. Comprueba la última lectura exitosa al minuto 7, 27 y 47: si ya hubo una consulta válida durante esa hora, evita otra consulta; si falló o GitHub omitió/demoró el primer inicio, vuelve a intentarlo. El control corre antes de instalar dependencias o abrir el navegador. GitHub puede demorar sus trabajos programados.

Desde el 13/11 se añade **Mantener lectura horaria del Interno**, un vigilante activo que revisa el snapshot de `main` cada minuto. Al cambiar de hora, si falta una lectura válida, solicita `Actualizar Interno 2026` por `workflow_dispatch`. Evita duplicar una ejecución activa y reintenta fallos cada diez minutos. A los 170 minutos solicita directamente su sucesor y termina; una concurrencia única mantiene un solo vigilante activo. El cron queda como recuperación, no como único mecanismo de continuidad. Solo usa el token temporal de GitHub con `contents: read` y `actions: write`; no necesita credenciales de Google ni una computadora encendida. Deshabilitar ese workflow detiene los siguientes relevos. El modo `probe` comprueba el relevo a una ejecución `verify`, que termina sin solicitar lecturas; ambos usan una concurrencia separada de la vigilancia.

El navegador de cada visitante sigue consultando el snapshot local cada minuto: las visitas a Ceibos no generan lecturas adicionales a Google. El reloj en pantalla se recalcula cada segundo.

## Qué se actualiza

- Equipos y grupos de Masculino (`M`), Femenino (`F`) y Papi fútbol (`P` → `mas38`), conservando IDs, escudos y encuadres existentes mediante correspondencias de nombre y posteriormente el ID de origen. Los participantes vigentes se identifican por tablas, fixture y goleadores; un equipo retirado que sigue en el registro general no aumenta el cupo. Un reemplazo con ID nuevo recibe su propia identidad y no hereda el escudo del anterior.
- Fixture con ID estable, local/visitante, fase, fecha, hora y cancha. Los números de cancha se muestran como «Cancha 1», etc.; no se inventan sedes.
- Fixture y resultados agrupados por día, con encabezado de fecha y cantidad de partidos. El fixture mantiene las fechas próximas primero y los horarios ascendentes; los resultados muestran primero los días más recientes. Las fechas pendientes quedan al final. Los enlaces directos a partidos y la sincronización horaria se conservan.
- Resultados completos confirmados, incluidos 0–0 reales y penales de eliminatorias. Un marcador vacío no se convierte en cero.
- Tablas oficiales por grupo: se respeta el orden y el puntaje publicados, incluidos ajustes. Sin partidos jugados no se presentan posiciones competitivas.
- Goleadores publicados y autores de goles confirmados de cada partido. Los goles en contra no se adjudican al ranking personal.
- Cruces de eliminatorias con ambos rivales confirmados, también visibles en «Formato y cruces». Los pases directos no se cuentan como partidos; los cruces sin rivales quedan pendientes, con un aviso del total.

La lectura inicial del 11/11/2026 contiene **38 equipos y 54 partidos**: 22 equipos/30 partidos masculinos y 16 equipos/24 partidos femeninos. La fuente todavía no incluye Papi fútbol (+38); se mantienen su categoría, formato, grupos y cualquier dato local de esa categoría. No se incorporan cuentas de administración, datos de contacto ni listas privadas de jugadores.

El 12/11/2026 se confirmó en las tablas y los tres partidos del grupo C femenino el reemplazo de **Pata de Palo por Manchester Birraited**. Pata de Palo permanece en el registro de origen, pero ya no participa en el fixture. También apareció la categoría `P` vacía. El 13/11 la fuente agregó sus seis equipos y nueve partidos, lo que bloqueó la lectura anterior. Ahora se incorpora Papi completo: **44 equipos y 63 partidos** entre las tres categorías. Los partidos con `grupo: IZ` se muestran como **Interzonal**, separados de las finales y sin inventar una tercera zona. La tabla oficial de Papi conserva el puntaje publicado sin asumir la regla de puntos de Masculino/Femenino; su configuración local `points` sigue siendo `null`.

Los formatos y videos confirmados, el PDF y el contacto de inscripción se conservan. El usuario confirmó el 11/11/2026 **25 + 5 + 25 minutos para Masculino y Papi**, y **20 + 5 + 20 para Femenino**, coherente con el fixture y el PDF.

## Fallos y publicación

El importador reintenta hasta tres veces ante problemas de Google. Valida identidad del torneo, equipos, pertenencia de grupos, fechas, horarios, marcadores, tablas y goleadores antes de sustituir el snapshot. Ante datos vacíos, un marcador parcial, un cambio de cantidad de equipos incompatible con el formato confirmado o un esquema no reconocido, el trabajo falla y conserva los datos anteriores.

Solo se publica `data/interno.json`. No se sobrescriben archivos del resto del sitio. Un conflicto en ese archivo requiere revisión y no se resuelve descartando cambios ajenos. Cada lectura válida guarda `sourceInfo.checkedAt`, aunque no haya novedades deportivas; la web muestra **«Última lectura verificada»** en horario de Uruguay. `importedAt` conserva la fecha de incorporación del último cambio deportivo. Un fallo nunca renueva la fecha de verificación.

Después de la sincronización, los workflows existentes de notificaciones y de preparación de avisos de inicio vuelven a revisar el fixture. Esto también funciona cuando el commit lo crea GitHub Actions, que no dispara otros workflows por `push`. Los avisos siguen respetando preferencias y deduplicación; solo se envían por novedades reales del torneo.

## Comprobación

`node --test automation/interno-source.test.mjs automation/interno-watch.test.mjs automation/interno-sync-due.test.mjs` prueba la adaptación, el cambio de hora, la recuperación, deduplicación y relevo sin acceder a la fuente ni enviar notificaciones. `node automation/sync-interno.mjs --dry-run` realiza una lectura real sin escribir archivos. `--from-file ruta.json --dry-run` permite usar una muestra local fuera de producción. En Windows se utiliza Chrome; `INTERNO_BROWSER_EXECUTABLE_PATH` permite indicar otro ejecutable. En GitHub se instala Chromium de Playwright 1.55.

Una corrección local `startedAt` del comienzo real se conserva mientras no cambien fecha/hora oficiales. Los horarios y resultados se deben editar en la fuente de origen; la próxima sincronización sustituye los valores locales de Masculino/Femenino.
