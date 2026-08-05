# Plan 0005 — Ningún Facade descarta respuestas "stale" ante cambios rápidos de filtro/sede

> **Spec:** [spec.md](./spec.md)
> **Status:** approved
> **Created:** 2026-08-05
> **Talla:** M

---

## 1. Resumen ejecutivo

Crear una utilidad pura `request-guard.utils.ts` en `core/utils/` que encapsule un contador
de `requestId` incremental, y aplicarla al patrón `fetchXxxData()` ya existente en los
Facades branch-scoped que siguen SWR (`AdminAlumnosFacade`, `DashboardFacade`,
`FlotaFacade`, `DmsFacade`). Orden: spike en `AdminAlumnosFacade` (validar el patrón con su
propio `.spec.ts`) → si funciona sin regresión, replicar mecánicamente en los otros 3.
`EnrollmentFacade` queda **fuera de esta primera pasada** (ver §3, no sigue el patrón
`initialize()`/`fetchXxxData()`/`refreshSilently()` de los otros 4 — es un wizard de un solo
flujo, no una lista que se recarga por cambio de sede).

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `src/app/core/utils/request-guard.utils.ts` | Util (Functional Core) | `createRequestGuard()` — factory con `next()` (incrementa y devuelve el token nuevo) e `isCurrent(token)` (compara contra el último token emitido). Sin estado de Angular, solo un closure con un contador. |
| `src/app/core/utils/request-guard.utils.spec.ts` | Test | Cobertura: token secuencial, `isCurrent` con token viejo vs vigente, múltiples guards independientes no se pisan entre sí. |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/facades/admin-alumnos.facade.ts` | `fetchAlumnosData()` toma un `requestId` de un guard privado (`private readonly alumnosGuard = createRequestGuard()`); antes de `this._alumnos.set(data)` verifica `alumnosGuard.isCurrent(token)` — si no es el vigente, `return` sin tocar signals. `initialize()`/`refreshSilently()` piden el token nuevo antes de llamar a `fetchAlumnosData()`. | Spike — Facade más simple de los branch-scoped (nota de la Asignación) |
| `src/app/core/facades/admin-alumnos.facade.spec.ts` | Test nuevo: 2 fetches disparados con resolución invertida → solo el signal del segundo dispara render | Cobertura AC1/AC-E1 |
| `src/app/core/facades/dashboard.facade.ts` | Mismo patrón en `fetchRealDashboardData()` | AC4 |
| `src/app/core/facades/dashboard.facade.spec.ts` | Test equivalente al de AdminAlumnosFacade | AC1/AC-E1 |
| `src/app/core/facades/flota.facade.ts` | Mismo patrón en `fetchVehiclesData()` (y `fetchCombustibleMesPorVehiculo()` si aplica el mismo guard) | AC4 |
| `src/app/core/facades/flota.facade.spec.ts` | Test equivalente | AC1/AC-E1 |
| `src/app/core/facades/dms.facade.ts` | Mismo patrón en `fetchAllData()` | AC4 |
| `src/app/core/facades/dms.facade.spec.ts` | Test equivalente | AC1/AC-E1 |
| `.claude/rules/facades.md` | Agregar sección corta documentando el patrón de guard de `requestId` como parte del contrato SWR (§7 o nueva sub-sección), para que Facades nuevos lo apliquen sin tener que redescubrirlo | Sincronizar la regla con el código nuevo (obligatorio por flujo del proyecto, paso 5 "Sincronizar") |

### Archivos a ELIMINAR

Ninguno.

---

## 3. Reutilización (Discovery)

### Facades/Services existentes que extendemos
- `AdminAlumnosFacade.fetchAlumnosData()`, `DashboardFacade.fetchRealDashboardData()`,
  `FlotaFacade.fetchVehiclesData()`, `DmsFacade.fetchAllData()` — los 4 ya siguen el mismo
  esqueleto SWR (`initialize()` con guard `_initialized`/`_lastBranchId` + `refreshSilently()`
  + un único método `fetchXxxData()` privado que hace el `.select()` y setea signals). El
  guard de `requestId` se inserta en ese mismo esqueleto sin cambiar su forma.

### Componentes/Facades que NO existen y debemos crear
- `request-guard.utils.ts` — no hay ninguna utilidad de control de flujo async equivalente
  en `core/utils/` (confirmado contra `indices/UTILS.md`); es genuinamente nueva.

### Explícitamente fuera de esta pasada
- **`EnrollmentFacade`**: no tiene el trío `initialize()`/`fetchXxxData()`/`refreshSilently()`
  — es el orquestador de un wizard de 6 pasos con estado de un solo draft en progreso, no una
  lista que se re-fetchea por cambio externo de sede. Aplicar el guard ahí requeriría primero
  entender *qué* dispararía fetches concurrentes en ese Facade (candidato: no está claro que
  aplique el mismo riesgo). **Decisión:** queda fuera de AC4 de esta spec — si se confirma que
  sí aplica, es una spec/fix separado, no bloquea el cierre de ésta. (Nota para
  `spec-verify`: esto reduce el AC4 real a los 4 Facades listados arriba, no 5 — el 5º de la
  tabla de `facades.md` §7 no es candidato natural.)
- `GlobalSearchFacade` — confirmado fuera de scope en la spec (§4 Out of scope).

---

## 4. Modelo de datos

N/A — no toca BD, RLS ni modelos DTO/UI. Es una utilidad de control de flujo en memoria.

---

## 5. Arquitectura del feature

### Diagrama de flujo (verbal)

```
BranchFacade.selectedBranchId() cambia
   → effect() en el Smart Component dispara facade.loadX()/initialize()
        → Facade: const token = this.xGuard.next()   // ← nuevo
        → await fetchXxxData()  (igual que hoy, sin cambios en la query)
        → if (!this.xGuard.isCurrent(token)) return;  // ← nuevo, antes de aplicar
        → this._data.set(resultado)                   // solo si sigue vigente
