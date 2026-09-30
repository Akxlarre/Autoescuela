# Tasks 0046-b — Despliegue a producción de la app Angular en cPanel (GitHub Actions + FTPS)

> **Plan:** [plan.md](./plan.md) · **Spec:** [spec.md](./spec.md)
> **Created:** 2026-09-29

Fases 1–4 de la plantilla (datos, facade, UI, conexión) no aplican: no se toca `src/app` ni BD.

---

## Fase A — Preflight y artefactos locales (agente)

- [x] **TA.0** — Preflight del gate de calidad en `main`
  - **AC ref:** AC1 (precondición)
  - **DoD:**
    - [x] `npm run test:ci` corrido local, resultado anotado (verde / rojo preexistente)
    - [x] `npm run lint:arch` corrido local, resultado anotado
    - [x] Sin rojo: test:ci 2774 passed / 5 skipped (19 min en Windows local); lint:arch exit 0 (solo warnings preexistentes ARCH-11/14/19)

- [x] **TA.1** — `public/.htaccess` + verificación de que viaja en el build
  - **AC ref:** AC5, AC6, AC7, AC10
  - **DoD:**
    - [x] `public/.htaccess` creado según el bosquejo del plan §5
    - [x] Sin dominio literal (`grep autoescuelachillan public/` → 0)
    - [x] `ng build --configuration production` OK
    - [x] Ruta real del output: `dist/Autoescuela/browser` (confirmada)
    - [x] `.htaccess` presente en esa ruta (si no, entrada explícita en `angular.json`)

- [x] **TA.2** — `scripts/lib/deploy-manifest.js` con TDD
  - **AC ref:** AC-E3
  - **DoD:**
    - [x] `scripts/lib/deploy-manifest.test.mjs` escrito primero y en rojo
    - [x] Casos: 1er deploy borra 0 · 2º borra 0 · 3º borra solo N-2 ∖ (N ∪ N-1) · archivo que reaparece no se borra · nunca `.htaccess`/`.deploy-manifest.json`/`cgi-bin/`/`.well-known/` · manifiesto corrupto → borra 0
    - [x] `node scripts/lib/deploy-manifest.test.mjs` → exit 0
    - [x] Función pura (sin `fs`, sin red)

- [x] **TA.3** — CLI `scripts/deploy-ftp-plan.js`
  - **AC ref:** AC-E3, AC4
  - **DoD:**
    - [x] Args: dir del build + path del manifiesto remoto (opcional/inexistente)
    - [x] Escribe `delete-list.txt` (una ruta por línea) y `<build>/.deploy-manifest.json`
    - [x] Probado local contra el `dist` de TA.1: sin manifiesto, con manifiesto simulado N-1/N-2, y con JSON corrupto

- [x] **TA.4** — Workflow `.github/workflows/deploy-app-production.yml`
  - **AC ref:** AC1, AC2, AC3, AC4, AC8, AC9, AC10, AC-E1, AC-E2, AC-E4, AC-E5
  - **DoD:**
    - [x] `on: push: tags: ['v*']` + `workflow_dispatch` con input `tag` (requerido)
    - [x] `build`: checkout `fetch-depth: 0` del tag · check "SHA ∈ origin/main" con mensaje explícito · node 22 + `npm ci` · `test:ci` · `lint:arch` · micro-suite de manifiesto · build prod · `version.json {tag, sha, builtAt}` · upload-artifact
    - [x] `deploy`: `needs: build` · `environment: { name: Production, url: https://${{ vars.APP_DOMAIN }} }` · `concurrency: { group: deploy-app-production, cancel-in-progress: false }`
    - [x] `lftp` con `ftp:ssl-force true`, `ftp:ssl-protect-data true`, `ssl:verify-certificate yes`, `net:max-retries 2`
    - [x] Orden: get manifiesto → plan → `mirror -R` sin `--delete` (excluye `index.html`, `version.json`, manifiesto) → `put version.json` → `put index.html` → `rm` de la lista → `put` manifiesto
    - [x] Falta de secrets detectada al inicio del job con error explícito (AC-E2)
    - [x] Credenciales solo vía `secrets.*` del environment; dominio solo vía `vars.APP_DOMAIN`
    - [x] `grep autoescuelachillan .github/workflows/deploy-app-production.yml` → 0
    - [x] YAML válido (yaml-lint OK; actionlint no disponible). Generación de scripts lftp simulada en bash: orden verificado

- [x] **TA.5** — `docs/DEPLOY.md`
  - **AC ref:** AC9, AC10 (operación)
  - **DoD:**
    - [x] Cómo publicar (tag), aprobar y hacer rollback (dispatch)
    - [x] Setup del environment `Production` (revisores, regla de tag `v*`, secrets, `APP_DOMAIN`)
    - [x] Checklist de cambio de dominio T-DOM-1..3
    - [x] Limitación: rutas de la SPA con "extensión" caen en 404

## Fase B — Verificación real (agente + owner)

- [ ] **TB.1** — Owner: commit + push a `main`
  - **AC ref:** AC-E4
  - **DoD:**
    - [ ] Commit con staging explícito (sin `git add -A`)
    - [ ] Push a `main` → **no** aparece run nuevo de "Deploy app (producción)"

- [ ] **TB.2** — Tag `v0.1.0` sin secrets cargados
  - **AC ref:** AC-E2, AC1, AC2
  - **DoD:**
    - [ ] `build` verde
    - [ ] Tras aprobar, `deploy` falla con error explícito de secrets/login
    - [ ] Docroot de cPanel intacto (Administrador de archivos)

- [ ] **TB.3** — Owner: configurar environment `Production`
  - **AC ref:** AC2, AC3, AC10
  - **DoD:**
    - [ ] Revisores `Akxlarre`, `SorkoTheProgram`, `m-fuentesr`
    - [ ] Deployment branches and tags → Selected → tag `v*`
    - [ ] Secrets `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD` + variable `APP_DOMAIN`
    - [ ] Verificado por el agente vía `gh api` (sin leer valores)

- [ ] **TB.4** — Re-run de `v0.1.0` con secrets
  - **AC ref:** AC1–AC8
  - **DoD:**
    - [ ] Log de `lftp` muestra el orden de AC4
    - [ ] `curl` de AC5, AC6, AC7, AC8 según plan §7, con evidencia pegada en `acceptance.md`
    - [ ] `/verify` sobre `/login`: consola limpia, sin 404 de assets

- [ ] **TB.5** — `v0.1.1` + rollback + edge cases
  - **AC ref:** AC9, AC-E1, AC-E3, AC-E5
  - **DoD:**
    - [ ] Dos tags seguidos → el pendiente viejo queda "cancelled" (AC-E1)
    - [ ] Dispatch `tag: v0.1.0` → `version.json` vuelve a `v0.1.0` (AC9)
    - [ ] Manifiesto en server con `current`/`previous` coherente; sin borrados fuera de la lista (AC-E3)
    - [ ] Tag sobre commit fuera de `main` → `build` falla con mensaje explícito (AC-E5); tag borrado después

## Fase C — Cierre

- [ ] **TC.1** — `/spec-verify` + `acceptance.md` con evidencia por AC
- [ ] **TC.2** — ROADMAP (0046-b → Done), `specs/.active` vacío, memoria del proyecto si surgió algo no obvio
  - **DoD:**
    - [ ] Tareas manuales T-DOM-1/2 listadas como pendientes del owner (no bloquean el cierre)
