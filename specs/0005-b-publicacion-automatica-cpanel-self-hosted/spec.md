# Spec 0005-b: Publicación Estática Automática en cPanel Self-Hosted

## Estado
- **Estado**: draft (borrador - inactiva)
- **Prioridad**: P1
- **Owner**: Akxlarre
- **Fecha de Creación**: 2026-05-23

---

## 1. Problema y Contexto

Actualmente, las landing pages multi-sede de Autoescuelas Chillán están construidas en **Astro SSG** para máxima velocidad de carga (CLS = 0) y optimización SEO. El despliegue de producción se realiza en un servidor **cPanel** tradicional.

Cuando un administrador edita la estructura de la landing page, colores o tarifas de los cursos desde la plataforma de administración en Angular, los cambios se guardan directamente en Supabase. Aunque la web pública implementa una **hidratación dinámica cliente (Fase 2)** para mostrar los cambios en tiempo real a los usuarios navegantes, los archivos HTML de carga estática inicial (Fase 1) y los robots de búsqueda de Google (SEO) siguen sirviéndose con el contenido local viejo compilado en los fallbacks `azul.json` y `roja.json`.

Para evitar que el desarrollador tenga que ejecutar comandos locales (`align_configs.js`, `npm run build:all`) y subir los archivos estáticos por FTP de forma manual cada vez que se realice un cambio importante, se requiere un mecanismo **100% automatizado, robusto y auto-hospedado (sin dependencias de terceros como GitHub Actions)** que compile y despliegue el sitio directamente en el mismo servidor cPanel al recibir un evento de publicación.

---

## 2. Arquitectura Propuesta (Self-Hosted Webhook Listener)

Se propone un microservicio ligero escrito en Node.js que correrá de forma constante en el servidor cPanel utilizando la característica nativa de **Setup Node.js App** (Passenger) de cPanel.

```
+-------------+                  +-------------------------+
|  Supabase   |                  |  Servidor cPanel        |
|  Database   |                  |  (Entorno Privado)      |
+------+------+                  +------------+------------+
       |                                      |
       | POST /publish (con Token)            |
       +------------------------------------->+ Webhook Listener (Node.js)
                                              |
                                              | 1. node align_configs.js
                                              | 2. npm run build:all
                                              | 3. Copia recursiva de archivos
                                              |
                                              v
                                 +------------+------------+
                                 |  Carpetas Públicas      |
                                 |  public_html            |
                                 +-------------------------+
```

### Componentes de la Solución:
1. **Webhook Listener (`scripts/cpanel-webhook.js`)**:
   Un microservicio HTTP en Node.js sin dependencias que escucha peticiones `POST /publish` protegidas por un token secreto (`x-publish-secret`).
2. **Script de Alineación (`scratch/align_configs.js`)**:
   Script existente que descarga, procesa (resuelve overrides de cursos y limpia nulos de Zod) y sobreescribe los fallbacks locales `azul.json` y `roja.json`.
3. **Database Webhook en Supabase**:
   Gatillo en caliente en Supabase que envía una petición HTTP POST al Listener en cPanel ante cualquier actualización (`UPDATE`) en la tabla `website_config`.

---

## 3. Especificación Técnica e Implementación

El código fuente del microservicio ya se encuentra desarrollado y listo para su uso futuro en:
📁 [cpanel-webhook.js](file:///c:/Users/Akxlarre/Autoescuela/scripts/cpanel-webhook.js)

### Variables de Entorno del Servicio:
- `PORT`: Puerto asignado por el servidor cPanel (manejado automáticamente por Phusion Passenger).
- `PUBLISH_SECRET`: Token de autenticación requerido para autorizar la compilación.
- `DEST_DIR_AZUL`: Ruta absoluta donde se alojan los archivos de la marca azul (ej: `/home/usuario/public_html/autoescuelachillan.cl`).
- `DEST_DIR_ROJA`: Ruta absoluta donde se alojan los archivos de la marca roja (ej: `/home/usuario/public_html/conductoreschillan.cl`).

---

## 4. Guía de Activación (Paso a Paso en el Futuro)

Cuando decidamos activar esta especificación, deberemos seguir los siguientes pasos:

### Paso A: Subir el Proyecto a cPanel (Entorno Privado)
Subir el repositorio completo a un directorio privado de la cuenta del hosting, por ejemplo:
`/home/tu_usuario/app/Autoescuela/`
*(Nunca dentro de public_html para evitar exposición de código)*.

### Paso B: Levantar la Aplicación en cPanel
1. Entrar a cPanel e ingresar a **Setup Node.js App**.
2. Crear una nueva aplicación con los siguientes valores:
   - **Node.js version**: `>= 18.x`
   - **Application Mode**: `Production`
   - **Application root**: `app/Autoescuela`
   - **Application URL**: `api.autoescuelachillan.cl/publish` (o el dominio/subcarpeta que prefieras).
   - **Application startup file**: `scripts/cpanel-webhook.js`
3. Añadir en la sección **Environment variables**:
   - `PUBLISH_SECRET` = `[tu-clave-secreta]`
   - `DEST_DIR_AZUL` = `/home/tu_usuario/public_html/autoescuelachillan.cl`
   - `DEST_DIR_ROJA` = `/home/tu_usuario/public_html/conductoreschillan.cl`
4. Guardar, activar y presionar **Run JS Install** para asegurar la instalación de los paquetes.

### Paso C: Enlazar con Supabase Webhooks
1. Entrar a la consola de **Supabase ➡️ Database ➡️ Webhooks ➡️ Create a new Webhook**.
2. Configuración del Trigger:
   - **Name**: `cpanel-publish-trigger`
   - **Table**: `website_config`
   - **Events**: `UPDATE`
   - **Type**: `HTTP Request`
   - **Method**: `POST`
   - **URL**: `https://api.autoescuelachillan.cl/publish` (Ruta configurada en el Paso B)
3. Configurar **Headers**:
   - Clave: `x-publish-secret`
   - Valor: `[tu-clave-secreta]` (Idéntica a la configurada en el Paso B)

---

## 5. Plan de Verificación y Aceptación

Para dar por cerrada y aprobada esta Spec en el futuro, se realizarán las siguientes pruebas:

1. **Prueba de Seguridad (POST sin Token)**:
   Realizar una consulta HTTP POST al webhook de cPanel sin encabezado `x-publish-secret`. El servidor debe responder inmediatamente `401 Unauthorized` y no ejecutar ninguna compilación.
2. **Prueba de Publicación Asíncrona**:
   Realizar una consulta HTTP POST válida con el token correcto. El servidor debe responder de inmediato `200 OK` (en menos de 100ms) para liberar la conexión del cliente y realizar la compilación en segundo plano.
3. **Verificación de Despliegue Local**:
   Comprobar que en el servidor cPanel se actualizan las carpetas públicas de destino con los archivos estáticos HTML compilados a la velocidad de escritura del disco local, y que reflejan los últimos cambios realizados en la base de datos de Supabase.