```

### Capas tocadas

- **Util**: `core/utils/request-guard.utils.ts` (Functional Core, sin Angular)
- **Facade**: `AdminAlumnosFacade`, `DashboardFacade`, `FlotaFacade`, `DmsFacade`
- **Smart Component**: ninguno — el cambio es interno al Facade, invisible para la UI
- **Migration**: ninguna

---

## 6. Restricciones aplicables (referencia al sistema Koa)

- [x] `architecture.md` — Núcleo Funcional: el guard es una función pura en `core/utils/`,
  sin estado de Angular ni inyección — se testea sin TestBed.
- [x] `facades.md` §7 — los 4 Facades tocados ya son branch-scoped; el guard convive con el
  patrón `_lastBranchId` existente sin reemplazarlo (son dos protecciones distintas: una
  invalida caché SWR por cambio de sede, la otra descarta respuestas fuera de orden).
- [ ] `models.md` — no aplica, sin DTOs nuevos
- [ ] `visual-system.md` — no aplica, sin UI nueva
- [x] `swr-pattern.md` — el guard se inserta en el mismo método `fetchXxxData()` que ya usa
  `refreshSilently()`; no introduce polling ni cambia el contrato SWR existente.
- [ ] `notifications.md` — no aplica
- [x] `testing-tdd.md` — `.spec.ts` obligatorio para la util nueva y para el cambio de
  comportamiento en cada Facade tocado (lógica nueva = test obligatorio, no opcional).
- [ ] `ai-readability.md` — no aplica, sin botones/inputs nuevos

---

## 7. Plan de testing

- **Unitarios (`request-guard.utils.spec.ts`):** token estrictamente incremental; `isCurrent`
  devuelve `true` solo para el último token emitido; dos guards independientes no comparten
  contador.
- **Unitarios por Facade (AC1, AC-E1, AC-E2, AC-E3):** simular 2-3 fetches con
  `mockResolvedValue` resueltos en orden invertido/aleatorio vía `Promise` controlados
  manualmente (no `setTimeout` real) y verificar que el signal final refleja solo la fetch
  más reciente disparada. Un caso adicional simula que la fetch vigente falla (`mockRejectedValue`)
  y confirma que `_error` sí se setea (AC-E2 — el guard no debe tragarse errores reales).
- **QA manual:** en `AdminAlumnosFacade` tras el spike, cambiar de sede 2 veces rápido en el
  topbar con throttling de red (DevTools) y confirmar visualmente que la tabla termina
  mostrando la sede correcta, sin parpadeo al dato viejo persistente.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| El guard descarta silenciosamente una respuesta que en realidad SÍ era la vigente (bug en la comparación de tokens) — regresión invisible sin tests | Media | Tests unitarios explícitos por Facade (no solo en la util) antes de dar el spike por bueno; QA manual del golden path (una sola sede, sin cambios rápidos) para confirmar cero regresión |
| Replicar el patrón en los 3 Facades restantes sin que el spike haya sido realmente validado primero | Media | Bloquear explícitamente el paso 2/3 hasta que `AdminAlumnosFacade` tenga sus tests en verde y, si es posible, QA manual confirmada — no paralelizar los 4 desde el inicio |
| `EnrollmentFacade` sí tenía el problema real y quedó fuera por la decisión de scope de este plan | Baja | Documentado explícitamente en §3 como decisión consciente, no omisión; queda para una spec/fix separado si se confirma el riesgo |

---

## 9. Orden de implementación

1. `request-guard.utils.ts` + `.spec.ts` (TDD: test primero)
2. Spike en `AdminAlumnosFacade`: integrar guard + `.spec.ts` con los casos de AC1/AC-E1/AC-E2 → correr `npm run test:ci` en verde
3. QA manual del spike (cambio rápido de sede con throttling) antes de replicar
4. Replicar mecánicamente en `DashboardFacade`, `FlotaFacade`, `DmsFacade` (uno por uno, con su `.spec.ts` cada vez)
5. Actualizar `.claude/rules/facades.md` documentando el patrón
6. `npm run lint:arch` + `npm run test:ci` completo
7. `/spec-verify` contra los AC de spec.md

---

## 10. Estimación

M — 1 a 2 días (la mecánica se repite 4 veces, pero el spike + validación del patrón es lo que consume más tiempo real).

---

## Changelog

- 2026-08-05 — plan inicial por m, talla M confirmada con el usuario. Alcance de AC4 acotado
  a 4 Facades (se excluye `EnrollmentFacade` del primer pase, ver §3).
