# Spec 0046-b — Despliegue a producción de la app Angular en cPanel (GitHub Actions + FTPS)

> **Status:** approved
> **Created:** 2026-09-29
> **Owner:** Benjamín
> **Priority:** P1

---

## 1. Contexto de negocio

**Origen:** iniciativa interna, conversación con el owner el 2026-09-29. Decisiones tomadas en
esa conversación:

- Producción de la app Angular vive en **cPanel**, hoy en `https://app.autoescuelachillan.cl`.
  ⚠️ **Ese dominio es provisorio (de prueba) y va a cambiar.** Nada del pipeline puede depender
  de él de forma fija: el dominio vive en un solo lugar configurable (variable del environment).
- **Se despliega con tag** `v*` (no con cada push a `main`), con aprobación manual encima.
- **Vercel queda solo para previews** de PRs (proyectos `autoescuela` y `autoescuela-dbd2`, ya
  conectados al repo). No es producción.
- **Sin ambiente QA por ahora** (no hay proyecto Supabase separado todavía). El flujo debe quedar
  preparado para sumar un environment `qa` después sin rehacerlo.
- Aprueba los pases a producción **cualquiera** de: Benjamín, Matías, Ignacio.
- Las webs públicas Astro **no** se despliegan todavía: el workflow `deploy-cpanel.yml` (Astro)
  fue desactivado manualmente en GitHub por el owner el 2026-09-29. No fallaba por cPanel sino por
  el `npm ci` de `webs/` (lockfile sin `vitest` + bug de npm 10); eso queda fuera de esta spec.

**Hallazgos de infraestructura (verificados 2026-09-29):**

- Hosting compartido cPanel 138 (cuenta `autoesc8`), shell en jaula (CageFS): sin `rsync`, sin
  `node`, sin `~/.ssh`, `sshd_config` no legible. Puerto 22 y alternativos cerrados desde afuera.
  → **SSH descartado; transporte = FTPS** (Pure-FTPd con TLS en puerto 21, verificado).
- Subdominio `app.autoescuelachillan.cl` creado, docroot `/home/autoesc8/app.autoescuelachillan.cl`.
- Cuenta FTP dedicada `deploy-app@app.autoescuelachillan.cl`, **enjaulada en ese docroot** (no ve
  los otros sitios).
- Environment `Production` existe en GitHub (sin reglas ni secrets al momento de redactar).

**Persona afectada:** Admin y Secretaria (usuarios del piloto) → acceden por la URL nueva.
Equipo dev → publica sin FTP manual.

**Problema que resuelve:**
Hoy no hay forma reproducible de publicar la app en el hosting de la escuela: habría que compilar
local y subir `dist/` a mano por FTP, sin registro de qué versión está arriba, sin aprobación y
sin rollback. Además, un FTP manual deja el sitio roto unos segundos (un `index.html` nuevo
apuntando a chunks que todavía no se subieron).

**Hipótesis de valor:**
Publicar a producción = mergear a `main` + un click de aprobación, con la versión desplegada
trazable a un commit y rollback en minutos.

---

## 2. User Stories

- **US1**: Como dev, quiero que crear un tag de versión (`v1.2.0`) prepare automáticamente un
  despliegue a producción, para no compilar ni subir archivos a mano y saber qué versión está arriba.
- **US2**: Como aprobador (Benjamín, Matías o Ignacio), quiero que nada llegue a producción sin
  que uno de nosotros lo apruebe, para controlar qué ve la escuela.
- **US3**: Como usuario de la app, quiero que recargar cualquier ruta interna funcione y que tras
  un despliegue vea la versión nueva sin limpiar caché.
- **US4**: Como dev, quiero volver a una versión anterior sin tocar código, para recuperar
  producción rápido si un despliegue sale mal.

---

## 3. Acceptance Criteria (Gherkin)

- **AC1 — Build y gate de calidad**: Given un push de un tag `v*` (ej. `v1.0.0`), When corre el workflow
  `deploy-app-production.yml`, Then un job `build` ejecuta `npm ci`, `npm run test:ci`,
  `npm run lint:arch` y `ng build --configuration production`, y si cualquiera falla no se crea
  despliegue.
- **AC2 — Aprobación obligatoria**: Given el build verde, When llega el job `deploy`, Then queda
  en "Waiting for review" en el environment `Production` y no sube nada hasta que Benjamín, Matías
  o Ignacio lo apruebe.
- **AC3 — Transporte FTPS**: Given la aprobación, When corre `deploy`, Then sube el artefacto del
  build (no recompila) a la raíz de la cuenta `deploy-app` por **FTPS** (TLS explícito), leyendo
  credenciales **solo** de secrets del environment `Production`.
- **AC4 — Orden seguro de subida**: Given el despliegue, When se suben archivos, Then primero se
  suben todos los assets y chunks, y `index.html` va **al final**. Nunca queda publicado un
  `index.html` que referencie chunks inexistentes.
