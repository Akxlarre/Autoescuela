# Fix: Filtros en la tabla principal de la vista Pagos (Alumnos con saldo pendiente)

> id: fix-248-m-filtros-tabla-pagos
> refs: ASG-m-005 (specs/assignments/ASG-m-005-filtros-tabla-pagos.md)
> status: done
> closed: 2026-09-15
> created: 2026-09-15

## Root Cause

[Heredado de ASG-m-005, ajustado por el owner durante la implementación]: la tabla principal
de la vista Pagos ("Alumnos con saldo pendiente", en `AdminPagosComponent` y
`SecretariaPagosComponent`) no tenía ningún filtro — solo paginaba/recortaba la lista completa
de `PagosFacade.alumnosConDeuda()`. Con volumen real de deudores esto obliga a recorrer varias
páginas para ubicar un caso puntual (ej. deudores de un curso o período específico).

Alcance final confirmado por el owner (difiere del sugerido en la Asignación, y se ajustó dos
veces más durante la implementación tras revisión visual):

- **Filtro de rango de fechas** — sobre `enrollments.created_at` (fecha de matrícula), único
  campo de fecha disponible en esta tabla. Se agregó también una **columna "Fecha Matrícula"**
  (pedida por el owner) — sin ella el filtro no tenía con qué confirmar visualmente el criterio
  aplicado.
- **Filtro por tipo de curso (B / Profesional)** — derivado de `courses.type` vía
  `enrollments.course_id`.
- **Columna "Sede"** en `AdminPagosComponent`, visible sólo cuando
  `BranchFacade.selectedBranchId() === null` ("Todas las sedes") — en ese estado la tabla
  mezcla deudores de ambas sedes sin forma de distinguirlos.
- **Botón "Limpiar filtros"** (pedido por el owner) — visible solo cuando hay al menos un
  filtro de fecha/curso aplicado; resetea a signals vacíos y vuelve a página 1.
- **Descartado: filtro por estado de pago.** No aporta nada porque, por definición,
  `alumnosConDeuda()` sólo contiene enrollments con `pending_balance > 0` — ninguna fila de
  esta tabla está "pagada", así que un filtro pagado/pendiente no tendría nada que discriminar.
- **Descartado durante la implementación: filtro de Sede (dropdown).** El owner lo pidió
  originalmente pero luego indicó que no aporta nada — si el admin quiere ver una sede en
  particular, ya existe el selector de sede del topbar para eso. Se retiró el `p-select` y el
  signal `filtroSede`; se **mantuvo la columna Sede**, que sigue siendo útil para distinguir
  filas cuando el topbar está en "Todas las sedes" (no depende del filtro retirado).

`SecretariaPagosComponent` no necesita columna de sede: la secretaria siempre ve una única sede
fija (`currentUser().branchId`), nunca "Todas las sedes". Sí tiene fecha, curso y "Limpiar
filtros", igual que `AdminPagosComponent`.

## ACs Afectados

Ninguna spec declaró ACs para esta tabla. ACs que este fix establece:

- **AC-1:** en `AdminPagosComponent` y `SecretariaPagosComponent`, filtrar por rango de fechas
  (Desde/Hasta sobre `created_at` de la matrícula) reduce la lista de `deudoresVisibles()` a
  las filas cuya matrícula cae dentro del rango, incluyendo ambos extremos.
- **AC-2:** filtrar por tipo de curso (Clase B / Profesional) muestra sólo los deudores cuya
  matrícula pertenece a ese tipo de curso.
- **AC-3:** en `AdminPagosComponent`, la columna "Sede" aparece sólo cuando
  `selectedBranchId() === null` ("Todas las sedes"); al cambiar a una sede específica
  desaparece (no tiene sentido mostrar una columna con un solo valor posible).
- **AC-4:** los filtros son combinables entre sí (AND) y client-side sobre los datos ya
  cargados por `PagosFacade` — mismo patrón que `PagosRecientesDrawerComponent.pagosFiltrados()`.
- **AC-5:** limpiar los filtros (botón "Limpiar filtros", visible solo con algún filtro activo,
  o no aplicar ninguno) muestra la lista completa, igual que el comportamiento original.
- **AC-6:** sin regresión de paginación/"Cargar más" — los filtros se aplican ANTES de
  paginar/recortar (`deudoresVisibles()`), no después. Cambiar cualquier filtro vuelve a la
  página 1 para no quedar en una página fuera de rango.
