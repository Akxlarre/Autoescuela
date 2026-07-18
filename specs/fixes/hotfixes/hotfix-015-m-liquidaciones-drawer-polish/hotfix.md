# Hotfix: overflow de contadores en Liquidaciones + migrar drawer Pago Instructor a app-drawer-form

## Problema 1
En `liquidaciones-content.component.ts`, la fila de filtros (nav de mes + buscador + contadores
"Pendientes"/"Pagados") fuerza `md:flex-row` basado en el viewport, no en el ancho real del panel.
Cuando se abre un drawer y el panel de la izquierda se angosta, los contadores (`shrink-0`) se
salen de la card porque la fila no tiene `flex-wrap`.

## Fix 1
Agregar `flex-wrap` (con `md:flex-wrap`) a la fila de filtros para que los contadores bajen de línea
en vez de desbordar cuando el contenedor real es angosto.

## Problema 2
`pago-instructor-modal.component.ts` (drawer "Registrar Pago Instructor") quedó fuera del refactor
masivo fix-025/026 que propagó el shell `app-drawer-form` a los drawers de formulario. Sigue usando
un `<div class="flex flex-col h-full">` con footer custom en vez del shell canónico.

## Fix 2
Aplicar la receta mecánica de fix-025 (`specs/fix-025.../fix.md` §"Receta mecánica"):
- Importar y usar `DrawerFormComponent` envolviendo el contenido (Patrón B, sin content-loader).
- Footer proyectado vía `ngProjectAs="[drawer-form-footer]"` con botones canónicos
  `btn-secondary` (Cancelar) + `btn-primary flex items-center gap-2` (Confirmar Pago).

## AC
- Los contadores de Liquidaciones no se salen de la card al abrir un drawer.
- El drawer "Registrar Pago Instructor" usa `app-drawer-form` igual que el resto de drawers de formulario migrados.

## Cierre
- Fix 1: `flex-wrap` agregado a la fila de filtros de `liquidaciones-content.component.ts:306` — los contadores ahora bajan de línea en vez de desbordar.
- Fix 2: `pago-instructor-modal.component.ts` migrado a `app-drawer-form` (Patrón B, sin content-loader). Footer canónico proyectado con `btn-secondary`/`btn-primary`. `tsc --noEmit` limpio.
