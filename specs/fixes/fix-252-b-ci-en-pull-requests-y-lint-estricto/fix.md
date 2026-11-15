---
id: fix-252-b-ci-en-pull-requests-y-lint-estricto
type: fix
status: in_progress
author: b
created: 2026-11-15
spec: —
---

# Fix: el gate de calidad corre en cada pull request y los ratchets de lint:arch fallan de verdad

## Síntoma

- Tests, `lint:arch` y build solo corren al apretar "Publicar en producción". Un pull request
  que rompe algo se mergea sin aviso y se descubre recién al publicar.
- `lint:arch` reporta una regresión de ratchet (ARCH-19 en `payment.component.html`, 6 casos
  contra cuota de 5) y termina con exit 0.
- De las 15 micro-suites de `scripts/lib/*.test.mjs`, el pipeline corre 2. Los tests Deno de
  `supabase/functions` y `scripts/test-tz.mjs` no corren en ningún paso automático.

## Causa raíz

El gate de calidad está definido dentro del workflow de deploy y en ningún otro lugar, así que
solo existe en el momento de publicar. Además, las regresiones de los ratchets (ARCH-15/16/17/19/
25/26) y las clases muertas (ARCH-11) son advertencia salvo con `--strict`, y nadie corre
`--strict`: ni el deploy ni los devs. Un ratchet que solo advierte no frena nada.

## Cambio

- **`.github/workflows/ci.yml` (nuevo):** corre en cada pull request hacia `main`.
  - Job `calidad`: `lint:arch:strict`, micro-suites de los guardrails, `test:ci`, tests de fechas
    en 3 zonas horarias, build de producción.
  - Job `edge-functions`: `deno test` sobre `supabase/functions`.
- **`package.json`:** scripts `lint:arch:strict` y `test:scripts`.
- **`scripts/run-lib-tests.mjs` (nuevo):** corre todas las micro-suites `scripts/lib/*.test.mjs`
  y falla si alguna falla. Se descubren solas: una suite nueva entra sin tocar el workflow.
- **7 archivos de `src/app`:** se corrigen los 7 casos que hoy fallan en modo estricto (6 clases
  de token muertas, que no generan CSS, y 1 cluster tipográfico a mano), para que el modo
  estricto arranque en cero.
- **`.github/dependabot.yml` (nuevo):** actualizaciones mensuales de las GitHub Actions.
- **Docs:** `docs/DEPLOY.md` y `.claude/CLAUDE.md` (comandos).

No se toca `deploy-app-production.yml`: el gate del deploy queda como red de respaldo, igual que
hoy.

## Fuera de alcance

- ESLint (`ng lint` sigue documentado y sin existir): requiere medir el backlog primero.
- Ratchet para ARCH-09/ARCH-10 (184 advertencias de complejidad): vive en `scripts/architect.js`,
  que es un archivo protegido.
- Proteger la rama `main` exigiendo el check: es un ajuste del repositorio en GitHub.
- Playwright en CI: la única base de datos es producción.

## Acceptance Criteria

- [ ] AC1: un pull request hacia `main` dispara el workflow `CI` con los jobs `calidad` y
      `edge-functions`. **Pendiente:** solo se comprueba con el primer PR real en GitHub. En
      local cada paso del workflow corrió con exit 0 (2026-11-15).
- [x] AC2: `npm run lint:arch:strict` termina en 0 sobre el árbol actual y en 1 si un archivo
      supera su cuota de ratchet (probado inyectando un cluster tipográfico: estricto exit 1, no
      estricto exit 0; archivo restaurado).
- [x] AC3: `npm run test:scripts` corre las 15 micro-suites y falla si una falla (probado con
      una suite temporal que salía con 1).
- [x] AC4: `npm run test:ci` en verde: 340 archivos, 5.162 tests.
- [ ] AC5: los 7 cambios de clase no alteran la intención visual. **Pendiente:** no se verificó
      en el navegador (`/verify`). Detalle:
  - `border-default` → `border-border-default` y `border-success-muted` →
    `border-success-border`: sin cambio visible (el color ya salía por defecto o por
    `[style.border-color]`).
  - `text-state-error` → `text-error` (2 archivos): el mensaje de error pasa a verse rojo, como
    sus hermanos del mismo formulario.
  - `bg-surface-elevated` y `bg-surface-hover`: se quitaron (no generaban CSS; se conserva el
    aspecto actual).
  - `payment.component.html`: 5 labels escritos a mano → `.micro-label` (semibold y tracking
    0.06em en vez de bold y tracking-widest).

## Verificación (2026-11-15, local)

- `npm run lint:arch:strict`: exit 0 (0 errores, 184 advertencias de complejidad ARCH-09/10).
- `npm run test:scripts`: 15 micro-suites en verde.
- `npm run test:ci`: 340 archivos, 5.162 tests en verde.
- `node scripts/test-tz.mjs`: 106 tests en verde en UTC, Asia/Tokyo y America/Santiago.
- `npx ng build --configuration production`: exit 0 (aviso de budget: bundle inicial 1,23 MB
  sobre el límite de advertencia de 1 MB).
- Deno: 289 tests en verde, excluyendo el test que necesita Postgres local.
- Baseline de ratchets consolidado con `--update-ds-baseline` (ningún total sube).

## Test de Regresión

- `npm run lint:arch:strict` → exit 0.
- `npm run test:scripts` → 15 suites en verde.
- `npm run test:ci` → verde.
