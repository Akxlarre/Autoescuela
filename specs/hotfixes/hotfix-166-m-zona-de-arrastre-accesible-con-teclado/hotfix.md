# Hotfix: La zona "Arrastra tu archivo aquí" se usa con teclado
> id: hotfix-166-m-zona-de-arrastre-accesible-con-teclado
> refs: fix-447-m-testing-documentos-certificacion (S05, S06)
> status: done
> closed: 2026-10-20
> created: 2026-10-20

## Problema
En "Subir documento", la zona de arrastre era un `div` con `(click)`: no recibía foco con Tab ni
se activaba con Enter/Espacio, así que sin mouse no había forma de elegir el archivo. El texto
además decía "PDF, JPG, PNG" y omitía WEBP, que sí se acepta.

## Cambios
- **Archivo:** `src/app/features/admin/documentos/dms-upload-drawer/dms-upload-drawer.component.ts`
  — la zona tiene `role="button"`, `tabindex="0"`, `aria-label` y abre el selector con Enter o
  Espacio; el texto dice "PDF, JPG, PNG o WEBP — máx. 5 MB". Verificado en navegador.
