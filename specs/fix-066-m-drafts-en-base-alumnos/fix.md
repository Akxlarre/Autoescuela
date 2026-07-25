# Fix: Matrículas draft (abandonadas en paso 1 del wizard) aparecen en Base de alumnos
> id: fix-066-m-drafts-en-base-alumnos
> refs: —
> status: done
> closed: 2026-07-25
> created: 2026-07-25

## Root Cause
`EnrollmentFacade` inserta una fila en `enrollments` con `status: 'draft'` apenas se completa
el paso 1 del wizard (datos personales), antes de que el alumno confirme nada. En
`AdminAlumnosFacade.fetchAlumnosData` (y su contraparte `mapToAlumnoTableRow`), el set
`INCOMPLETE_STATUSES` solo excluye `'cancelled'` y `'pending_payment'` — no excluye `'draft'`.
Como resultado, cualquier draft (incluso uno abandonado justo después del paso 1) pasa el
filtro, se selecciona como el enrollment vigente del alumno, y `deriveStatus()` lo mapea a
`'Pre-inscrito'`, mostrándolo en la tabla de Base de alumnos con expediente "Pendiente - 0/4".
Ya existe precedente de excluir `'draft'` en el mismo archivo (`checkHistorial` usa
`.neq('status', 'draft')` y `nroExpedientes` ya filtra `e.status !== 'draft'`), así que
`INCOMPLETE_STATUSES` quedó inconsistente con el resto del archivo.

## ACs Afectados
Ninguno — fix autónomo (bug de visualización, no ligado a una spec previa).

- AC-1: Un alumno cuya única matrícula Clase B está en estado `draft` (wizard abandonado en
  cualquier paso, incluido el 1) NO debe aparecer en la tabla "Base de alumnos".
- AC-2: Un alumno con al menos una matrícula Clase B en estado válido (no `cancelled`,
  `pending_payment` ni `draft`) sigue apareciendo normalmente, sin regresión.

## Cambio
- **Archivo:** `src/app/core/facades/admin-alumnos.facade.ts`
- **Qué cambia:** agregar `'draft'` al set `INCOMPLETE_STATUSES` en `fetchAlumnosData` (L376) y
  en `mapToAlumnoTableRow` (L417), para que las matrículas draft se traten igual que
  `cancelled`/`pending_payment` al decidir si el alumno tiene un enrollment Clase B válido.

## Test de Regresión
- `src/app/core/facades/admin-alumnos.facade.spec.ts > excluye alumnos cuya única matrícula Clase B está en estado draft` ✓
