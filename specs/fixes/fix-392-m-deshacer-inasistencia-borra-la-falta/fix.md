# Fix: una inasistencia deshecha sigue figurando en la ficha del alumno, y su aviso no se entiende
> id: fix-392-m-deshacer-inasistencia-borra-la-falta
> refs: ASG-i-027 (observaciones de Matías tras el cierre) · fix-377-m · fix-379-m · fix-191-m · hotfix-152-m (reemplazado por este fix, sin cambios de código)
> status: done
> closed: 2026-10-13
> created: 2026-10-13

## Síntoma

1. La confirmación de "Deshacer inasistencia" dice "la falta pasa al historial" y "si esa falta ya
   canceló clases por penalización, esas clases no vuelven solas". Matías no entendió qué iba a
   pasar al confirmar.
2. Una falta marcada por error y deshecha sigue apareciendo en la lista de inasistencias de la
   ficha del alumno, etiquetada como "reagendada", aunque el alumno nunca faltó.
3. En "Clases Actuales" del dashboard, "No asistió" se pinta con el mismo gris que "Concluida".

## Root Cause

`fix-377-m` reutilizó el archivado de `fix-191-m` (pensado para reagendar una falta real) para
deshacer una falta marcada por error. La ficha deriva "reagendada" de `archived_at`, así que no
distingue una falta reagendada de una que nunca existió. El texto del aviso describía ese
mecanismo interno en vez de lo que le pasa a la clase.

## Fix

**Decisión de Matías (2026-10-13):** deshacer una inasistencia **borra** la falta. No queda rastro
en la ficha. Sin migración: admin y secretaria ya tienen política de borrado sobre
`class_b_practice_attendance` y ninguna tabla la referencia (verificado en la BD de dev).

- `AsistenciaClaseBFacade.undoAbsence()` borra la falta vigente en vez de archivarla.
- Texto nuevo de la confirmación y de los avisos de clases que siguen canceladas (también el de
  justificar, en Asistencia y en la ficha).
- "Clases Actuales": la falta sin justificar va en color de error; "Justificada" y "Concluida"
  siguen en gris.

Las faltas que ya se deshicieron con el mecanismo anterior quedan archivadas (se ven como
"reagendada" en la ficha). No se tocan: no hay forma de distinguirlas de un reagendamiento real.

## Acceptance Criteria

- [x] AC1 — Deshacer una falta sin justificar la borra y deja la clase "Pendiente". Una falta
      justificada sigue sin poder deshacerse.
- [x] AC2 — La falta deshecha no aparece en la lista de inasistencias de la ficha del alumno.
- [x] AC3 — La confirmación explica en lenguaje llano qué pasa con la clase, sin mencionar
      "historial" ni "penalización". Menciona las clases canceladas **solo si las hay**, con su
      número (observación de Matías: la cancelación automática depende de Ajustes; con ella
      apagada nunca hay clases canceladas y nombrarlas confunde).
- [x] AC4 — En "Clases Actuales", "No asistió" (sin justificar) se ve en color de error;
      "Justificada" y "Concluida" en gris.

## Regression Test

- `asistencia-clase-b.facade.spec.ts` → `undoAbsence`
- `live-classes-panel.component.spec.ts` → `isUnexcusedAbsence`
- `e2e/asistencia-clase-b.spec.ts` → `E07 (fix-377-m · fix-392-m)`

## Verificación (2026-10-13)

- Unit: los tres specs afectados en verde (190 tests). `lint:arch` y `tsc` sin errores.
- E2E `E07` (secretaria de la sede, dashboard): "No asistió" con `text-error` y "Concluida" con
  `text-text-muted`; la confirmación muestra el texto nuevo (sin hablar de cancelaciones, porque
  no hay ninguna); tras "Deshacer" la clase queda
  `scheduled` y la BD no conserva ninguna asistencia de esa clase (AC2: la ficha lee de esa tabla).
  Confirma además que la política de borrado alcanza a la secretaria, sin migración.
- Captura revisada del panel y del modal.
