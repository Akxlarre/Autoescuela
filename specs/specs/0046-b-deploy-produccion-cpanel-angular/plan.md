# Plan 0046-b — Despliegue a producción de la app Angular en cPanel (GitHub Actions + FTPS)

> **Spec:** [spec.md](./spec.md)
> **Status:** approved (owner, 2026-09-29)
> **Created:** 2026-09-29
> **Talla:** S (confirmada por el owner, 2026-09-29)

---

## 1. Resumen ejecutivo

Un workflow nuevo, disparado por tag `v*`, con dos jobs:

1. **`build`**: gate de calidad y artefacto.
2. **`deploy`**: requiere la aprobación del environment `Production` y sube el artefacto por FTPS con
   `lftp`, en un orden que nunca deja el sitio roto.

Un `.htaccess` en `public/` resuelve el fallback SPA, la caché y HTTPS sin nombrar el dominio. La
limpieza de archivos viejos la decide una función pura con test, que solo borra lo que el propio
pipeline subió hace dos versiones.

**Por qué `lftp` y no `SamKirkland/FTP-Deploy-Action`** (la acción que usaba el workflow de Astro):

- Esa acción borra los archivos viejos en la **misma** pasada en que sube los nuevos, y no tiene
  opción para no borrar.
- Si se hacen dos pasadas (assets, luego `index.html`), la primera ya borró los chunks viejos
  mientras el `index.html` viejo sigue publicado, lo que viola AC4.
- Además, un usuario con la app abierta que navega a una ruta lazy pide un chunk viejo que ya no
  existe.
- `lftp` (`mirror -R` sin `--delete`, luego `put index.html`, luego `rm` explícitos) da control
  total del orden.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `.github/workflows/deploy-app-production.yml` | Workflow CI | Trigger por tag `v*` + `workflow_dispatch` (rollback). Job `build` (AC1, AC-E5) y job `deploy` con environment `Production` (AC2, AC3, AC4, AC-E1, AC-E2). |
| `public/.htaccess` | Config Apache | HTTPS forzado (AC7), fallback SPA (AC5), `Cache-Control` (AC6). Sin dominio literal (AC10). |
| `scripts/lib/deploy-manifest.js` | Núcleo funcional (función pura) | `planDeploy({ currentFiles, remoteManifest })` → `{ toDelete, nextManifest }`. Periodo de gracia de una versión (AC-E3). |
| `scripts/lib/deploy-manifest.test.mjs` | Micro-suite sin framework | Mismo patrón que `scripts/lib/*.test.mjs`. |
| `scripts/deploy-ftp-plan.js` | CLI delgado | Lee el `dist`, lee el manifiesto remoto (si existe) y escribe `delete-list.txt` + `.deploy-manifest.json`. Solo I/O; la lógica vive en la lib. |
| `docs/DEPLOY.md` | Doc | Cómo publicar (tag), aprobar, hacer rollback, qué hacer al cambiar de dominio (T-DOM-1..3) y setup del environment. |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `specs/ROADMAP.md` | Mover 0046-b a "Done" al cerrar | Proceso SDD |

### Archivos a ELIMINAR

Ninguno. `deploy-cpanel.yml` (Astro) queda **desactivado, no borrado**: la spec 0005-b y las
webs lo van a necesitar.

---

## 3. Reutilización (Discovery)

- **Índices de la app (`COMPONENTS`, `FACADES`, `DATABASE`…): N/A.** No se toca `src/app`, ni BD,
  ni UI.
- **Patrón `scripts/lib/*.js` + `*.test.mjs` sin framework** (ej. `shared-roles.js`,
  `sql-schema.js`) → la lib de manifiesto sigue ese mismo patrón. No entra en `test:ci` (vitest),
  igual que las demás micro-suites; se corre como paso explícito del job `build`.
- **Assets de Angular desde `public/`** (`angular.json` → `{"glob":"**/*","input":"public"}`) →
  el `.htaccess` viaja solo en el build, sin tocar `angular.json`. ⚠️ Verificar en T1 que el glob
  copie dotfiles; si no, se agrega una entrada explícita para `.htaccess`.
- **`deploy-cpanel.yml` (Astro)**: se reutiliza la idea de secrets FTP; lo demás no (acción FTP
  descartada arriba).

### Lo que NO existe y se crea
- La lógica de "qué borrar": no hay nada equivalente en el repo, y la acción FTP estándar no la
  ofrece.

---

## 4. Modelo de datos

N/A. No toca persistencia.

---

## 5. Arquitectura del feature

