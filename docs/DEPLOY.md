# Despliegue a producción (app Angular → cPanel)

> Spec: [`0046-b`](../specs/specs/0046-b-deploy-produccion-cpanel-angular/spec.md) ·
> [`fix-177-b`](../specs/fixes/fix-177-b-deploy-desde-botones-actions/fix.md) ·
> Workflows: [publicar](../.github/workflows/publicar-produccion.yml) ·
> [volver atrás](../.github/workflows/rollback-produccion.yml) ·
> [deploy](../.github/workflows/deploy-app-production.yml)

La app se publica en el hosting cPanel de la escuela, vía GitHub Actions y FTPS. **Vercel queda
solo para previews de PRs**: no es producción. Por ahora no hay ambiente QA.

---

## Publicar una versión (2 clics + aprobación)

1. Asegúrate de que lo que quieres publicar ya está **mergeado en `main`**. Mergear no publica
   nada por sí solo.
2. GitHub → **Actions → Publicar en producción → Run workflow**:
   - **Branch:** `main`
   - **Tipo de cambio:** `arreglo` (corrige algo: `v0.1.6` → `v0.1.7`) o `mejora` (agrega algo:
     `v0.1.6` → `v0.2.0`)
   - **Run workflow**
3. El workflow calcula solo el número de versión y corre los tests (`test:ci`), el lint
   (`lint:arch`) y el build, en unos 3 minutos. Si algo falla, no se publica nada.
4. Queda en **Waiting for review**. GitHub les avisa a los aprobadores (`Akxlarre`,
   `SorkoTheProgram`, `m-fuentesr`). Arriba del run está el **resumen**: versión nueva y lista
   de commits que entran. Uno de ellos: **Review deployments → Approve and deploy**.
5. Listo en unos 2 minutos. `https://<dominio>/version.json` muestra la versión publicada, y
   **GitHub → Releases** registra la versión con su build exacto (`site.zip`).

Si no hay commits nuevos en `main` desde la última versión publicada, el botón falla con
"No hay cambios nuevos…" y no crea nada.

<details>
<summary>Alternativa por terminal (equivalente)</summary>

```bash
git checkout main && git pull
git tag v0.1.7 && git push origin v0.1.7
```

El número lo eliges tú (tiene que ser mayor que el último). El resto es igual: tests → aprobación
→ publicación → Release.
</details>

**Un deploy a la vez.** Si hay un deploy esperando aprobación y se lanza otro, el nuevo queda en
cola (*pending*) detrás, sin pedir aprobación todavía. GitHub **no** cancela el que espera: si ya
no corresponde, **recházalo** en *Review deployments → Reject* y pasa el siguiente. Una subida en
curso nunca se corta.

## Volver a una versión anterior (rollback)

GitHub → **Actions → Volver a una versión anterior → Run workflow** → **Versión:** la que quieras
(ej. `v0.1.6`; la lista está en **Releases**) → **Run workflow** → aprobar.

No recompila: baja el `site.zip` del Release de esa versión y lo sube tal cual. Tarda segundos y
sube exactamente lo que se aprobó en su momento. Recompilar una versión vieja puede fallar (tests
que dependen de la fecha) o dar otro build (dependencias nuevas). Solo se puede volver a versiones
con Release: `v0.1.5` en adelante.

Para "deshacer el rollback", publica de nuevo con el botón de publicar, o vuelve a la versión más
nueva con este mismo botón.

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
| Deployment branches and tags | *Selected* → **dos** reglas: rama `main` (los botones corren desde `main`) **y** tag `v*` (push manual de un tag). Con solo la de tag, GitHub bloquea los deploys de los botones |
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
- [ ] **Supabase Auth → URL Configuration**: *Site URL* = `https://<dominio>` y en *Redirect URLs*
      agregar `https://<dominio>/recuperar-contrasena`. El link de "Recuperar contraseña" pide volver
      a esa ruta (fix-181-b); si no está registrada, Supabase lo manda a la Site URL (la app igual
      redirige a la pantalla, pero no conviene depender de eso).
- [ ] **Supabase Edge Functions → secret `SITE_URL`** = `https://<dominio>`. Es el destino de los
      links de activación de cuenta: `create-secretary` (fix-182-b), `create-instructor`,
      `activate-instructor-account`, `activate-student-account`.
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
