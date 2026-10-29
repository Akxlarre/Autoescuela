# Hotfix: Pestañas del drawer Ajustes sin semántica de pestañas
> id: hotfix-168-b-pestanas-ajustes-a11y
> refs: fix-197-b-testing-instructores-secretarias-usuarios (V07/V08)
> status: done
> closed: 2026-10-29
> created: 2026-10-29

## Problema
En el testing de ASG-i-034 (casos V07/V08): las pestañas del drawer Ajustes (Mi Perfil / Ajustes /
Seguridad) eran botones sueltos, sin `role="tab"` ni `aria-selected`. Un lector de pantalla no
anunciaba que eran pestañas ni cuál estaba activa, y con el teclado había que pasar por las tres
con Tab.

## Cambios
- **Archivo:** `src/app/shared/components/ajustes-drawer/ajustes-drawer.component.ts` — patrón
  tablist de WAI-ARIA: `role="tablist"` con `aria-label`, cada pestaña con `role="tab"`,
  `aria-selected`, `aria-controls` y `tabindex` itinerante (solo la activa entra con Tab); cada
  contenido con `role="tabpanel"` + `aria-labelledby`. Flechas izquierda/derecha, Inicio y Fin
  cambian de pestaña y mueven el foco. Las pestañas salen de un `computed` (Seguridad solo para
  admin, igual que antes). Sin cambios visuales.
