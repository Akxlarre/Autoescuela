# Fix: Botones de Acciones sin affordance visible en Asistencia B ("Ver motivo" y marcar inasistencia)

> id: fix-222-m-botones-acciones-poco-visibles-asistencia-b
> refs: fix-221-m-alineacion-acciones-consistente-asistencia-b
> status: done
> closed: 2026-08-25
> created: 2026-08-25

## Root Cause

Al revisar la alineación de la columna Acciones (`fix-219/220/221-m`), el usuario notó que 2
elementos no se leen como botones clickeables:

1. **"Ver motivo"** usa `.btn-ghost` (`asistencia-clase-b-content.component.ts:618`), que por
   diseño es transparente en reposo (`--btn-ghost-bg: transparent`, solo muestra fondo al hover)
   — se ve como texto plano, no como botón.
2. **Marcar inasistencia** (icono "x-circle" solo) usa un botón sin borde ni fondo propio
   (`p-1.5 rounded-md ... text-error`, línea 566-578) — un ícono suelto sin affordance,
   especialmente notorio al lado de "Iniciar" (que sí tiene borde + fondo tintado visibles).

## ACs Afectados

Ninguno — fix autónomo (hallazgo visual reportado por el usuario).

## Cambio

- **Archivo:** `src/app/shared/components/asistencia-clase-b-content/asistencia-clase-b-content.component.ts`
  - "Ver motivo": `btn-ghost btn-sm` → `btn-secondary btn-sm` (borde + fondo visibles en reposo,
    mismo estilo que "Cancelar" en el resto de la app — acción neutra de solo lectura).
  - "Justificar" (mismo problema, misma causa, no pedido explícitamente pero corregido en el
    mismo cambio): `btn-ghost btn-sm` → `btn-secondary btn-sm`.
  - "Marcar inasistencia": pasa de ícono solo a botón con label + ícono, usando `btn-danger-ghost
    btn-sm` (mismo estilo que los botones "Eliminar" existentes en otras tablas). Label final:
    **"Ausente"** (no "Marcar ausente" como se propuso inicialmente) — verificado con Playwright
    que "Marcar ausente" + el botón "Iniciar" adyacente no entraban en una sola línea dentro del
    ancho fijo de la columna (18%, `colgroup`) y se envolvían a 2 líneas; "Ausente" es
    suficientemente claro en contexto y cabe en una sola línea junto a "Iniciar".

## Test de Regresión

Cambio puramente visual (clases CSS + texto de label, sin lógica nueva) — no aplica test
automatizado según `.claude/rules/testing-tdd.md`. Verificado con Playwright MCP contra la vista
real (`localhost:4200/app/admin/asistencia`), simulando los 4 estados vía inyección de DOM
temporal (no persistida): "Ausente" + "Iniciar" en una sola línea sin wrap, "Ver motivo" y
"Justificar" con affordance de botón visible en reposo. `npx tsc -p tsconfig.app.json --noEmit`
limpio.
