# Fix: App-like `/admin/clase-profesional/archivo` + `/secretaria/profesional/archivo`
> id: fix-150-m-app-like-profesional-archivo
> refs: ASG-b-081
> status: in_progress
> created: 2026-08-10

## Root Cause
[Heredado de ASG-b-081, a confirmar]: Paso 13 del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`),
separado de la matriz de notas (ASG-b-080) por ser más simple — `AdminProfesionalArchivoComponent`
(que `SecretariaProfesionalArchivoComponent` wrappea) no tiene el modo dual landing/grilla de
Evaluaciones/Notas. Hoy la página no ocupa toda la pantalla en Desktop (no aplica el patrón
`--fill-screen-kpi` / `.bento-fill`), a diferencia del resto de páginas ya migradas del rollout.

## ACs Afectados
Ninguno — fix de rollout de patrón visual (app-like), no ligado a un AC de negocio específico.

## Cambio
- **Archivo:** `src/app/features/admin/profesional-archivo/admin-profesional-archivo.component.ts`
  (y su `.html`/`.scss` si están separados)
- **Qué cambia:**
  1. Root → agregar modificador `--fill-screen-kpi` al `.bento-grid`: filtro se mantiene fijo
     (zona auto), tabla pasa a `.bento-fill`.
  2. Wrapper de la tabla → `flex-1 min-h-0 overflow-y-auto`.
  3. Verificar que la columna `sticky-col` (ya existente en "Alumno") sigue pegada al hacer
     scroll horizontal tras el cambio — no romperla.

## Test de Regresión
- [ ] `force-compact` verificado con drawer abierto
- [ ] `/verify` en `/admin/clase-profesional/archivo`
- [ ] `/verify` en `/secretaria/profesional/archivo` (wrappea al de admin, se resuelve
      automáticamente, pero se confirma igual)
- [ ] Confirmar `sticky-col` funcionando con scroll horizontal después del cambio
