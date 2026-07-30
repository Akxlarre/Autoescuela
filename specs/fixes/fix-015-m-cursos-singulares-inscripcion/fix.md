# fix-015-m — Cursos Singulares: UX de inscripción + sanitización de errores

## Contexto

Auditoría del módulo Cursos Singulares (RF-035) detectó tres problemas en el flujo
"Inscribir Alumno" del drawer (`admin-curso-singular-inscribir-drawer.component.ts`
+ `cursos-singulares.facade.ts`):

## Bugs

### BUG-1 — UX: la búsqueda por RUT parece obligatoria-excluyente
El paso 1 exige buscar un RUT antes de mostrar el formulario, sin explicar que
la búsqueda es solo para pre-cargar datos de alumnos ya registrados (Clase B /
Profesional). Da la impresión de que **solo** se pueden inscribir alumnos ya
existentes, cuando el caso más común es un alumno totalmente nuevo.

### BUG-2 — Errores crudos de BD expuestos al usuario
El facade hace `this._error.set('Error al actualizar alumno: ' + error.message)`
(y variantes en 6+ puntos). Los mensajes de PostgreSQL (nombres de columnas,
constraints) llegan tal cual a la UI. Reportado por usuario real: al matricular
un RUT existente vio el error de la columna `birth_date`.

### BUG-3 — Causa raíz del error de `birth_date` (pérdida de datos)
- `students.birth_date` es `DATE NOT NULL` + CHECK edad ≥ 17 (migración
  `20260301000001`), pero el wizard trata la fecha de nacimiento como opcional.
- `searchByRut()` NO trae `birth_date`/`gender`/`address` del alumno existente,
  y `upsertStudent()` hace UPDATE con `birth_date: form.birthDate || null` →
  **inscribir a un alumno existente siempre viola el NOT NULL** y además
  habría sobrescrito sus datos reales con null/defaults.
- Cálculo de edad incorrecto (`getFullYear()` diff, sin mes/día) duplicando mal
  el util existente `calcAge()` de `core/utils/age.utils.ts`.
- El check de duplicado corre DESPUÉS de los upserts → muta datos del usuario
  aunque la inscripción sea rechazada.

## Acceptance Criteria

- [x] AC1: El paso 1 explica que la búsqueda por RUT pre-carga datos si el alumno
  ya existe, y que un alumno nuevo se registra en el mismo formulario.
- [x] AC2: Ningún mensaje de error visible en la UI contiene texto crudo de
  PostgreSQL/Supabase (columnas, constraints, códigos). Los errores se loguean
  a consola y la UI muestra mensajes amigables en español.
- [x] AC3: Inscribir un alumno con RUT ya registrado pre-carga TODOS sus datos
  (incl. fecha de nacimiento, género, dirección, apellido materno) y no
  sobrescribe datos existentes con valores vacíos.
- [x] AC4: Fecha de nacimiento es requerida en el formulario, con validación
  de edad ≥ 17 años (espejo del CHECK de BD) y mensaje claro.
- [x] AC5: El check de inscripción duplicada corre ANTES de cualquier escritura.
- [x] AC6: Tests del facade (`cursos-singulares.facade.spec.ts`) cubren la
  sanitización de errores y la no-sobrescritura de datos.

## Test de regresión

`src/app/core/facades/cursos-singulares.facade.spec.ts`
`src/app/core/utils/db-error.utils.spec.ts`
