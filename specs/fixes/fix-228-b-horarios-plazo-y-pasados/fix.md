# fix-228-b — Horarios: los de hoy ya pasados se ofrecen y el plazo no llega al de la Agenda

- **Autor:** b
- **Origen:** ASG-i-026 (testing de la Agenda), sospechas S2 y S3 de `fix-186-b`. Decisiones del
  owner (2026-10-16): no ofrecer bloques que ya empezaron; ampliar los horarios al plazo de la Agenda.
- **Estado:** cerrado (2026-10-16)

## Bug

`v_class_b_schedule_availability`:

1. **S2** — genera los bloques desde el inicio del día de hoy: a las 10:00 todavía ofrece como
   "Disponible" el de las 08:30 (Agenda, matrícula presencial y online, reagendar).
2. **S3** — genera 28 días, pero la Agenda deja navegar 2, 3 o 4 meses (`AgendaSettingsService`,
   por defecto 3): desde la semana 5 no aparece ningún "Disponible" aunque el texto diga
   "hasta el 6 de enero".

## Criterios

- **H1** — Ningún bloque con `slot_start <= now()` aparece en la vista.
- **H2** — La vista cubre hasta hoy + 4 meses (el máximo que permite la Agenda).
- **H3** — Admin y secretaria leen la vista sin error (regla de fix-226-b) y sin bloques repetidos
  (fix-227-b).
- **H4** — Tiempo aceptable: medido el 2026-10-16 en producción con la vista nueva —
  una semana 140–250 ms, el plazo completo de un instructor 15–90 ms.

## Cambio

Migración `20261016150000_fix228_horarios_plazo_y_pasados.sql`: `CREATE OR REPLACE VIEW` (copia de
la de fix-227-b) con `generate_series` hasta hoy + 4 meses y el filtro de bloques futuros.

Test: `supabase/tests/agenda/fix-228-b-horarios-plazo-y-pasados.sql`. e2e: se quita el
`knownBug` S3 de `e2e/agenda.spec.ts` (C06).

## Verificación

- [x] Test en BEGIN…ROLLBACK con la migración: 4/4 (sin ella, 2 fallas: 34 bloques ya empezados ofrecidos y plazo de 28 días); fix-224/226/227-b en verde.
- [x] Migración aplicada en producción (aprobada por el owner con "dale con tus recomendaciones")
      + tests en verde (4/4, 5/5, 13/13, 3/3) + e2e de la Agenda 29/29 con C06 sin `knownBug`.
