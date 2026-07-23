# Hotfix: Campo "Licencia" redundante en Cabecera del Libro de Clases

> id: hotfix-038-m-libro-clases-licencia-redundante
> status: done
> closed: 2026-07-22
> created: 2026-07-22

## Problema
En la Cabecera del Libro de Clases, "Curso: Profesional A3" y "Licencia: A3"
muestran la misma información dos veces — el nombre del curso ya incluye la
clase de licencia.

## Fix
`features/libro-de-clases/libro-de-clases.component.ts`: se elimina el
párrafo "Licencia: {{ cab.licenseClass }}" de la Cabecera. `cab.licenseClass`
no se elimina del modelo — sigue usándose en `moduleHeaders` computed
(`getModuleNames(licenseClass)`), solo deja de mostrarse duplicado en pantalla.

## Cierre
- `tsc --noEmit` limpio.
- `npm run test:ci` sigue en verde (sin tests que dependieran de ese párrafo).
- Sin verificación visual con Playwright (MCP inactivo en esta sesión).
