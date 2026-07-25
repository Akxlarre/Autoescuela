# Hotfix: Botones se achican al pasar a estado loading — ancho debe mantenerse estable
> id: hotfix-048-m-async-btn-ancho-estable-loading
> status: done
> closed: 2026-07-25
> created: 2026-07-25

## Problema
`AsyncBtnComponent` (`shared/components/async-btn/async-btn.component.ts`, usado en 15 archivos) no fija ningún ancho — el `<button>` es `flex` con `width: auto`, así que cuando cambia de contenido (`label + icon` en idle → `spinner + loadingLabel` en loading, casi siempre más corto) el botón se contrae visiblemente, rompiendo la sensación de fluidez (reportado por el dueño en "Guardar y Continuar" del paso 1 de matrícula). El mismo patrón de botón hand-rolled (`@if(isLoading){spinner+texto}@else{icon+label}` sin ancho fijo) se repite en varios drawers/páginas fuera del componente centralizado.

## Cambios
- **Archivo nuevo:** `src/app/core/directives/stable-width.directive.ts` — `StableWidthDirective` (`[appStableWidth]`): mide el ancho del host con `afterRenderEffect` (Angular 21) mientras el input es `false` (contenido "completo"/idle) y lo fija como `min-width`; cuando el input pasa a `true` (contenido reducido/loading) deja de remedir pero mantiene el último ancho — el elemento nunca se achica por debajo de su tamaño idle.
- **Archivo:** `shared/components/async-btn/async-btn.component.ts` — refactorizado para usar `[appStableWidth]="activeState() !== 'idle'"` en vez de duplicar la lógica de medición inline. Corrige los 15 consumidores centralizados de una vez.
- **Archivo:** `features/secretaria/pagos/secretaria-pagos.component.ts` y `features/admin/pagos/admin-pagos.component.ts` — botón "Generar PDF" (mismo patrón hand-rolled, `facade.isGeneratingReport()`), migrado a `[appStableWidth]`.
- **Nota de alcance:** existen más botones hand-rolled con este mismo patrón (identificados en fix-065, ej. `egreso-modal`, `cuadratura-content`, `admin-reprogramar-clase-drawer`, etc.) que no se migraron en este hotfix por volumen — la directiva ya existe y está documentada en `indices/DIRECTIVES.md` para que se adopten incrementalmente al tocar esos archivos.