- **AC5 — Fallback SPA**: Given la app desplegada, When se abre o recarga directamente
  `https://<dominio>/app/admin/dashboard` (o cualquier ruta interna), Then responde
  200 con la app, no 404 de Apache.
- **AC6 — Caché correcta**: Given la app desplegada, When se piden los recursos, Then
  `index.html` responde con `Cache-Control: no-cache` y los archivos con hash
  (`*.js`/`*.css` con hash en el nombre) con `Cache-Control: public, max-age=31536000, immutable`.
- **AC7 — HTTPS forzado**: Given una request a `http://<dominio>/...`, When llega,
  Then redirige 301 a `https://`. El `.htaccess` no nombra el dominio (usa `%{HTTP_HOST}`).
- **AC8 — Trazabilidad**: Given un despliegue terminado, When se consulta
  `https://<dominio>/version.json`, Then devuelve el tag, el SHA del commit y la fecha de build,
  que coinciden con la ejecución del workflow.
- **AC9 — Rollback sin recompilar**: Given un tag previo desplegado con éxito, When un dev lanza el
  workflow manualmente (`workflow_dispatch`) indicando ese tag, Then se re-despliega **el mismo
  build que se aprobó en su momento** (descargado de su GitHub Release), sin `npm ci`, sin tests y
  sin `ng build`, pasando igual por aprobación, y `version.json` refleja ese tag y su SHA original.
- **AC11 — Registro de versiones publicadas**: Given un deploy por tag que termina con éxito, When
  concluye, Then existe un GitHub Release de ese tag con el build exacto (`site.zip`, incluido
  `.htaccess`) como asset. Un deploy rechazado o fallido no crea Release.
- **AC-E6 — Rollback a un tag sin build publicado**: Given un tag sin Release (nunca desplegado, o
  anterior a este mecanismo), When se pide rollback a él, Then el workflow falla con un mensaje
  explícito ("no hay build publicado para ese tag") antes de pedir aprobación.
- **AC10 — Dominio desacoplado**: Given que el dominio de producción cambie, When se actualiza,
  Then basta con cambiar la variable `APP_DOMAIN` del environment `Production` (más las tareas
  manuales de §5): cero cambios de código, workflow ni `.htaccess`. Verificable con
  `grep -r "autoescuelachillan" .github/ public/` → 0 resultados.

### Edge cases obligatorios

- **AC-E1 — Un solo despliegue a la vez**: Given dos tags pusheados seguidos, When ambos llegan a
  `deploy`, Then nunca corren dos subidas en paralelo contra el FTP: el primero en llegar queda
  esperando aprobación y el otro queda en cola (`pending`) sin pedirla; si llega un tercero, reemplaza
  al que estaba en cola. Un deploy que espera aprobación no se cancela solo: el aprobador lo
  **rechaza** si no corresponde (p. ej. dos tags casi simultáneos donde ganó el turno la versión vieja).
  Una subida en curso nunca se cancela (`cancel-in-progress: false`).
- **AC-E2 — Credenciales ausentes o inválidas**: Given secrets faltantes o contraseña incorrecta,
  When corre `deploy`, Then el job falla con un error explícito de conexión o login y el sitio
  publicado queda intacto (sin subida parcial).
- **AC-E3 — Limpieza de archivos viejos**: Given despliegues sucesivos, When un chunk deja de
  existir en el build nuevo, Then se elimina del servidor en ese despliegue o en el siguiente, y la
  carpeta no crece sin límite. Nunca se borra el `.htaccess` ni nada fuera del docroot de la cuenta.
- **AC-E4 — Pushes sin tag no despliegan**: Given un push a `main` o a cualquier rama sin tag
  `v*`, When se evalúa el trigger, Then no se crea despliegue.
- **AC-E5 — Tag fuera de `main`**: Given un tag `v*` que apunta a un commit que no está en la
  historia de `main`, When corre el workflow, Then falla en `build` con un mensaje explícito y no
  llega a pedir aprobación.

---

## 4. Out of scope

- ❌ Ambiente **QA** y segundo proyecto Supabase. Queda para una spec posterior; esta deja el
  workflow parametrizable por environment para sumarlo.
- ❌ Despliegue de las webs **Astro** (`webs/`) y el arreglo de su `npm ci`. El workflow
  `deploy-cpanel.yml` sigue desactivado.
- ❌ Aplicar migraciones SQL o desplegar Edge Functions desde el pipeline (siguen manuales, como hoy).
- ❌ Cambios en Vercel (sigue como previews, tal cual está).
- ❌ Headers de seguridad avanzados (CSP, HSTS preload): se evalúan aparte.
- ❌ Migrar a SSH/rsync (no disponible en este hosting).
- ❌ Crear o rotar la cuenta FTP y los secrets: lo hace el owner a mano (no automatizable ni
  delegable al agente).

---

## 5. Dependencias

### Specs previas
- Ninguna.

### Capacidades del proyecto que se asumen existentes
- `ng build --configuration production` funcional (builder `@angular/build:application`, assets
  desde `public/`).
