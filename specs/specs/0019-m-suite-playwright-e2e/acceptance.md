# Acceptance 0019-m — Suite Playwright E2E automatizada (base de la tanda de testing)

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-09-30
> **Verifier:** Claude Code · validado por Matías

---

## Resumen

- AC totales: 15 (12 + 3 casos borde)
- AC cumplidos: 15
- AC fallidos: 0
- AC con evidencia: 15

**Veredicto final:** ✅ PASA

> Evidencia de ejecución de la sesión 2026-09-30 (cambios aún sin commit al momento de verificar):
> `npm run test:e2e` → **13/13 en verde, exit 0** (16.9 s) contra la BD de desarrollo, con los 4 roles.

---

## Verificación por AC

### AC1 — Comando y reporte

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `package.json` → `test:e2e` = `playwright test`; `playwright.config.ts` → reporter `html` + `list`, `webServer` con `ng serve`.
  - Corrida completa: 13 passed, **exit 0**. Corridas con fallas (setup sin cuenta multi-sede, pruebas de AC3 y AC8): **exit 1**.
  - Reporte generado en `playwright-report/` (gitignored).

### AC2 — Modo depuración

- **Estado:** ✅ cumplido
- **Evidencia:** `package.json` → `test:e2e:ui` = `playwright test --ui` (comando estándar de Playwright 1.63; lista los mismos 13 tests que `--list`).
- **Notas:** no se abrió la ventana del modo UI en la sesión (es interactiva); el comando es el oficial y la config es la misma que usa `test:e2e`.

### AC3 — Nunca contra otra BD

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `e2e/support/env-guard.ts` (`assertDevSupabase`) + `e2e/global-setup.ts` (lee `src/environments/environment.ts`, el que usa la app).
  - Unit: `e2e/support/env-guard.spec.ts` — 5 casos (ref de dev pasa, otro ref, dominio con el ref como prefijo, URL malformada, lista vacía).
  - Prueba real: allowlist cambiada temporalmente a `proyectofalso123` → `Error: [e2e] La app apunta a https://skvekggejikzxhzsjmkz.supabase.co, que no es la BD de desarrollo (permitidos: proyectofalso123.supabase.co). La suite no se ejecuta.`, sin ejecutar ningún test, exit 1. Revertido.

### AC4 — Sesiones por rol

- **Estado:** ✅ cumplido
- **Evidencia:** `e2e/auth.setup.ts` genera `e2e/.auth/<rol>.json` para los 4 roles; `e2e/infra.spec.ts` → "AC4: <rol> entra con la sesión iniciada, sin pasar por /login" × 4, en verde.

### AC5 — Sesiones aisladas

- **Estado:** ✅ cumplido
- **Evidencia:** `e2e/infra.spec.ts` → "AC5: admin y secretaria A en paralelo no se pisan la sesión": ambos navegan y recargan en paralelo y cada uno sigue en su dashboard. `pageAs()` crea un `BrowserContext` propio por rol (`e2e/support/fixtures.ts`).

### AC6 — Secretaria multi-sede

- **Estado:** ✅ cumplido
- **Evidencia:**
  - Cuenta `secretaria.multisede@test.com` creada por el owner desde Admin → Secretarias (sede 1, "Todas las sedes").
  - `e2e/infra.spec.ts` → "AC6: el selector de sede aparece para la secretaria multi-sede y no para la de sede A", en verde (selector `data-llm-description="Branch filter…"` de la topbar).

### AC7 — Test de humo

- **Estado:** ✅ cumplido
- **Evidencia:** `e2e/smoke.spec.ts` — admin → `/app/admin/dashboard` → `watchErrors().expectClean()`, en verde. Solo selectores por rol ARIA (`getByRole('main')`). Primera corrida: **0 errores** de consola/red.

### AC8 — Lista de tolerados

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `e2e/support/known-errors.ts` (`KNOWN_ERRORS` vacío, `validateKnownErrors`, `isKnownError`), validado en `global-setup.ts`.
  - Unit: `e2e/support/known-errors.spec.ts` — 6 casos.
  - Prueba real: entrada `{ pattern: /prueba-ac8/, reason: '' }` → `Error: [e2e] El error tolerado /prueba-ac8/ no tiene justificación (e2e/support/known-errors.ts). La suite no se ejecuta.`, exit 1. Revertido.

### AC9 — Limpieza de datos

- **Estado:** ✅ cumplido
- **Evidencia:** `e2e/infra.spec.ts` → "AC9: una tarea E2E- creada por el test se borra al terminar" + `afterAll` que verifica que ya no existe. Query posterior a la BD: **0 tareas `E2E-`**. El helper detecta también borrados de 0 filas por RLS (`fixtures.ts`, `.select('id')` tras el `delete`).

