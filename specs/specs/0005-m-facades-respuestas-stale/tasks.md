# Tasks 0005 — Ningún Facade descarta respuestas "stale" ante cambios rápidos de filtro/sede

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md)
> **Status:** done
> **Created:** 2026-08-05

---

## Cómo usar este archivo

- Cada tarea es **atómica**: una unidad de trabajo que se puede empezar y terminar en un sitting.
- Marcá la tarea como `[x]` apenas pase su DoD (no antes, no en bloque).
- Si descubrís una sub-tarea no listada, agregala al final de su sección antes de hacerla.
- Si una tarea está fuera del scope de la spec → **detenete** y crear spec nueva.

---

## Fase 1 — Utilidad compartida (Functional Core)

- [x] **T1.1** — Escribir `core/utils/request-guard.utils.spec.ts` PRIMERO (TDD)
  - **AC ref:** AC1, AC-E1
  - **DoD:**
    - [x] Test: `next()` devuelve tokens estrictamente incrementales (1, 2, 3…)
    - [x] Test: `isCurrent(token)` es `true` solo para el último token emitido por ese guard
    - [x] Test: `isCurrent(tokenViejo)` es `false` tras emitir un token nuevo
    - [x] Test: dos instancias de `createRequestGuard()` no comparten contador entre sí
    - [x] Tests FALLAN (no hay implementación aún)

- [x] **T1.2** — Implementar `core/utils/request-guard.utils.ts`
  - **AC ref:** AC1, AC3, AC-E1
  - **DoD:**
    - [x] `createRequestGuard()` — función pura, sin `inject()` ni dependencia de Angular
    - [x] Expone `next(): number` e `isCurrent(token: number): boolean`
    - [x] Tests de T1.1 PASAN (`npm run test:ci`)
    - [x] Registrado en `indices/UTILS.md` (Auto-Index vía `npm run indices:sync`, pendiente correr en Fase 6)

---

## Fase 2 — Spike en `AdminAlumnosFacade`

- [x] **T2.1** — Escribir el test de orden-invertido en `admin-alumnos.facade.spec.ts` PRIMERO (TDD)
  - **AC ref:** AC1, AC-E1, AC-E2
  - **DoD:**
    - [x] Test: se dispara `initialize()`/`refreshSilently()` dos veces seguidas con promesas controladas manualmente (no `setTimeout` real); la primera resuelve DESPUÉS que la segunda → `alumnos()` termina reflejando solo el resultado de la segunda llamada
    - [x] Test: 3+ llamadas en sucesión con orden de resolución aleatorio → solo aplica la última disparada (AC-E1)
    - [x] Test: si la fetch vigente (la última disparada) rechaza, `error()` SÍ se setea — el guard no debe tragarse el error real (AC-E2)
    - [x] Tests FALLAN contra el código actual (confirma que el bug es real antes de arreglarlo)

- [x] **T2.2** — Integrar el guard en `admin-alumnos.facade.ts`
  - **AC ref:** AC1, AC2, AC-E1, AC-E2
  - **DoD:**
    - [x] `private readonly alumnosGuard = createRequestGuard();` como estado privado nuevo
    - [x] `fetchAlumnosData()` toma `const requestToken = this.alumnosGuard.next()` al inicio y verifica `isCurrent(requestToken)` antes de `this._alumnos.set(...)`
    - [x] Tests de T2.1 PASAN
    - [x] Caso normal (una sola fetch en vuelo) sin cambios de comportamiento — 21/21 tests de `admin-alumnos.facade.spec.ts` verdes, cero regresiones

- [x] **T2.3** — QA manual del spike
  - **AC ref:** AC1
  - **DoD:**
    - [x] Con Playwright MCP + `ng serve`, cambio de sede en Alumnos admin (Conductores Chillán → Autoescuela Chillán → Todas las sedes)
    - [x] La tabla terminó mostrando los 22 alumnos combinados (8+14) de "Todas las sedes" con columna "Sede" correcta, sin datos residuales de la sede anterior
    - [x] 0 errores nuevos de consola (los 2 preexistentes son de refresh token expirado, no relacionados)
    - [x] Evidencia agregada a `acceptance.md`

---

## Fase 3 — Replicar en el resto de Facades branch-scoped

> Solo arrancar esta fase si T2.2/T2.3 están en verde — no paralelizar el spike con la réplica.

- [x] **T3.1** — Aplicar el mismo patrón (test primero) en `dashboard.facade.ts` / `fetchRealDashboardData()`
  - **AC ref:** AC1, AC2, AC4, AC-E1, AC-E2
  - **DoD:** 16/16 tests verdes, incluyendo el nuevo de race-condition (batching de 8 queries paralelas por invocación)

- [x] **T3.2** — Aplicar el mismo patrón (test primero) en `flota.facade.ts` / `fetchVehiclesData()`
  - **AC ref:** AC1, AC2, AC4, AC-E1, AC-E2
  - **DoD:** 8/8 tests verdes (control de las 2 queries secuenciales: `vehicles` + `expenses`)

- [x] **T3.3** — Aplicar el mismo patrón (test primero) en `dms.facade.ts` / `fetchAllData()`
  - **AC ref:** AC1, AC2, AC4, AC-E1, AC-E2
  - **DoD:** 17/17 tests verdes (batching de 6 queries paralelas por invocación)

- [x] **T3.4** — Verificar `refreshSilently()` post-acción también queda protegido (AC-E3)
  - **AC ref:** AC-E3
  - **DoD:**
    - [x] Test en `admin-alumnos.facade.spec.ts`: `refreshSilently()` (simulando post-acción, ej. `restaurarAlumno()`) racing contra `initialize()` — el guard descarta correctamente la respuesta vieja de `initialize()` cuando `refreshSilently()` resuelve primero

---

## Fase 4 — Documentación

- [x] **T4.1** — Documentar el patrón en `.claude/rules/facades.md`
  - **DoD:**
    - [x] Sección "Guard contra respuestas fuera de orden (requestId)" agregada en §7, con snippet mínimo de integración
    - [x] Redactada como criterio general para cualquier Facade SWR futuro, no ligada a un track específico

---

## Fase 5 — Validación

- [x] **T5.1** — `npm run lint:arch` corre limpio (exit 0; solo warnings ARCH-10 preexistentes en métodos ya largos antes del cambio)
- [x] **T5.2** — `npm run test:ci` corre verde — 1739/1739 tests, 3 skipped (baseline), 0 fallos
- [x] **T5.3** — QA manual de los 3 Facades restantes (smoke test: Flota, DMS, Dashboard cargan sin errores de consola tras el cambio)
  - **DoD:** Evidencia agregada a `acceptance.md`
- [x] **T5.4** — Ejecutar `/spec-verify`
  - **DoD:** ✅ PASA — 7/7 AC cumplidos con evidencia (gap inicial de AC-E2 cerrado agregando los 3 tests de rechazo faltantes en Dashboard/Flota/Dms)

---

## Fase 6 — Cierre

- [x] **T6.1** — Actualizar `indices/FACADES.md` y `indices/UTILS.md` con lo nuevo (`npm run indices:sync`)
- [x] **T6.2** — Marcar spec como `done` en `specs/ROADMAP.md`
- [x] **T6.3** — Limpiar `specs/.active` (`/spec-activate --clear`)

---

## Tareas descubiertas durante implementación

> Si surge algo que no estaba planeado pero ES parte del scope de la spec, agregalo acá.
> Si está fuera de scope, crear spec nueva.

- [ ] …
