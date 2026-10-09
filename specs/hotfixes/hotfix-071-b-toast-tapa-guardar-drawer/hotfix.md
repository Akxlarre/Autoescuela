# Hotfix: El toast de éxito tapa el botón Guardar del drawer
> id: hotfix-071-b-toast-tapa-guardar-drawer
> refs: ASG-i-034 (manuales grupo 1, caso E12) — hallazgo 2
> status: closed
> created: 2026-10-09

## Problema
Los toasts salen abajo a la derecha (`position="bottom-right"` en `app.html`), justo donde está el pie
del drawer lateral con "Guardar". Tras guardar en un drawer que sigue abierto (Editar instructor), el
toast "Instructor actualizado" tapa el botón unos segundos: en la prueba en vivo dos clics cayeron sobre
el toast y no guardaron nada, sin ningún aviso. En móvil el drawer ocupa toda la pantalla y el toast,
abajo al centro, tapa el mismo pie.

## Cambios
- **Archivo:** `src/app/layout/layout-drawer.component.ts` — publica en `<html>` cuánto tapa el drawer
  del borde derecho (`--layout-drawer-cover`, medido con `ResizeObserver` durante la animación y al
  cambiar el tamaño de la ventana) y `data-layout-drawer-open` mientras está visible.
- **Archivo:** `src/styles/vendors/_primeng-overrides.scss` — escritorio: el toast se corre a la izquierda
  del drawer (sobre la pantalla, no sobre el panel). Móvil (drawer a pantalla completa): con el drawer
  abierto, el toast sale arriba en vez de abajo.

## Verificación
- `ng build`, `lint:arch`; en el navegador: con el drawer abierto, el toast no se cruza con el pie
  del drawer (escritorio y 375 px); sin drawer, el toast queda donde estaba.

## Resultado (2026-10-09)
- `ng build` OK, `lint:arch` 0 errores (182).
- En el navegador (Editar instructor, toast de prueba por el `ToastService` del facade, sin guardar):
  - Escritorio (947 px): panel en x 521–947, toast en x 101–501 → no se cruzan.
  - Móvil (716 px, panel a pantalla completa): toast arriba (y 16–98), no sobre el pie.
  - Al cerrar: `--layout-drawer-cover` sigue el ancho durante la animación y termina en `0px`, sin
    atributo; el toast vuelve a `right: 20px; bottom: 20px`.
