# Despliegue a producción (app Angular → cPanel)

> Spec: [`0046-b`](../specs/specs/0046-b-deploy-produccion-cpanel-angular/spec.md) ·
> Workflow: [`.github/workflows/deploy-app-production.yml`](../.github/workflows/deploy-app-production.yml)

La app se publica en el hosting cPanel de la escuela, vía GitHub Actions y FTPS. **Vercel queda
solo para previews de PRs**: no es producción. Por ahora no hay ambiente QA.

---

## Publicar una versión

1. Asegúrate de que lo que quieres publicar ya está en `main`.
2. Crea y sube un tag de versión:

   ```bash
   git tag v1.2.0 && git push origin v1.2.0
   ```

3. En **Actions → Deploy app (producción)**, el job `build` corre los tests (`test:ci`), el lint
   (`lint:arch`) y el build. Si algo falla, no se despliega.
4. El job `deploy` queda en **Waiting for review**. Lo aprueba cualquiera de: `Akxlarre`,
   `SorkoTheProgram` o `m-fuentesr` (botón *Review deployments*).
5. Al terminar, `https://<dominio>/version.json` muestra el tag y el commit publicados, y en
   **GitHub → Releases** aparece el Release del tag con el build exacto (`site.zip`). Ese Release
   es lo que usa el rollback: la lista de Releases es la lista de versiones a las que se puede volver.

Un push a `main` **sin** tag no despliega nada. Un tag creado sobre un commit que no está en `main`
falla en `build`.

**Un deploy a la vez.** Si hay un deploy esperando aprobación y llega otro tag, el nuevo queda en
cola (*pending*) detrás, sin pedir aprobación todavía. GitHub **no** cancela el que espera: si ya no
corresponde (p. ej. pusheaste dos tags casi juntos y tomó el turno el más viejo), **recházalo** en
*Review deployments → Reject* y pasa el siguiente. Una subida en curso nunca se corta.

## Rollback

**Actions → Deploy app (producción) → Run workflow** → en `tag` pon la versión anterior (ej.
`v1.1.0`). Pasa por la misma aprobación. `version.json` confirma la vuelta atrás.

El rollback **no recompila**: baja el `site.zip` del Release de ese tag y lo sube tal cual. Es
rápido (sin `npm ci`, tests ni build) y sube exactamente lo que se aprobó en su momento —
recompilar un tag viejo puede fallar (tests que dependen de la fecha) o dar otro build (deps
nuevas). Si el tag no tiene Release, el workflow falla antes de pedir aprobación: solo se puede
volver a versiones publicadas por este pipeline (`v0.1.5` en adelante; `v0.1.0`–`v0.1.4` son
anteriores al Release automático).

## Cómo sube los archivos (y por qué en ese orden)

El job usa `lftp` sobre FTPS con el certificado verificado:

1. Sube todo **menos** `index.html`, sin borrar nada.
2. Sube `version.json` y después `index.html`. Ese es el "switch" de versión: antes de este paso
   los usuarios siguen en la versión anterior completa.
3. Borra solo los archivos que el pipeline subió **hace dos versiones** y que ya nadie usa.
   Quien tiene abierta la versión anterior sigue encontrando sus chunks.
4. Sube `.deploy-manifest.json`: el registro de qué subió cada versión. No es público (el
   `.htaccess` lo bloquea).

El pipeline nunca toca archivos que no subió él (`cgi-bin/`, `.well-known/` del SSL de cPanel).
La lógica vive en `scripts/lib/deploy-manifest.js`, con su test en
`node scripts/lib/deploy-manifest.test.mjs`.

## Configuración del environment `Production` (GitHub → Settings → Environments)

| Qué | Valor |
|---|---|
| Required reviewers | `Akxlarre`, `SorkoTheProgram`, `m-fuentesr` |
| Deployment branches and tags | *Selected* → regla de **tag** `v*` |
| Secret `FTP_SERVER` | hostname **del servidor** que figura en el certificado TLS (hoy `rs7-va.serverhostgroup.com`), no `ftp.<dominio>` — ver Problemas conocidos |
| Secret `FTP_USERNAME` | cuenta FTP dedicada, **enjaulada en el docroot del subdominio** |
| Secret `FTP_PASSWORD` | contraseña de esa cuenta |
| Variable `APP_DOMAIN` | dominio sin `https://` (hoy `app.autoescuelachillan.cl`) |

Los secrets van **en el environment**, no como *Repository secrets*: así solo los lee el job que
pasó la aprobación.

## Cambiar de dominio

El dominio actual es **provisorio**. Ni el workflow ni el `.htaccess` lo nombran, así que no hace
falta tocar código. Al cambiarlo:

- [ ] **cPanel**: crear el subdominio (con SSL activo) y una cuenta FTP enjaulada en su docroot.
- [ ] **GitHub**: actualizar `APP_DOMAIN` y los secrets FTP del environment `Production`.
- [ ] **Supabase Auth → URL Configuration**: *Site URL* y *Redirect URLs* = `https://<dominio>`.
      Sin esto, el enlace de "Recuperar contraseña" apunta al dominio viejo
      (`resetPasswordForEmail` no pasa `redirectTo`, usa la Site URL).
- [ ] **Supabase Edge Functions → secret `APP_URL`** = `https://<dominio>`. Sin esto, Webpay
      devuelve al usuario a otra URL (`public-enrollment` y `student-payment` usan
      `localhost:4200` por defecto).
- [ ] Publicar un tag y verificar `https://<dominio>/version.json`.

## Problemas conocidos

- **El certificado del FTP no calza con el host** (`certificate common name doesn't match requested host name`):
  en este hosting compartido el FTP presenta el certificado Let's Encrypt **del servidor**, no el de
  tu dominio. Por eso `FTP_SERVER` es `rs7-va.serverhostgroup.com` (misma IP que
  `ftp.autoescuelachillan.cl`, verificado 2026-10-01). Si el hosting mueve la cuenta de servidor,
  ver el nombre nuevo con:
  `echo | openssl s_client -starttls ftp -connect ftp.<dominio>:21 2>/dev/null | openssl x509 -noout -ext subjectAltName`
  y usar uno de los DNS listados. **No** desactives `ssl:verify-certificate`.
- **IP de GitHub bloqueada** (cPHulk / Imunify360) tras varios logins fallidos: desbloquear desde
  cPanel → *Bloqueador de IP*, y corregir las credenciales antes de reintentar.
- **Rutas de la SPA con "extensión"** (ej. `/algo/archivo.pdf`) responden 404: el `.htaccess`
  trata toda ruta con extensión como archivo. Hoy ninguna ruta de `indices/ROUTES.md` es así.
- **`test:ci` es lento en Windows local** (~19 min); en el runner Linux de GitHub tarda ~1,5 min y el job `build` completo ~2,5 min (timeout: 45 min).