```
git push origin v1.2.0            (o workflow_dispatch { tag: v1.1.0 } para rollback)
        │
        ▼
┌─ job: build ──────────────────────────────────────────────────────────┐
│ checkout (fetch-depth: 0, ref = tag)                                   │
│ ¿SHA del tag ∈ historia de origin/main?  no → FAIL (AC-E5)             │
│ setup-node 22 + npm ci                                                 │
│ npm run test:ci  →  npm run lint:arch  →  micro-suite deploy-manifest  │
│ ng build --configuration production                                    │
│ escribe version.json { tag, sha, builtAt } en dist/…/browser (AC8)     │
│ upload-artifact "site"                                                 │
└────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ job: deploy ── environment: Production (url: https://${vars.APP_DOMAIN}) ┐
│   ⏸  Waiting for review (Akxlarre | SorkoTheProgram | m-fuentesr)  AC2    │
│ concurrency: group=deploy-app-production, cancel-in-progress: false AC-E1 │
│ download-artifact → site/        apt install lftp                         │
│ lftp get .deploy-manifest.json (puede no existir: 1er deploy)             │
│ node scripts/deploy-ftp-plan.js → delete-list.txt + nuevo manifiesto      │
│ lftp (FTPS, ftp:ssl-force, verificación de certificado):          AC3     │
│   1. mirror -R  (excluye index.html, version.json, manifiesto)    AC4     │
│      SIN --delete                                                         │
│   2. put version.json, put index.html   ← el switch de versión    AC4     │
│   3. rm de delete-list.txt (solo archivos de hace 2 versiones)    AC-E3   │
│   4. put .deploy-manifest.json                                            │
└───────────────────────────────────────────────────────────────────────────┘
```

**Por qué `cancel-in-progress: false` (AC-E1):** GitHub mantiene como máximo una ejecución
corriendo y una pendiente por grupo, y la pendiente nueva reemplaza a la vieja. `true` podría
matar un `deploy` a mitad de la subida.

**Manifiesto con gracia de una versión (AC-E3).** El server guarda
`{ current: [archivos de N-1], previous: [archivos de N-2] }`. Al desplegar N:

- `toDelete = previous − N − current`, es decir, solo archivos que **este pipeline** subió en
  N-2 y que ni N ni N-1 usan.
- `nextManifest = { current: N, previous: current }`.

Nunca toca `cgi-bin/` ni `.well-known/` (AutoSSL de cPanel), ni nada que el pipeline no haya
subido.

**`.htaccess` (bosquejo, sin dominio):**
```apache
Options -Indexes
RewriteEngine On
# HTTPS (sin tocar el desafío de AutoSSL)
RewriteCond %{HTTPS} !=on
RewriteCond %{REQUEST_URI} !^/\.well-known/
RewriteRule ^ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
# El manifiesto de deploy no es público
RewriteRule ^\.deploy-manifest\.json$ - [F,L]
# Archivo o carpeta real → servir tal cual
RewriteCond %{REQUEST_FILENAME} -f [OR]
RewriteCond %{REQUEST_FILENAME} -d
RewriteRule ^ - [L]
# Ruta con extensión que no existe (chunk viejo, typo) → 404 real, NO index.html
RewriteCond %{REQUEST_URI} \.[a-z0-9]{1,5}$ [NC]
RewriteRule ^ - [R=404,L]
# Resto → SPA
RewriteRule ^ index.html [L]

<IfModule mod_headers.c>
  <FilesMatch "^(index\.html|version\.json)$">
    Header set Cache-Control "no-cache"
  </FilesMatch>
  <FilesMatch "-[A-Za-z0-9]{8}\.(js|css)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
</IfModule>
```

Por qué va la regla del 404 por extensión: sin ella, un chunk inexistente devolvería `index.html`
con 200 y el navegador fallaría con un error de sintaxis de JS en vez de un 404 legible.

### Capas tocadas
- **CI**: `.github/workflows/deploy-app-production.yml`
- **Server config**: `public/.htaccess`
- **Tooling**: `scripts/lib/deploy-manifest.js`, `scripts/deploy-ftp-plan.js`
- **App Angular / BD / Edge Functions**: ninguna.

---

## 6. Restricciones aplicables

Reglas aplicables:

- **`architecture.md` §Núcleo Funcional**: la decisión de qué borrar es una función pura
  testeable, fuera del YAML.
- **`testing-tdd.md`**: test primero para la lib de manifiesto.
- **Cero dependencias externas para el cliente** (memoria del proyecto): `lftp` es una herramienta
  del runner, no un SaaS que la escuela deba administrar.
- El resto (Facade, OnPush, DS, SWR, notificaciones, data-llm-*): no aplica.

---

## 7. Plan de testing

- **Unitario (TDD):** `node scripts/lib/deploy-manifest.test.mjs`. Casos:
  - Primer deploy (sin manifiesto) → borra 0.
  - Segundo deploy → borra 0 (gracia).
  - Tercer deploy → borra solo lo de N-2 que no está en N ni N-1.
  - Un archivo que vuelve a aparecer en N no se borra.
  - Nunca propone `.htaccess`, `.deploy-manifest.json`, `cgi-bin/` ni `.well-known/`.
  - Manifiesto remoto corrupto o de formato desconocido → no borra nada (falla segura).
- **Local, antes del primer tag:**
  - `ng build --configuration production` y confirmar que `dist/…/browser/.htaccess` existe.
  - `actionlint` sobre el workflow, si está disponible.
