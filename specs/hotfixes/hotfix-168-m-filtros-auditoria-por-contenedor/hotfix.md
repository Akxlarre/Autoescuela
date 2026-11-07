# Hotfix: Filtros de Auditoría que caben en su caja y fecha igual en tabla y detalle
> id: hotfix-168-m-filtros-auditoria-por-contenedor
> refs: fix-485-m-testing-auditoria-configuracion-web
> status: done
> closed: 2026-11-07
> created: 2026-11-07

## Problema
Vistos en el testing de Auditoría (N2–N5 de `fix-485-m`):

- La grilla de filtros cambia de columnas por el ancho de la **ventana** (`lg:grid-cols-6`), no
  por el de su caja. A 1440 px los selectores cortaban su texto ("Todos los usu…") y, con el
  drawer de detalle abierto, se reducían a una letra ("T", "E").
- Las etiquetas de fecha usan `micro-label` (las pone `app-date-input`) y las de los selectores un
  estilo propio en minúscula.
- La tabla muestra `2026-11-06 23:00:11` y el detalle `06/11/2026 23:00:11`.

## Cambios
- **Archivo:** `src/app/features/admin/auditoria/admin-auditoria.component.ts` — la grilla de
  filtros usa `repeat(auto-fill, minmax(12rem, 1fr))` (se adapta a su caja); las etiquetas de los
  selectores pasan a `micro-label`; la fecha de la tabla usa `dd/MM/yyyy HH:mm:ss`, el formato del
  detalle y del resto de la app. "Limpiar filtros" y "Exportar" pasan a ser la última celda de la
  grilla (abajo a la derecha) en vez de una fila aparte que dejaba "Exportar" solo.
- **Archivo:** `src/app/features/admin/auditoria/audit-log-detail-drawer.component.ts` — fecha y
  sede a ancho completo: en media columna se cortaban ("07/11/2026 11:5…", "Autoescuela …").

## Verificación
- Navegador (2026-11-07): 1440 px en 2 filas sin texto cortado y "Exportar" junto a Módulo; con el
  drawer abierto, 2 columnas legibles y el detalle sin cortes; 375 px sin scroll horizontal.
  Capturas `c485-10-filtros-1440.png`, `c485-11-drawer.png`, `c485-12-375.png`.
