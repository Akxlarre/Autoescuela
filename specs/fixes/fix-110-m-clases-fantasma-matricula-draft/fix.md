# Fix: Clases fantasma de matrículas draft en Dashboard y Asistencia B
> id: fix-110-m-clases-fantasma-matricula-draft
> refs: —
> status: done
> closed: 2026-08-04
> created: 2026-08-04

## Root Cause
El wizard de matrícula (`enrollment.facade.ts`) no guarda de forma transaccional: es
auto-save incremental por paso. En el **Paso 2** (`saveAssignment()`, líneas 1027-1030)
ya inserta filas reales en `class_b_sessions` con `status='reserved'`, apuntando a un
`enrollment` que sigue en `status='draft'` (creado en el Paso 1, líneas 691-719) — mucho
antes de la confirmación final del **Paso 6** (`confirmEnrollment()`, líneas 1259-1318),
donde recién `enrollments.status` pasa a `'active'` y las sesiones a `'scheduled'`.

Si el usuario abandona el wizard entre el Paso 2 y el Paso 6, el `enrollment` queda para
siempre en `draft` pero sus `class_b_sessions` con `status='reserved'` ya existen en la
base. Un cron diario (`cleanup_expired_drafts`, 3am) las limpia, pero solo tras
`expires_at` (14h) — ventana real de exposición de hasta ~38h.

Durante esa ventana, tres queries que leen `class_b_sessions` no excluyen estas filas
huérfanas porque ninguna filtra `enrollments.status` ni `class_b_sessions.status='reserved'`
de forma consistente:

- `dashboard.facade.ts::fetchLiveClasses()` (líneas 328-344): solo `.neq('status', 'cancelled')`.
- `asistencia-clase-b.facade.ts::fetchPracticas()` (líneas 553-592): solo
  `.or('status.neq.cancelled,status.is.null')`.
- `asistencia-clase-b.facade.ts::fetchAlertas()` (líneas 644-680): sí filtra
  `enrollments.status='active'`, pero no excluye `status='reserved'`.

Precedente: el mismo patrón (`status='draft'` filtrándose donde no debería) ya se corrigió
en `fix-066-m` para "Base de alumnos" (`admin-alumnos.facade.ts`), agregando `'draft'` a
`INCOMPLETE_STATUSES`, pero ese fix no se replicó en estos tres puntos.

## ACs Afectados
Ninguno — fix autónomo (bug de datos, no altera contrato de ninguna spec existente).

## Cambio
- **Archivo nuevo:** `src/app/core/utils/class-b-session.utils.ts`
  **Qué agrega:** constante pura `VALID_CLASS_B_SESSION_STATUSES` (excluye `'reserved'` y
  `'cancelled'`) para reutilizar el criterio de "sesión válida" en los tres call sites.
- **Archivo:** `src/app/core/facades/dashboard.facade.ts`
  **Qué cambia:** `fetchLiveClasses()` — reemplaza `.neq('status', 'cancelled')` por
  `.in('status', VALID_CLASS_B_SESSION_STATUSES)` y agrega
  `.eq('enrollments.status', 'active')`.
- **Archivo:** `src/app/core/facades/asistencia-clase-b.facade.ts`
  **Qué cambia:**
  1. `fetchPracticas()` — reemplaza el `.or('status.neq.cancelled,status.is.null')` por
     `.in('status', VALID_CLASS_B_SESSION_STATUSES)` y agrega
     `.eq('enrollments.status', 'active')`.
  2. `fetchAlertas()` — agrega `.in('status', VALID_CLASS_B_SESSION_STATUSES)` (ya tenía
     el filtro de `enrollments.status`).

## Test de Regresión
- `src/app/core/utils/class-b-session.utils.spec.ts > VALID_CLASS_B_SESSION_STATUSES excluye reserved y cancelled` ✓
- `src/app/core/facades/dashboard.facade.spec.ts > fetchLiveClasses no incluye sesiones reserved de enrollments draft` ✓
- `src/app/core/facades/asistencia-clase-b.facade.spec.ts > fetchPracticas no incluye sesiones reserved de enrollments draft` ✓
