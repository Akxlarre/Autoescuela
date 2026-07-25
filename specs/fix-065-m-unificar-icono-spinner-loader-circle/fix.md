# Fix: Unificar el ícono de spinner de carga — `loader` (segmentado) → `loader-circle` (anillo fluido)
> id: fix-065-m-unificar-icono-spinner-loader-circle
> refs: —
> status: done
> closed: 2026-07-25
> created: 2026-07-25

## Root Cause
No existía una convención centralizada para el ícono de "cargando" en botones/estados async. `app.config.ts` registra 3 íconos Lucide de spinner (`Loader`, `Loader2`, `LoaderCircle`) y distintos desarrolladores/momentos del proyecto usaron indistintamente `name="loader"` (ícono de 12 rayos radiales tipo "estallido" — se ve como un ventilador girando, poco legible en tamaños pequeños) vs `name="loader-circle"` / `name="loader-2"` (mismo ícono visual — Lucide renombró `loader-2` a `loader-circle`, ambos son el anillo con un segmento incompleto, fluido al rotar). El dueño identificó que `name="loader"` (usado en 20 archivos, incluyendo `AsyncBtnComponent` — el botón async **centralizado** que reutiliza toda la app) se ve peor y menos claro como indicador de carga que `loader-circle`, y pidió unificar todo a este último.

## ACs Afectados
- Ninguno — fix autónomo (decisión visual del dueño).

## Cambio
Reemplazar `name="loader"` → `name="loader-circle"` en los 20 archivos que lo usan como ícono de estado de carga (todos con `class="animate-spin"` salvo 2 casos donde también faltaba el spin, corregidos de paso por ser el mismo defecto):
- `shared/components/async-btn/async-btn.component.ts` — **componente centralizado**, usado por toda la app para botones con estado loading/success/error.
- `shared/components/registrar-gasto-fijo-drawer/registrar-gasto-fijo-drawer.component.ts`
- `shared/components/matricula-steps/personal-data/personal-data.component.html` (sin `animate-spin` — agregado)
- `features/secretaria/pagos/secretaria-pagos.component.ts`
- `features/admin/pagos/admin-pagos.component.ts`
- `features/admin/alumno-detalle/inasistencia-drawer/admin-inasistencia-drawer.component.ts`
- `features/admin/alumno-detalle/editar-perfil-drawer/admin-editar-perfil-drawer.component.ts`
- `features/admin/contabilidad-reportes/registrar-gasto-fijo-drawer.component.ts`
- `shared/components/matricula-steps/assignment/assignment.component.html`
- `shared/components/historial-cuadraturas-content/historial-cuadraturas-content.component.ts`
- `shared/components/eliminar-alumno-modal/eliminar-alumno-modal.component.ts`
- `shared/components/detalle-cuadratura-modal/detalle-cuadratura-modal.component.ts`
- `shared/components/cuadratura-content/cuadratura-content.component.ts`
- `features/admin/alumno-detalle/reprogramar-clase-drawer/admin-reprogramar-clase-drawer.component.ts` (2 usos)
- `shared/components/public-enrollment-steps/public-personal-data/public-personal-data.component.ts`
- `shared/components/matricula-steps/documents/documents.component.html` (2 usos)
- `shared/components/schedule-grid/schedule-grid.component.ts`
- `shared/components/public-enrollment-steps/public-schedule/public-schedule.component.ts`
- `shared/components/public-enrollment-steps/public-documents/public-documents.component.ts` (2 usos)
- `shared/components/egreso-modal/egreso-modal.component.ts` (sin `animate-spin` — agregado)

**Sin tocar** (ya usan `loader-circle` o `loader-2`, visualmente idénticos — es el ícono correcto): ~50+ usos ya correctos en drawers de certificación, matrícula pública, dashboard, auditoría, etc.

**Centralización (pedido explícito del dueño):**
- Regla documentada en `.claude/rules/visual-system.md` — "spinner de carga: SIEMPRE `loader-circle`, NUNCA `loader`".
- `Loader` (el ícono descartado) se **eliminó completamente** del registro `provideIcons()` en `app.config.ts` — ya no es posible usarlo por accidente, ni siquiera existe como opción para `name="..."`.

## Verificación
- `tsc --noEmit` sin errores tras los 24 reemplazos + limpieza de `app.config.ts`.
- Confirmado con `grep -rn 'name="loader"[^-]'` sobre `src/` → 0 resultados (ningún caso quedó sin migrar).
- Revisión visual pendiente de confirmación del dueño (Playwright MCP no disponible en esta sesión).
