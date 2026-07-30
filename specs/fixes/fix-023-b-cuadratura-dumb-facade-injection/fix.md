# Fix: cuadratura-content — Dumb component inyectando LayoutDrawerFacadeService
> id: fix-023-b-cuadratura-dumb-facade-injection
> refs: fix-022-tier-d2-content-animatehero
> status: done
> created: 2026-06-15

## Root Cause

`shared/components/cuadratura-content` inyecta `LayoutDrawerFacadeService` directamente,
violando la regla de Dumb components (solo `input()` y `output()`). Esto bloquea el
Architect Guard e impide editar el archivo para cualquier otro fix.

## Cambio

1. **Dumb** (`cuadratura-content`): eliminar `inject(LayoutDrawerFacadeService)`,
   agregar `readonly isDrawerOpen = input<boolean>(false)`, reemplazar los 4 usos
   de `layoutDrawer.isOpen()` en template por `isDrawerOpen()`.
2. **Smart admin** (`admin-contabilidad-cuadratura`): inyectar `LayoutDrawerFacadeService`,
   pasar `[isDrawerOpen]="layoutDrawer.isOpen()"` al Dumb.
3. **Smart secretaria** (`secretaria-contabilidad-cuadratura`): ídem.
4. **Dead code fix-022**: con el Guard desbloqueado, eliminar `heroRef` viewChild y
   simplificar `ngAfterViewInit` en cuadratura-content.

## Test de Regresión

- ✅ `ng build` verde.
- ✅ La tabla de cuadratura sigue reaccionando al drawer abierto/cerrado (layout compacto).
