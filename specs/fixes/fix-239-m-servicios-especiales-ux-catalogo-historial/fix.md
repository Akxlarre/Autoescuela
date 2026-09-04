# Fix: Rediseño UX de Servicios Especiales (catálogo + historial)

> id: fix-239-m-servicios-especiales-ux-catalogo-historial
> status: done
> closed: 2026-09-04
> created: 2026-09-04

## Root Cause

Feedback visual directo del dueño sobre `/app/{admin,secretaria}/servicios-especiales`:

1. El Historial de Ventas competía por el mismo viewport que el Catálogo, dejando a ambos
   con menos espacio del necesario — con un catálogo chico (1-2 servicios reales) esa mitad
   de pantalla queda vacía la mayor parte del tiempo.
2. El catálogo usaba tarjetas ad-hoc en vez del patrón de tabla + paginación que ya usan
   Base de Alumnos (`alumnos-list-content`) y Promociones (`admin-profesional-promociones`) —
   inconsistencia visual entre listados del mismo producto.
3. Los botones "Agregar servicio" y "Vender" usaban clases Tailwind compuestas a mano en vez
   de las clases semánticas `.btn-primary`/`.btn-secondary` que usa el resto de la app.
4. El checkbox "Mostrar inactivos" no mostraba `cursor-pointer` en el `<input>` (solo en el
   `<label>` que lo envuelve).
5. El KPI "Total registros" no comunicaba que cuenta **ventas individuales**, no servicios
   del catálogo — confuso al lado de un catálogo con 1 solo servicio.

## ACs Afectados

Ninguno — cambio de UI/UX puro. La lógica de negocio (cálculo de KPIs, reglas de borrado,
bloqueo por caja cerrada, export) vive en `ServiciosEspecialesFacade` y no se toca.

## Cambio

- **Historial de Ventas → Drawer** (`historial-ventas-drawer.component.ts`, nuevo, junto a
  `registrar-venta-drawer`/`agregar-servicio-drawer`): Smart/Drawer self-sufficient (inyecta
  `ServiciosEspecialesFacade`, `ConfirmModalService`, `ToastService` directo, mismo patrón que
  sus dos hermanos). Absorbe filtro por servicio, `app-period-selector`, export
  Excel/PDF y borrado de venta (antes vivían en el Smart wrapper + `app-servicios-especiales-content`).
  Se abre desde una nueva acción "Ver Historial" en el Hero (`ServiciosEspecialesFacade.openHistorialVentasDrawer()`,
  mismo patrón lazy-import que los otros dos `openXDrawer()`).
- **Estilo del drawer de Historial → calcado de `PagosRecientesDrawerComponent`** (feedback
  visual directo del dueño sobre el primer borrador, que usaba `p-table`): card grande
  (`app-drawer-form`) + filas divididas (`rows-divider`), sin componente de paginación — un
  drawer con scroll nativo no tiene el límite de DOM de la tabla de la página principal
  (spec 0039-b), así que, igual que Pagos Recientes, alcanza con un contador al pie ("N de M
  ventas"). Reemplaza la paginación manual anterior (`pageSize`/`currentPage`/`safePage`/
  `ventasPaginadas`/`onPageChange` + `p-paginator` standalone) sin reintroducir otro mecanismo
  de paginación — la ventana de período + filtro de servicio ya acotan la lista en la práctica.
- **Catálogo ocupa todo el bento** (`servicios-especiales-content.component.ts`): con el
  Historial fuera, el grid pasa de `bento-grid--fill-screen-2` a `bento-grid--fill-screen`
  (una sola celda `.bento-fill`). Se agregan breakpoints de contenedor adicionales
  (4/5 columnas) para aprovechar el ancho ganado.
- **Botones al canon del DS:** "Agregar servicio" (toolbar) y "Vender" (por fila) pasan de
  clases Tailwind compuestas a mano a `btn-secondary`/`btn-secondary btn-sm`.
- **Checkbox "Mostrar inactivos":** se agrega `cursor-pointer` directo al `<input>`.
- **KPI renombrado:** "Total registros" → "Ventas Totales" (mismo valor `kpis.totalRegistros`,
  solo cambia el label expuesto al Hero).

## Test de Regresión

`servicios-especiales-content.component.spec.ts` cubría la paginación manual del historial
(spec 0039-b) — esa lógica se elimina, así que el spec se reemplaza por
`historial-ventas-drawer.component.spec.ts`, cubriendo el filtrado por servicio/período que sí
sigue siendo lógica propia (computed `ventasFiltradas`). Verificado con `/verify` (Playwright,
sesión admin real): catálogo en tabla paginada (`p-table`) ocupando el ancho completo, Historial
abre en drawer desde el Hero con el mismo estilo que Pagos Recientes (card + filas, sin
paginador), export y borrado de venta funcionan igual que antes desde el drawer.
