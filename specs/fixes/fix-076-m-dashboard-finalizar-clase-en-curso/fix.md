---
# Fix: no se puede finalizar una clase en curso desde el Dashboard
> id: fix-076-m-dashboard-finalizar-clase-en-curso
> refs: —
> status: done
> closed: 2026-07-27
> created: 2026-07-27

## Root Cause

`DashboardComponent.handleLiveClassAction()` (`dashboard.component.ts:450-488`) solo tiene un caso
especial para clases `status === 'pending'`: abre el drawer real "Iniciar Clase Práctica"
(`AdminIniciarClaseDrawerComponent`). Para cualquier otro status — incluyendo `in_progress` — cae al
`else` genérico, que abre `AgendaSlotDetailDrawerComponent`: un drawer puramente informativo (solo
botón "Cerrar detalle", sin acciones). El usuario (Matías) verificó en `ng serve` que al hacer clic
en una clase "Transcurriendo" desde el panel "Clases Actuales" del Dashboard, no hay forma de
finalizarla — mientras que desde la página de Asistencia Clase B sí existe ese flujo real
(`AdminFinalizarClaseDrawerComponent`, vía `admin-asistencia.component.ts:135-142`).

El Dashboard nunca quedó conectado a ese flujo para clases en curso — solo para clases pendientes de
iniciar. `LiveClassModel`/`fetchLiveClasses()` tampoco traían los 2 campos que ese drawer necesita
(`studentId`, `kmStart`).

## ACs Afectados

- Ninguno — fix autónomo, sin spec asociada.

## Cambio

- **Archivo:** `src/app/core/models/ui/dashboard.model.ts`
  - `LiveClassModel`: agregar `studentId: number | null` y `kmStart: number | null`.
- **Archivo:** `src/app/core/facades/dashboard.facade.ts`
  - `fetchLiveClasses()`: ampliar el `select()` de `class_b_sessions` para traer `km_start` y
    `enrollments!inner(branch_id, student_id, students(users(...)))` (agrega `student_id` al join
    existente). Mapear `studentId: row.enrollments?.student_id ?? null` y
    `kmStart: row.km_start ?? null` en `mappedPracticas`.
- **Archivo nuevo:** `src/app/core/utils/live-class-action.utils.ts`
  - `resolveLiveClassActionPlan(cls: LiveClassModel)`: función pura (Núcleo Funcional) que decide
    el flujo (`iniciar` | `finalizar` | `informativo`) y arma el `row` correspondiente. Se extrajo
    la decisión a una función pura porque `DashboardComponent` no es testeable vía
    `TestBed.createComponent()` en este proyecto (falla por resolución de `styleUrl` en Vitest —
    mismo patrón ya usado por `admin-alumno-detalle.component.ts` con `resolveListadoRoute`).
- **Archivo:** `src/app/features/dashboard/dashboard.component.ts`
  - `handleLiveClassAction()`: ahora delega en `resolveLiveClassActionPlan(cls)` y solo despacha el
    side-effect según el `flow` devuelto (`iniciar` → `AdminIniciarClaseDrawerComponent`,
    `finalizar` → `AdminFinalizarClaseDrawerComponent` nuevo, `informativo` → comportamiento previo
    intacto).

## Test de Regresión

- `live-class-action.utils.spec.ts > resolveLiveClassActionPlan (fix-076)`:
  - `clase practical pending → flow "iniciar" con status "pendiente"` ✓
  - `clase practical in_progress → flow "finalizar" con studentId y kmStart` ✓
  - `clase practical completed → flow "informativo"` ✓
  - `clase theoretical in_progress → flow "informativo" (no es practical)` ✓
- `dashboard.facade.spec.ts`: test nuevo de `fetchLiveClasses()` verificando que
  `studentId`/`kmStart` se mapean desde la fila de `class_b_sessions`.
- Suite completa (`npm run test:ci`): 1467/1467 en verde (4/4 en
  `live-class-action.utils.spec.ts`, 5/5 en `dashboard.facade.spec.ts` incluyendo el test nuevo).
- `npm run lint:arch`: 0 errores, 165 advertencias (mismas pre-existentes, ninguna nueva).
- `npx tsc --noEmit`: 0 errores.
- Verificación visual: NO ejecutada con Playwright MCP en esta sesión — el usuario (Matías) decidirá
  si la corre en `ng serve`.
