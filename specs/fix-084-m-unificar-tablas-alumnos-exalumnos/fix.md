# Fix: Unificar diseño de tablas Base Alumnos y Ex-Alumnos (B y Profesional)
> id: fix-084-m-unificar-tablas-alumnos-exalumnos
> refs: —
> status: done
> closed: 2026-07-27
> created: 2026-07-27

## Root Cause
Las tablas de "Ex-Alumnos" (Clase B y Profesional) se implementaron con un diseño propio,
distinto al de "Base Alumnos": el RUT vive debajo del nombre en vez de ser columna propia,
no muestran correo ni Nº de Expediente/Matrícula, y solo tienen el botón "Re-matricular"
(sin acceso al detalle del alumno, que sí existe — `AdminAlumnoDetalleComponent` — pero no
estaba enlazado desde esta vista). Además, la Base Alumnos (B y Profesional) no excluye a
los alumnos con matrícula `completed` ("Finalizado"), por lo que un mismo alumno egresado
aparece simultáneamente en Base Alumnos y en Ex-Alumnos.

## ACs Afectados
Ninguno — fix autónomo (no hay spec previa que documente el diseño de Ex-Alumnos).

- AC-1 (corregido tras QA visual del dueño): Ex-Alumnos (B y Profesional) usa **literalmente
  el mismo diseño** que Base Alumnos — mismo toolbar (buscador + selects), misma tabla
  `p-table` con paginador PrimeNG, mismos avatares circulares con iniciales, mismo `p-tag`
  para estados, mismos botones de acción tipo ícono redondo, mismas tarjetas mobile con
  "Cargar más". Solo cambia el contenido de las columnas (RUT, Correo, Nº Exp./Matrícula,
  Licencia, Año/Sede, Estado cuenta) y las acciones (Ver detalle + Re-matricular, ambos como
  íconos redondos, no como pills custom).
- AC-2: Ex-Alumnos (B y Profesional) tiene un botón "Ver detalle" que navega a la misma
  ficha de alumno usada en Base Alumnos (`<basePath>/alumnos/:id`), además de mantener
  "Re-matricular".
- AC-3: Un alumno con estado `Finalizado` (enrollment `completed`) deja de listarse en
  Base Alumnos (B y Profesional) — solo aparece en Ex-Alumnos.
- AC-4: El filtro de "Estado" en Base Alumnos (B y Profesional) deja de ofrecer la opción
  "Finalizado", ya que nunca habrá resultados para ese valor.
- AC-5 (corrección 2): el Correo NO es columna propia — va debajo del nombre en la celda
  "Alumno", igual que en Base Alumnos (AC-1 se ajusta: columnas propias son solo RUT y
  Nº Exp./Matrícula).
- AC-6 (corrección 2): el botón "volver" en la ficha de detalle de un alumno que llegó desde
  Ex-Alumnos debe apuntar al listado de Ex-Alumnos correspondiente (B/Profesional,
  admin/secretaria), no a Base Alumnos — se propaga vía queryParam `?from=ex-alumnos` en el
  routerLink de "Ver ficha".

## Cambio
- **`core/models/ui/egresado-table.model.ts`:** agrega `studentId`, `correo`, `nroExpediente`.
- **`core/facades/ex-alumnos.facade.ts`:** query trae `students.id`, `users.email` y
  `enrollments.number`; `mapRow` los expone en `EgresadoTableRow`.
- **`features/admin/alumnos/ex-alumnos/admin-ex-alumnos.component.ts`** y
  **`features/secretaria/ex-alumnos/secretaria-ex-alumnos.component.ts`:** reescritos para
  usar el mismo patrón visual que `alumnos-list-content.component.ts` — toolbar (buscador +
  select de año), `p-table` con paginador, avatar circular con iniciales, `p-tag` de estado
  de cuenta, botones de acción tipo ícono redondo (Ver ficha + Re-matricular), tarjetas mobile
  con "Cargar más" (`sliceByBudget`).
- **`shared/components/ex-alumnos-profesional-content/ex-alumnos-profesional-content.component.ts`:**
  mismo rediseño (toolbar + `p-table` + tarjetas + "Cargar más") + input `basePath` para el
  link de detalle (admin vs secretaria).
- **`features/secretaria/ex-alumnos-profesional/secretaria-ex-alumnos-profesional.component.ts`:**
  pasa `basePath="/app/secretaria"`.
- **`core/facades/admin-alumnos.facade.ts`:** filtra fuera de `_alumnos` las filas con
  `status === 'Finalizado'`.
- **`core/facades/admin-alumnos-profesional.facade.ts`:** `ENROLLED_STATUSES` deja de incluir
  `'completed'`.
- **`shared/components/alumnos-list-content/alumnos-list-content.component.ts`** y
  **`shared/components/alumnos-profesional-list-content/alumnos-profesional-list-content.component.ts`:**
  quitan la opción "Finalizado" del filtro de Estado.
- **Correción 2** — Correo bajo el nombre (no columna propia) en las 3 tablas de Ex-Alumnos
  (admin B, secretaria B, Profesional compartido); columnas quedan en Alumno/RUT/Nº
  Exp.·Mat./Licencia/Año-Sede/Estado cuenta/Acciones.
- **Corrección 2** — `admin-alumno-detalle.component.ts`: `resolveListadoRoute`/
  `resolveListadoLabel` reciben `cameFromExAlumnos` (leído de `?from=ex-alumnos` en la URL);
  los 3 botones "Ver ficha" de Ex-Alumnos ahora navegan con `[queryParams]="{ from:
  'ex-alumnos' }"`.

## Test de Regresión
- `core/facades/admin-alumnos.facade.spec.ts` — un alumno con enrollment `completed` no
  aparece en `alumnos()`.
- `core/facades/admin-alumnos-profesional.facade.spec.ts` — un enrollment `completed` no
  aparece en `alumnos()`.
- `core/facades/ex-alumnos.facade.spec.ts` — `egresadosClaseBList()` /
  `egresadosProfesionalList()` exponen `studentId`, `correo` y `nroExpediente`.
- `features/admin/alumno-detalle/admin-alumno-detalle.component.spec.ts` —
  `resolveListadoRoute`/`resolveListadoLabel` con `cameFromExAlumnos=true` apuntan a
  Ex-Alumnos (B/Profesional, admin/secretaria).
