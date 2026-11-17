# Preguntale a Ceibos

Asistente de consultas sobre la información pública de Ceibos, incorporado el 17/11/2026 por pedido del usuario. Se abre desde «Preguntá», el menú móvil o el pie del buscador. El usuario eligió consultas del club y confirmó que el alcance es todo `ceibosclub.com`, sin búsquedas en otros sitios. Funciona en el navegador, sin un proveedor de IA, claves, facturación por pregunta ni envío de conversaciones a un servidor.

## Fuentes

- Fixture, resultados, equipos, grupos y goleadores del Interno: el mismo JSON validado que usa su sección, compartido por `ceibos:interno-search-data`. Conserva la hora de la última lectura de la fuente.
- Gym: `ceibos:gym-data` comparte únicamente los totales, meta, cantidad de ladrillos/ocupados, fecha del dato y estado de lectura del mismo módulo del muro. No incorpora nombres ni pagos individuales. Una consulta puede pedir al módulo su estado y una actualización si pasó más de un minuto, respetando su control de petición en curso. Una lectura fallida conserva el último importe y la respuesta lo identifica como respaldo; nunca presenta el respaldo antiguo como una lectura nueva.
- Deportes y categorías, sus próximos partidos/resultados, agenda social, tablas 2026 de campeonatos/goleadores y archivo histórico: `ceibos:assistant-content` se genera a partir de los mismos datos y plantillas públicas de la home. Los enlaces a categorías admiten también categorías adicionales publicadas por las fuentes, como Divisional B.
- Textos de historia, predio, tienda, socios, solidaridad, contacto, noticias, proyecto Gym y reglamento: fragmentos publicados en el DOM, incluso contenido desplegable, y dirección pública del marcado estructurado. Cada respuesta incluye un enlace a su sección. No recorre paneles privados, formularios ni cuentas de visitantes.
- Reglas deportivas del PDF público de 2026: extractos revisados con el documento original y enlazados a la página correspondiente en `assets/club-assistant-regulation.js`. Conservan el alcance general o específico de Masculino/Femenino/Papi; no se republican el contacto, la cuenta de pago ni el formulario de inscripción retirados. Las etapas y copas usan además los formatos confirmados del JSON del Interno.

## Respuestas y límites

`assets/club-assistant-model.js` interpreta consultas de partidos, fechas, resultados, grupos, goleadores, posiciones, Gym y eventos. «Hoy», «mañana» y días de la semana se resuelven siempre en `America/Montevideo`; una pregunta por «el miércoles» indica la fecha concreta en la respuesta. Solo se usan partidos existentes. Los horarios/canchas desconocidos se identifican como pendientes, y no se convierte un resultado sin confirmar en 0–0. Nombres ambiguos o aproximados requieren elegir un equipo. El contexto de equipo/fecha permite continuar con «¿y en qué cancha?».

`assets/club-assistant-facts.js` recupera fragmentos del resto del contenido público. Cita los textos que realmente están publicados, sin generar datos nuevos ni obedecer instrucciones que aparezcan dentro de ellos. Preguntas sin información publicada reciben una aclaración o enlaces relacionados; no se promete resolver cualquier formulación ni conversaciones ajenas al club. No inventar precios, entrenadores, horarios de entrenamiento o una apertura del Gym a partir de datos que no lo confirman.

La conversación solo permanece en memoria durante esa visita; «Nueva conversación» la borra. Las preguntas y mensajes se insertan como texto. La medición de visitas existente continúa sin registrar contenido de formularios. Los datos se actualizan por los mecanismos ya existentes del sitio; no se crean crons, cuentas ni bases nuevas.

Verificación: `node --test automation/club-assistant.test.mjs` prueba fechas, las consultas solicitadas, contexto, datos faltantes, ambigüedad, respaldos y recuperación del contenido general. La prueba de navegador valida el recorrido completo, coincidencia del importe con el muro, cambios/fallos de la fuente, enlaces, menú/buscador, teclado y tamaños móviles.
