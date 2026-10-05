# Fix: Las promociones finalizadas no se pueden consultar en el piloto
> id: fix-326-m-archivo-profesional-en-piloto
> refs: fix-319-m-testing-clase-profesional-piloto (S4, S23, D3a) · fix-256-m · ASG-i-025
> status: in_progress
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
