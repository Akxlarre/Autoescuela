# Fix: Dashboard muestra clase no_show como Concluida
> id: fix-193-m-dashboard-clase-concluida-en-no-show
> refs: —
> status: done
> closed: 2026-08-19
> created: 2026-08-19

## Root Cause
`DashboardFacade.mapPracticaRow()` (`src/app/core/facades/dashboard.facade.ts`) colapsa
`row.status === 'no_show'` dentro de `'completed'` al construir el `LiveClassModel` del
panel "Clases Actuales". El tipo `LiveClassModel.status` (`core/models/ui/dashboard.model.ts`)
tampoco declara `'no_show'` como valor posible. El resultado: una clase marcada `no_show` por
el cron de las 21:00 se ve en el Dashboard como "Concluida"/"Finalizada" (panel) y "Completada"
(drawer de detalle), aunque la asistencia real fue "Ausente" (correcto en Asistencia B, que lee
`no_show` sin colapsar). El drawer de detalle (`agenda-slot-detail-drawer.component.ts`) ya
tiene un `case 'no_show'` con label "No asistió" que nunca se activa porque el dato llega
pre-colapsado desde el Facade.

## ACs Afectados
Ninguno — fix autónomo (no hay spec formal para el panel "Clases Actuales").
- AC-1: Una clase con `class_b_sessions.status = 'no_show'` se refleja en el Dashboard
  ("Clases Actuales" y su drawer de detalle) con un estado distinguible de "Concluida",
  consistente con lo que ya muestra Asistencia B.

## Cambio
- **Archivo:** `src/app/core/models/ui/dashboard.model.ts`
  **Qué cambia:** agrega `'no_show'` a la unión de `LiveClassModel.status`.
- **Archivo:** `src/app/core/facades/dashboard.facade.ts`
  **Qué cambia:** `mapPracticaRow()` deja de colapsar `no_show` en `completed`; propaga
  `'no_show'` tal cual.
- **Archivo:** `src/app/shared/components/live-classes-panel/live-classes-panel.component.ts`
  **Qué cambia:** `statusLabel()` y `getRelativeTime()` distinguen `'no_show'` ("No Asistió")
  de `'completed'` ("Finalizada"/"Concluida"); clases de color/ícono existentes de `completed`
  se extienden a `no_show` (misma familia visual "clase cerrada", no una nueva).

## Test de Regresión
- `src/app/core/facades/dashboard.facade.spec.ts > mapPracticaRow > preserva no_show en vez de colapsarlo a completed` ✓
- `src/app/shared/components/live-classes-panel/live-classes-panel.component.spec.ts > statusLabel > no_show devuelve "No Asistió"` ✓
