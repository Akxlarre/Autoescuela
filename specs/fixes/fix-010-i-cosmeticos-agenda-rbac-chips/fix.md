# Fix: 3 cosméticos — label Agenda inconsistente, texto RBAC engañoso, chips "P" ambiguos
> id: fix-010-i-cosmeticos-agenda-rbac-chips
> refs: ASG-b-028
> status: done
> closed: 2026-08-01
> created: 2026-07-31

## Root Cause
[Heredado de ASG-b-028, a confirmar]: 3 hallazgos cosméticos pequeños, sin relación entre sí:
- **H-010**: en Agenda, el selector de instructor muestra "Todos los instructores" al entrar, pero en realidad ya cargó un instructor específico (el primero de la lista) — label inconsistente con el estado real.
- **H-014**: en `/app/secretaria/contabilidad/reportes`, la sección "Gastos Fijos del Período" dice en su propio subtítulo "solo visible para admin", pero se muestra igual a la secretaria (incluido el botón "Registrar Gasto Fijo") — o sobra la sección (fuga RBAC) o el texto miente.
- **H-018**: en el Dashboard del alumno, "Asistencia reciente" muestra chips "P" sobre fechas que en "Mis Clases" figuran como Inasistencia — ambiguo si "P" significa "Práctica" o "Presente" (y en este último caso, sería incorrecto).

## ACs Afectados
Ninguno — fix autónomo (originado de Asignación de equipo, no de una spec).

## Cambio

### H-010 (usuario confirmó: pasa con sede "Autoescuela Chillán", no con "Conductores Chillán" ni "Todas las sedes")
- **Causa real** (no estaba en `admin-agenda.component.ts` sino en `core/facades/agenda.facade.ts`): `loadInstructors()` solo auto-seleccionaba el primer instructor la primera vez (`if (this._selectedInstructorId() === null ...)`). En cambios de sede posteriores, `_selectedInstructorId` quedaba con el id de la sede anterior — si ese id no existía en la lista de instructores de la nueva sede, el `p-select` no encontraba la opción y caía al placeholder "Todos los instructores", mientras la grilla seguía filtrando por el instructor "fantasma" de la sede vieja.
- **Archivo:** `src/app/core/facades/agenda.facade.ts` — `loadInstructors()` ahora siempre re-ancla `_selectedInstructorId` a `filters[0]?.id ?? null` (sin el guard `=== null`). Es seguro porque este método solo corre en cambios de sede reales — `initialize()` ya filtra los refrescos SWR (`branchId === this._lastBranchId`).

### H-014 (usuario confirmó: no dejar a secretaría registrar gasto fijo)
- **Archivo:** `src/app/shared/components/reportes-contables-content/reportes-contables-content.component.ts` — nuevo `isAdmin` input (default `false`); la sección completa "Gastos Fijos del Período" (incluye el botón "Registrar Gasto Fijo") ahora está detrás de `@if (!isLoading() && isAdmin())`. Se quitó el texto "— solo visible para admin" del subtítulo (ya no hace falta, ahora es cierto por diseño).
- **Archivo:** `src/app/features/admin/contabilidad-reportes/admin-contabilidad-reportes.component.ts` — agregado `[isAdmin]="true"` (ruta exclusiva de admin).
- **`secretaria-contabilidad-reportes.component.ts` — sin cambios**: al no pasar `[isAdmin]`, el default `false` ya oculta la sección. `fixed_expenses` ya era admin-only a nivel RLS (`indices/DATABASE.md`), así que esto es puramente UI — cierra la fuga de UX, no de datos.

### H-018 (usuario confirmó: la sección ya debería mostrar clases prácticas)
- **Diagnóstico:** la fuente de datos ya era correcta — `StudentHomeFacade` arma `recentSessions` desde `class_b_sessions` + `class_b_practice_attendance`, exactamente lo mismo que usa "Mis Clases" (`kind` es siempre `'practice'`, la asistencia teórica se eliminó en spec 0001). El bug real era visual: el chip de una sola letra "P" quedaba justo debajo de un ícono de estado (check verde / x rojo), y se leía como si dijera "Presente" — contradictorio cuando el ícono mostraba una inasistencia.
- **Archivo:** `src/app/features/alumno/dashboard/alumno-dashboard.component.ts` — el chip ahora dice "Práctica"/"Teoría" completo en vez de "P"/"T", sin ambigüedad con el estado (que ya se comunica por separado vía el ícono check/x + color).

## Test de Regresión
- **Nuevo** en `src/app/core/facades/agenda.facade.spec.ts` (`describe('loadInstructors (vía initialize) — fix-010-i, H-010', ...)`, 2 tests): confirma que `selectedInstructorId()` se re-ancla al instructor de la nueva sede tras un cambio de sede (antes quedaba pegado al id de la sede anterior), y que queda en `null` si la nueva sede no tiene instructores.
- H-014 y H-018 no requieren test nuevo (`.claude/rules/testing-tdd.md`): son gating de template (`@if`) y cambio de texto estático, sin `computed()` ni decisión de negocio nueva.
- Verificación empírica: `npx tsc -p tsconfig.app.json --noEmit` limpio, `ng build --configuration=development` exitoso, `npm run lint:arch` → 0 errores, `npx vitest run src/app/core/facades/agenda.facade.spec.ts` → **12/12 verde** (10 preexistentes + 2 nuevos).
- Verificación visual pendiente: (a) en Agenda, cambiar a sede "Autoescuela Chillán" y confirmar que el selector muestra un instructor real (no "Todos los instructores") y la grilla coincide; (b) en Reportes de Secretaría, confirmar que "Gastos Fijos del Período" ya no aparece; (c) en el Dashboard del alumno, confirmar que los chips de "Asistencia reciente" dicen "Práctica" en vez de "P".