- `npm run test:ci` y `npm run lint:arch` en verde en `main`.
- Subdominio `app.autoescuelachillan.cl` con SSL activo en cPanel.
- Cuenta FTP `deploy-app@app.autoescuelachillan.cl` enjaulada en su docroot.

### Capacidades nuevas requeridas (acciones manuales del owner, previas a AC2/AC3)
- Environment `Production` con **Required reviewers** (`Akxlarre`, `SorkoTheProgram`,
  `m-fuentesr`) y **Deployment branches and tags** → *Selected* → regla de **tag** `v*`.
- Environment secrets: `FTP_SERVER` (`ftp.autoescuelachillan.cl`), `FTP_USERNAME`
  (`deploy-app@app.autoescuelachillan.cl`), `FTP_PASSWORD`.
- Environment variable: `APP_DOMAIN` (hoy `app.autoescuelachillan.cl`).

### Tareas manuales por dominio (NO son AC de esta spec — se repiten cada vez que cambie el dominio)

> El dominio actual es provisorio. Estas tareas se hacen al publicar en un dominio y se rehacen
> cuando cambie. Quedan fuera del pipeline a propósito.

- [ ] **T-DOM-1 — Supabase Auth → URL Configuration**: Site URL y Redirect URLs =
      `https://<dominio>`. Sin esto, el enlace de "Recuperar contraseña" apunta a otro lado
      (`resetPasswordForEmail` no pasa `redirectTo`, usa la Site URL).
- [ ] **T-DOM-2 — Secret `APP_URL`** de Edge Functions = `https://<dominio>`. Sin esto, Webpay
      devuelve al usuario a `localhost:4200` (fallback en `public-enrollment` y `student-payment`).
- [ ] **T-DOM-3 — cPanel**: subdominio con SSL activo + cuenta FTP enjaulada en su docroot;
      actualizar `APP_DOMAIN` y los secrets FTP si cambian.

---

## 6. Datos y modelo (preliminar)

- No toca persistencia. Sin tablas, modelos ni RLS nuevos.
- Archivos nuevos previstos: `.github/workflows/deploy-app-production.yml`, `public/.htaccess`,
  generación de `version.json` en el build.

---

## 7. UX y flujos (preliminar)

- Sin pantallas nuevas.
- Flujo principal: `git tag v1.0.0 && git push origin v1.0.0` → build + tests → "Waiting for
  review" → aprobación → subida FTPS (assets → `index.html`) → `version.json` actualizado.
- Rollback: Actions → "Deploy app (producción)" → Run workflow → tag anterior → aprobación.

---

## 8. Métricas de éxito post-launch

- Cero despliegues manuales por FTP desde que se activa el workflow.
- Tiempo de merge aprobado a producción < 10 min.
- Cero reportes de "pantalla en blanco" o 404 al recargar tras un despliegue.

---

## 9. Notas / decisiones abiertas

- [x] **D1 — Disparador**: **tag `v*`** (owner, 2026-09-29), con aprobación manual encima.
      `workflow_dispatch` solo para rollback a un tag existente.
- [x] **D2 — Gate de tests**: **sí**, `test:ci` + `lint:arch` bloquean el despliegue.
- [x] **D3 — Aprobadores**: `Akxlarre`, `SorkoTheProgram`, `m-fuentesr` (confirmado por el owner).
- [x] **D4 — Cutover**: no hay URL previa en uso que redirigir (owner: "no creo").
- [x] **D5 — Dominio**: provisorio. Las URLs de Supabase pasan a tareas manuales (§5 T-DOM-*),
      no a ACs, y el dominio queda en una sola variable (AC10).
- [x] **D6 — Rollback sin recompilar** (owner, 2026-10-01): el rollback re-despliega el build
      original guardado en un GitHub Release por tag. Motivo: el primer rollback real (dispatch
      `v0.1.0`, run 36900019092) recompiló el tag viejo y el gate lo frenó por un test que dependía
      de la fecha (arreglado en `main`, pero no en el tag). Recompilar tampoco reproduce el build
      aprobado (deps/Node pueden cambiar) y es lento. `v0.1.0`–`v0.1.4` no tienen Release → no son
      destino de rollback (AC-E6).
- [x] **D7 — AC-E1 reescrito** a lo que GitHub hace de verdad (observado con `v0.1.3`/`v0.1.4`,
      2026-10-01): un deploy esperando aprobación no se cancela por uno nuevo; el nuevo queda en cola.

---

## Changelog

- 2026-09-29 — draft inicial por Benjamín (redactado con Claude a partir de las decisiones de la
  conversación del 2026-09-29).
- 2026-09-29 — resueltas D1–D4 + D5 (dominio provisorio → URLs de Supabase como tareas
  manuales, AC10 reemplazado por "dominio desacoplado", AC-E4 reescrito y AC-E5 nuevo por el
  disparador con tag). Status → approved.
- 2026-10-01 — D6/D7: AC9 reescrito (rollback = build original del Release, sin recompilar),
  AC11 y AC-E6 nuevos, AC-E1 ajustado al comportamiento real de la cola de environments.
