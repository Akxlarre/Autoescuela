# Fix: Alertas y Actividad reciente quedan bajas en el dashboard de secretaria
> id: fix-255-b-dashboard-secretaria-listas-bajas
> refs: 0060-b-lecturas-fallidas-como-ceros (hallazgo 3 de la validación T1.6)
> status: done
> created: 2026-11-19

## Root Cause
"Actividad reciente" y "Alertas Importantes" comparten la columna derecha de
`bento-grid--fill-screen-2`, una fila cada una, frente a "Clases Actuales" que ocupa las dos.
A 1280x800 la grilla mide 680 px, el hero 217 px y cada fila 179 px; de esos 179 px unos 164 son
padding, cabecera y pie de la celda, así que cada lista queda en 15 px (a 1440x900, ~91 px: una
sola fila completa). Repartir las filas no alcanza: dos listas apiladas no caben con dos filas
completas cada una. Tres columnas lado a lado sí, pero dejan "Clases Actuales" en 288 px y su fila
se rompe (medido en vivo).

## ACs Afectados
Ninguno de 0060-b cambia: el aviso del caso B de alertas sigue en la cabecera de la celda, con
"Reintentar" y su `data-llm-action`.

- AC-1: A la derecha de "Clases Actuales" hay una sola celda, a las dos filas, con pestañas
  (`app-tabs` segmented) "Alertas" (por defecto, con el número de alertas) y "Actividad".
- AC-2: A 1280x800 y 1440x900, en claro y oscuro, la lista de la pestaña activa muestra al menos 3
  filas completas y el documento no scrollea.
- AC-3: El aviso del caso B de alertas va en la cabecera de la celda, solo con la pestaña "Alertas"
  activa, y no le quita alto a la lista.
- AC-4: Cada pestaña conserva su pie ("Ver todas las alertas" / "Ver toda la actividad") y sus
  estados vacíos, de carga y de error (caso A de alertas).
- AC-5: A 375x812 la celda mide su contenido (scroll nativo) y muestra hasta 3 ítems.

## Cambio
- **Archivo:** `src/app/features/secretaria/dashboard/secretaria-dashboard.component.ts`
- **Qué cambia:** las celdas de Actividad y Alertas pasan a una sola celda `data-row-span="2"` con
  pestañas; estado `feedTab` y `feedTabs` en el componente.

## Evidencia (navegador, secretaria, 2026-11-19)
Alto de la lista de la pestaña activa (filas completas), sin scroll del documento ni de `<main>`:

| Viewport | Claro | Oscuro | Con aviso del caso B |
|---|---|---|---|
| 1280x800 | 223 px (3) en ambas pestañas | 223 px (3) | 195 px (3): el aviso baja de línea en la cabecera |
| 1440x900 | 375 px (6 de 6) | 375 px (6 de 6) | 375 px (6): el aviso entra en la línea de las pestañas |
| 375x812 | 3 ítems completos por pestaña (scroll nativo) | igual | — |

Antes: 15 px a 1280x800 y 91 px a 1440x900. Se descartaron tres columnas lado a lado (deja
"Clases Actuales" en 288 px y su fila se encima) y compactar las celdas apiladas (~1,9 filas a
1280x800). Consola sin errores.

## Test de Regresión
- `secretaria-dashboard.component.spec.ts > pestañas Alertas / Actividad (fix-255-b)` ✓
