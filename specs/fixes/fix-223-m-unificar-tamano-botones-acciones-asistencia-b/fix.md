# Fix: Unificar tamaño de botones "Ausente" y "Finalizar" con "Iniciar" en Asistencia B

> id: fix-223-m-unificar-tamano-botones-acciones-asistencia-b
> refs: fix-222-m-botones-acciones-poco-visibles-asistencia-b
> status: done
> closed: 2026-08-25
> created: 2026-08-25

## Root Cause

`fix-222-m` le dio affordance de botón a "Ausente" (`btn-danger-ghost btn-sm`) y ya existía
"Finalizar" (`btn-success-soft btn-sm`), pero ambos usan las utilidades `btn-*` genéricas del DS
(con su propio padding/radius), mientras que "Iniciar" usa un estilo inline propio (`px-2.5 py-1
rounded-lg`, sin las utilidades `btn-*`). Resultado: en la misma fila, "Iniciar" (pendiente) y
"Ausente" quedan con tamaño/padding visiblemente distinto — reportado por el usuario. Mismo caso
para "Finalizar" junto al indicador "En clase".

## ACs Afectados

Ninguno — fix autónomo (hallazgo visual reportado por el usuario).

## Cambio

- **Archivo:** `src/app/shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.ts`
  - "Ausente": mismas clases exactas que "Iniciar" (`text-xs font-semibold px-2.5 py-1 rounded-lg
    border transition-colors flex items-center gap-1 cursor-pointer`) cambiando solo el color:
    `text-error border-error bg-error/10` en vez de `text-brand border-brand bg-brand/10`.
  - "Finalizar": mismo patrón, con `text-success border-success bg-success/10`.
  - "Justificar" y "Ver motivo" (agregado a pedido del usuario antes de cerrar el fix, mismo
    problema de tamaño inconsistente que traían de `fix-222-m` con `btn-secondary btn-sm`): mismo
    patrón de clases base, con color neutro `text-text-secondary border-border-default bg-subtle`
    (no son acciones positivas/negativas como Iniciar/Ausente/Finalizar, son de solo lectura).
  - Los 5 botones (`Iniciar`, `Ausente`, `Finalizar`, `Justificar`, `Ver motivo`) dejan de usar
    las utilidades `btn-*` + `btn-sm` para quedar dimensionalmente idénticos entre sí (mismo
    padding, radius, tamaño de texto) — solo cambia el color según semántica.

## Test de Regresión

Cambio puramente visual (clases CSS) — no aplica test automatizado según
`.claude/rules/testing-tdd.md`. Verificado con Playwright MCP contra la vista real: los 5
botones ("Iniciar", "Ausente", "Finalizar", "Justificar", "Ver motivo") comparten exactamente el
mismo padding/radius/tamaño de texto, solo difieren en el color según semántica (azul/rojo/verde/
gris neutro). `npx tsc -p tsconfig.app.json --noEmit` limpio.
