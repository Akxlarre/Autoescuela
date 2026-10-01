# Plan 0019-m — Suite Playwright E2E automatizada (base de la tanda de testing)

> **Spec:** [spec.md](./spec.md)
> **Status:** approved
> **Created:** 2026-09-30
> **Talla:** M (confirmada por el owner 2026-09-30) · estimado 1-2 días

---

## 1. Resumen ejecutivo

Se instala Playwright Test en una carpeta `e2e/` en la raíz, separada de `src/` y del runner de
Vitest. La suite tiene 3 capas: (1) un **global setup** que verifica que la app apunte a la BD
de desarrollo y valida la lista de errores tolerados; (2) un **proyecto `setup`** que inicia
sesión con los 4 roles por la UI de login y guarda cada sesión (`storageState`); (3) **fixtures**
que entregan páginas ya logueadas por rol, un vigilante de consola/red y un helper de limpieza
de datos `E2E-`. Sobre eso van el test de humo, los tests que demuestran las fixtures y la
página de docs. No se toca código de producto de `src/app/`.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `playwright.config.ts` | Config | `testDir: 'e2e'`, proyectos `setup` + `chromium` (depende de `setup`), `webServer` (`ng serve`, `reuseExistingServer: true`), reporter HTML, `globalSetup`. AC1, AC-E1 |
| `e2e/tsconfig.json` | Config | Tipos de `@playwright/test` y Node solo para `e2e/`, sin mezclarse con `tsconfig.app.json` |
| `e2e/support/accounts.ts` | Datos | **Fuente única** de las 4 cuentas (`admin`, `secretariaA`, `secretariaB`, `secretariaMultisede`): email, contraseña, ruta esperada tras el login. Tipo `E2eRole`. AC11 |
| `e2e/support/env-guard.ts` | Función pura | `assertDevSupabase(url, allowedRefs)`: lanza un error con la URL detectada si el ref del proyecto no está permitido. AC3 |
| `e2e/support/env-guard.spec.ts` | Test Vitest | Casos: ref de dev pasa · otro ref lanza error · URL malformada lanza error |
| `e2e/support/known-errors.ts` | Datos + función pura | Lista `KNOWN_ERRORS: { pattern: RegExp; reason: string }[]` (parte vacía) + `validateKnownErrors()` (lanza error si una entrada no tiene `reason`) + `isKnownError(text)`. AC8 |
| `e2e/support/known-errors.spec.ts` | Test Vitest | Casos: entrada sin razón lanza error · razón vacía/espacios lanza error · `isKnownError` coincide o no |
| `e2e/support/supabase-admin.ts` | Helper Node | Cliente `supabase-js` en Node (URL y anon key de `environment.ts`) logueado como **admin** con su contraseña. Solo lo usan la limpieza y la demo. La RLS se aplica igual (no usa clave de servicio) |
| `e2e/global-setup.ts` | Setup | Importa `src/environments/environment.ts` → `assertDevSupabase()`; ejecuta `validateKnownErrors()`. Si algo falla, no corre ningún test. AC3, AC8 |
| `e2e/auth.setup.ts` | Proyecto `setup` | Por cada rol: `/login` → llena `[data-llm-description="User email address for authentication"]` / password → click `[data-llm-action="submit-auth-form"]` → espera la ruta del rol **o** el mensaje de error; si aparece el error, falla con `No se pudo iniciar sesión como <rol>`. Guarda `e2e/.auth/<rol>.json`. AC4, AC-E2 |
| `e2e/support/fixtures.ts` | Fixtures | `test` extendido con: `pageAs(role)` (nuevo `BrowserContext` con el `storageState` del rol, cerrado al final), `errorWatch` (junta `console.error`, `pageerror` y respuestas ≥400; `expectClean()` ignora solo `KNOWN_ERRORS`), `cleanup` (`track(table, id)`; en el teardown borra todo lo registrado, **pase o falle el test**). AC4, AC5, AC7, AC9, AC-E3 |
| `e2e/smoke.spec.ts` | Test E2E | Admin → `/app/admin/dashboard` → espera carga → `errorWatch.expectClean()`. Selectores `data-llm-*`/ARIA. **Plantilla** para la tanda. AC7 |
| `e2e/infra.spec.ts` | Test E2E | Demuestra la infraestructura: sesión por rol (AC4), admin y secretaria A en paralelo sin pisarse (AC5), selector de sede visible para multi-sede y oculto para secretaria A (AC6), limpieza de una tarea `E2E-` también cuando el test falla (AC9, AC-E3, con `test.fail()` controlado) |
| `docs/E2E-PLAYWRIGHT.md` | Doc | Instalación (`npx playwright install chromium`), cómo correr (`test:e2e`, `test:e2e:ui`), cómo se creó la secretaria multi-sede, las 3 reglas de convivencia con un ejemplo cada una, cómo agregar un error tolerado y cómo escribir un test nuevo copiando `smoke.spec.ts`. AC12 |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `package.json` | devDependency `@playwright/test`; scripts `test:e2e` (`playwright test`) y `test:e2e:ui` (`playwright test --ui`) | AC1, AC2 |
| `.gitignore` | `e2e/.auth/`, `playwright-report/`, `test-results/` | Las sesiones guardadas contienen tokens; los reportes son artefactos locales |
| `vitest.config.ts` | `include` suma `'e2e/support/**/*.spec.ts'` | Que los tests puros de `e2e/support/` corran con `npm run test:ci`. Los `e2e/*.spec.ts` de Playwright quedan fuera (no están en `support/`) |

