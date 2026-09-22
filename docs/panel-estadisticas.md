# Panel privado de Ceibos Club

URL: https://ceibosclub.com/panel/

Acceso con Google: nicolasmendieta52@gmail.com, correo verificado y proveedor google.com. La autorización efectiva está en las reglas de Firestore, no en el código del panel. No hay enlaces al panel en la navegación pública ni estadísticas exportadas a GitHub.

La colección `analyticsVisits` conserva registros anónimos con consentimiento previo. Se usa una instancia Firebase separada de notificaciones para no cambiar sus sesiones. Los clientes pueden crear y actualizar solo sus propios registros con un esquema acotado; no pueden leer ni borrar registros. Solo el propietario puede leerlos. Las reglas existentes de `notificationSubscriptions` se conservan.

Una visita es una carga de la home. Los visitantes son UID anónimos persistidos por navegador con consentimiento, no personas identificadas. El panel muestra hasta las 2.000 visitas más recientes del período y avisa si alcanza el límite. La tabla muestra 50; la exportación incluye todos los registros cargados. El período usa una ventana móvil y los días se agrupan en horario de Uruguay. No registra texto libre, formularios, IP, geolocalización ni grabación de pantalla. Rechazo, DNT y GPC evitan iniciar la medición. Al aceptar hay como máximo 190 escrituras por visita y no más de tres horas de tiempo activo.

La preferencia de exclusión del administrador afecta a ese navegador. El panel privado no contiene el script de medición. Las métricas comienzan desde el despliegue; no hay datos anteriores recuperables desde esta implementación. Los datos de origen son únicamente dominios de referencia informados por el navegador.

Archivos: `assets/analytics.js` (medición y consentimiento), `assets/analytics-model.js` (resumen), `panel/` (panel), `firebase/firestore.rules` (autorización), `privacidad/` (información al visitante). La configuración pública de Firebase se reutiliza desde `notification-config.json`. Ninguna clave privada se publica.

No desplegar reglas sin comparar con las vigentes en Firebase: podrían existir cambios de otros administradores. El archivo versionado preserva las reglas de notificaciones leídas durante la implementación.

Retención: `limpiar-estadisticas.yml` ejecuta diariamente `automation/cleanup-analytics.mjs` con la cuenta de servicio existente. Elimina únicamente visitas con expiresAt vencido (90 días desde el inicio). No depende de una política TTL habilitada en Google Cloud.
