# fix-227-b — Horarios duplicados para un instructor "Ambas sedes"

- **Autor:** b
- **Origen:** ASG-i-026 (testing de la Agenda), hallazgo H4 / sospecha S19 de `fix-186-b`.
- **Estado:** abierto — esperando aprobación del owner para aplicar la migración

## Bug

`v_class_b_schedule_availability` arma los bloques por sede (`course_slots`) y une al instructor
con los bloques de **cada** sede que cubre. Un instructor "Ambas sedes" con un vehículo "Ambas"
recibe una fila por sede para el mismo bloque: si las dos sedes tienen el mismo horario, el mismo
turno aparece **dos veces** (simulado el 2026-10-16: 65 duplicados en 7 días). La matrícula, la
Agenda y el reagendar muestran el horario repetido y se puede elegir dos veces el mismo.

Hoy no hay instructores ni vehículos "Ambas" en el piloto: el bug está latente.

## Criterios

- **D1** — Un instructor "Ambas" con vehículo "Ambas" tiene una sola fila por bloque.
- **D2** — El estado (`available` / `occupied`) no cambia: el choque ya es global (fix-196-b).
- **D3** — Instructor y vehículo de una sola sede: mismas filas que antes.
- **D4** — Admin y secretarias leen la vista sin error (regla de `fix-226-b`).

## Cambio

Migración `20261016140000_fix227_horarios_ambas_sin_duplicados.sql`: `CREATE OR REPLACE VIEW`
(copia de la de fix-224-b) con `SELECT DISTINCT` en la salida final. `security_invoker` y
comentario se conservan.

Test: `supabase/tests/agenda/fix-227-b-horarios-ambas-sin-duplicados.sql` (sub-bloque que aborta;
lee como `postgres` y como secretaria).

## Verificación

- [x] Test en BEGIN…ROLLBACK con la migración: 5/5 (2 fallas sin ella); fix-224-b 13/13 y fix-226-b 3/3; tiempo de la vista sin regresión (semana 92 ms, por instructor 23 ms).
- [ ] Migración aplicada en producción (requiere aprobación del owner) + tests en verde
      (este, fix-224-b, fix-226-b) + e2e de la Agenda.