### Archivos a ELIMINAR

Ninguno.

### Tarea manual (no es código)

- **Crear la secretaria multi-sede en la BD de desarrollo** desde la UI de admin: Secretarias →
  Crear (drawer `admin-secretarias-crear-drawer`) → email `secretaria.multisede@test.com`,
  contraseña `Test123456`, sede A, con el permiso "acceso a ambas sedes"
  (`users.can_access_both_branches`). Los pasos quedan en `docs/E2E-PLAYWRIGHT.md`. AC6

---

## 3. Reutilización (Discovery)

### Lo que ya existe y se aprovecha
- **Atributos `data-llm-*` del login** (`login-card.component.ts`): `data-llm-description` en
  email/password y `data-llm-action="submit-auth-form"` → selectores estables sin tocar `src/`.
- **Selector de sede de la topbar** (`topbar.component.ts:291`, `canSeeBranchSelector`): visible
  solo para admin y secretaria con grant; tiene
  `data-llm-description="Branch filter for admin — …"` → sirve para verificar AC6.
- **Sesión Supabase en `localStorage`** (`supabase.service.ts`, `persistSession: true`) →
  `storageState` de Playwright la captura y la restaura tal cual.
- **`environment.ts`** → fuente de la URL/anon key para la verificación de BD y
  para el cliente Node. No se duplica la URL en `e2e/`.
- **Cuentas del seed `0008-i`** (`admin@`, `secretaria@`, `secretaria2@` · `Test123456`).
- **Checks de `/verify`** (consola limpia, red sin 4xx) → mismo criterio en `errorWatch`.
- **Rutas** (`indices/ROUTES.md`): `/login`, `/app/admin/dashboard`, `/app/secretaria/dashboard`.

### Lo que no existe y hay que crear
- Todo `e2e/`: el repo no tiene Playwright Test ni ninguna suite E2E. No hay facades, componentes
  ni servicios de producto nuevos: la suite vive fuera de `src/app/`.

### Demo de limpieza (decisión abierta de la spec §9, resuelta aquí)
- Entidad: **`tasks`**. Motivo: el admin tiene `DELETE` por RLS (`tasks_delete`: admin +
  `branch_visible`), y ningún trigger dispara efectos al insertar (los triggers de notificación
  son de `task_replies` y del cambio de `status`).
- Se crea **por API** (`supabase-admin.ts`), no por UI: `TasksFacade.createTask()` crea una
  notificación real al destinatario (lado cliente), que quedaría en la bandeja de la secretaria de
  prueba que usa el equipo. La tarea va de admin → secretaria A, `subject: 'E2E-…'`.

---

## 4. Modelo de datos

N/A. Sin migraciones, sin tablas, sin cambios de RLS. El único dato nuevo (la secretaria
multi-sede) se crea por UI (tarea manual, arriba).

---

## 5. Arquitectura del feature

### Diagrama de flujo

```
npm run test:e2e
  └─ playwright.config.ts
       ├─ webServer: ng serve (o reutiliza :4200)          ← AC-E1
       ├─ globalSetup: e2e/global-setup.ts
       │     ├─ assertDevSupabase(environment) ← AC3 (aborta todo)
       │     └─ validateKnownErrors()                     ← AC8 (aborta todo)
       ├─ proyecto "setup": e2e/auth.setup.ts
       │     └─ 4 × login por UI → e2e/.auth/<rol>.json   ← AC4, AC-E2
       └─ proyecto "chromium" (dependencies: ["setup"])
             ├─ smoke.spec.ts  ─┐
             └─ infra.spec.ts  ─┤ usan e2e/support/fixtures.ts
                                ├─ pageAs(rol)  → BrowserContext propio   ← AC4, AC5
                                ├─ errorWatch   → consola/red − KNOWN_ERRORS ← AC7
                                └─ cleanup      → supabase-admin.ts borra lo registrado ← AC9, AC-E3
       └─ reporte HTML → playwright-report/                ← AC1
```

### Capas tocadas

- **Producto (`src/app/`)**: ninguna.
- **Config de repo**: `package.json`, `.gitignore`, `vitest.config.ts`.
- **Suite nueva**: `playwright.config.ts` + `e2e/`.
- **Docs**: `docs/E2E-PLAYWRIGHT.md`.

---

## 6. Restricciones aplicables (referencia al sistema Koa)

