# Fuente de datos del Interno 2026

Fuente indicada por el usuario: https://interno2026.ceibosfutbol.workers.dev/ . Ese sitio es una pantalla que carga la vista pública de una aplicación de Google Apps Script. El importador verifica ese enlace y lee el mismo estado público que recibe el visitante (`getPublicData` / `S.data`), con un navegador aislado y sin iniciar sesión. No utiliza funciones administrativas ni modifica la aplicación de origen.

El workflow **Actualizar Interno 2026** lee una vez por hora, al minuto 37, además de permitir ejecución manual. GitHub puede demorar el inicio de trabajos programados. El navegador de cada visitante sigue consultando el snapshot local cada minuto: las visitas a Ceibos no generan lecturas adicionales a Google. El reloj en pantalla se recalcula cada segundo.

## Qué se actualiza

- Equipos y grupos de Masculino (`M`) y Femenino (`F`), conservando IDs, escudos y encuadres existentes mediante correspondencias de nombre y posteriormente el ID de origen.
- Fixture con ID estable, local/visitante, fase, fecha, hora y cancha. Los números de cancha se muestran como «Cancha 1», etc.; no se inventan sedes.
- Resultados completos confirmados, incluidos 0–0 reales y penales de eliminatorias. Un marcador vacío no se convierte en cero.
- Tablas oficiales por grupo: se respeta el orden y el puntaje publicados, incluidos ajustes. Sin partidos jugados no se presentan posiciones competitivas.
- Goleadores publicados y autores de goles confirmados de cada partido. Los goles en contra no se adjudican al ranking personal.
- Cruces de eliminatorias con ambos rivales confirmados, también visibles en «Formato y cruces». Los pases directos no se cuentan como partidos; los cruces sin rivales quedan pendientes, con un aviso del total.

La lectura inicial del 11/11/2026 contiene **38 equipos y 54 partidos**: 22 equipos/30 partidos masculinos y 16 equipos/24 partidos femeninos. La fuente todavía no incluye Papi fútbol (+38); se mantienen su categoría, formato, grupos y cualquier dato local de esa categoría. No se incorporan cuentas de administración, datos de contacto ni listas privadas de jugadores.

Los formatos y videos confirmados, el PDF y el contacto de inscripción se conservan. El usuario confirmó el 11/11/2026 **25 + 5 + 25 minutos para Masculino y Papi**, y **20 + 5 + 20 para Femenino**, coherente con el fixture y el PDF.

## Fallos y publicación

El importador reintenta hasta tres veces ante problemas de Google. Valida identidad del torneo, equipos, pertenencia de grupos, fechas, horarios, marcadores, tablas y goleadores antes de sustituir el snapshot. Ante datos vacíos, un marcador parcial, un cambio de cantidad de equipos incompatible con el formato confirmado o un esquema no reconocido, el trabajo falla y conserva los datos anteriores.

Solo se publica `data/interno.json`. No se sobrescriben archivos del resto del sitio. Un conflicto en ese archivo requiere revisión y no se resuelve descartando cambios ajenos. Si no hay cambios de contenido, no se generan commits ni builds. «Datos incorporados» es la fecha del último snapshot con cambios, no la hora de cada lectura sin novedades.

Después de la sincronización, los workflows existentes de notificaciones y de preparación de avisos de inicio vuelven a revisar el fixture. Esto también funciona cuando el commit lo crea GitHub Actions, que no dispara otros workflows por `push`. Los avisos siguen respetando preferencias y deduplicación; solo se envían por novedades reales del torneo.

## Comprobación

`node --test automation/interno-source.test.mjs` prueba la adaptación sin acceder a la fuente ni enviar notificaciones. `node automation/sync-interno.mjs --dry-run` realiza una lectura real sin escribir archivos. `--from-file ruta.json --dry-run` permite usar una muestra local fuera de producción. En Windows se utiliza Chrome; `INTERNO_BROWSER_EXECUTABLE_PATH` permite indicar otro ejecutable. En GitHub se instala Chromium de Playwright 1.55.

Una corrección local `startedAt` del comienzo real se conserva mientras no cambien fecha/hora oficiales. Los horarios y resultados se deben editar en la fuente de origen; la próxima sincronización sustituye los valores locales de Masculino/Femenino.
