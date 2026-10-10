# Asignación ASG-i-060 — ¿Los reportes suman pagos que no están pagados?

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-10-10
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

**Sospecha no confirmada.** Al inventariar las lecturas de `payments` para `fix-044-i` (2026-10-09)
se vio que solo la Caja (`status IN ('paid','completado')`) y el trigger del saldo
(`status = 'paid'`) filtran por estado. El resto suma **todas** las filas:

- `pagos.facade.ts`: KPIs del día y del mes (`total_amount` con filtro de fecha y sede, sin estado) y
  el conteo; el listado excluye solo `pending`.
- `reportes-contables.facade.ts`, `dashboard.facade.ts` (recaudación del mes y del anterior),
  `dashboard-alerts.facade.ts` (conteo del día).
- Edge functions de reportes (`generate-financial-report`, `generate-payment-report`,
  `generate-cash-closing-report`) y RPC `exec_dashboard_*`: revisar.

`payments.status` admite al menos `paid`, `pending`, `partial` y `completado`. Si hay filas
`pending` (pagos de matrícula pública sin confirmar, borradores), esas pantallas muestran plata que
no entró. Además, la Caja suma `completado` y el saldo del alumno no: si existen pagos
`completado`, la Caja y el saldo no coinciden.

## Alcance sugerido

- **Paso 1, confirmar** con una consulta de solo lectura:
  `select status, count(*), sum(total_amount) from payments group by status;`
  Si todo es `paid`, cerrar como "no aplica hoy" y dejar anotado el riesgo para `ASG-i-059`.
- Si hay otros estados: decidir qué cuenta como plata recibida (¿`paid` + `completado`?) y aplicar el
  mismo criterio en todas las lecturas del inventario, la Caja y `recalculate_enrollment_balance()`.
- Idealmente, el criterio en un solo lugar (util compartido en la app, y una vista o función en la BD
  para las RPC/edge functions).

## Referencias

- `specs/fixes/fix-044-i-cuadratura-operaciones-fallan-en-silencio/fix.md` (§ Notes, "Fuera de alcance")
- `ASG-i-059` (anular pagos): depende del mismo inventario.

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/pagos.facade.ts`
- `src/app/core/facades/reportes-contables.facade.ts`
- `src/app/core/facades/dashboard.facade.ts`
- `src/app/core/facades/dashboard-alerts.facade.ts`

## Notas para quien la reclame

- El paso 1 es una sola consulta: hacerlo antes de estimar.
- Coordinar con quien tome `ASG-i-059`: comparten inventario y el mismo criterio de "pago que cuenta".
