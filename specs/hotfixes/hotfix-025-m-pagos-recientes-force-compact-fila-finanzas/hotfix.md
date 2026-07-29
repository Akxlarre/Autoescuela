# Hotfix: fila "Monto" y "Método/N° Documento" apretadas en una sola línea con drawer abierto

## Problema
Root cause distinto al de hotfix-024 (badge duplicado), en el mismo bug class:
la regla `.force-compact .lg\:contents { display:flex; flex-direction:row;
justify-content:space-between; ... }` se aplica indiscriminadamente a
**cualquier** elemento con clase `lg:contents`, sin distinguir entre:

- Wrappers **externos** que agrupan sub-filas verticalmente en mobile real
  (`flex flex-col lg:contents` — línea `admin-pagos.component.ts:404-406` /
  `secretaria-pagos.component.ts:370-371`, el bloque "Finanzas" que contiene
  el par Monto y el par Método+N°Documento).
- Wrappers **internos** que forman un par horizontal label-valor
  (`flex justify-between items-center lg:contents`).

En mobile real (<1024px), `lg:contents` no aplica (solo activa a partir de
1024px), así que el wrapper externo se queda `flex flex-col` (correcto: apila
las 2 sub-filas). Pero con `.force-compact` (viewport real ≥1024px, drawer
abierto) la regla genérica convierte también al wrapper **externo** en
`flex-row`, aplastando "Monto $X" y "Método • N° Documento" en una sola línea
en vez de mostrarlos en 2 filas apiladas.

## Fix
Agregar una clase distintiva `fin-group` al wrapper externo y una regla más
específica que gane por especificidad (sin `!important`, ya que la genérica
también usa `!important` — necesitamos más clases en el selector para ganar
igual con `!important`):

```css
.force-compact .fin-group.lg\:contents {
  display: flex !important;
  flex-direction: column !important;
  border-top: 1px solid var(--border-muted) !important;
  padding-top: 0.5rem !important;
  width: 100% !important;
}
```

Aplicado en `admin-pagos.component.ts` y `secretaria-pagos.component.ts`.

## AC
- Con un drawer abierto, en "Pagos Recientes" la fila "Monto" y la fila "Método / N° Documento" aparecen en 2 líneas separadas, no apretadas en una sola.

## Cierre
- Clase `fin-group` agregada al wrapper "Finanzas" en ambos componentes.
- Regla `.force-compact .fin-group.lg\:contents { flex-direction: column; justify-content: flex-start }` gana por especificidad (0,3,0 > 0,2,0) sobre la regla genérica `.force-compact .lg\:contents` (row), sin necesidad de reordenar CSS.
- `tsc --noEmit` limpio.
