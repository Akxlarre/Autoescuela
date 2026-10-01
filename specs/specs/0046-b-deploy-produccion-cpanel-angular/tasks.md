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

- [x] **TB.1** — Owner: commit + push a `main` (75ea92e2, 2026-09-29)
  - **AC ref:** AC-E4
  - **DoD:**
    - [x] Commit con staging explícito (sin `git add -A`)
    - [x] Push a `main` → **no** aparece run nuevo de "Deploy app (producción)" (`gh run list --commit 75ea92e2` vacío; workflow registrado como active)

- [x] **TB.2** — Tag `v0.1.0` sin secrets cargados (run 36656473137, 2026-09-30)
  - **AC ref:** AC-E2, AC1, AC2
  - **DoD:**
    - [x] `build` verde en 2m30s: test:ci 208 files passed (85 s en Linux), lint:arch OK, micro-suite OK, build OK, version.json {tag v0.1.0, sha 75ea92e2}
    - [x] `deploy` (sin revisores todavía → sin espera) falla en "Verificar configuración del environment": "Falta configurar en el environment Production: secret FTP_SERVER secret FTP_USERNAME secret FTP_PASSWORD variable APP_DOMAIN. No se subió nada."
    - [x] Docroot intacto por construcción: el paso falló antes de instalar lftp/abrir conexión (ningún paso FTP ejecutado)

- [x] **TB.3** — Owner: configurar environment `Production` (salvo la regla de tag, ver abajo)
  - **AC ref:** AC2, AC3, AC10
  - **DoD:**
    - [x] Revisores `Akxlarre`, `SorkoTheProgram`, `m-fuentesr` (gh api 2026-10-01; prevent_self_review=false)
    - [ ] Deployment branches and tags → Selected → tag `v*` — **pendiente** (no bloquea: el workflow ya exige tag v* ∈ main; es defensa en profundidad)
    - [x] Secrets `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD` + variable `APP_DOMAIN` (tras corregir: estaban en el env de Vercel y APP_DOMAIN como secret)
    - [x] `FTP_SERVER` → `rs7-va.serverhostgroup.com` (gh secret set, 2026-10-01). Motivo: el 1er re-run falló con "certificate common name doesn't match"; el cert es del server compartido (SAN rs7-va…), misma IP 40.160.21.52, verify OK con ese host. Nada subido en ese intento.
    - [x] Verificado por el agente vía `gh api` (sin leer valores)

- [x] **TB.4** — Re-run de `v0.1.0` con secrets (run 36656473137 attempt 3, aprobado por Akxlarre, 2026-10-01)
  - **AC ref:** AC1–AC8
  - **DoD:**
    - [x] Log: get del manifiesto → 550 (1er deploy) · plan 542 archivos / 0 a borrar · mirror con 541 "Transferring file" (reemplazó un `.htaccess` default de cPanel) · los `put` corren después del mirror (silenciosos); step OK con `cmd:fail-exit yes`
    - [x] Verificado con fetch desde el navegador integrado (el bash-guard bloquea comandos de red): `/app/admin/dashboard` 200 + `app-root` (AC5) · `index.html` y `version.json` `no-cache`; `main-*.js` y `styles-*.css` `public, max-age=31536000, immutable` (AC6) · `http://…/login` → `https://…/login` (AC7) · `version.json` = {v0.1.0, 75ea92e2} (AC8) · chunk inexistente 404, `.deploy-manifest.json` 403, `.htaccess` 403
    - [x] `/login` renderiza (screenshot); 38 recursos cargados, 0 con status ≥ 400

- [x] **TB.5** — Segundo deploy + edge cases (2026-10-01)
  - **AC ref:** AC1, AC-E1, AC-E3, AC-E5
  - **DoD:**
    - [x] AC1 en la práctica: `v0.1.1`/`v0.1.2` frenados en `build` por un test que dependía de la fecha (`executive-dashboard.facade.spec.ts`, AC23 con preset `last_month`). Sin aprobación pedida. Test arreglado en `main` (1697d8b6); tags borrados.
    - [x] AC-E1 con `v0.1.3`/`v0.1.4` pusheados juntos: `v0.1.4` (run 36899268413) tomó el turno y quedó `waiting`; `v0.1.3` (run 36899270698) quedó `pending` en cola sin pedir aprobación. Nunca en paralelo. GitHub **no** canceló el que esperaba → AC-E1 reescrito (spec D7). `v0.1.4` aprobado y publicado; `v0.1.3` rechazado por Akxlarre.
    - [x] AC-E3 (2º deploy): manifiesto remoto leído (sin 550), "542 archivo(s), 0 a borrar" (gracia); `main-LL72IEMR.js` de `v0.1.0` sigue respondiendo 200 con `v0.1.4` publicado (`main-VRPMDIRC.js`).
    - [x] AC-E5: tag `v0.0.0-ace5` sobre commit fuera de `main` (d4676f18, creado con commit-tree sin rama) → `build` falla con "…que no está en main…", `deploy` skipped. Tag borrado. (Un 1er intento sobre un commit anterior al workflow no generó run: GitHub usa el workflow del commit del tag.)
    - [x] AC9 (diseño original) **falló**: dispatch `v0.1.0` (run 36900019092) recompiló el tag y el gate lo frenó por el mismo test de fecha → rediseño D6.

- [x] **TB.6** — Rollback sin recompilar (D6) + Release por versión (2026-10-01)
  - **AC ref:** AC9, AC11, AC-E3, AC-E6
  - **DoD:**
    - [x] Workflow: `build` con modo publicación/rollback, job `release` (YAML lint OK, 0 menciones del dominio)
    - [x] Commit + push a `main` (478deb82)
    - [x] AC-E6: dispatch `v0.1.0` (run 36900860740) → "No hay build publicado para v0.1.0 …" en 16 s, sin aprobación
    - [x] AC11: `v0.1.5` (run 36900937462) publicado → Release `v0.1.5` con `site.zip` 3,8 MB (`.htaccess` incluido, validado en el job)
    - [x] AC-E3: el mismo deploy borró 3 archivos exclusivos de `v0.1.0` (`main-LL72IEMR.js`, `chunk-7LXIYDSV.js`, `chunk-DRMS55JA.js`) → 404; `.htaccess` 403; dashboard 200
    - [x] AC9: `v0.1.6` publicado (run 36901786036) → dispatch `v0.1.5` (run 36902496717): npm ci/tests/lint/build `skipped`, preparación 9 s → `version.json` = v0.1.5, `builtAt 17:41:52`, `run 36900937462` (originales); job `release` skipped

## Fase C — Cierre

- [x] **TC.1** — `acceptance.md` con evidencia por AC: 18/18 ✅
- [x] **TC.2** — ROADMAP (0046-b → Done), `specs/.active` vacío, memoria del proyecto
  - **DoD:**
    - [x] Tareas manuales del owner listadas en `acceptance.md` § Pendientes: regla de tag `v*` en el environment y T-DOM-1/2 (no bloquean el cierre)
