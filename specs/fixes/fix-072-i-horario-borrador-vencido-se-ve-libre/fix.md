# Fix: Los horarios de un borrador vencido se ven libres pero no se pueden tomar
> id: fix-072-i-horario-borrador-vencido-se-ve-libre
> refs: fix-058-i-testing-matricula-presencial (B5-1, caso H10)
> status: done
> closed: 2026-11-05
> created: 2026-11-03

## Root Cause

Hay dos definiciones de "horario ocupado" que no coinciden. `class_b_slot_occupied()`, que alimenta
la vista de disponibilidad, ignora las clases de un borrador vencido. Los triggers de choque del
instructor (fix-152/163) y del vehículo (fix-187) sí las cuentan. El horario se ofrece como libre y
al guardar falla con "El instructor ya tiene una clase agendada…".

Sin pago, dura hasta la limpieza nocturna. Con un pago vivo no tiene fecha de término: desde
`fix-069-i` la limpieza no toca ese borrador, y sus clases siguen ahí hasta que una persona lo
retome o lo descarte.

## ACs Afectados

Ninguno de una spec — caso H10 del checklist `specs/testing-piloto/026-agenda-triple-match.md`.

- **H10:** un horario tomado por un borrador vencido no se ofrece como libre.

## Cambio

- **Decisión (Ignacio, 2026-11-05):** opción A, mostrarlos ocupados. La vista pasa a contar lo
  mismo que los triggers. La opción contraria (que los triggers ignoren esas clases) dejaría dos
  clases en el mismo horario, y una de ellas sería de un alumno que ya pagó.
- **Fuera de alcance:** forzar un horario tomado por un borrador va en una spec aparte. Reglas ya
  acordadas: un borrador sin pago se puede forzar y suelta todas sus clases, y uno con pago no.
- **Archivo:** `supabase/migrations/20261103120000_fix072i_slot_ocupado_borrador_vencido.sql`, que
  redefine `public.class_b_slot_occupied()`.
- **Qué cambia:** se quita el filtro `e.status <> 'draft' OR e.expires_at > now()`, y con él el
  `JOIN` a `enrollments`, que solo servía para ese filtro.
- **Test:** `supabase/tests/agenda/fix-196-b-disponibilidad-rls.sql` repetía el filtro quitado.

## Consecuencia aceptada

En la Agenda ese horario queda como celda vacía: la vista ya no lo ofrece y la Agenda no carga
clases `reserved`. Es lo mismo que hoy pasa con un borrador vigente.

## Test de Regresión

- `supabase/tests/agenda/fix-072-i-borrador-vencido-ocupa.sql` ✓ F1, F2 y F3 (correr como postgres,
  con la migración aplicada)
- `supabase/tests/agenda/fix-196-b-disponibilidad-rls.sql` ✓ F1 a F5 (semana de Agenda: 219 ms)

Ignacio aplicó la migración y corrió ambos en el SQL Editor el 2026-11-05. No se probó en navegador:
el front no cambia y lee `slot_status` de la vista.

## Progreso

- [x] Ignacio aprueba la opción A y el SQL de la migración
- [x] Migración guardada en `supabase/migrations/`
- [x] Migración aplicada
- [x] Test de regresión y `fix-196-b-disponibilidad-rls.sql` corridos, sin `FALLA`
- [x] `indices/DATABASE.md` actualizado (`class_b_slot_occupied()`; la fila de la vista no menciona
  borradores)
