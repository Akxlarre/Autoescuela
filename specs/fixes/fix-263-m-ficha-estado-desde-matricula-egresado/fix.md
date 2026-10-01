# Fix: La ficha del alumno muestra "Activo" siempre: lee students.status en vez del estado de la matrícula
> id: fix-263-m-ficha-estado-desde-matricula-egresado
> refs: fix-012-i, fix-262-m
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Root Cause

La ficha del alumno (`AdminAlumnoDetalleFacade.fetchDetalleData`) **nunca lee
`enrollments.status`**. El `select` anidado de `enrollments` no incluye la columna, y el estado
que se muestra sale de `students.status` (`estado: this.formatStatus(s.status)`).
`students.status` es una columna que **ningún flujo escribe**: en la BD, los 205 alumnos están en
`active`. Lo que define si alguien es alumno o ex-alumno es `enrollments.status = 'completed'`
(`ExAlumnosFacade`, `marcarComoExAlumno` de `fix-012-i`).

Síntomas de la misma causa:
1. El chip del header y el "ESTADO: …" de la tarjeta de perfil dicen **"Activo"** para todos,
   incluidos los egresados (detectado por Matías en la ficha de `alumno.seed132`, que aparece en
   Ex-Alumnos B).
2. La CTA "Marcar como Ex-Alumno" se oculta con `alumno.estado !== 'Finalizado'`. Como `estado`
   nunca es "Finalizado", la CTA seguiría visible después de marcar al alumno.
3. El filtro `e.status !== 'draft'` del selector de matrículas compara contra `undefined`, así
   que nunca excluye borradores.

**Decisión (Matías, 2026-10-01):** el estado mostrado sale de la **matrícula seleccionada**, y
`completed` se muestra como **"Egresado"**.

## ACs Afectados

Ninguno de una spec previa. Fix autónomo.

- AC-1: la consulta de la ficha trae `enrollments.status`, y `EnrollmentSummary` lo expone.
- AC-2: `alumno.estado` deriva del status de la matrícula seleccionada: `active` → "Activo",
  `completed` → "Egresado", `pending_payment` → "Pago pendiente", `cancelled` → "Anulada". Sin
  matrícula → "Sin matrícula". Se recalcula en `selectEnrollment()`.
- AC-3: `alumno.egresado` (boolean) reemplaza la comparación de strings `estado !== 'Finalizado'`
  para ocultar "Marcar como Ex-Alumno".
- AC-4: el filtro de borradores del selector funciona: `draft` queda excluido.
- AC-5: el chip del header muestra "Egresado" en estilo `success`. Ningún estado conocido queda
  en `warning` por defecto, salvo pago pendiente o anulada.

## Archivos involucrados

- `src/app/core/models/ui/alumno-detalle.model.ts`: `EnrollmentSummary.status`,
  `AlumnoDetalleUI.egresado`
- `src/app/core/facades/admin-alumno-detalle.facade.ts`
- `src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.ts`: CTA ex-alumno y
  estilo del chip

## Cambios

- **`alumno-detalle.model.ts`**: `EnrollmentSummary.status` (status crudo de la matrícula) y
  `AlumnoDetalleUI.egresado` (boolean). (AC-1, AC-3)
- **`admin-alumno-detalle.facade.ts`**:
  - el `select` anidado de `enrollments` pide `status`. Con eso también funciona el filtro de
    `draft` que ya existía. (AC-1, AC-4)
  - `estado` y `egresado` derivan de la matrícula: la más reciente en la carga y la elegida en
    `selectEnrollment()`. (AC-2)
  - `formatStatus` (mapa de `students.status`) se reemplaza por `formatEnrollmentStatus`:
    `draft` → Borrador, `active` → Activo, `completed` → **Egresado**,
    `pending_payment` → Pago pendiente, `cancelled` → Anulada, sin matrícula → "Sin matrícula".
    (AC-2)
- **`admin-alumno-detalle.component.ts`**:
  - la CTA "Marcar como Ex-Alumno" usa `!alumno.egresado` en vez de comparar con 'Finalizado'.
    (AC-3)
  - el chip del header es `success` para Activo y Egresado, con ícono `graduation-cap` si es
    egresado. (AC-5)
- **`indices/DOMAIN-GOTCHAS.md`**: DG-096 (`students.status` es una columna muerta).
- **`indices/SERVICES.md`**: entrada de `AdminAlumnoDetalleFacade`.

## Test de Regresión

- `admin-alumno-detalle.facade.spec.ts` › `estado desde la matrícula — fix-263-m`:
  - matrícula `completed` → "Egresado" y `egresado=true` aunque `students.status='active'`
  - matrícula `active` → "Activo" y `egresado=false`
  - `selectEnrollment` recalcula el estado según la matrícula elegida
  - la consulta de la ficha pide `enrollments.status`
  - las matrículas `draft` quedan fuera del selector
- Los 3 primeros fallaron antes del cambio. El de `draft` pasaba igual porque el mock devuelve
  `status` aunque no se pida, así que se agregó el test del `select`, que sí detecta la causa
  real. Suite del facade y del componente: 88/88. tsc limpio. `lint:arch` sin errores nuevos.

## Progreso

- [x] Tests primero (facade): estado desde matrícula, "Egresado", `selectEnrollment`, `draft` excluido
- [x] Implementación facade + modelo + componente (88/88)
- [x] Verificación visual en la ficha de `alumno.seed132`: chip y ESTADO dicen "Egresado" (Matías, 2026-10-01)
- [x] `/fix-close`
