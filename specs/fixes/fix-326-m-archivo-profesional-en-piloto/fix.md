# Fix: Las promociones finalizadas no se pueden consultar en el piloto
> id: fix-326-m-archivo-profesional-en-piloto
> refs: fix-319-m-testing-clase-profesional-piloto (S4, S23, D3a) · fix-256-m · ASG-i-025
> status: done
> closed: 2026-10-05
> created: 2026-10-05

## Root Cause
Al finalizar, una promoción sale de Promociones (la consulta excluye `finished`,
`promociones.facade.ts:116`), aunque el filtro ofrece "Finalizada". El único lugar pensado para
verlas, la vista **Archivo**, está bloqueada por `pilotPhaseGuard('clase-profesional-recorte')`
(`fix-256-m`), y su contenido depende casi entero de Asistencia y Evaluaciones (también
bloqueados). Además Archivo lista las promociones sin filtrar por sede
(`archivo-profesional.facade.ts:134-138`, S23).

Decisión D3a (Matías, 2026-10-05):
- **Archivo se habilita en el piloto.** Promociones queda para planificadas y en curso: su filtro
  deja de ofrecer "Finalizada".
- **Archivo muestra de una promoción finalizada lo mismo que "Ver promoción"** (información
  general, alumnos por categoría, cursos con relatores y alumnos), **reutilizando el mismo
  componente**.
- Lo académico actual de Archivo (asistencia, notas M1–M7, promedio, KPIs de aprobación) queda como
  sección adicional, **oculta mientras Asistencia y Evaluaciones sigan bloqueados**. Se mantiene la
  escala de notas.

## ACs Afectados
Ninguno — fix autónomo.

## Cambio
- **`src/app/app.routes.ts`**, **`src/app/core/services/auth/menu-config.service.ts`** — Archivo
  (admin y secretaria) sin `pilotPhaseGuard` ni `hiddenInPilotRecorte`.
- **`src/app/features/admin/profesional-promociones/admin-promocion-ver-drawer.component.ts`** —
  extraer el contenido a un componente reutilizable (organismo de `shared/`).
- **`src/app/features/admin/profesional-archivo/admin-profesional-archivo.component.ts`** — usar
  ese componente para la promoción elegida; sección académica oculta en el piloto.
- **`src/app/core/facades/archivo-profesional.facade.ts`** — filtrar promociones por sede (S23).
- **`src/app/features/admin/profesional-promociones/admin-profesional-promociones.component.ts`** —
  quitar "Finalizada" del filtro.
- Actualizar `indices/COMPONENTS.md` con el componente nuevo.

## Test de Regresión
- E2E: Archivo accesible para admin y secretaria; elegir una promoción finalizada muestra sus
  cursos, relatores y alumnos; no se ven columnas de asistencia/nota.
- E2E: el filtro de Promociones no ofrece "Finalizada".

**Verificado el 2026-10-05** (unit + visual con Playwright; no se agregó un E2E nuevo):
- Vitest 82/82 en los 9 archivos tocados: `archivo-profesional.facade.spec` (S23: filtra por
  sede; "todas" no filtra), `promociones.facade.spec` (`loadPromocionDetalle()`),
  `promocion-detalle-content.component.spec` (nuevo, 4), `admin-profesional-archivo.component.spec`
  (nuevo, 4: académico oculto en piloto, elegir carga el detalle, no muestra una seleccionada de
  otra pantalla, recarga al volver), `admin-profesional-promociones.component.spec` (filtro sin
  "Finalizada"), `menu-config.service.spec` (Archivo visible), drawers. `tsc` y `lint:arch` sin
  errores (ARCH-09 por tamaño del componente nuevo: aviso; `bg-surface-elevated` de Archivo, previo).
- Visual admin: `/app/admin/clase-profesional/archivo` carga (antes "Módulo no disponible"), lista
  7 finalizadas; la 277 muestra el mismo detalle que "Ver promoción" (A2 con 1 alumno
  "Completado"), sin columnas de asistencia/nota. A 1440 px el detalle scrollea dentro del panel
  (main 843/843, panel 1482/427); a 929 px scroll nativo. "Ver promoción" de la 280 se ve igual que
  antes. Consola sin errores.
- Visual secretaria (`secretaria2@test.com`, sede 2): ítem Archivo en el menú y la página lista
  las 7 finalizadas de su sede.

## Cambios hechos
- `PromocionesFacade.loadPromocionDetalle(id)` + `isLoadingDetalle`; consulta y conteo de inscritos
  extraídos (`PROMOTION_ROW_SELECT`, `fetchEnrolledCounts()`) para no duplicarlos.
- `ArchivoFacade.fetchPromociones()` filtra por la sede activa (S23).
- `app-promocion-detalle-content` (nuevo, `shared/`); el drawer "Ver promoción" quedó en ~100 líneas.
- Archivo: detalle reutilizado; selector de curso, tabla y KPIs académicos solo si
  `!isBlockedInPilot('clase-profesional-recorte')`.
- Rutas admin/secretaria y menú: Archivo sin bloqueo de piloto. Filtro de Promociones sin
  "Finalizada".
