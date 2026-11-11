# Panel privado de Ceibos Club

URL: https://ceibosclub.com/panel/

Acceso con Google: nicolasmendieta52@gmail.com, ceibosfutbol@gmail.com, jdtorresn@gmail.com, correo verificado y proveedor google.com. La autorización efectiva está en las reglas de Firestore, no en el código del panel. No hay enlaces al panel en la navegación pública ni estadísticas exportadas a GitHub.

La colección `analyticsVisits` conserva registros anónimos con consentimiento previo. Se usa una instancia Firebase separada de notificaciones para no cambiar sus sesiones. Los clientes pueden crear y actualizar solo sus propios registros con un esquema acotado; no pueden leer ni borrar registros. Solo las tres cuentas autorizadas pueden leerlos. Las reglas existentes de `notificationSubscriptions` se conservan.

Una visita es una carga de la home. Los visitantes son UID anónimos persistidos por navegador con consentimiento, no personas identificadas. El panel muestra hasta las 2.000 visitas más recientes del período y avisa si alcanza el límite. La tabla muestra 50; la exportación incluye todos los registros cargados. El período usa una ventana móvil y los días se agrupan en horario de Uruguay. No registra texto libre, formularios, IP, geolocalización ni grabación de pantalla. Rechazo, DNT y GPC evitan iniciar la medición. Al aceptar hay como máximo 190 escrituras por visita y no más de tres horas de tiempo activo.

La preferencia de exclusión del administrador afecta a ese navegador. El panel privado no contiene el script de medición. Las métricas comienzan desde el despliegue; no hay datos anteriores recuperables desde esta implementación. Los datos de origen son únicamente dominios de referencia informados por el navegador.

Archivos: `assets/analytics.js` (medición y consentimiento), `assets/analytics-model.js` (resumen), `panel/` (panel), `firebase/firestore.rules` (autorización), `privacidad/` (información al visitante). La configuración pública de Firebase se reutiliza desde `notification-config.json`. Ninguna clave privada se publica.

No desplegar reglas sin comparar con las vigentes en Firebase: podrían existir cambios de otros administradores. El archivo versionado preserva las reglas de notificaciones leídas durante la implementación.

Retención: `limpiar-estadisticas.yml` ejecuta diariamente `automation/cleanup-analytics.mjs` con la cuenta de servicio existente. Elimina únicamente visitas con expiresAt vencido (90 días desde el inicio). No depende de una política TTL habilitada en Google Cloud.

Desde el 26 de octubre de 2026 se miden también `interno` y `proyecto-gimnasio`. Las reglas admiten esos contadores como opcionales para no rechazar visitas de pestañas abiertas con una versión anterior. No se reconstruyen vistas anteriores a la incorporación de esas secciones.

## Corrección del 11 de noviembre de 2026

La validación repetida de cada contador de sección superaba el límite de 1.000 expresiones de Firestore. Las visitas válidas se rechazaban y el último registro anterior a la reparación era del 26/10/2026. Se valida una sola vez el rango compartido 0/1 y se conservan los controles de tipo entero, los campos admitidos, la compatibilidad con clientes anteriores y todos los permisos existentes. No se pueden reconstruir las visitas rechazadas durante ese período.

También se corrigió la detección de vistas de secciones largas en móvil: el Interno supera los 8.700 px y exigir que se viera el 10% impedía contabilizarlo en pantallas de 812 px. Ahora se exige ver al menos 120 px o el 10% de una sección pequeña. Los cambios de categoría/cancha, las pestañas del Interno y su botón de avisos se incluyen en los contadores de interacción existentes, sin añadir campos personales.

La regresión se verifica con `node automation/test-analytics-rules.mjs` (Node 22 o posterior y Java 21; se puede indicar el ejecutable con `JAVA_BIN`). Descarga una versión fija del emulador oficial, verifica SHA-256 y ejecuta pruebas contra un proyecto `demo-` aislado en localhost. No requiere credenciales ni toca la base real. `Verificar estadísticas privadas` ejecuta esta comprobación en GitHub al cambiar las reglas o sus pruebas. La prueba reproduce el error con la regla anterior y verifica escrituras completas/antiguas, límites de datos, las tres cuentas de Google, bloqueo de terceros y preservación de las suscripciones de notificaciones.
