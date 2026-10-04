# Fix: El menú "Exportar" se cierra con Escape y con un clic en cualquier parte
> id: fix-286-m-menu-exportar-se-cierra-con-escape-y-clic-afuera
> refs: ASG-i-024
> status: done
> closed: 2026-10-03
> created: 2026-10-03

## Root Cause
`app-export-menu` cierra el menú con un telón invisible (`fixed inset-0 z-10`) que queda debajo de
las opciones. Ese telón vive dentro del panel de la lista, que crea su propio contexto de
apilamiento: fuera del panel (encabezado de la página, barra superior, menú lateral) quedan por
encima y el clic nunca llega al telón. Además el componente no escucha el teclado, así que Escape
no hace nada. Es B26 de la 2ª pasada de `fix-264-m` (`024a` K01); afecta a las 5 listas que usan
el menú.

## ACs Afectados
- `024a` K01: el menú "Exportar" se cierra con Escape y con un clic en cualquier parte de la
  pantalla fuera del menú.
- Un clic en el botón "Exportar" sigue abriendo y cerrando el menú; elegir una opción lo cierra.

## Cambio
- **Archivo:** `src/app/shared/components/export-menu/export-menu.component.ts` — se quita el
  telón; el componente escucha `click` y `keydown.escape` en el documento y cierra el menú si el
  clic cayó fuera de él.

## Test de Regresión
- `export-menu.component.spec.ts` (nuevo) ✓ (4 tests: la decisión de cerrar; no renderiza la
  plantilla porque en esta infra los signal inputs de los hijos no se enlazan)
- `e2e/alumnos-b-lista.spec.ts > K01 (fix-286-m)` sin la marca `knownBug` ✓ (Escape y clic en el
  encabezado, en el navegador)
