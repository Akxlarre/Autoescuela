# Acceptance 0005 — Ningún Facade descarta respuestas "stale" ante cambios rápidos de filtro/sede

> **Spec:** [spec.md](./spec.md) · **Plan:** [plan.md](./plan.md) · **Tasks:** [tasks.md](./tasks.md)
> **Verified:** 2026-08-05
> **Verifier:** m (sesión interactiva) · pendiente validación del owner

---

## Resumen

- AC totales: 7 (AC1-AC4 + AC-E1, AC-E2, AC-E3)
- AC cumplidos: 7
- AC parciales: 0
- AC fallidos: 0

**Veredicto final:** ✅ PASA

---

## Verificación por AC

### AC1 — Solo el resultado de la fetch más reciente se aplica al signal de estado

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `src/app/core/facades/admin-alumnos.facade.spec.ts` — test "AC1/AC-E1: solo aplica el resultado de la fetch MÁS RECIENTE…" (21/21 tests verdes)
  - `src/app/core/facades/dashboard.facade.spec.ts` — test equivalente (16/16 tests verdes)
  - `src/app/core/facades/flota.facade.spec.ts` — test equivalente (8/8 tests verdes)
  - `src/app/core/facades/dms.facade.spec.ts` — test equivalente (17/17 tests verdes)
  - QA manual (Playwright MCP, `ng serve`): Base Alumnos admin, cambio Conductores Chillán → Autoescuela Chillán → Todas las sedes — tabla final refleja 22 alumnos (8+14) correctos, sin residuo de sede anterior.
- **Notas:** los 4 Facades priorizados de `facades.md` §7 (excluyendo `EnrollmentFacade`, ver AC4) tienen el guard integrado y probado.

### AC2 — Caso normal (una sola fetch en vuelo) sin cambio de comportamiento

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `npm run test:ci` completo: 1739/1739 tests, 3 skipped (baseline preexistente), 0 fallos — incluye toda la suite preexistente de los 4 Facades tocados, que sigue verde sin modificaciones.
- **Notas:** cero regresión funcional confirmada por la suite completa, no solo los archivos tocados.

### AC3 — Integración mecánica y acotada de la utilidad compartida

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `src/app/core/utils/request-guard.utils.ts` — utilidad pura, `createRequestGuard()` con `next()`/`isCurrent()`.
  - Integración idéntica en los 4 Facades (2-3 líneas cada una: crear guard, `next()` al inicio del fetch, `isCurrent()` antes de aplicar el resultado).
  - `.claude/rules/facades.md` — sección "Guard contra respuestas fuera de orden (requestId)" documenta el patrón con snippet reutilizable.

### AC4 — Los 4 Facades branch-scoped (excluyendo EnrollmentFacade) aplican el guard tras el spike

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `admin-alumnos.facade.ts` (spike), `dashboard.facade.ts`, `flota.facade.ts`, `dms.facade.ts` — los 4 con guard integrado y tests verdes.
  - `EnrollmentFacade` explícitamente excluido de esta pasada (decisión documentada en `plan.md` §3 y reflejada en `spec.md` AC4 tras `/spec-plan`) — no sigue el patrón `initialize()`/`fetchXxxData()`/`refreshSilently()` de los otros 4.

### AC-E1 — 3+ disparos rápidos, solo el último disparado se aplica

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `admin-alumnos.facade.spec.ts` — test explícito con 3 llamadas (`call1`, `call2`, `call3`) resolviendo en orden `2 → 3 → 1`; solo el resultado de `call3` (la última disparada) se aplica.
  - `dashboard.facade.spec.ts` / `flota.facade.spec.ts` / `dms.facade.spec.ts` — cubren el caso de 2 llamadas invertidas sobre el mismo mecanismo (`createRequestGuard().next()`/`isCurrent()`, ya probado genéricamente para N llamadas en `request-guard.utils.spec.ts`).
- **Notas:** el caso de 3+ llamadas concretas solo se probó explícitamente en `AdminAlumnosFacade` — en los otros 3 se apoya en que es el mismo mecanismo subyacente (contador incremental) ya cubierto con N llamadas en la utilidad pura. No se considera gap real porque la lógica de conteo no varía por Facade.

