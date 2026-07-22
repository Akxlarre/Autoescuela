# Asignación ASG-009 — Fix H-013: Reportes Contables no cuenta pagos reales (descuadre financiero)

> **status:** pendiente
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P0
> **created:** 2026-07-22
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Ninguna secretaria puede cuadrar su caja del mes: "Pagos" y "Caja Diaria" muestran los ingresos reales de su sede, pero "Reportes Contables" (mismo rango, misma sede) muestra $0. Confirmado dos veces — con dato histórico y con una transacción fresca creada durante el audit (matrícula real vía Webpay). Como admin en "Ambas escuelas" el mismo pago SÍ aparece, pero bajo la categoría "Otros (Sede 0)" — el registro de ingreso no lleva un `branch_id` resoluble por el filtro de sede de Reportes, aunque Pagos y Alumnos sí lo resuelven bien.

## Alcance sugerido

- Localizar el pipeline de creación de pago (flujo público Webpay + flujo presencial) y confirmar por qué el `branch_id` no queda resoluble para el query de Reportes específicamente, cuando sí lo está para Pagos/Alumnos.
- Candidatos a revisar: `reportes-contables.facade.ts` (cómo resuelve sede al filtrar), la Edge Function/trigger que crea el registro de pago (¿escribe `branch_id` directo o lo deriva de la matrícula en el momento de leer?).
- Fuera de scope: no cambiar cómo Pagos/Alumnos resuelven sede — esos ya funcionan bien, son la referencia de "cómo debería ser".

## Referencias

- `indices/FLOWS-QA-AUDIT.md`, hallazgo H-013 — **el hallazgo más grave de la Fase 1-2 junto con H-016**, con evidencia histórica y fresca reproducida 2 veces.

## Notas para quien la reclame

- **Prioridad Crítica** — bloquea el cuadre financiero mensual de cualquier secretaria, para todo pago (no solo Webpay).
- Investigar con cuidado: puede ser un problema de escritura (el registro nunca tuvo `branch_id`) o de lectura (Reportes filtra sobre un campo distinto al que usan Pagos/Alumnos) — confirmar cuál antes de escribir el fix.