### AC10 — Sin reset

- **Estado:** ✅ cumplido
- **Evidencia:** búsqueda en `e2e/` de `reset|truncate|0008-i|delete().neq/gt/...`: solo aparece la mención en un comentario de `accounts.ts`. El único `.delete(` es el de `cleanup` (`fixtures.ts:83`), por `id`.

### AC11 — Cuentas centralizadas

- **Estado:** ✅ cumplido
- **Evidencia:** búsqueda de `Test123456|@test.com` en `e2e/`: solo en `e2e/support/accounts.ts`. La suite corre sin ningún paso de configuración (ningún `.env`).

### AC12 — Documentación

- **Estado:** ✅ cumplido
- **Evidencia:** `docs/E2E-PLAYWRIGHT.md` — requisitos, comandos, verificación previa, las 3 reglas con ejemplo cada una, cómo escribir un test (plantilla), errores tolerados, cuentas y pasos para crear la secretaria multi-sede, consulta para encontrar datos `E2E-` sobrantes.

### AC-E1 — Servidor ya corriendo

- **Estado:** ✅ cumplido
- **Evidencia:** `webServer.reuseExistingServer: true`. Todas las corridas de la sesión se hicieron con el `ng serve` del owner ya levantado en :4200 y lo reutilizaron sin error de puerto.

### AC-E2 — Credencial inválida

- **Estado:** ✅ cumplido
- **Evidencia:** primera corrida (cuenta multi-sede aún inexistente): `Error: No se pudo iniciar sesión como secretariaMultisede (secretaria.multisede@test.com): Correo o contraseña incorrectos.` — nombra el rol, no es un timeout genérico. `auth.setup.ts` distingue además el caso de primer login pendiente.
- **Notas:** la prueba adicional con contraseña falsa temporal la bloqueó el Architect Guard (detector de credenciales hardcodeadas). Es el mismo camino de código (mensaje de error de la tarjeta de login), así que no se forzó.

### AC-E3 — Test caído a mitad

- **Estado:** ✅ cumplido
- **Evidencia:** `e2e/infra.spec.ts` → "AC-E3: la tarea se borra aunque el test falle" (`test.fail()`, falla a propósito tras crear la tarea); el `afterAll` confirma que se borró; query posterior: 0 tareas `E2E-`.

---

## Out-of-scope respetado

- ❌ Tests de cada módulo — confirmado: no entró (solo humo + tests de infraestructura).
- ❌ Integración en CI — confirmado: no entró (solo `forbidOnly` condicionado a `CI`, config estándar).
- ❌ Pagos reales por Webpay — confirmado: no entró.
- ❌ Proyecto Supabase separado para E2E — confirmado: no entró.

---

## Desviaciones del plan (documentadas)

- **Chrome del sistema en vez de Chromium descargado** (`channel: 'chrome'`): `npx playwright install chromium` falló por timeout 2 veces. Ahorra además un paso de setup al equipo. Requisito nuevo en la doc: tener Google Chrome.
- **`environment.ts` en vez de `environment.development.ts`**: el segundo está en `.gitignore` y `angular.json` no tiene `fileReplacements`; la app siempre usa `environment.ts`.
- **`errorWatch` implementado como función `watchErrors(page)`** en vez de fixture: se engancha a la página que el test elige, incluida una de `pageAs()`.

---

## Deuda técnica detectada

- Comentario desactualizado en `supabase/functions/create-secretary/index.ts:20` ("sin password → recibirá email de invite"): el código crea la cuenta con contraseña inicial = RUT sin DV y no envía correo. → hotfix de documentación.
- El `ng serve` de desarrollo dejó de detectar cambios de archivos durante la sesión (hubo que reiniciarlo). No es de esta spec; se anota por si se repite.

---

## Cambios en índices

- Ninguno de los índices de `indices/` cubre tooling de testing (componentes, facades, servicios, modelos, BD). La suite queda documentada en `docs/E2E-PLAYWRIGHT.md`.

---

## Post-mortem

- Qué salió mejor de lo esperado: el dashboard de admin no tenía ningún error de consola/red; `KNOWN_ERRORS` arranca vacío.
- Qué fricciones encontramos: la descarga de Chromium; el watcher de `ng serve`; el Architect Guard bloquea contraseñas literales de prueba (útil en general, pero impidió una verificación negativa).
- Qué cambiaríamos: revisar antes qué archivo de `environment` usa realmente la app.

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia
- [x] Out-of-scope respetado
- [x] Índices actualizados (ninguno aplica)
- [x] Tests pasando (`test:ci` 2785/2785 + `test:e2e` 13/13)
- [x] `lint:arch` limpio (exit 0)
- [x] Sin deuda crítica abierta

**Cerrado por:** Matías
**Fecha:** 2026-09-30