- **Verificación real (el primer tag `v0.1.0` es parte del QA):**

| AC | Cómo se verifica |
|----|------------------|
| AC-E2 | Correr **antes** de cargar los secrets en el environment → `deploy` falla con error de login explícito y el docroot queda intacto |
| AC1 / AC2 | Run con `build` verde y `deploy` en "Waiting for review" |
| AC3 / AC4 | Log de `lftp`: `mirror` sin borrados → `put index.html` → `rm` |
| AC5 | `curl -sI https://$APP_DOMAIN/app/admin/dashboard` → 200 + `content-type: text/html` |
| AC6 | `curl -sI` de `/index.html` → `no-cache`; de `/main-XXXXXXXX.js` → `immutable` |
| AC7 | `curl -sI http://$APP_DOMAIN/login` → 301 a `https://` |
| AC8 | `curl https://$APP_DOMAIN/version.json` → tag/sha del run |
| AC9 | Desplegar `v0.1.1` y hacer rollback con dispatch `v0.1.0` → `version.json` vuelve a `v0.1.0` |
| AC10 | `grep -r "autoescuelachillan" .github/workflows/deploy-app-production.yml public/` → 0 |
| AC-E1 | Pushear dos tags seguidos → el run pendiente viejo queda "cancelled" |
| AC-E4 | Push a `main` sin tag → ningún run nuevo del workflow |
| AC-E5 | Tag sobre un commit de otra rama → `build` falla con el mensaje de "no está en main" |

- **Visual:** `/verify` sobre `https://$APP_DOMAIN/login` (consola limpia, sin 404 de assets).

---

## 8. Riesgos y mitigaciones

| Riesgo | Prob. | Mitigación |
|--------|-------|------------|
| El certificado TLS del FTP es el del servidor compartido (`rs7-va…`) y no el de `ftp.autoescuelachillan.cl` → la verificación de certificado falla | Media | Probar en el primer run. Si falla, usar como `FTP_SERVER` el hostname que figura en el certificado (sigue cifrado y verificado). **No** desactivar `ssl:verify-certificate` en silencio. |
| cPHulk / Imunify360 bloquea las IPs de GitHub tras logins fallidos (ej. el run de AC-E2) | Media | AC-E2 se prueba **una sola vez**. `lftp` con `net:max-retries 2` para no martillar. Si hay bloqueo, se levanta desde cPanel → Bloqueador de IP. |
| `test:ci` o `lint:arch` no están verdes en `main` hoy → el primer tag queda bloqueado | Media | T0: correr ambos local antes de implementar. Si hay rojo preexistente, se reporta; no se relaja el gate. |
| El glob de assets no copia dotfiles → `.htaccess` no viaja | Baja | T1 lo verifica con un build real; fallback: entrada explícita en `angular.json`. |
| Servidor LiteSpeed en vez de Apache: sintaxis de `.htaccess` compatible, pero `Header set` podría ignorarse | Baja | AC6 se verifica con `curl -I` real, no por lectura. |
| Ruta de la SPA con un segmento que termina en "extensión" (ej. `/x/archivo.pdf`) cae en el 404 | Baja | Hoy `ROUTES.md` no tiene rutas así (ids numéricos). Anotado en `docs/DEPLOY.md`. |
| Self-approval: quien crea el tag lo aprueba él mismo | — | Aceptado por diseño (cualquiera de los 3 aprueba). Configurable después con *Prevent self-review*. |

---

## 9. Orden de implementación

0. **T0 — Preflight:** `npm run test:ci` + `npm run lint:arch` en `main` local; anotar el estado.
1. **T1:** crear `public/.htaccess` + `ng build --configuration production` → confirmar ruta real
   del output (`dist/Autoescuela/browser`?) y que `.htaccess` esté en ella.
2. **T2 (TDD):** `scripts/lib/deploy-manifest.test.mjs` en rojo → `deploy-manifest.js` → verde.
3. **T3:** `scripts/deploy-ftp-plan.js` (CLI) + prueba local contra un `dist` real y un manifiesto
   simulado.
4. **T4:** `.github/workflows/deploy-app-production.yml`.
5. **T5:** `docs/DEPLOY.md`.
6. **T6 — Owner:** commit + push a `main` (no dispara nada, AC-E4).
7. **T7 — Primer tag `v0.1.0` sin secrets** → AC-E2. **Owner** carga secrets + `APP_DOMAIN` +
   revisores + regla de tag `v*` → re-run → AC1–AC8.
8. **T8:** `v0.1.1` + rollback a `v0.1.0` → AC9, AC-E1, AC-E5.
9. **T9:** tareas manuales de dominio T-DOM-1/2 (Supabase), si el owner decide usar este dominio
   provisorio con usuarios reales.

---

## 10. Estimación

S — ~medio día de implementación + la ventana de verificación real (depende de los pasos manuales
del owner en GitHub/cPanel).

---

## Changelog

- 2026-09-29 — plan inicial (talla S).
