# Investigación y mejora del asistente de Ceibos

Revisión del 17 de noviembre de 2026. El objetivo es resolver las consultas que una persona hace al visitar Ceibos: encontrar un partido, entender una tabla, seguir al Interno, consultar el Gym o ubicar información del club. Se conservaron las respuestas concretas y las referencias al final solicitadas por el usuario.

## Referencias estudiadas

La selección se centra en asistentes de soporte y guías de interacción aplicables a una web con datos propios. La documentación de cada proveedor describe sus funciones; esta revisión no constituye un ranking independiente de precisión entre sus modelos.

| Referencia | Comportamiento útil | Aplicación en Ceibos |
| --- | --- | --- |
| [Intercom Fin: experiencia conversacional](https://www.intercom.com/help/en/articles/11433030-conversational-fin-experience) | Respuestas breves y naturales; aclaraciones y recuperación cuando la persona indica que la respuesta no ayudó. | Mantener el contexto y ofrecer una corrección concreta, sin dar por resuelta una consulta por cerrar el panel o agradecer. |
| [Fin: tono y extensión](https://www.intercom.com/help/en/articles/13177409-customize-fin-ai-agent-tone-of-voice-and-answer-length) | Ajustar lenguaje y extensión al servicio que representa el asistente. | Español con voseo, información directa y preguntas sugeridas relacionadas con el tema. |
| [Zendesk: configuración de respuestas](https://support.zendesk.com/hc/en-us/articles/9517744828058-Configuring-settings-for-generative-replies-in-advanced-AI-agents) | Estado de espera y fuentes al final del mensaje. | Mostrar una espera solo cuando hay datos pendientes; reunir y eliminar referencias duplicadas después de la respuesta. |
| [Zendesk: organización del conocimiento](https://support.zendesk.com/hc/en-us/articles/4408845739162-Optimizing-your-knowledge-content-for-generative-AI) | Recuperar contenido específico de una base de conocimiento organizada. | Separar tablas, partidos, grupos, reglas y textos del club. Una fila de un rival no sirve para responder los puntos de Ceibos. |
| [Google: diseño de preguntas](https://developers.google.com/assistant/conversation-design/questions) | Aclaraciones que se pueden responder con las opciones que realmente admite el sistema; reducir el alcance cuando hay una ambigüedad. | Preguntar una categoría o equipo a la vez y conservar la fecha y la operación originales al elegir. |
| [Microsoft HAX: corrección eficiente](https://www.microsoft.com/en-us/haxtoolkit/guideline/support-efficient-correction/) | Facilitar editar o recuperar una interacción incorrecta. | Editar preguntas, reformular y cambiar equipo o fecha sin empezar la conversación de cero. |
| [Microsoft HAX: incertidumbre](https://www.microsoft.com/en-us/haxtoolkit/guideline/scope-services-when-in-doubt/) | Aclarar o limitar la respuesta cuando la intención no está suficientemente definida. | Confirmar nombres aproximados y distinguir datos ausentes de un valor cero. |
| [Anthropic: construcción de agentes](https://www.anthropic.com/engineering/building-effective-agents) | Enrutar tareas diferentes hacia los procedimientos y datos adecuados, con criterios de evaluación verificables. | Separar recuperación de textos, tablas, cálculos y conversación; comprobar cada ruta con consultas reproducibles. |
| [Perplexity: búsqueda y refinamiento](https://www.perplexity.ai/help-center/en/articles/10352903-what-is-pro-search) | Respuestas verificables y preguntas de seguimiento que conservan contexto. | Fecha de lectura cuando existe, enlaces a la información usada y seguimientos útiles sobre el mismo equipo o campaña. |

## Auditoría del funcionamiento anterior

Se revisaron consultas aisladas y conversaciones de varios turnos con los datos públicos del sitio. La muestra inicial identificó fallas reproducibles:

| Consulta | Problema encontrado | Criterio de corrección |
| --- | --- | --- |
| Cuántos puntos tiene Reserva Verde | Podía recuperar una fila de goleadores de un rival. | Seleccionar la categoría, el tipo de tabla y la fila de Ceibos. |
| Quién es su goleador | Podía elegir un jugador rival por coincidencia de palabras. | Separar el goleador del equipo del goleador de toda la competencia. |
| Quiénes están en el grupo C | Podía contestar con un párrafo del formato de copas. | Resolver grupo y categoría a partir de los equipos publicados. |
| Gym → y cuánto falta | Perdía el tema de la conversación. | Conservar el tema y calcular el importe pendiente con los mismos datos del muro. |
| Manchester mañana → City | Podía pasar al siguiente partido, aunque fuera de otro día. | Conservar la fecha pedida al aclarar el equipo. |
| Cuánto cuesta Cena Ceibos | Contestaba la fecha del evento. | Responder sobre el precio y aclarar si no está publicado. |
| No, la Reserva A | No conservaba el conteo y el período solicitados. | Cambiar el sujeto manteniendo la consulta original. |
| Gracias / no me entendiste | Podía tratar el mensaje como una nueva búsqueda de información. | Distinguir conversación social, corrección y consulta. |

## Implementación

El recorrido queda separado en cuatro partes:

1. **Lenguaje:** normalizar variaciones frecuentes sin perder fechas, reconocer alias y confirmar posibles errores en nombres.
2. **Conversación:** mantener tema, sujeto, período y aclaraciones; admitir correcciones y preguntas breves de seguimiento.
3. **Datos:** resolver tablas, goleadores, grupos y agendas desde sus registros estructurados. Los cálculos de resultados conservan sus filtros de fecha, rival y local/visitante.
4. **Presentación:** respuesta concreta, detalle cuando hace falta, acciones de corrección y referencias al final.

La interfaz incorpora accesos para empezar, sugerencias relacionadas, edición de preguntas, copia de respuestas, recuperación cuando una respuesta no ayuda y cancelación de una espera. Las listas largas permiten desplegar sus filas adicionales. El diseño usa el escudo, colores y tipografías existentes de Ceibos.

Las conversaciones permanecen en memoria durante la visita. Los controles de corrección funcionan dentro de esa conversación; no entrenan un modelo ni envían mensajes al club. El motor se ejecuta en el navegador con los datos públicos del sitio y reglas de interpretación. Las capacidades de los modelos generativos comerciales dependen de sus servicios propios; la implementación de Ceibos adopta los patrones de interacción que puede verificar con su información disponible.

## Verificación

Las pruebas controlan el contenido de las respuestas y las conversaciones completas, con especial atención a las fallas observadas. Se conserva la regresión de la pregunta original de Reserva Verde y las pruebas del resto de la web. La validación en navegador comprueba fuentes, aclaraciones, enlaces, edición, copia, cancelación y pantallas móviles, con las notificaciones y escrituras externas desactivadas para las pruebas.

La falta de una tarifa, una fecha de inauguración, una tabla o un horario se informa expresamente. Cada fase mantiene sus propios puntos; no se suman tablas de competencias distintas. Una lectura anterior conserva su advertencia y su fecha.

Resultado de la revisión local: 226 pruebas generales, con 225 aprobadas, ninguna fallida y una omitida por su configuración. Los recorridos de navegador comprobaron el diseño entre 320 y 1440 píxeles, el teclado móvil, selección de categoría, tablas reales, copia, edición, recuperación y cancelación sin que aparezca luego una respuesta cancelada. La muestra de consultas de la prueba de interfaz tuvo una mediana de 194 ms y un máximo de 220 ms en el equipo local; estas cifras describen esa prueba, no un compromiso de velocidad para todos los dispositivos.

En la fuente pública consultada durante la prueba, Reserva Verde figuraba con 28 puntos en «Segunda rueda · Título y ascenso» y 23 en «Serie RS31». La respuesta identifica ambas fases. El importe del Gym usado por el navegador de prueba fue un dato interceptado localmente; no se modificó la planilla ni se enviaron notificaciones reales.
