# Campaña del gimnasio de Ceibos

La sección está después del hero en `index.html`. Sigue la composición de la imagen enviada por el club: escudo y presentación a la izquierda, lema en cursiva al centro, objetivo y recaudación a la derecha, edificio y grilla debajo. Los cambios de tipografía están limitados a esta campaña. CSS y JavaScript independientes en `assets/gym-campaign.*`; no necesita compilación ni dependencias nuevas.

## Actualizar los montos

Editar `data/gym-campaign.json` y publicar los archivos por el flujo habitual del sitio:

```json
{
  "goal": 200000,
  "raised": 87450,
  "updatedAt": "",
  "contributionUrl": "",
  "sourceUrl": ""
}
```

- `goal`: meta en USD, número mayor que cero.
- `raised`: total confirmado en USD, número mayor o igual a cero, sin separadores de miles.
- `updatedAt`: fecha real del dato, por ejemplo `2026-09-11`, o vacío para no mostrar fecha.
- `contributionUrl`: enlace HTTPS a Shoots, formulario o sistema para registrar aportes. Vacío: abre un correo a info@ceibosclub.com con el asunto del gimnasio.
- `sourceUrl`: endpoint JSON opcional para leer montos actualizados. Vacío: usa este archivo local.
- `brickLabels`: lista opcional de nombres para mostrar en los ladrillos financiados, en orden de lectura. Incluye los siete nombres transcritos de la foto, a pedido del usuario. Se conservan las grafías de la imagen. `\n` permite poner “y flia” en una segunda línea. La fuente externa también puede devolver esta lista. Los nombres se insertan como texto, nunca como HTML, y se ofrece la misma lista a lectores de pantalla.

El visitante recibe los datos al abrir la web y cada 60 segundos mientras la pestaña está visible; también al volver a ella. No se usan montos guardados en el navegador.

## Conectar Google Sheets más adelante

Preparar un endpoint público de solo lectura, con CORS si tiene otro origen, que traduzca el total de la hoja a este formato:

```json
{ "goal": 200000, "raised": 89450, "updatedAt": "2026-09-12" }
```

Colocar su URL en `sourceUrl`. Un enlace normal para compartir Sheets no es un endpoint JSON: hay que conectar la hoja con un adaptador o un proceso que actualice el JSON local. El endpoint solo debe publicar los totales, sin credenciales ni datos privados de colaboradores. El formulario y la fuente de datos tienen campos independientes.

Si la fuente externa falla, se conserva el último monto válido de esa visita; en la primera carga se usa el JSON local como respaldo. Se muestra un aviso de que el dato no pudo actualizarse. Si falla también el archivo local, la sección informa la falta del dato y mantiene el enlace de contacto.

## Pared y animación

100 ladrillos de igual valor (`goal / 100`), completados de izquierda a derecha desde la primera fila, igual que en la referencia. La parte financiada del ladrillo en curso se muestra proporcionalmente en verde, al igual que los completos. La recaudación real llena 43 ladrillos y parte del siguiente; no se reproduce el número de ladrillos de ejemplo de la imagen porque no corresponde al porcentaje real. En desktop la grilla es de 10 columnas; en teléfonos pequeños, 5 para permitir nombres legibles. El avance visual se limita a 100% si se supera la meta, pero el monto recibido se muestra completo. Una reducción corregida del monto también se refleja.

Al aparecer la pared se coloca sutilmente el último ladrillo financiado. Cuando sube el total, se animan solo los ladrillos cuya financiación aumentó. Se respeta `prefers-reduced-motion`. La pared es decorativa para lectores de pantalla: monto, meta, progreso y estado se exponen como texto y un elemento `progress` accesible.

Para una integración que ya reciba actualizaciones en la página (o una prueba local), se puede emitir:

```js
window.dispatchEvent(new CustomEvent('ceibos:gym-update', {
  detail: { raised: 89450 }
}));
```

Este evento solo actualiza la vista: no registra ni persiste un aporte. La siguiente lectura del JSON vuelve a la fuente de verdad. Hacer clic en colaborar nunca aumenta la recaudación automáticamente.

## Validación

`npm test` incluye los cálculos y la validación de la campaña. Para verla localmente, servir esta carpeta por HTTP y abrir la home con el acceso habitual del club.
