# Fix: Publicar y volver atrás en producción desde botones de GitHub Actions
> id: fix-177-b-deploy-desde-botones-actions
> refs: 0046-b-deploy-produccion-cpanel-angular
> status: in_progress
> created: 2026-10-01

## Root Cause
El pipeline de 0046-b funciona, pero publicar exige saber git: calcular a mano el próximo número de
versión, crear el tag en `main` actualizado y pushearlo. El owner lo marcó como poco intuitivo
para el equipo (2026-10-01). Además, el rollback vive en el mismo workflow que el deploy por tag
y su formulario no dice qué versiones hay disponibles.

No se puede resolver solo con un botón que cree el tag: un tag creado por un workflow con
`GITHUB_TOKEN` **no dispara** otros workflows (protección anti-loop de GitHub). Hacerlo así
exigiría un token personal, que habría que crear, guardar y renovar. La causa raíz es que el
deploy solo se puede invocar por evento de tag o por dispatch, y no como pieza reutilizable.

## ACs Afectados
- **US1 / AC1 (0046-b):** publicar ya no requiere terminal. *Actions → "Publicar en producción" →
  Run workflow → tipo de cambio* calcula la versión, crea el tag y corre el mismo gate + deploy.
- **AC9 (0046-b):** el rollback pasa a su propio botón, *"Volver a una versión anterior"*, con el
  mismo comportamiento (build del Release, sin recompilar).
- **AC2, AC3, AC4, AC11 (0046-b):** sin cambios de comportamiento. Aprobación, FTPS, orden de
  subida y Release siguen en un único workflow, ahora reutilizable.

### ACs nuevos de este fix
- **F1 — Versión calculada:** Given el último tag semver `vX.Y.Z` del repo, When se elige
  **arreglo**, Then se publica `vX.Y.(Z+1)`; When se elige **mejora**, Then `vX.(Y+1).0`. Los tags
  que no son semver puro (ej. `v0.0.0-ace5`) se ignoran. Lógica en una función pura con test.
- **F2 — Solo desde `main`:** Given que se lanza "Publicar" desde otra rama, Then falla antes de
  crear el tag, con un mensaje explícito.
- **F3 — Nada nuevo que publicar:** Given que `main` apunta al mismo commit que la última versión
  **publicada** (último Release), Then falla con "no hay cambios nuevos desde vX" sin crear tag.
  Un tag cuyo deploy fue rechazado no cuenta como publicado.
- **F4 — Qué se aprueba:** Given un run de "Publicar" esperando aprobación, Then el resumen del run
  lista la versión nueva y los commits desde la última versión publicada.
- **F5 — Un solo deploy:** el tag creado por "Publicar" no dispara además el deploy por push de
  tag (que en total haya un único run de deploy por versión).
- **F6 — Compatibilidad:** pushear un tag `v*` a mano desde la terminal sigue desplegando igual
  que antes.

## Cambio
- **`.github/workflows/deploy-app-production.yml`:** pasa a `on: workflow_call` (inputs `tag`,
  `mode`) además de `push: tags`. El modo se decide por input y no por `github.event_name`, porque
  en un workflow llamado `event_name` es el del caller. Sale el `workflow_dispatch`.
- **`.github/workflows/publicar-produccion.yml` (nuevo):** "Publicar en producción". Dispatch con
  `tipo: arreglo | mejora` → calcula la versión → resumen → crea y pushea el tag → llama al deploy.
- **`.github/workflows/rollback-produccion.yml` (nuevo):** "Volver a una versión anterior".
  Dispatch con `version` → llama al deploy en modo rollback.
- **`scripts/lib/next-version.js` (+ `.test.mjs`):** `nextVersion(tags, tipo)`. Función pura.
- **`docs/DEPLOY.md`:** el flujo de botones pasa a ser el principal; la terminal queda como
  alternativa.

## Test de Regresión
- `node scripts/lib/next-version.test.mjs` ✓ (F1: arreglo/mejora, tags no semver ignorados,
  orden semver y no lexicográfico (`v0.10.0 > v0.9.0`), repo sin tags → `v0.1.0`)
- **Verificación real (como en 0046-b):**
  - "Publicar" desde una rama ≠ main → falla (F2).
  - "Publicar" con `arreglo` → `v0.1.7`, resumen con commits (F4), aprobación, publicado, Release
    `v0.1.7`, un solo run de deploy (F1, F5, AC2, AC11).
  - "Publicar" otra vez sin cambios → falla (F3).
  - "Volver a una versión anterior" con `v0.1.6` → `version.json` = v0.1.6 original (AC9).
