# Hotfix: Colores de "Cancelada" y "En curso" en horario semanal — corrección de seguimiento a hotfix-079
> id: hotfix-080-m-leyenda-horario-colores-cancelada-y-en-curso
> refs: hotfix-079-m-leyenda-horario-semanal-colores-y-estado-faltante
> status: done
> closed: 2026-08-20
> created: 2026-08-20

## Problema
Tras hotfix-079, el usuario detectó visualmente en la leyenda:

1. **"En curso" y "No asistió" se ven del mismo color** — ambos quedaron con
   `borderColor: var(--state-warning)` (hotfix-079 solo le asignó ámbar a `no_show` sin
   notar que `in_progress` ya usaba ese mismo token de antes). Además, semánticamente
   ámbar (advertencia) no representa bien "en curso", que es un estado neutro/positivo.
2. **"Cancelada" se ve gris casi invisible, no roja** — en hotfix-079 se dejó
   `cancelled.borderColor: var(--border-subtle)` a criterio propio, pero el pedido
   original del usuario ("no show debe ser rojo al igual que cancelada, esencialmente
   representan lo mismo") sí pedía rojo para `cancelled`. Fue un error de alcance no
   aplicarlo.

Confirmado con el usuario:
- `cancelled.borderColor` → rojo (`var(--state-error)`).
- `in_progress.borderColor` → azul distinto del de `scheduled` (que ya usa
  `var(--color-primary)`), para no volver a chocar colores en la leyenda. Se usa
  `var(--state-info)` (azul más oscuro/desaturado, mismo family "activo/informativo"
  pero perceptualmente distinguible del brand blue de `scheduled`).

## Cambios
- **Archivo:** `src/app/core/utils/schedule-status.utils.ts`
  — `getStatusVisual('cancelled')`: `borderColor: 'var(--border-subtle)'` → `'var(--state-error)'`.
  — `getStatusVisual('in_progress')`: `borderColor: 'var(--state-warning)'` → `'var(--state-info)'`.