- [ ] `architecture.md` — no se toca código de producto
- [ ] `facades.md`
- [ ] `models.md`
- [ ] `visual-system.md`
- [ ] `swr-pattern.md`
- [ ] `notifications.md` — solo como motivo para no crear la tarea demo por UI
- [x] `testing-tdd.md` — funciones puras de `e2e/support/` con `.spec.ts` Vitest primero (TDD)
- [x] `ai-readability.md` — los selectores de la suite usan `data-llm-*` / ARIA, no clases CSS
- [x] **Bash Guard** — los `.ts` se crean con Write/Edit, no por shell

---

## 7. Plan de testing

- **Unitarios (Vitest, `npm run test:ci`)**: `env-guard.spec.ts`, `known-errors.spec.ts`.
  Se escriben antes de la implementación.
- **E2E (la suite misma, `npm run test:e2e`)**: `smoke.spec.ts` + `infra.spec.ts` cubren AC4-AC7,
  AC9 y AC-E3.
- **Verificación manual de los AC negativos** (se documenta la evidencia en `acceptance.md`):
  - AC3: apuntar temporalmente la URL a un ref falso → la suite aborta sin correr tests.
  - AC8: agregar una entrada sin `reason` → la suite aborta.
  - AC-E1: con `ng serve` ya corriendo, `test:e2e` lo reutiliza.
  - AC-E2: cambiar temporalmente la contraseña de un rol en `accounts.ts` → el mensaje nombra el
    rol.
  - AC1: exit code 0 en verde y ≠0 con un test roto a propósito.
  - AC10/AC11: grep en `e2e/` (sin reset de `0008-i`, sin credenciales fuera de `accounts.ts`).

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| El dashboard de admin ya tiene errores de consola/red previos → el humo queda rojo desde el primer día | Media | Justamente para eso existe `KNOWN_ERRORS`: se corre una vez, se revisa cada error y solo se tolera lo justificado (lo demás se reporta como bug, no se esconde) |
| Rotación de refresh token: si dos contextos restauran la misma sesión y uno refresca, el otro queda con un token revocado | Media | Cada rol tiene su propia sesión (AC5 usa roles distintos). La sesión se regenera en cada corrida (el proyecto `setup` corre siempre). Los tests del mismo rol en paralelo se revisan si aparece el síntoma |
| El login por UI es lento (animación GSAP del hero) o inestable | Baja | Esperar la ruta de destino o el mensaje de error, no tiempos fijos. Son solo 4 logins por corrida |
| Un test que se corta de golpe (Ctrl+C, crash del proceso) no alcanza a limpiar | Baja | El prefijo `E2E-` permite barrer a mano; la doc incluye la consulta para encontrar lo que quedó |
| La limpieza por API falla por RLS (ej. la sede de la tarea no es visible para admin) | Baja | La demo usa admin → secretaria A (admin ve todas las sedes). Si la limpieza falla, el teardown lo reporta como error del test, no lo traga |
| `ng serve` tarda en compilar en frío y el `webServer` agota el tiempo | Media | `timeout` del `webServer` en 180 s; `reuseExistingServer` para el uso diario |
| La tarea demo aparece unos segundos en la bandeja de la secretaria A mientras corre el test | Baja | Aceptado: dura lo que dura el test y el prefijo `E2E-` la identifica |

---

## 9. Orden de implementación

1. `npm i -D @playwright/test` + `npx playwright install chromium`; scripts en `package.json`;
   `.gitignore`.
2. TDD: `env-guard.spec.ts` + `known-errors.spec.ts` (rojos) → `env-guard.ts` + `known-errors.ts`
   (verdes); `vitest.config.ts` incluye `e2e/support/`.
3. `accounts.ts`, `supabase-admin.ts`, `global-setup.ts`, `playwright.config.ts`, `e2e/tsconfig.json`.
4. **Tarea manual**: crear la secretaria multi-sede por UI.
5. `auth.setup.ts` → confirmar que se generan las 4 sesiones.
6. `fixtures.ts` (`pageAs`, `errorWatch`, `cleanup`).
7. `smoke.spec.ts` → primera corrida → revisar errores reales y armar `KNOWN_ERRORS` con
   justificación.
8. `infra.spec.ts` (AC4, AC5, AC6, AC9, AC-E3).
9. Verificación de los AC negativos (§7).
10. `docs/E2E-PLAYWRIGHT.md`.
11. `npm run test:ci` + `npm run lint:arch` + `npm run test:e2e` en verde → `/spec-verify`.

---

## 10. Estimación

Talla M · 1-2 días. La incertidumbre principal es el paso 7 (cuántos errores preexistentes
aparecen en el dashboard).

---

## Changelog

- 2026-09-30 — plan inicial. Demo de limpieza resuelta: `tasks` creada por API (spec §9).
- 2026-09-30 — aprobado por Matías (owner).
- 2026-09-30 — durante T3.1: la fuente de URL/anon key es `src/environments/environment.ts`, no
  `environment.development.ts`. Este último está en `.gitignore` (no lo tienen los demás devs) y
  `angular.json` no tiene `fileReplacements`, así que la app siempre usa `environment.ts`.
  También (T1.1): se usa el Chrome del sistema (`channel: 'chrome'`) en vez de descargar Chromium.