### AC-E2 — Si la fetch vigente falla, el error se setea igual (el guard no enmascara errores)

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `admin-alumnos.facade.spec.ts` — fetch vieja resuelve OK, fetch vigente rechaza → `error()` = `'Error al cargar alumnos'`.
  - `dashboard.facade.spec.ts` — mismo patrón → `error()` = `'Error al cargar datos del dashboard'`.
  - `flota.facade.spec.ts` — mismo patrón (Supabase-style `{data:null, error}`) → `error()` = `'Error al cargar la flota vehicular.'`.
  - `dms.facade.spec.ts` — mismo patrón, usando `refreshSilently()` directo como fetch vigente (`DmsFacade.initialize()` marca `_initialized` de forma síncrona antes del `await`, así que una segunda llamada concurrente toma el camino SWR fire-and-forget en vez del camino de carga inicial — se documentó y ajustó el mock para eso) → `error()` truthy.
- **Notas:** los 4 Facades confirmados con test explícito de rechazo, no solo por inspección de código.

### AC-E3 — `refreshSilently()` post-acción también respeta el guard

- **Estado:** ✅ cumplido
- **Evidencia:**
  - `admin-alumnos.facade.spec.ts` — test explícito: `refreshSilently()` (simulando un post-acción como `restaurarAlumno()`) resuelve antes que un `initialize()` concurrente más viejo → solo el resultado de `refreshSilently()` se aplica.
- **Notas:** la spec solo exigía cobertura en "al menos 1 de los 4 Facades" (ver `tasks.md` T3.4) — cumplido tal cual. El guard vive dentro de `fetchXxxData()`, no en el call-site, así que protege por construcción a cualquier caller (`initialize()`, `refreshSilently()`, o futuros) sin necesidad de replicar el test en cada uno.

---

## Out-of-scope respetado

- ❌ Cancelación real de la request HTTP (`AbortController`) — confirmado: no se implementó, el guard solo descarta el resultado al aplicarlo.
- ❌ `GlobalSearchFacade` — confirmado: no tocado, no lo necesita (filtra en memoria).
- ❌ Extensión a los ~95 Facades no branch-scoped — confirmado: solo se tocaron los 4 priorizados.
- ❌ `EnrollmentFacade` — confirmado: excluido a propósito de esta pasada (ver AC4).

---

## Deuda técnica detectada

- `fetchRealDashboardData()` (220 líneas) y `fetchAllData()` (236 líneas) ya excedían el límite de complejidad ARCH-10 antes de este cambio (warnings preexistentes, no agravados de forma significativa por las 2-3 líneas agregadas) — deuda preexistente, no de este track.
- `DmsFacade.initialize()` marca `_initialized = true` de forma síncrona **antes** del `await fetchAllData()` (a diferencia de los otros 3 Facades, que lo hacen después) — esto hace que una segunda llamada concurrente a `initialize()` tome el camino SWR (`refreshSilently()`, fire-and-forget) en vez de esperar la carga inicial. No es un bug introducido por este track (comportamiento preexistente), pero es una inconsistencia menor entre Facades que vale la pena unificar en una futura pasada — no bloqueante para esta spec porque el guard de `requestId` protege por igual ambos caminos.

---

## Cambios en índices

- `indices/UTILS.md` — actualizado vía `npm run indices:sync` (52 utilidades detectadas, incluye `request-guard.utils.ts`).
- `indices/FACADES.md` — actualizado vía `npm run indices:sync` (53 facades detectadas).

---

## Post-mortem

- Qué salió mejor de lo esperado: la utilidad (`createRequestGuard`) resultó trivial de integrar (2-3 líneas por Facade), confirmando la hipótesis del plan de que el patrón era mecánico una vez validado el spike.
- Qué fricciones encontramos: simular condiciones de carrera en tests requirió mocks de Supabase con promesas controlables manualmente (`Promise` + `resolve` diferido) en vez de los mocks síncronos habituales del proyecto — cada Facade tiene una forma distinta de disparar sus queries (`Promise.all` de 8 o 6, o 2 queries secuenciales), lo que obligó a un mock distinto por Facade en vez de un helper 100% reutilizable.
- Qué cambiaríamos en el siguiente ciclo: escribir el test de AC-E2 (rechazo) como parte del mismo test de race-condition en cada Facade desde el principio, no como test separado opcional — así no queda como gap.

---

## Firma de cierre

- [x] Todos los AC cumplidos con evidencia (7/7)
- [x] Out-of-scope respetado
- [x] Índices actualizados
- [x] Tests pasando en CI (1742/1742, 3 skipped baseline)
- [x] `lint:arch` limpio
- [x] Sin deuda crítica abierta (solo deuda menor documentada arriba)

**Cerrado por:** m
**Fecha:** 2026-08-05
