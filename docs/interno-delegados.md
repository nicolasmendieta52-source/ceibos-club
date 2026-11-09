# Panel de resultados para delegados

Acceso desde la home: `/#interno-delegados`, entre el anuncio de fecha y las pestañas del torneo. Incluye el enlace directo y un iframe dentro de un bloque desplegable, con altura adaptable a celular y PC. El iframe carga al abrir ese bloque.

Se conserva el enlace aportado por el usuario:

https://script.google.com/macros/s/AKfycby6uKKfOzV8tgNxWSwbVgeiV9IGohws3Uq9IIBw6QAZi4AwvNwwdclDRmFEKk-JWxrtcQ/exec?p=admin

## Estado de la inserción al 9/11/2026

La aplicación responde HTTP 200 y se identifica como «Admin · Torneo Interno 2026», pero devuelve `X-Frame-Options: SAMEORIGIN` y `Content-Security-Policy: frame-ancestors 'self'`. El navegador bloquea su inserción en Ceibos. Este permiso depende del proyecto de Google Apps Script, no de las opciones del iframe en la web.

Para habilitarlo, el dueño del proyecto debe aplicar el modo `ALLOWALL` al `HtmlOutput` que ya devuelve su `doGet(e)`, conservando las rutas y la autenticación existentes:

```js
// salida: el HtmlOutput creado por el doGet actual.
salida.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
return salida;
```

Después debe actualizar la implementación existente con una versión nueva, manteniendo la misma URL `/exec`. No se debe sustituir todo el `doGet` por un ejemplo que elimine el manejo de `p=admin`.

Documentación oficial: https://developers.google.com/apps-script/reference/html/x-frame-options-mode

El editor se abre desde https://script.google.com/home o, si está vinculado a una planilla, desde **Extensiones → Apps Script**. El enlace de uso `/exec` no da acceso al código del proyecto.

La web no altera la autenticación ni guarda resultados por sí misma: muestra la aplicación externa. La asignación de permisos a delegados y el guardado de resultados dependen de esa aplicación. No se realizaron envíos de prueba sobre partidos reales.
