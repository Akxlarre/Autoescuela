# Hotfix: Spinner estándar en botón "Exportar PDF" de Libro de Clases
> id: hotfix-092-m-libro-clases-pdf-spinner-estandar
> refs: —
> status: done
> closed: 2026-08-26
> created: 2026-08-26

## Problema
El botón "Exportar PDF" del Libro de Clases solo cambia su texto a "Generando PDF..." durante
la exportación, pero mantiene el ícono estático de descarga (`download`) en vez del spinner
estándar de la app (`loader-circle` + `animate-spin`), definido como obligatorio en
`.claude/rules/visual-system.md`. El estado de carga es poco evidente.

## Cambios
- **Archivo:** `src/app/features/libro-de-clases/libro-de-clases.component.ts` — en el
  `computed()` de `heroActions`, la acción `export-pdf` ahora setea `icon: 'loader-circle'` y
  `loading: true` mientras `facade.isExporting()` es true (en vez de mantener `icon: 'download'`
  fijo). El componente `app-section-hero` ya soporta `action.loading` aplicando
  `[class.animate-spin]` al ícono — solo faltaba usarlo con el ícono canónico de carga.
