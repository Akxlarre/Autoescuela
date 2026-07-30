# Hotfix: Slim Hero — título line-clamp-2 + botones siempre visibles en mobile
> id: hotfix-008-b-slim-hero-title-wrap-buttons-always-visible
> status: done
> closed: 2026-06-18
> created: 2026-06-18

## Problema
1. El h1 del slim hero tiene `truncate` (1 línea fija) — en móvil a 446px el título largo
   tipo "¡Bienvenido, PEPITO ADMIN!" queda cortado con "...".
2. Las acciones secundarias (Agenda, Pagos) tienen `hiddenOnMobile: true` del fix-026.
   Con el nuevo layout flex-col (hotfix-006), el slot RIGHT tiene su propia fila en mobile
   con flex-wrap, así que ya no es necesario ocultar botones — simplemente wrappean.

## Cambios
- **Archivo:** `src/app/shared/components/section-hero/section-hero.component.ts`
  — Cambiar clase h1 slim de `truncate` a `line-clamp-2` (permite 2 líneas antes de ellipsis)
- **Archivo:** `src/app/features/dashboard/dashboard.component.ts`
  — Remover `hiddenOnMobile: true` de las acciones "Agenda" y "Pagos"
