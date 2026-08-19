# Fix: Clases reagendadas aparecen como Ausente/canceladas por asistencia vieja no archivada

> id: fix-191-m-reagendadas-asistencia-vieja-no-archivada
> refs: RF-053 (reagendamiento masivo de clases penalizadas, fix-008-i / fix-009-i)
> status: done
> closed: 2026-08-17
> created: 2026-08-17

## Root Cause

El reagendamiento masivo (`AdminAlumnoDetalleFacade.reagendarClasesPenalizadas()`) **recicla la
misma fila** de `class_b_sessions` (nuevo `scheduled_at`, `status = 'scheduled'`) y deja
deliberadamente intacta la fila de `class_b_practice_attendance` con `status = 'absent'/'no_show'`
de la ocurrencia anterior ("soft archive", comentario en `admin-alumno-detalle.facade.ts:1551`).

Ese comentario asume que todos los consumidores derivan el estado desde
`class_b_sessions.status`. Es falso: hay consumidores que derivan desde la asistencia, y la fila
de asistencia ya no tiene forma de saber que pertenece a una ocurrencia que ya no existe.

Consecuencias observadas y latentes:

1. **Asistencia B** — `mapPracticaStatus(sessionStatus, attendanceStatus)` cae a
   `attendanceStatus === 'absent'` y pinta **Ausente** una clase que está `scheduled`.
   (Agenda, Clases Actuales y Mi Horario la muestran agendada porque leen `sessions.status`.)
2. **KPIs y alertas de Asistencia B** — `fetchAlertas()` filtra por
   `class_b_sessions.status IN (VALID_…)`, que incluye `'scheduled'`: la falta ya reagendada
   sigue contando como falta consecutiva viva.
3. **Re-cancelación (el "canceladas" reportado)** — `apply_class_b_absence_penalty()` detecta el
   par consecutivo (N, N+1) mirando `class_b_practice_attendance` sin filtro de vigencia. Las
   faltas viejas nunca caducan, así que la próxima vez que se ejecute la penalización vuelve a
   cancelar las clases recién reagendadas.
4. **Vistas del alumno** — `student-clases` / `student-home` derivan el estado desde la
   asistencia: la clase reagendada le aparece al alumno como ausente.
5. **Cron nocturno** — `mark_end_of_day_class_b_absences()` inserta la nueva falta con
   `ON CONFLICT DO NOTHING`: si sobrevive la fila vieja, una inasistencia real a la clase
   reagendada **no se registra**.

Causa raíz única: **la asistencia no tiene marca de vigencia**, así que un registro histórico es
indistinguible del estado actual de la sesión.

## ACs Afectados

Ninguna spec formal — RF-053 vía fix-008-i/fix-009-i.

- El reagendamiento debe dejar la sesión en estado "agendada" **en todas las vistas**, no solo en
  las que leen `class_b_sessions.status`.
- La auditoría de la inasistencia original debe conservarse (historial de inasistencias del
  alumno, `reagendada: true`).

## Cambio

- **Archivo:** `supabase/migrations/20260817120000_class_b_attendance_archived_at.sql`
  - **Qué cambia:** agrega `class_b_practice_attendance.archived_at TIMESTAMPTZ`; backfill de las
    filas ya huérfanas (falta cuya sesión fue reciclada y hoy apunta a una fecha posterior);
    `apply_class_b_absence_penalty()` ignora asistencia archivada;
    `mark_end_of_day_class_b_absences()` reactiva (`DO UPDATE`) la fila archivada en vez de
    saltarla.
- **Archivo:** `src/app/core/facades/admin-alumno-detalle.facade.ts`
  - **Qué cambia:** al reagendar, marca `archived_at = now()` en la asistencia de las sesiones
    recicladas; el historial de inasistencias deriva `reagendada` de `archived_at`.
- **Archivo:** `src/app/core/facades/asistencia-clase-b.facade.ts`
  - **Qué cambia:** ignora asistencia archivada al mapear estado y al computar alertas; los
    upserts de asistencia limpian `archived_at`.
- **Archivos:** `src/app/core/facades/student-clases.facade.ts`,
  `student-home.facade.ts`, `instructor-clases.facade.ts`
  - **Qué cambia:** mismo filtro de vigencia al derivar estado / upsertar.

## Test de Regresión

- `src/app/core/facades/asistencia-clase-b.facade.spec.ts > mapea a pendiente una sesión scheduled
  cuya asistencia fue archivada por reagendamiento` ✓
- `src/app/core/facades/asistencia-clase-b.facade.spec.ts > excluye asistencia archivada de las
  alertas de faltas consecutivas` ✓
- `src/app/core/facades/admin-alumno-detalle.facade.spec.ts > recicla in-place tanto las sesiones
  no_show como las cancelled de la selección…` ✓ — ampliado: verifica que la asistencia se
  **archiva** (`update({archived_at})` + `is('archived_at', null)`) y **no** se borra.
- `src/app/core/facades/admin-alumno-detalle.facade.spec.ts > soft archive (RF-053): marca
  reagendada=true…` ✓ — ahora deriva de `archived_at`, no de `session.status !== 'no_show'`.

Suite completa: `npm run test:ci` → 2114 passed / 5 skipped, 0 failed.
`npm run lint:arch` → 0 errores (170 warnings preexistentes).

## Despliegue

La migración `20260817120000_class_b_attendance_archived_at.sql` fue aplicada a mano por Matías
en el SQL Editor de Supabase el 2026-08-17 (mismo canal por el que se aplicaron las funciones
RF-053) y verificada por él en la app. El backfill dejó las clases ya afectadas de vuelta en
"pendiente" en Asistencia B.

Gotcha derivado: `indices/DOMAIN-GOTCHAS.md` → DG-075.
