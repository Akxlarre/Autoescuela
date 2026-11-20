# Fix: Apuntar app, edge functions, landing y tests al proyecto Supabase nuevo
> id: fix-503-m-supabase-proyecto-nuevo
> refs: —
> status: done
> closed: 2026-11-20
> created: 2026-11-20

## Root Cause
La base de datos se traspasó de la cuenta de Supabase vieja (`skvekggejikzxhzsjmkz`, us-west-1) a
una cuenta nueva (`klcwwrwfdqdciffraozq`, sa-east-1). El ref del proyecto estaba escrito a mano en
el código: la configuración del front, 6 edge functions (URL del logo de los PDFs y de la matrícula
pública), dos lugares del front que arman la URL de las imágenes por defecto de la web, la landing
`webs/` y los guards de los tests e2e. Con el ref fijo, cualquier cambio de proyecto deja todo eso
apuntando al proyecto viejo.

## ACs Afectados
Ninguno — fix autónomo.

- **AC-1:** Las 6 edge functions arman la URL del logo desde `SUPABASE_URL` (env del runtime), sin
  ref escrito en el código.
- **AC-2:** El front arma la URL de las imágenes por defecto de la web (`website-public/seeds`)
  desde el cliente de Supabase configurado, sin ref escrito en el código.
- **AC-3:** `environment.ts` y `environment.development.ts` apuntan al proyecto nuevo con su
  publishable key.
- **AC-4:** La landing `webs/` y los guards/scripts de e2e apuntan al proyecto nuevo.
- **AC-5:** Fuera de `audit_log` (historial) y de este fix.md, no queda el ref viejo en el código
  versionado.

## Cambio
- **Archivo:** `supabase/functions/_shared/storage-urls.ts` (nuevo) + las 6 functions que usaban el logo
- **Qué cambia:** `publicStorageUrl(bucket, path)` arma la URL pública desde `SUPABASE_URL`.
- **Archivo:** `src/app/core/facades/website-config.facade.ts`, `general-tab.component.ts`
- **Qué cambia:** la base de `seeds` sale de `storage.getPublicUrl()` expuesta por el Facade.
- **Archivo:** `src/environments/*.ts`, `webs/`, `e2e/support/env-guard*.ts`, `scripts/test-enrollment-flow.ts`
- **Qué cambia:** ref y llave del proyecto nuevo.

## Test de Regresión
- `supabase/functions/_shared/storage-urls.test.ts > arma la URL pública desde SUPABASE_URL` ✓ (3/3, Deno)
- `src/app/core/facades/website-config.facade.spec.ts > fix-503-m: el logo por defecto sale del proyecto configurado` ✓
- `e2e/support/env-guard.spec.ts` con el ref nuevo ✓
- Suite completa: 353 archivos, 5554 tests en verde.

## Progreso
- [x] Helper `storage-urls.ts` + 6 edge functions (Deno 3/3; `deno check` sin errores nuevos)
- [x] Facade + `GeneralTabComponent` (`tsc -p tsconfig.app.json` limpio, `lint:arch` 0 errores)
- [x] `environment*.ts`, `webs/`, e2e y scripts con el ref nuevo
- [x] Specs de Vitest en verde. Dos trabas de entorno en el camino: `node_modules` mezclado con
      paquetes de Deno (se resolvió con `npm ci`) y Vitest corrido desde `d:\` en minúscula, que
      carga su runner dos veces ("failed to find the runner"); desde `D:\` pasa.
