# Hotfix: el detalle de una clase en la Agenda tiene "Ver ficha del alumno"
> id: hotfix-095-b-agenda-ver-ficha
> refs: ASG-i-026 (checklist 026, E11; decisión del owner 2026-10-19)
> status: closed
> created: 2026-10-19

## Problema
El detalle de una clase en la Agenda es solo lectura y no lleva a ningún lado: para reprogramar o
ver al alumno hay que buscarlo a mano en Base Alumnos. Decisión: un atajo "Ver ficha del alumno".

## Cambios
- **Archivo:** `src/app/core/facades/agenda.facade.ts` (+ spec) — la consulta de sesiones trae
  `enrollments.student_id`; el slot expone `studentId`.
- **Archivo:** `src/app/core/models/ui/agenda.model.ts` — `AgendaSlot.studentId`.
- **Archivo:** `src/app/core/utils/agenda-week.utils.ts` (+ spec) — `studentFichaUrl(url actual,
  studentId, enrollmentId)`: `/app/{admin|secretaria}/alumnos/:id?enrollment=…` según el portal.
- **Archivo:** `src/app/features/agenda/agenda-slot-detail-drawer.component.ts` — botón "Ver ficha
  del alumno" (solo en clases con alumno); cierra el drawer y navega.

## Verificación
- [x] vitest del util y del facade.
- [x] e2e: abrir una clase agendada en la Agenda → "Ver ficha del alumno" → ficha de ese alumno.