- **AC-7:** la columna "Fecha Matrícula" es siempre visible (independiente del filtro de sede)
  en ambos componentes, mostrando `fechaMatricula` formateada (`dd-MM-yyyy`) o "—" si es null.

## Cambio

- **Archivo:** `src/app/core/models/ui/pagos.model.ts`
  - `AlumnoDeudor` gana `cursoTipo`, `cursoNombre`, `fechaMatricula`, `sedeId`, `sedeNombre` —
    campos derivados necesarios para los filtros y las columnas nuevas.
- **Archivo:** `src/app/core/facades/pagos.facade.ts`
  - `fetchAlumnosConDeuda()` amplía el `select()` con
    `created_at, branch_id, courses!inner(type, name), branches!inner(name)` y mapea los
    campos nuevos de `AlumnoDeudor`.
- **Archivo:** `src/app/features/admin/pagos/admin-pagos.component.ts`
  - Signals `filtroFechaDesde`, `filtroFechaHasta`, `filtroCurso` + setters que resetean
    `paginaDeudoresActual` a 1.
  - `computed()` `deudoresFiltrados()` (mismo patrón que
    `PagosRecientesDrawerComponent.pagosFiltrados()`), intercalado antes de `deudoresVisibles()`
    / `totalPaginasDeudores()` / `rangoDeudoresMostrando()` / `remainingDeudores()`.
  - `computed()` `mostrarColumnaSede()` (`selectedBranchId() === null`) — controla solo la
    columna, ya no un filtro.
  - `computed()` `hayFiltrosActivos()` + método `limpiarFiltros()`.
  - UI: fechas con `app-date-input`, select de curso vía `p-select`, botón "Limpiar filtros"
    condicional, columnas "Sede" (condicional) y "Fecha Matrícula" (siempre) en el grid
    (`.deudores-grid-cols` / `.deudores-grid-cols-sede`, ambas ampliadas +1 columna).
  - Método `fechaCorta()` (mismo patrón que `PagosRecientesDrawerComponent`).
- **Archivo:** `src/app/features/secretaria/pagos/secretaria-pagos.component.ts`
  - Mismo patrón que admin (fecha + curso + limpiar filtros + columna Fecha Matrícula), sin
    sede: ni filtro ni columna.

## Test de Regresión

- `src/app/core/facades/pagos.facade.spec.ts` — `fetchAlumnosConDeuda — mapeo de curso/fecha/sede (fix-248-m) > mapea cursoTipo, cursoNombre, fechaMatricula, sedeId y sedeNombre desde el join` ✓
- `src/app/features/admin/pagos/admin-pagos.component.spec.ts` — describe `AdminPagosComponent — filtros de deudores (fix-248-m)`: filtra por fecha/curso, combina con AND, aplica antes de paginar, resetea página al cambiar filtro, `mostrarColumnaSede` según sede activa, `limpiarFiltros`, `hayFiltrosActivos` ✓ (24/24 en el describe original + nuevo, 61 tests totales del módulo pagos)
- `src/app/features/secretaria/pagos/secretaria-pagos.component.spec.ts` — mismo set sin sede ✓ (19 tests)
- `npm run lint:arch` — 0 errores, 175 advertencias (baseline preexistente, sin regresión; se corrigió un ARCH-16 introducido por `btn-ghost text-sm` en el botón "Limpiar filtros", resuelto quitando `text-sm`)
- `npx tsc --noEmit` — 0 errores
- `/verify` (Playwright, admin@test.com): login OK, navegación a `/app/admin/pagos` sin errores de consola. Verificado en vivo con datos reales:
  - Filtro de curso (Clase B / Profesional) reduce la lista correctamente (ej. "0 de 24" en una sede sin Profesional, "24 de 24" en Clase B).
  - Filtro de fecha (vía calendario real, no `fill()` de texto) reduce correctamente ("0 de 24" con fecha futura).
  - Botón "Limpiar filtros" aparece solo con filtro activo y restaura la lista completa.
  - Columna "Sede" aparece/desaparece correctamente al cambiar entre "Todas las sedes" y una sede específica del topbar.
  - Columna "Fecha Matrícula" siempre visible con formato `dd-mm-aaaa`.

**Hallazgo fuera de alcance (no corregido en este fix):** overlap visual preexistente entre el
texto de "Saldo" y el botón "Ver detalle" en la tabla de deudores — confirmado que ocurre
también sin los cambios de este fix (con y sin columna Sede, con 6 o 7 columnas). No introducido
por este cambio; reportado al usuario para un fix aparte.
