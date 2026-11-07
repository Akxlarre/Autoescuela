# Hotfix: El tema de la web sale siempre de la sede
> id: hotfix-169-m-tema-web-desde-la-sede
> refs: fix-485-m-testing-auditoria-configuracion-web
> status: done
> closed: 2026-11-07
> created: 2026-11-07

## Problema
El tema visual de cada landing está fijado por sede: Autoescuela Chillán (sede 1) = roja,
Conductores Chillán (sede 2) = azul (decisión del 2026-06-15, `sede-theme.utils.ts`). En
Configuración web, los valores por defecto de una sede sin configuración y el respaldo al guardar
seguían con el mapeo anterior a esa decisión (`branchId === 2 ? 'roja' : 'azul'`): una sede sin
`brand.theme` guardado quedaba con el color de la otra empresa. Visto en el testing `fix-485-m`
(N1: los datos de la BD están bien; el código de respaldo no).

## Cambios
- **Archivo:** `src/app/core/facades/website-config.facade.ts` — el tema por defecto sale de
  `branchIdToTheme()`.
- **Archivo:** `src/app/features/admin/configuracion-web/admin-configuracion-web.component.ts` —
  al cargar y al publicar, el tema es siempre `branchIdToTheme(sede)`; el campo ya era de solo
  lectura ("fijado para cada sede").

## Verificación
- Test del facade: la sede 2 sin configuración arranca con tema azul y la 1 con roja.
- Navegador: sede 1 muestra "Roja (Red/Orange)" (captura `c485-03-configweb.png`); los datos guardados ya coincidían con el mapeo.
