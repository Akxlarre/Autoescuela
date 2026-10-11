# Fix: se puede iniciar una clase con un vehículo que ya está en otra clase en curso
> id: fix-376-m-vehiculo-en-dos-clases-en-curso
> refs: fix-366-m-testing-asistencia-clase-b (C06) · ASG-i-027 · 0001-i
> status: done
> closed: 2026-10-11
> created: 2026-10-11

## Síntoma

Bloque 2 de `fix-366-m`, C06: la clase de ayer de E2E-AsisColgada quedó `in_progress` con BBCD12
(nadie la finalizó). Hoy se inició otra clase eligiendo BBCD12 y quedaron dos clases en curso con
el mismo vehículo.

## Root Cause

`prevent_concurrent_in_progress_class_b_sessions()` (spec 0001-i) solo impide dos clases en
curso del mismo **instructor**. Para el vehículo solo existe el choque de horarios agendados
(`trg_prevent_vehicle_double_booking`), que no mira clases en curso de otro horario.

## Fix

**Decisión de Matías (2026-10-11):** bloquear igual que con el instructor, con el mensaje
"El vehículo está en una clase en curso (DD-MM, HH:MM); finalízala antes".

Migración `20261011140000_fix376_vehiculo_una_clase_en_curso.sql`: la misma función agrega el
chequeo por `vehicle_id` (el de `NEW`, así cubre también el cambio de vehículo al iniciar). La
fecha y hora del mensaje son las de la clase que lo tiene ocupado, en hora de Chile.

## Acceptance Criteria

- [x] AC1 — Iniciar con un vehículo que tiene otra clase `in_progress` se rechaza con el mensaje
      que indica la fecha y hora de esa clase.
- [x] AC2 — Iniciar con un vehículo libre sigue funcionando; el chequeo del instructor no cambia.
- [x] AC3 — El mensaje aparece en el drawer de Iniciar (Asistencia y Dashboard).

## Regression Test

`supabase/tests/asistencia/fix-376-m-vehiculo-una-clase-en-curso.sql` (aborta siempre).

## Verificación (2026-10-11)

Matías aplicó la migración. `supabase/tests/asistencia/fix-376-m-…sql` contra la BD de dev:
`RESULTADO fix-376-m: TODO OK` (vehículo ocupado rechazado con "El vehículo está en una clase en
curso (10-10, 03:15); finalízala antes.", también al cambiar de vehículo en el mismo UPDATE;
vehículo libre OK; el chequeo del instructor sigue). Antes de aplicar daba FALLA en AC1.
Navegador como secretaria: con la clase de las 21:30 en curso con ABCD43, iniciar la de las 13:30
(otro instructor) eligiendo ABCD43 → el drawer muestra "El vehículo está en una clase en curso
(11-10, 21:30); finalízala antes." y queda abierto. Datos restaurados con "Cancelar inicio".

## Despliegue

Migración: la aplica Matías.
