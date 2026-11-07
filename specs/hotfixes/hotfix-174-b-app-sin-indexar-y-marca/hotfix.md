# Hotfix: la app no se indexa en buscadores y usa la marca correcta
> id: hotfix-174-b-app-sin-indexar-y-marca
> refs: hotfix-173-b
> status: done
> closed: 2026-11-07
> created: 2026-11-07

## Problema
La entrada pública `gestordeautoescuelas.cl` (repo aparte `gestor-landing`) es la que debe salir en
Google al buscar «Gestor de Autoescuelas». La app en `app.gestordeautoescuelas.cl` no tenía
`robots.txt` ni `noindex`, su título era «Autoescuela» y usaba un `favicon.ico` genérico: su login
podía competir con la entrada en los resultados y se veía poco profesional. La app es software
interno (secretarias, instructores, alumnos): no necesita SEO.

## Cambios
- **Archivo:** `public/robots.txt` — nuevo, `User-agent: *` + `Disallow: /`.
- **Archivo:** `public/.htaccess` — `Header always set X-Robots-Tag "noindex, nofollow"` en un
  bloque `<IfModule mod_headers.c>` (`always` para que también lo lleven las respuestas 3xx/4xx,
  como la redirección a HTTPS); las reglas de la SPA y de caché quedan iguales.
- **Archivo:** `src/index.html` — `<title>` «Gestor de Autoescuelas», `<meta name="robots">`
  `noindex, nofollow` y enlaces a `favicon.svg`, `favicon.ico` y `apple-touch-icon.png`.
- **Archivo:** `public/favicon.svg` — la G de la marca (copia de `gestor-landing/public/favicon.svg`).
- **Archivo:** `public/favicon.ico` — reemplazado por la G en 16/32/48 px.
- **Archivo:** `public/apple-touch-icon.png` — nuevo, 180×180.

## Verificación
- `npm run lint:arch` y `npm run test:ci` verdes.
- `ng build --configuration production` deja `robots.txt`, `.htaccess` y los íconos en
  `dist/Autoescuela/browser/`.
- `ng serve`: título e íconos correctos, `robots.txt` servido.

No se publica en producción desde este track: lo hace el equipo con «Publicar en producción».
