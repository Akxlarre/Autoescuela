# Asignación ASG-016 — Fix H-029: precio Profesional A2 muestra $180.000 en vez de $800.000

> **status:** pendiente
> **owner:** i
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-07-22
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Al matricular a un alumno en "Profesional A2" (wizard de secretaria o admin), el Paso 4 "Método de Pago y Descuentos" muestra "Valor Base del Curso: 180.000 $" — pero `supabase/migrations/20260301000010_09b_seed_data.sql` define `professional_a2` con precio base `800000`. El alumno queda matriculado con un saldo de $180.000 (el precio de Clase B), no los $800.000 esperados. Error de cobro real: si se replica en producción, la escuela facturaría 4.4× menos de lo que corresponde por cada matrícula profesional nueva.

## Alcance sugerido

- Investigar de dónde toma el precio el wizard de matrícula en el paso 4 para cursos Profesional — probablemente está tomando el `base_price` de la tabla/curso equivocado (¿confundiendo `class_b` con `professional_a2`, o tomando un valor hardcodeado/default de Clase B en vez de leer el precio real del curso seleccionado?).
- Confirmar el precio correcto contra el seed (`professional_a2` = $800.000) antes de escribir el fix.
- Verificar que matrículas Profesional YA CREADAS con el precio incorrecto (si las hay en producción) se identifiquen para corrección manual — fuera de scope del fix de código en sí, pero importante mencionarlo al cerrar.

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, hallazgo H-029.

## Notas para quien la reclame

- Prioridad alta por ser un error de cobro con impacto financiero directo, aunque técnicamente es "solo" un bug de UI/cálculo, no de seguridad.
