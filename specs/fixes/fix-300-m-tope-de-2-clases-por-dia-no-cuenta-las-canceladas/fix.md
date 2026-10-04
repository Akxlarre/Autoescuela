# Fix: El tope de 2 clases por día no cuenta las clases canceladas
> id: fix-300-m-tope-de-2-clases-por-dia-no-cuenta-las-canceladas
> refs: ASG-i-024
> status: done
> closed: 2026-10-04
> created: 2026-10-04

## Root Cause
Al reprogramar o reagendar desde la ficha, `computeBlockedDates()` bloquea los días en que el
alumno ya tiene 2 clases, pero cuenta cualquier clase con fecha, también las canceladas. Un día
con una clase cancelada y una agendada aparecía completo, aunque el alumno solo tiene una clase
ese día. Observado en la 3ª pasada de `fix-264-m`.

Regla definida por Matías (2026-10-04): máximo 2 clases por día, contando solo las que debían
ocurrir. Las canceladas no cuentan; las inasistencias sí, porque la clase debía suceder y el
alumno no asistió.

## ACs Afectados
- `024b` F08: un día queda bloqueado cuando el alumno tiene en él 2 clases agendadas, completadas
  o con inasistencia; una clase cancelada no ocupa cupo.

## Cambio
- **Archivo:** `src/app/core/facades/admin-alumno-detalle.facade.ts`
- **Qué cambia:** `computeBlockedDates()` deja de contar las clases canceladas.

## Test de Regresión
- `admin-alumno-detalle.facade.spec.ts > estado desde la matrícula — fix-263-m > el tope de 2 clases por día no cuenta las canceladas, sí las inasistencias (fix-300-m)` ✓ (falló antes del arreglo)
