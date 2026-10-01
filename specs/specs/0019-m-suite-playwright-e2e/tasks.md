# Tasks 0019-m — Suite Playwright E2E automatizada (base de la tanda de testing)

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done
> **Created:** 2026-09-30

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marca la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubres una sub-tarea no listada, agrégala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detente** y crea una spec nueva.

> Esta spec no toca `src/app/` ni la BD (plan §4-5), así que las fases estándar de datos,
> Facade y UI no aplican. Las fases siguen el orden del plan §9.

---

## Fase 1 — Instalación

- [x] **T1.1** — Instalar Playwright y registrar scripts
  - **AC ref:** AC1, AC2
  - **DoD:**
    - [x] `@playwright/test` en `devDependencies` de `package.json` (1.63.0)
    - [x] ~~`npx playwright install chromium` ejecutado sin error~~ → la descarga desde
      `cdn.playwright.dev` se corta por timeout; se usa el Google Chrome instalado
      (`channel: 'chrome'` en T3.2). Ver "Tareas descubiertas".
    - [x] Scripts `test:e2e` (`playwright test`) y `test:e2e:ui` (`playwright test --ui`)
    - [x] `.gitignore` incluye `e2e/.auth/`, `playwright-report/`, `test-results/`

---

## Fase 2 — Funciones puras (TDD)

- [x] **T2.1** — Escribir `e2e/support/env-guard.spec.ts` y `e2e/support/known-errors.spec.ts` PRIMERO
  - **AC ref:** AC3, AC8
  - **DoD:**
    - [x] `vitest.config.ts` incluye `'e2e/support/**/*.spec.ts'` (sin incluir `e2e/*.spec.ts`)
    - [x] env-guard: ref de dev pasa · otro ref lanza error con la URL detectada · URL malformada lanza error (+ dominio con el ref como prefijo, + lista vacía)
    - [x] known-errors: entrada sin `reason` lanza error · `reason` vacío/espacios lanza error · `isKnownError` coincide / no coincide
    - [x] Tests FALLAN (no hay implementación aún) — 2 archivos en rojo por import inexistente

- [x] **T2.2** — Implementar `e2e/support/env-guard.ts` y `e2e/support/known-errors.ts`
  - **AC ref:** AC3, AC8
  - **DoD:**
    - [x] `assertDevSupabase(url, allowedRefs)` y `validateKnownErrors()` / `isKnownError()` exportadas
    - [x] `KNOWN_ERRORS` parte vacío
    - [x] Tests de T2.1 PASAN — 11/11 (`npx vitest run e2e/support`)

---

## Fase 3 — Configuración y sesiones

- [x] **T3.1** — `e2e/support/accounts.ts` + `e2e/support/supabase-admin.ts`
  - **AC ref:** AC11, AC9
  - **DoD:**
    - [x] Las 4 cuentas (`admin`, `secretariaA`, `secretariaB`, `secretariaMultisede`) con email, contraseña y ruta esperada, tipo `E2eRole` (sedes confirmadas por query: `secretaria@` = 1, `secretaria2@` = 2)
    - [x] `supabase-admin.ts` toma URL y anon key de `src/environments/environment.ts` (sin duplicarlas) y se loguea como admin desde `accounts.ts`
    - [x] No usa clave de servicio

- [x] **T3.2** — `e2e/global-setup.ts` + `playwright.config.ts` + `e2e/tsconfig.json`
  - **AC ref:** AC1, AC3, AC8, AC-E1
  - **DoD:**
    - [x] `globalSetup` ejecuta `assertDevSupabase()` y `validateKnownErrors()` antes de cualquier test
    - [x] Proyectos `setup` y `chromium` (este último con `dependencies: ['setup']`)
    - [x] `webServer`: `ng serve`, `url: http://localhost:4200`, `reuseExistingServer: true`, `timeout` 180 s
    - [x] Reporter HTML
    - [x] `npx playwright test --list` no da errores de compilación (13 tests en 3 archivos)

- [x] **T3.3** — Tarea manual: crear la secretaria multi-sede en la BD de desarrollo
  - **AC ref:** AC6
  - **DoD:**
    - [x] `secretaria.multisede@test.com` ("Antonia Multi Sede", RUT `19.658.564-8`), sede 1, "Todas las sedes", creada por el owner desde Admin → Secretarias → Crear (2026-09-30)
    - [x] Primer login con la contraseña inicial (RUT sin DV, la pone `create-secretary`) y cambio a `Test123456`
    - [x] El selector de sede aparece con esa cuenta (verificado por AC6 en la suite)
    - [x] Pasos anotados para la doc (T5.1)

- [x] **T3.4** — `e2e/auth.setup.ts`
  - **AC ref:** AC4, AC-E2
  - **DoD:**
    - [x] Login por UI de los 4 roles con selectores `data-llm-*`
    - [x] Espera la ruta del rol, el cambio de contraseña obligatorio **o** el mensaje de error, sin tiempos fijos
    - [x] Si falla, el error dice `No se pudo iniciar sesión como <rol>` — visto en la 1.ª corrida con la cuenta multi-sede inexistente: "…como secretariaMultisede (secretaria.multisede@test.com): Correo o contraseña incorrectos."
    - [x] Se generan los 4 `e2e/.auth/<rol>.json`

---

## Fase 4 — Fixtures y tests

