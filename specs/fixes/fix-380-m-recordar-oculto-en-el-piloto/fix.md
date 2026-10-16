# Fix: "Recordar" dice que avisó a un alumno que no puede ver el aviso
> id: fix-380-m-recordar-oculto-en-el-piloto
> refs: fix-366-m-testing-asistencia-clase-b (H03, F09) · ASG-i-027 · fix-093-b · ASG-m-010
> status: done
> closed: 2026-10-12
> created: 2026-10-12

## Síntoma

Bloque 3 de `fix-366-m`, H03: "Recordar" responde "Recordatorio enviado al alumno" y guarda una
notificación in-app, pero el portal Alumno está bloqueado en el piloto, así que nadie la ve. El
texto además dice "Registramos **1 falta consecutivas**…" y llama "consecutivas" a faltas que no lo
son.

## Root Cause

- El botón no mira la fase piloto (`isBlockedInPilot('alumno')`).
- El mensaje usa siempre "consecutivas" y no concuerda en número.

## Fix

**Decisión de Matías (2026-10-12):** durante el piloto se oculta "Recordar"; la secretaria
contacta al alumno por teléfono.

- `AsistenciaClaseBFacade.recordatoriosHabilitados = !isBlockedInPilot('alumno')` (fuente única,
  como `fix-214-b` con los instructores). Admin y secretaria lo pasan al rail
  (`canRemind`), que deja de mostrar el botón cuando es `false`.
- Texto: "Registramos N falta(s) sin justificar en tus clases prácticas…", con número correcto.
  Queda listo para cuando se levante la fase.

## Acceptance Criteria

- [x] AC1 — En el piloto las alertas amarillas no muestran "Recordar" (admin y secretaria).
- [x] AC2 — El mensaje dice "1 falta sin justificar" / "2 faltas sin justificar".

## Regression Test

`asistencia-clase-b.facade.spec.ts` (`sendReminder`: texto) y verificación en navegador.

## Verificación (2026-10-12)

- `asistencia-clase-b.facade.spec.ts` 60/60 (texto "1 falta / 2 faltas sin justificar";
  `recordatoriosHabilitados` = false en el piloto).
- Admin → Asistencia: 6 alertas amarillas y 0 botones "Recordar". La secretaria pasa el mismo
  `[canRemind]="facade.recordatoriosHabilitados"`.