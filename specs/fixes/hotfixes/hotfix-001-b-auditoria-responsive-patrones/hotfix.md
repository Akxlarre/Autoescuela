# Hotfix: Responsive y patrones en admin-auditoria
> id: hotfix-001-b-auditoria-responsive-patrones
> status: done
> closed: 2026-05-27
> created: 2026-05-27

## Problema
`admin-auditoria.component.ts` tiene la tabla con `overflow-hidden` y `.audit-grid` de columnas fijas en px sin breakpoints responsive, más violaciones de patrones (estilos inline, CSS muerto, `#fff` hardcodeado, sin `card-accent`, `Router` y `OnInit` sin uso).

## Cambios
- **Archivo:** `src/app/features/admin/auditoria/admin-auditoria.component.ts`
  - Tabla: cambiar contenedor de `overflow-hidden` → `overflow-x-auto` + agregar `min-width` al grid
  - `.audit-grid`: agregar `min-width: 780px` para que el scroll funcione correctamente
  - Filtros: agregar `sm:grid-cols-3 lg:grid-cols-5` para breakpoints intermedios
  - Paginación: ocultar números intermedios en mobile (`hidden sm:flex`), solo Anterior/Siguiente
  - Estilos inline: reemplazar `style="color: var(--text-X)"` por clases semánticas (`text-secondary`, `text-muted`)
  - CSS muerto: eliminar `.export-btn` y `.export-btn--primary`
  - `#fff` hardcodeado: reemplazar por `var(--color-primary-text)` en `.page-btn--active`
  - Agregar `.card-accent` al header de la tabla
  - Eliminar `Router` inyectado sin usar
  - Eliminar `implements OnInit` y `ngOnInit()` vacío
