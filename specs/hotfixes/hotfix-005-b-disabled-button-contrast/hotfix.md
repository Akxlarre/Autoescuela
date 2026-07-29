# Hotfix: Botón CTA disabled visualmente idéntico al habilitado
> id: hotfix-005-b-disabled-button-contrast
> status: done
> closed: 2026-06-04
> created: 2026-06-04

## Problema
Los botones "Continuar" en los pasos del flujo público usan `[style.opacity]="0.5"` cuando
están deshabilitados. Con el color de marca (azul/rojo intenso), 50% de opacidad sigue
luciendo como un botón activo — el usuario no percibe que está deshabilitado hasta intentar clickearlo.

## Causa raíz
La utilidad CSS `btn-primary` tiene `:disabled { opacity: 0.7 }` y los componentes
superponen `[style.opacity]="0.5"` via inline style. El color de marca persiste en ambos
casos, dando insuficiente contraste visual con el estado habilitado.

## Cambios
- **Archivo:** `src/tailwind.css` → `@utility btn-primary`
  Actualizar `:disabled` para usar fondo gris neutro + texto muted en vez de solo opacity.
- **Archivos de componentes:** Eliminar los `[style.opacity]` y `[style.cursor]` inline
  redundantes de los botones CTA en los pasos públicos — la clase CSS los manejará.
