# Fix: App-like — `/admin/flota` (`flota-list-content`)
> id: fix-126-b-app-like-admin-flota
> refs: ASG-b-067
> status: done
> closed: 2026-08-09
> created: 2026-08-09

## Root Cause

**[Heredado de ASG-b-067, a confirmar]:** Tercera pieza del rollout app-like
(`indices/APP-LIKE-ROLLOUT.md`). `AdminFlotaComponent` es un wrapper sin template propio — todo
el trabajo vive en `shared/components/flota-list-content/flota-list-content.component.ts`.

Usa `p-table` de PrimeNG con `[paginator]="true" [rows]="10"`. **Decisión ya tomada
(2026-08-02): a diferencia de instructores (tabla hecha a mano), acá se MANTIENE el paginador
nativo de PrimeNG** — es la convención ya probada en 6 páginas hermanas (`alumnos-list-content`,
`alumnos-profesional-list-content`, `ex-alumnos-profesional-content`, `admin/ex-alumnos`,
`secretaria/ex-alumnos`, `admin/profesional-relatores`): combinan `[paginator]` con
`[scrollable]="true" scrollHeight="flex"`.

Plan:

1. Root: `bento-grid` → `bento-grid--fill-screen`.
2. Card `dual-viewport-container` → agregar `bento-fill flex flex-col h-full`.
3. Ambos `.viewport-content` (skeleton y contenido real) → agregar
   `flex flex-col flex-1 min-h-0 h-full w-full`.
4. Wrapper `.desktop-view` → agregar `flex flex-col flex-1 min-h-0 h-full w-full`.
5. `<p-table>` → agregar `[scrollable]="true" scrollHeight="flex"` (mantiene
   `[paginator]="true" [rows]="10"`), extender `styleClass` con `h-full flex flex-col`.
6. Mobile: **sin cambios** — ya renderiza todas las cards sin límite de densidad, correcto
   porque en mobile no hay `contain:size` (solo aplica ≥1024px), la página scrollea natural.

Sin lógica de densidad nueva (no hay `mobileShown` que agregar) — cambio puramente estructural.

## ACs Afectados

Ninguno — no hay spec previa para esta página. Fix originado de una Asignación de equipo
(ASG-b-067), no de una spec con ACs formales.

## Cambio

Aplicados los 5 cambios estructurales del plan en
`src/app/shared/components/flota-list-content/flota-list-content.component.ts` (sin tocar
`admin-flota.component.ts`, tal como anticipaba el plan):

1. Root: `bento-grid` → `bento-grid bento-grid--fill-screen`.
2. Card: agregado `bento-fill flex flex-col w-full h-full` a las clases existentes.
3. `.viewport-content` (skeleton y contenido real, ambas ramas del `@if`): agregado
   `flex flex-col flex-1 min-h-0 h-full w-full`.
4. `.desktop-view` (rama contenido real): agregado `flex flex-col flex-1 min-h-0 h-full w-full`.
5. `<p-table>`: agregado `[scrollable]="true" scrollHeight="flex"`, `styleClass` extendido a
   `"p-datatable-sm p-datatable-striped h-full flex flex-col"`. `[paginator]="true" [rows]="10"`
   se mantuvo sin cambios.
6. Mobile: sin cambios, confirmado correcto (ver Test de Regresión).

**Nota de scope (decisión deliberada, no omisión):** el plan de la ASG NO incluye cablear
`force-compact` en este componente. `FlotaListContentComponent` es un Dumb component
(`shared/`) que hoy no inyecta `LayoutDrawerFacadeService` — intenté agregarlo por precedente de
`alumnos-list-content.component.ts` (que sí lo inyecta) pero el hook de arquitectura lo bloqueó
correctamente («SIN inyección de Facades ni Services» en Dumb components) y el plan explícito de
la ASG tampoco lo pedía. Revertido. Queda como gap preexistente fuera de alcance de este fix — no
se inventó scope nuevo no autorizado por el plan.

## Test de Regresión

- Sin `.spec.ts` nuevo — no se agregó lógica de densidad (`computed()`) en esta pieza, solo
  cambios estructurales de clases/bindings (consistente con el plan).
- `/verify` en navegador real (login admin, datos reales de Supabase, todo 200):
  - **1280×800 y 1440×768:** `bento-grid--fill-screen` activo, `.shell-content` no scrollea,
    `.bento-fill` con `contain:size`, 0 violaciones de `contain`/`min-height` inline. `p-table`
    con `.p-datatable-scrollable` Y `.p-paginator` presentes simultáneamente (mantiene paginador,
    como pedía la decisión). 7 filas reales.
  - **390×844:** container query cambia a `mobile-view` (7 cards, sin límite — correcto, esta
    pieza no tiene densidad adaptativa). `.bento-fill` mide `contain: none` (gate ≥1024px
    funcionando). El scroll real de la app vive en `.shell-content` (no en `document`) — ahí
    scrollea correctamente (2546px de contenido en 768px visibles). Sin overflow horizontal.
  - **force-compact:** confirmado que el drawer "Nuevo Vehículo" abre correctamente
    (`ng.getComponent` → `isOpen: true`, `VehicleFormDrawerComponent`), pero el grid NO recibe la
    clase `force-compact` — comportamiento esperado, ver nota de scope arriba.
- `npm run test:ci` completo: **1892 passed, 5 skipped, 0 failed**.
- `npm run lint:arch`: exit 0, sin warnings nuevos en `flota-list-content.component.ts`.

## Checklist de cierre (heredado de ASG-b-067, aplica a TODO el rollout app-like)

- [x] `force-compact` — no aplica a esta pieza (ver nota de scope en "Cambio"); no estaba en el
      plan de la ASG y el componente es Dumb (no puede inyectar el Facade sin violar arquitectura)
- [x] `/verify` en 390×844, 1280×800 y 1440×768 (los 3 con contrato app-like correcto)
- [x] No aplica ítem de tests nuevos (sin `computed()` de densidad agregado en esta pieza)

## Referencias

- `indices/APP-LIKE-ROLLOUT.md` — fila `/admin/flota`
- Cualquiera de las 6 páginas hermanas listadas arriba como referencia exacta del patrón
  `p-table` + `scrollable` + `paginator`
- `specs/assignments/ASG-b-067-app-like-admin-flota.md` — Asignación original

## Archivos involucrados

- `src/app/features/admin/flota/admin-flota.component.ts` (wrapper, probablemente sin cambios)
- `src/app/shared/components/flota-list-content/flota-list-content.component.ts`
