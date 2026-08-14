# Activar las notificaciones de Ceibos Club

El código ya incluye:

- selección de Fútbol, Rugby, Hockey y Basketball;
- aviso cuando la automatización encuentra un partido nuevo;
- recordatorio el mismo día del partido;
- funcionamiento con la web cerrada mediante Web Push;
- eliminación automática de suscripciones vencidas;
- control para evitar avisos duplicados.

Hasta completar los pasos siguientes, el botón de la campana muestra que la conexión está pendiente y la actualización habitual de partidos continúa funcionando.

## 1. Crear el proyecto gratuito en Firebase

1. Entrar a <https://console.firebase.google.com/> con la cuenta que administrará Ceibos.
2. Crear un proyecto llamado `ceibos-club`.
3. En **Configuración del proyecto > General**, agregar una aplicación **Web**.
4. Copiar los valores del objeto `firebaseConfig`.
5. Abrir `notification-config.json` y completar esos valores. Todavía dejar `enabled` en `false`.

La configuración pública de Firebase y la clave VAPID pública pueden estar en el repositorio. No son contraseñas.

## 2. Habilitar el acceso anónimo

En Firebase:

1. Ir a **Authentication > Sign-in method**.
2. Habilitar **Anonymous / Anónimo**.
3. En **Authentication > Settings > Authorized domains**, agregar `ceibosclub.com` si todavía no aparece.

Cada navegador obtiene un identificador anónimo. No se pide nombre, correo, teléfono ni ubicación.

## 3. Crear Firestore y aplicar reglas

1. Ir a **Firestore Database** y crear la base en modo Producción.
2. Elegir una región cercana, si Firebase ofrece más de una.
3. En la pestaña **Rules / Reglas**, usar:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /notificationSubscriptions/{userId} {
      allow read, delete: if request.auth != null && request.auth.uid == userId;
      allow create, update: if request.auth != null
        && request.auth.uid == userId
        && request.resource.data.keys().hasOnly([
          'enabled', 'endpoint', 'keys', 'deportes', 'userAgent', 'updatedAt'
        ])
        && request.resource.data.enabled == true
        && request.resource.data.endpoint is string
        && request.resource.data.keys is map
        && request.resource.data.deportes is map;
    }
  }
}
```

Publicar las reglas.

## 4. Generar las claves Web Push

Abrir CMD dentro de la carpeta de la web y ejecutar:

```cmd
npm install
npx web-push generate-vapid-keys --json
```

El comando muestra una clave pública y una privada:

- copiar `publicKey` en `notification-config.json`, en `vapidPublicKey`;
- guardar `privateKey` para el paso de GitHub. **Nunca subirla a un archivo del repositorio.**

Después cambiar `enabled` a `true`.

## 5. Crear la cuenta de servicio

En Firebase:

1. Abrir **Configuración del proyecto > Cuentas de servicio**.
2. Elegir **Generar nueva clave privada**.
3. Descargar el archivo JSON y abrirlo con Bloc de notas.
4. Copiar su contenido completo.

Ese JSON es privado. No debe enviarse por WhatsApp, correo ni subirse al repositorio.

## 6. Agregar los secretos a GitHub

En el repositorio `ceibos-club`:

1. Ir a **Settings > Secrets and variables > Actions**.
2. Crear estos Repository secrets:

| Nombre | Valor |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | Todo el contenido del JSON de la cuenta de servicio |
| `VAPID_PRIVATE_KEY` | La `privateKey` generada en el paso 4 |
| `VAPID_SUBJECT` | `mailto:administracion@ceibosclub.com` |

## 7. Subir y probar

Subir los cambios normalmente y ejecutar **Actions > Actualizar datos del club > Run workflow**.

Para probar desde un teléfono:

- **iPhone/iPad:** agregar Ceibos Club a la pantalla de inicio, abrir desde el ícono y tocar la campana;
- **Android o PC:** abrir la web, tocar la campana y aceptar el permiso del navegador.

La notificación de confirmación aparece inmediatamente. Las deportivas se envían cuando la automatización detecta novedades o partidos correspondientes a ese día.
