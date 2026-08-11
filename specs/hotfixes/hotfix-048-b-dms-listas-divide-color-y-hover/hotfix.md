# Hotfix: DMS — listas con divide-y sin color canónico + sin hover de fila
> id: hotfix-048-b-dms-listas-divide-color-y-hover
> status: done
> closed: 2026-08-10
> created: 2026-08-10

## Problema

Las 2 listas `<ul class="divide-y">` de `DmsListContentComponent` ("Últimos subidos" en la tab
"students", lista de documentos en la tab "school") usan `border-border-subtle` en el `<ul>`
para intentar colorear las líneas separadoras — pero Tailwind `divide-y` necesita la clase
`divide-{color}`, no `border-{color}` (esa solo afecta `border`, no el pseudo-selector que
genera `divide-y`). El resultado: las líneas caen al color default de Tailwind en vez del token
del design system, viéndose "raras"/fuera de lugar. Patrón correcto ya usado en ~20 otros
componentes del proyecto (`divide-border-subtle`, `divide-border-default`, etc.). Además,
ninguna de las 2 listas tiene feedback de hover en sus filas — el resto de listas/tablas del
proyecto usan la primitiva canónica `.list-item-hover` (fix-119-b, `src/tailwind.css:463`).

## Cambios

- **Archivo:** `src/app/shared/components/dms-list-content/dms-list-content.component.ts`
  - Ambos `<ul class="divide-y ... border-border-subtle ...">` → `divide-border-subtle` en vez
    de `border-border-subtle`.
  - Ambos `<li>` (Últimos subidos, documentos de escuela) → agregan `list-item-hover
    transition-colors`.
