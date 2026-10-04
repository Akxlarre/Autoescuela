# Fix: Reprogramar no ofrece horarios que chocan con otra clase del alumno
> id: fix-299-m-reprogramar-no-ofrece-horarios-que-chocan-con-otra-clase-del-alumno
> refs: ASG-i-024
> status: done
> closed: 2026-10-04
> created: 2026-10-04

## Root Cause
Al reprogramar una clase desde la ficha, la grilla de horarios marca como ocupado lo que el
**instructor** ya tiene tomado (lo dice la vista `v_class_b_schedule_availability`) y los días en
que el alumno ya tiene 2 clases (`computeBlockedDates()`), pero no mira a qué **hora** tiene el
alumno sus otras clases. Si el alumno tiene la clase #2 a las 08:30 con un instructor, las 08:30
de otro instructor se ofrecen como disponibles para la clase #1 y la base lo acepta: el trigger
`trg_prevent_double_booking` solo impide el choque del instructor. Resultado posible: un alumno
con dos clases a la misma hora. Es `024b` S20 / F07, confirmada en navegador en la 3ª pasada de
`fix-264-m`. Es B42.

## ACs Afectados
- `024b` F07: un horario a la misma hora que otra clase vigente del alumno no se puede elegir.

## Cambio
- **Archivo:** `src/app/core/utils/reagendamiento.utils.ts` — `slotChocaConClases()`: función
  pura que dice si un horario se cruza con alguna de las clases dadas.
- **Archivo:** `src/app/core/facades/admin-alumno-detalle.facade.ts` — la grilla marca como
  ocupado todo horario que choca con una clase vigente del alumno (agendada, no cancelada ni
  inasistencia), sin contar la que se está moviendo. Aplica a reprogramar y al reagendamiento
  masivo, que usan la misma grilla.

No se agrega un trigger en la base: el choque por alumno entre dos sesiones simultáneas de
secretarías distintas sigue sin guarda atómica. Queda anotado en `fix-264-m`.

## Test de Regresión
- `reagendamiento.utils.spec.ts > slotChocaConClases() — fix-299-m` ✓
- `admin-alumno-detalle.facade.spec.ts > estado desde la matrícula — fix-263-m > la grilla de reprogramar marca ocupado el horario que choca con otra clase vigente del alumno (fix-299-m)` ✓
- `e2e/alumnos-b-ficha.spec.ts > tercera pasada > F07 (S20)` ✓ (falló antes del arreglo: las 08:30 se seguían ofreciendo)
