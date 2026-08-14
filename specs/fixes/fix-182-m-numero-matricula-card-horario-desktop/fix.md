# Fix: Card de "Mi Horario" desktop mostraba Clase Nº en vez de N° de matrícula
> id: fix-182-m-numero-matricula-card-horario-desktop
> refs: fix-181-m-horario-desktop-rail-sin-domingo (corrige un malentendido de ese mismo cambio)
> status: done
> closed: 2026-08-14
> created: 2026-08-14

## Root Cause
En fix-181-m, al pedir el dueño "el número de matrícula del alumno" como dato principal de la
card, se interpretó erróneamente como `ScheduleBlock.classNumber` ("Clase Nº", 1-12 — qué sesión
es dentro del curso práctico). El dueño se refería al **número de matrícula** real:
`enrollments.number` (columna `UQ TEXT` en `indices/DATABASE.md`), el identificador único de la
matrícula del alumno — dato completamente distinto que la query de `instructor-horas.facade.ts`
ni siquiera traía de la base de datos.

Precedente de formato ya existente en el codebase: `admin-alumno-detalle.facade.ts` expone este
mismo campo como `matricula: lastEnrollment?.number ? '#' + lastEnrollment.number : '—'` — se
replica esa convención (`#<number>`) para consistencia.

## ACs Afectados
Ninguno — fix autónomo (corrección de un fix visual reciente, sin spec formal detrás).

## Cambio
- **Archivo:** `src/app/core/models/ui/instructor-portal.model.ts`
  - **Qué cambia:** agrega `enrollmentNumber: string | null` a `ScheduleBlock` (el N° de
    matrícula real, `enrollments.number`) — campo nuevo, distinto de `classNumber`.
- **Archivo:** `src/app/core/facades/instructor-horas.facade.ts`
  - **Qué cambia:** `fetchWeeklySchedule()` agrega `number` al `select()` anidado de
    `enrollments(...)` y mapea `enrollmentNumber: (row.enrollments as any)?.number ?? null`.
- **Archivo:** `src/app/shared/components/weekly-schedule-grid/weekly-schedule-grid.component.ts`
  - **Qué cambia:** la card vuelve a mostrar el N° de matrícula (`#{{ enrollmentNumber }}`) como
    dato principal (grande, arriba) — no "Clase Nº". `classNumber` se conserva pero baja al
    footer, junto al vehículo, sin desaparecer la información.

## Test de Regresión
Cambio de mapeo de datos (una columna más en un `select()` existente) + ajuste de template — sin
lógica condicional nueva que amerite test unitario. Verificación visual: `/verify` (Playwright)
confirmando que la card muestra `#<número de matrícula>` como dato principal y el nombre del
alumno debajo.