- [x] **T4.1** — `e2e/support/fixtures.ts`
  - **AC ref:** AC4, AC5, AC7, AC9, AC-E3
  - **DoD:**
    - [x] `pageAs(role)`: `BrowserContext` propio con el `storageState` del rol, cerrado al final
    - [x] `errorWatch` (implementado como `watchErrors(page)`): junta `console.error`, `pageerror` y respuestas ≥400; `expectClean()` ignora solo `KNOWN_ERRORS`
    - [x] `cleanup.track(table, id)`: el teardown borra lo registrado pase o falle el test; si el borrado falla **o borra 0 filas** (RLS silenciosa), el test lo reporta como error

- [x] **T4.2** — `e2e/smoke.spec.ts` + armar `KNOWN_ERRORS`
  - **AC ref:** AC7, AC8
  - **DoD:**
    - [x] Admin → `/app/admin/dashboard` → espera carga → `watchErrors().expectClean()`
    - [x] Solo selectores `data-llm-*` / ARIA
    - [x] Primera corrida revisada: **0 errores** de consola/red en el dashboard de admin → `KNOWN_ERRORS` queda vacío
    - [x] Comentario al inicio indicando que es la plantilla para la tanda

- [x] **T4.3** — `e2e/infra.spec.ts`
  - **AC ref:** AC4, AC5, AC6, AC9, AC-E3
  - **DoD:**
    - [x] Cada rol abre su dashboard sin pasar por `/login` (AC4) — 4/4
    - [x] Admin y secretaria A en paralelo siguen viendo cada uno su usuario (AC5)
    - [x] Selector de sede visible para multi-sede y oculto para secretaria A (AC6)
    - [x] Tarea `E2E-…` creada por API y borrada al terminar (AC9)
    - [x] Test que falla a propósito (`test.fail()`) después de crear una tarea `E2E-`, y la tarea igual se borra (AC-E3) — `afterAll` lo verifica; query posterior: 0 tareas `E2E-` en la BD
    - [x] `npm run test:e2e` en verde — 13/13 (16.9 s), exit 0

---

## Fase 5 — Documentación

- [x] **T5.1** — `docs/E2E-PLAYWRIGHT.md`
  - **AC ref:** AC12
  - **DoD:**
    - [x] Instalación (requisito: Google Chrome) y cómo correr (`test:e2e`, `test:e2e:ui`, dónde ver el reporte)
    - [x] Cómo se creó la secretaria multi-sede (pasos de T3.3)
    - [x] Las 3 reglas de convivencia con un ejemplo cada una
    - [x] Cómo agregar un error tolerado y cómo escribir un test nuevo copiando `smoke.spec.ts`
    - [x] Consulta para encontrar datos `E2E-` que hayan quedado

---

## Fase 6 — Validación

- [x] **T6.1** — Verificar los AC negativos y dejar evidencia en `acceptance.md`
  - **AC ref:** AC1, AC3, AC8, AC10, AC11, AC-E1, AC-E2
  - **DoD:**
    - [x] AC3: ref falso temporal → la suite aborta sin correr tests (revertido después)
    - [x] AC8: entrada sin `reason` → la suite aborta (revertido después)
    - [x] AC-E1: con `ng serve` corriendo, `test:e2e` lo reutiliza
    - [x] AC-E2: el mensaje nombra el rol — evidencia de la 1.ª corrida (cuenta multi-sede aún inexistente → "Correo o contraseña incorrectos"). La prueba con contraseña falsa temporal la bloqueó el Architect Guard (detector de credenciales hardcodeadas); mismo camino de código, no se forzó.
    - [x] AC1: exit code 0 en verde (13/13) y 1 cuando falló el setup en la 1.ª corrida y en las pruebas de AC3/AC8
    - [x] AC10/AC11: búsqueda en `e2e/` sin reset de `0008-i` ni credenciales fuera de `accounts.ts`
- [x] **T6.2** — `npm run lint:arch` corre limpio (exit 0)
- [x] **T6.3** — `npm run test:ci` corre verde (210 archivos, 2785 tests; incluye los 11 de `e2e/support`)
- [x] **T6.4** — Ejecutar `/spec-verify` → ✅ PASA 15/15 (`acceptance.md`)
  - **DoD:** AC Verifier devuelve `{ok: true}` o los tickets restantes quedan resueltos

---

## Fase 7 — Cierre

- [x] **T7.1** — Actualizar `indices/` con lo nuevo (`/sync-indices`), si algún índice cubre tooling de testing → ninguno aplica (sin componentes, facades, servicios, modelos ni BD nuevos); la suite queda en `docs/E2E-PLAYWRIGHT.md`
- [x] **T7.2** — Marcar la spec como `done` en `ROADMAP.md`
- [x] **T7.3** — Limpiar `specs/.active` (`/spec-activate --clear`)

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agrégalo acá.
> Si está fuera de scope, crea una spec nueva.

- [x] **TD.1** — Desviación del plan: usar el Chrome del sistema (`channel: 'chrome'`) en vez de
  descargar Chromium. Motivo: `npx playwright install chromium` falla por timeout (2 intentos,
  2026-09-30) y Chrome ya está instalado; además ahorra un paso de setup al equipo. Reflejar en
  `playwright.config.ts` (T3.2) y en la doc (T5.1: requisito "tener Google Chrome").
