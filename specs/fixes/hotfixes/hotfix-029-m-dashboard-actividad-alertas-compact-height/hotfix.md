# Hotfix: "Actividad reciente" y "Alertas Importantes" siguen apretadas con drawer abierto

## Problema
`.dashboard-panel` (Actividad reciente, Alertas Importantes) neutraliza su
`min-height` de respaldo (`min-h-[300px]` / `min-h-[250px]`) vía
`@container layoutmain (min-width: 768px) { .dashboard-panel { min-height: 0 } }`.

Ese umbral (768px) asume que a partir de ahí el CSS Grid ya puede darle
suficiente alto a la fila por sí solo. Pero estos paneles usan
`style="contain: size"`, lo que los excluye del cálculo de `auto` en
`grid-auto-rows: minmax(120px, auto)` — su fila termina cayendo al piso
mínimo (120px), insuficiente para el header + lista/estado vacío. Con el
drawer abierto (`<main>` angostado a ≥768px) esto se vuelve visible: el
`min-height` que antes compensaba esa falta de info al grid queda anulado
justo cuando más hace falta.

hotfix-028 resolvió el caso análogo de "Clases Actuales" dándole más alto de
grid (`data-row-span-md="2"`), pero Actividad/Alertas son celdas de 1 fila
por diseño (con scroll interno), así que la solución ahí es distinta:
restaurar un piso de `min-height` razonable (menor al original, pero
suficiente) específicamente cuando `.force-compact` está activo, en vez de
anularlo a 0.

## Fix
Agregar, con mayor especificidad que la regla de `@container`, un piso de
`min-height: 220px` cuando el wrapper raíz tiene `.force-compact`:

```css
.force-compact .dashboard-panel {
  min-height: 220px !important;
}
```

Aplicado en `dashboard.component.ts` (admin) y `secretaria-dashboard.component.ts`.

## AC
- Con un drawer abierto, "Actividad reciente" y "Alertas Importantes" mantienen alto suficiente para mostrar el header y al menos 1-2 ítems (o el estado vacío) sin verse apretados/cortados.

## Cierre
- Regla `.force-compact .dashboard-panel { min-height: 220px !important }` agregada en `dashboard.component.ts` (admin).
- `secretaria-dashboard.component.ts` NO tiene este bug: su "Actividad reciente"/"Alertas Importantes" no usan `contain:size` ni `.dashboard-panel`/`min-h-[...]`, por lo que no requiere el mismo fix.
- `tsc --noEmit` limpio.

## Corrección post-verificación del dueño
El piso de 220px alcanzaba para 2 ítems pero no para los 3 que se ven sin
drawer (confirmado con capturas: con drawer solo 2 ítems por card, sin drawer 3).
Subido a `min-height: 300px !important` (igual al alto original sin
compactar) para no perder capacidad visible. `tsc --noEmit` limpio.
