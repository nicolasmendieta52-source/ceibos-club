# Acceso privado temporal de Ceibos Club

La protección se ejecuta en Cloudflare Pages. El código compartido nunca se guarda en este repositorio ni se envía al navegador hasta que el visitante lo escribe.

## Configuración de Cloudflare Pages

1. Crear un proyecto de **Workers & Pages** conectado al repositorio `nicolasmendieta52-source/ceibos-club`.
2. Seleccionar la rama de producción `main`.
3. Usar como comando de compilación `exit 0` y como directorio de salida `.`.
4. En **Settings > Variables and Secrets**, crear dos secretos cifrados para producción:
   - `ACCESS_CODE`: el código compartido elegido por el club.
   - `SESSION_SECRET`: una cadena aleatoria larga, diferente del código de acceso.
5. Volver a desplegar el proyecto después de guardar los secretos.
6. Probar primero la dirección `*.pages.dev` en una ventana de incógnito.
7. Cuando funcione, agregar `ceibosclub.com` en **Custom domains** y conservar todos los registros DNS existentes, especialmente `socios.ceibosclub.com`.

## Comportamiento

- Los visitantes sin sesión ven `construction.html` con estado HTTP 503 temporal.
- El código correcto crea una cookie segura, `HttpOnly`, válida durante 7 días.
- Cambiar `ACCESS_CODE` invalida automáticamente las sesiones anteriores.
- `https://ceibosclub.com/__salir` cierra la sesión del dispositivo.
- Mientras el bloqueo esté activo se envía `noindex` a buscadores.

## Volver a abrir la web

Para el lanzamiento, quitar o renombrar `functions/_middleware.js`, desplegar de nuevo y restaurar el comportamiento público de `robots.txt`.
