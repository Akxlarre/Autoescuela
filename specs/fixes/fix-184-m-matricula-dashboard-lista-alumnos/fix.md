# Fix: N° de matrícula en dashboard y lista de alumnos del instructor + apellido materno
> id: fix-184-m-matricula-dashboard-lista-alumnos
> refs: fix-182-m-numero-matricula-card-horario-desktop, fix-183-m-numero-matricula-card-horario-mobile
> status: done
> closed: 2026-08-14
> created: 2026-08-14

## Root Cause
El dueño pidió extender el criterio de "N° de matrícula como dato principal" (ya aplicado en
Mi Horario, fix-182/183-m) al resto de vistas del portal instructor donde aparece el nombre de un
alumno, y detectó dos huecos adicionales de datos:

1. `InstructorClassRow` (usado en "Mis Clases de Hoy" del dashboard) no traía `enrollments.number`
   — mismo hueco que tenía `ScheduleBlock` antes de fix-182-m, en un facade distinto
   (`instructor-clases.facade.ts`).
2. `InstructorStudentCard` (lista "Mis Alumnos") tampoco traía `enrollments.number`, y ninguna de
   las dos consultas (`instructor-clases.facade.ts`, `instructor-alumnos.facade.ts`) seleccionaba
   `maternal_last_name` de `users` — el nombre mostrado siempre omitía el apellido materno.
3. La columna "Curso" de la lista de alumnos es dead weight: los alumnos de un instructor son
   siempre Clase B (confirmado por el dueño), así que la columna no aporta ninguna variación útil.

## ACs Afectados
Ninguno — fix autónomo (extensión de fix-182-m/fix-183-m a más vistas).

## Cambio
- **Archivo:** `src/app/core/models/ui/instructor-portal.model.ts`
  - **Qué cambia:** agrega `enrollmentNumber: string | null` a `InstructorClassRow` y a
    `InstructorStudentCard`.
- **Archivo:** `src/app/core/facades/instructor-clases.facade.ts`
  - **Qué cambia:** `fetchTodayClasses()` y `loadClassDetail()` agregan `number` al `enrollments`
    anidado y `maternal_last_name` al `users` anidado; `mapSessionToRow()` mapea
    `enrollmentNumber: row.enrollments?.number ?? null` y arma `studentName` con los 3 apellidos.
- **Archivo:** `src/app/core/facades/instructor-alumnos.facade.ts`
  - **Qué cambia:** `fetchStudents()` agrega `number` al `enrollments` seleccionado y
    `maternal_last_name` a `users`; mapea `enrollmentNumber: row.number ?? null` y arma `name`
    con los 3 apellidos.
- **Archivo:** `src/app/features/instructor/dashboard/instructor-dashboard.component.ts`
  - **Qué cambia:** en "Mis Clases de Hoy" (mismo template para desktop y mobile — layout
    responsive, sin duplicación), el N° de matrícula pasa a ser el dato principal (donde antes
    iba `cls.studentName`), y el nombre baja a dato secundario debajo.
- **Archivo:** `src/app/features/instructor/alumnos/instructor-alumnos.component.ts`
  - **Qué cambia:** la columna "Curso" de la tabla desktop (y su equivalente en las cards mobile)
    se reemplaza por "N° Matrícula" (`#{{ enrollmentNumber }}`).

## Test de Regresión
Cambio de mapeo de datos (columnas adicionales en `select()`s ya existentes) + templates — sin
lógica condicional nueva que amerite test unitario nuevo. Verificación visual: `/verify`
(Playwright) confirmando que el dashboard y la lista de alumnos muestran `#<N° de matrícula>`,
apellido materno en los nombres, y que la columna "Curso" ya no aparece en la lista de alumnos.
