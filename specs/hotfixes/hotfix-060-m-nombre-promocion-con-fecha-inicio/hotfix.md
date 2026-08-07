# Hotfix: Nombre de promociones automáticas con fecha de inicio en vez de solo el código
> id: hotfix-060-m-nombre-promocion-con-fecha-inicio
> refs: —
> status: done
> closed: 2026-08-07
> created: 2026-08-07

## Problema
La Edge Function `auto-create-next-promotions` nombra las promociones automáticas como
`Promoción {code}` (ej. `Promoción 277`), sin fecha. Las promociones creadas manualmente
desde la UI usan el formato `Promoción {día} de {mes} {año}` (fecha de inicio) — el owner
pide que el nombre incluya AMBOS: código y fecha de inicio, formato
`Promoción {code} ({día} de {mes} {año})` (ej. `Promoción 277 (24 de agosto 2026)`).

## Cambios
- **Archivo:** `supabase/functions/auto-create-next-promotions/index.ts` — agregar helper de
  formateo de fecha en español (día + mes en letras + año) y usarlo para construir
  `name: \`Promoción ${nextCode} (${fechaFormateada})\`` a partir de `nextStart`.
