---
# Fix: Dashboard de Secretaria tampoco permite finalizar una clase en curso
> id: fix-077-m-secretaria-dashboard-finalizar-clase-en-curso
> refs: fix-076-m-dashboard-finalizar-clase-en-curso
> status: done
> closed: 2026-07-27
> created: 2026-07-27

## Root Cause

`SecretariaDashboardComponent.handleLiveClassAction()` (`secretaria-dashboard.component.ts:358-390`)
es una copia duplicada de la misma lógica que `DashboardComponent` tenía antes de fix-076: solo
maneja `status === 'pending'` (abre `AdminIniciarClaseDrawerComponent`); para `in_progress` cae al
`else` genérico e informativo (`AgendaSlotDetailDrawerComponent`, sin acción de finalizar). Mismo bug
que fix-076, en la copia de Secretaria en vez de la de Admin.

## ACs Afectados

- Ninguno — fix autónomo, sin spec asociada.

## Cambio

- **Archivo:** `src/app/features/secretaria/dashboard/secretaria-dashboard.component.ts`
  - `handleLiveClassAction()`: reemplazar el `if/else` manual por `resolveLiveClassActionPlan(cls)`
    (la función pura ya creada y testeada en fix-076, `core/utils/live-class-action.utils.ts`) —
    mismo patrón de despacho que `DashboardComponent`: `iniciar` → `AdminIniciarClaseDrawerComponent`,
    `finalizar` → `AdminFinalizarClaseDrawerComponent` (nuevo caso), `informativo` → comportamiento
    previo intacto.

## Test de Regresión

- Ya cubierto por `live-class-action.utils.spec.ts > resolveLiveClassActionPlan (fix-076)` — la
  función pura reutilizada ya tiene sus 4 casos testeados; no se duplica lógica nueva en este
  componente.
- Suite completa (`npm run test:ci`): 1467/1467 en verde (sin tests nuevos — reutiliza
  `live-class-action.utils.spec.ts` de fix-076).
- `npm run lint:arch`: 0 errores, 165 advertencias (mismas pre-existentes, ninguna nueva).
- `npx tsc --noEmit`: 0 errores.
- Verificación visual: NO ejecutada con Playwright MCP en esta sesión — el usuario (Matías) decidirá
  si la corre en `ng serve`.
