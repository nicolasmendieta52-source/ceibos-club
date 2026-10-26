# Muro del gimnasio

Los 100 ladrillos tienen el mismo tamaño, independientemente del monto aportado. Se ocupan desde abajo hacia arriba: 10 columnas en escritorio y 5 en móvil. Los sponsors se muestran separados del muro. Europcar está excluido de la lista pública y de la sincronización, sin alterar los importes ni los registros de pagos. La meta actual es USD 225.000.

La home consulta cada 60 segundos la pestaña `Web` de la planilla existente mediante CSV, sin esperar al cron de GitHub ni a una compilación de Pages. La pestaña contiene únicamente totales, nombres públicos, avance de cada ladrillo y sponsors. Sus fórmulas toman los pagos anotados independientemente del campo Estado, separan sponsors y omiten notas privadas. `feedVersion=2` exige los 100 avances, admite coma decimal y conserva aportes parciales.

`data/gym-campaign.json` configura `sourceUrl` y `sourceFormat=sheets-csv-v2`, y sirve como respaldo inmediato mientras llega Sheets. Si falla la consulta, la página conserva el último dato verificado y avisa. La versión del formato evita que una pestaña abierta con JavaScript anterior reinterprete los avances parciales como recaudación global. Google puede añadir su propio tiempo de propagación; la consulta de un minuto no es una garantía de respuesta de Google. La sincronización horaria existente mantiene el respaldo y preserva la fuente directa.
