# Hotfix: Badge de estado "cancelled" con severity inválido de PrimeNG
> id: hotfix-078-m-badge-cancelled-color-invalido
> refs: hotfix-077-m-badge-no-show-color-y-texto
> status: done
> closed: 2026-08-20
> created: 2026-08-20

## Problema
En "Mis Clases de Hoy" (instructor), el badge de una clase `cancelled` usa
`colorMap.cancelled = 'error'`, que no es un severity válido de `p-tag` en PrimeNG 21
(el enum real es `info | success | warn | danger | secondary | contrast`). Al no
matchear ninguna clase de color, cae al estilo default de `p-tag` (verde primario de
Aura) — una clase cancelada se ve del mismo verde que una completada.

## Cambios
- **Archivo:** `src/app/core/facades/instructor-clases.facade.ts` — `colorMap.cancelled`:
  `'error'` → `'danger'` (severity real de PrimeNG para rojo).

## Nota
`colorMap.in_progress = 'warning'` tiene el mismo problema (severity inválido, cae a
verde default) pero se deja fuera a pedido explícito: el panel ya tiene suficientes
indicadores visuales para una clase en curso más allá del color del badge.
