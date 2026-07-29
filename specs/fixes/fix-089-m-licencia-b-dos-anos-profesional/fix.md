# Fix: Fecha de obtención de licencia B + advertencia de los 2 años (Profesional)
> id: fix-089-m-licencia-b-dos-anos-profesional
> refs: ASG-b-041
> status: open
> created: 2026-07-29

## Root Cause
[Heredado de ASG-b-041, a confirmar]: requisito legal para matricular en Clase
Profesional — el alumno debe tener al menos 2 años de licencia clase B. El wizard de
matrícula Profesional no pide la fecha de obtención de la licencia B ni advierte cuando
no se cumplen los 2 años. La columna `students.license_obtained_date` (DATE, nullable)
ya existe en el modelo (ver `indices/DATABASE.md`), junto con `current_license_class` —
no hace falta migración, falta pedir el dato en el wizard y usarlo.

El cliente fue explícito: **advertir, no bloquear** — la secretaría debe poder
matricular igual bajo su criterio.

Decisión ya confirmada con el owner (2026-07-28): los 2 años se cuentan **hasta la
fecha de inicio del curso**, no hasta la fecha de matrícula.

## ACs Afectados
Ninguno — fix autónomo derivado de Asignación de equipo, ver
`specs/assignments/ASG-b-041-licencia-b-dos-anos-profesional.md`.

## Alcance sugerido (de la Asignación)
- Campo de fecha (`<p-datepicker>`, no input nativo) en el wizard de matrícula
  Profesional, persistido en `students.license_obtained_date`.
- Cálculo de antigüedad contra la fecha de inicio del curso (no la fecha de matrícula).
- Advertencia clara y no bloqueante si no llega a los 2 años: debe decir cuánto le
  falta, no un genérico "no cumple requisitos".
- Dejar registro de quién matriculó a pesar de la advertencia (sugerido, no obligatorio
  — ver Notas).

## Cambio
_Pendiente de implementar._

## Verificación
_Pendiente._

## Test de Regresión
_Pendiente._

## Notas
- ⚠️ Coordinar con **ASG-b-035** (spec `0002-m-promociones-cadencia-automatica`, activa)
  — ambas tocan el wizard de matrícula Profesional. Como las reclamé yo mismo, no hay
  riesgo de choque entre personas, pero sí de pisarme el propio trabajo en curso: revisar
  el estado de esa spec antes de tocar el wizard.
- La advertencia es un mensaje de negocio con consecuencia legal: redactar el texto
  exacto, no improvisarlo.
- Archivos involucrados sugeridos: wizard de matrícula Profesional,
  `src/app/core/facades/enrollment.facade.ts`.
