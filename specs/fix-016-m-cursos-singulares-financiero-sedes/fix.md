# fix-016-m — Cursos Singulares: capa financiera, sedes y robustez

## Contexto

Segunda tanda de la auditoría del módulo Cursos Singulares (continuación de
fix-015). Corrige los 7 hallazgos pendientes reportados al dueño.

## Bugs / Hallazgos

1. **Descuentos no persistidos** — el descuento solo afectaba `amount_paid`; si
   el pago quedaba pendiente se descartaba y `marcarEnrollmentPagado` cobraba
   el precio completo. `totalCobrado` del drawer de cobro usaba `cobrados × precio`.
2. **KPI "Ingresos" era estimado** (`precio × inscritos`), no dinero real, e
   incluía cursos "próximos" mientras la tabla los excluía (inconsistencia).
3. **Sin integración con cuadratura** — un cobro en efectivo de curso singular
   no aparecía en el cierre de caja diario.
4. **Separación por sedes incompleta** — `crearCurso` con "Todas las sedes"
   creaba cursos con `branch_id = NULL` (invisibles al filtrar); `registered_by`
   nunca se guardaba; la lista no reaccionaba al cambio de sede del topbar;
   sin invalidación SWR por sede.
5. **Sin validación de cupos al confirmar** — solo se ocultaba el botón en UI;
   dos usuarias simultáneas podían sobrevender.
6. **`loadInscriptos` tragaba errores** mostrando "Sin inscriptos registrados".
7. **Identidad editable de alumnos existentes** — un typo pisaba nombre/fecha
   de un alumno de Clase B al inscribirlo en un curso singular.

## Acceptance Criteria

- [x] AC1: `discount_amount`/`discount_reason` persisten en BD; el cobro
  posterior (`marcarEnrollmentPagado`) cobra `precio − descuento`; el drawer
  de cobro muestra el descuento y suma `amount_paid` real.
- [x] AC2: KPI "Ingresos" = Σ `amount_paid` (cobrado real); nuevo KPI
  "Por Cobrar"; columna de tabla muestra cobrado real, consistente con footer.
- [x] AC3: Los cobros pagados de cursos singulares aparecen como ingresos en la
  cuadratura del día (`paid_at`), branch-scoped, con reversa al eliminar.
- [x] AC4: Cursos siempre con sede: migración backfill `branch_id` NULL→1 +
  NOT NULL; selector de sede en el drawer de creación (admin); `registered_by`
  persistido; lista reactiva al selector del topbar (effect + `_lastBranchId`).
- [x] AC5: Cupos validados al confirmar inscripción (facade) + trigger de BD
  como backstop contra carreras; mensaje amigable "No quedan cupos".
- [x] AC6: Error de `loadInscriptos` visible para el usuario (no lista vacía).
- [x] AC7: Campos de identidad (nombres, apellidos, nacimiento, género)
  bloqueados cuando el alumno ya existe; contacto (email/teléfono/dirección)
  editable.
- [x] AC8: El export Excel/PDF de la cuadratura (EF
  `generate-cash-closing-report`) incluye los cobros singulares del día con
  los mismos buckets que la pantalla.
- [x] AC9: Reportes contables (facade + Functional Core + EF
  `generate-financial-report`) suman los cobros singulares como categoría
  de ingreso "Cursos Singulares" (branch-scoped, con sede en la etiqueta
  cuando se ven todas las escuelas).

## Test de regresión

`src/app/core/facades/cursos-singulares.facade.spec.ts` (ampliado)
`src/app/core/facades/cuadratura.facade.spec.ts` (mapper singular→IngresoRow)
`src/app/core/utils/db-error.utils.spec.ts` (mensaje CUPOS_AGOTADOS)
