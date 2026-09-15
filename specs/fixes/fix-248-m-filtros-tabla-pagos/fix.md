# Fix: Filtros en la tabla principal de la vista Pagos (Alumnos con saldo pendiente)

> id: fix-248-m-filtros-tabla-pagos
> refs: ASG-m-005 (specs/assignments/ASG-m-005-filtros-tabla-pagos.md)
> status: in_progress
> created: 2026-09-15

## Root Cause

[Heredado de ASG-m-005, ajustado por el owner]: la tabla principal de la vista Pagos
("Alumnos con saldo pendiente", en `AdminPagosComponent` y `SecretariaPagosComponent`) no
tiene ningún filtro — solo pagina/recorta la lista completa de `PagosFacade.alumnosConDeuda()`.
Con volumen real de deudores esto obliga a recorrer varias páginas para ubicar un caso
puntual (ej. deudores de un curso o período específico).

Alcance confirmado por el owner (difiere del sugerido en la Asignación):
- **Filtro de rango de fechas** — sobre `enrollments.created_at` (fecha de matrícula), único
  campo de fecha disponible en esta tabla.
- **Filtro por tipo de curso (B / Profesional)** — derivado de `courses.type` vía
  `enrollments.course_id`.
- **Filtro por sede** — sólo relevante para `AdminPagosComponent` cuando el admin está en
  "Todas las sedes" (`BranchFacade.selectedBranchId() === null`); en ese estado la tabla mezcla
  deudores de ambas sedes sin forma de distinguirlos.
- **Descartado: filtro por estado de pago.** No aporta nada porque, por definición,
  `alumnosConDeuda()` sólo contiene enrollments con `pending_balance > 0` — ninguna fila de
  esta tabla está "pagada", así que un filtro pagado/pendiente no tendría nada que discriminar.
- **Extra pedido por el owner, fuera del alcance original de la Asignación:** agregar una
  columna "Sede" a la tabla en `AdminPagosComponent`, visible sólo cuando
  `selectedBranchId() === null` (mismo criterio que activa el filtro de sede) — sin esa columna
  el filtro de sede no tendría con qué confirmar visualmente a qué sede pertenece cada fila.

`SecretariaPagosComponent` no necesita filtro ni columna de sede: la secretaria siempre ve una
única sede fija (`currentUser().branchId`), nunca "Todas las sedes".

## ACs Afectados

Ninguna spec declaró ACs para esta tabla. ACs que este fix establece:

- **AC-1:** en `AdminPagosComponent` y `SecretariaPagosComponent`, filtrar por rango de fechas
  (Desde/Hasta sobre `created_at` de la matrícula) reduce la lista de `deudoresVisibles()` a
  las filas cuya matrícula cae dentro del rango, incluyendo ambos extremos.
- **AC-2:** filtrar por tipo de curso (Clase B / Profesional) muestra sólo los deudores cuya
  matrícula pertenece a ese tipo de curso.
- **AC-3:** en `AdminPagosComponent`, cuando `selectedBranchId() === null` ("Todas las sedes"),
  aparece un filtro adicional de Sede y una columna "Sede" en la tabla; al cambiar a una sede
  específica, ambos desaparecen (no tiene sentido filtrar/mostrar una columna con un solo valor
  posible).
- **AC-4:** los filtros son combinables entre sí (AND) y client-side sobre los datos ya
  cargados por `PagosFacade` — mismo patrón que `PagosRecientesDrawerComponent.pagosFiltrados()`.
- **AC-5:** limpiar los filtros (o no aplicar ninguno) muestra la lista completa, igual que el
  comportamiento actual.
- **AC-6:** sin regresión de paginación/"Cargar más" — los filtros se aplican ANTES de
  paginar/recortar (`deudoresVisibles()`), no después.

## Cambio

- **Archivo:** `src/app/core/models/ui/pagos.model.ts`
  - **Qué cambia:** `AlumnoDeudor` gana `cursoTipo: string`, `cursoNombre: string`,
    `fechaMatricula: string | null` y `sedeId: number`, `sedeNombre: string` — campos derivados
    necesarios para los filtros nuevos y la columna Sede.
- **Archivo:** `src/app/core/facades/pagos.facade.ts`
  - **Qué cambia:** `fetchAlumnosConDeuda()` amplía el `select()` con
    `created_at, courses!inner(type, name), branches!inner(name)` y mapea los campos nuevos de
    `AlumnoDeudor`.
- **Archivo:** `src/app/features/admin/pagos/admin-pagos.component.ts`
  - **Qué cambia:** agrega signals de filtro (`filtroFechaDesde`, `filtroFechaHasta`,
    `filtroCurso`, `filtroSede`), un `computed()` `deudoresFiltrados()` (mismo patrón que
    `pagosFiltrados()` en `PagosRecientesDrawerComponent`) intercalado antes de
    `deudoresVisibles()`, UI de filtros (fechas con `app-date-input`, selects de curso/sede vía
    `p-select`), y la columna "Sede" condicionada a `branchFacade.selectedBranchId() === null`.
- **Archivo:** `src/app/features/secretaria/pagos/secretaria-pagos.component.ts`
  - **Qué cambia:** mismo `computed()` de filtro de fecha + curso (sin sede, sin columna Sede —
    la secretaria está anclada a una sola sede).

## Test de Regresión

- `src/app/core/facades/pagos.facade.spec.ts` — `fetchAlumnosConDeuda mapea cursoTipo, fechaMatricula y sedeNombre` ✓
- `src/app/features/admin/pagos/admin-pagos.component.spec.ts` — `deudoresFiltrados() combina fecha + curso + sede (AND)`, `columna Sede sólo visible con selectedBranchId() === null` ✓
- `src/app/features/secretaria/pagos/secretaria-pagos.component.spec.ts` — `deudoresFiltrados() combina fecha + curso (AND)` ✓
