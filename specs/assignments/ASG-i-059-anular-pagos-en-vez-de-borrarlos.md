# Asignación ASG-i-059 — Anular pagos en vez de borrarlos

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** spec
> **priority:** P2
> **created:** 2026-10-10
> **created_by:** i
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Desde `fix-044-i` (ASG-i-048), quitar un pago de matrícula en la Caja es **solo del admin** y es un
`DELETE` real: el saldo lo recalcula `trg_update_balance` y el rastro queda en `audit_log`. Se eligió
así para cerrar el bug de plata sin un cambio grande antes del piloto.

Lo que no resuelve:

- El pago **desaparece** de la Caja y de la ficha del alumno. Si el alumno reclama ("yo pagué"), no
  se ve que ese pago existió ni por qué se quitó.
- No queda un **motivo**.
- El rastro existe, pero la vista **Auditoría solo lista acciones de secretarias**
  (`AuditoriaFacade`, `users!inner … roles.name='secretary'`); un borrado del admin solo se ve en la
  actividad reciente del dashboard.

Objetivo: que quitar un pago lo deje **anulado** (estado `anulado`, quién, cuándo y motivo), visible
tachado en la Caja y en la ficha del alumno, y que **no sume** en ningún total.

## Alcance sugerido

- Columnas de anulación en `payments` (quién, cuándo, motivo) y un estado `anulado`. Al pasar a
  `anulado`, `trg_update_balance` ya lo saca del saldo (suma solo `status = 'paid'`).
- **Inventario obligatorio antes de tocar nada:** hoy muchas lecturas suman `payments` **sin filtrar
  por estado**; un `anulado` se seguiría sumando ahí. Relevado el 2026-10-09:
  - App: `pagos.facade.ts` (KPIs de hoy/mes/conteo y listado, que solo excluye `pending`),
    `reportes-contables.facade.ts`, `dashboard.facade.ts`, `dashboard-alerts.facade.ts`,
    `admin-alumno-detalle.facade.ts`, `admin-alumnos.facade.ts`, `admin-alumnos-profesional.facade.ts`,
    `enrollment-payment.facade.ts`.
  - Edge functions: `generate-cash-closing-report`, `generate-financial-report`,
    `generate-payment-report`, `generate-enrollment-sheet`.
  - BD: RPC `exec_dashboard_*`, `get_student_payment_status`.
- La Caja lo muestra tachado con motivo y sin sumar; la ficha del alumno también.
- Que el bloqueo por día cerrado (`guard_movimiento_caja_cerrada`, DG-106) aplique también a anular.
- Decidir si la vista Auditoría debe mostrar también las acciones del admin sobre pagos.

## Referencias

- `specs/fixes/fix-044-i-cuadratura-operaciones-fallan-en-silencio/fix.md` (§ Decisiones)
- `ASG-i-060` (si las mismas lecturas ya suman pagos `pending` hoy): conviene resolverla primero o junto.

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/cuadratura.facade.ts`
- `src/app/core/facades/pagos.facade.ts`
- `src/app/core/facades/reportes-contables.facade.ts`
- Migración sobre `payments`

## Notas para quien la reclame

- Es `spec`, no `fix`: cambia el modelo de un pago y toca muchas pantallas.
- Si se olvida una sola lectura del inventario, un reporte suma plata que no existe: el inventario es
  la parte importante del trabajo.
