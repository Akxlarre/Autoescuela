# Fix: App-like — `/admin/configuracion-web` + `/secretaria/configuracion-web`
> id: fix-124-m-app-like-configuracion-web
> refs: ASG-b-072
> status: in-progress
> created: 2026-08-06

## Root Cause
[Heredado de ASG-b-072, a confirmar]: Paso 6b del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`).
`AdminConfiguracionWebComponent` (shared entre admin y secretaria) tiene 6 tabs —
`general`/`hero`/`cursos`/`promo`/`contacto`/`faqs` — cada una su PROPIO componente
`*-tab.component.ts` separado, usando `<app-tabs>` (el shared `TabsComponent`, no hand-rolled).
Base ideal para el patrón: las tabs ya existen, solo falta el shell.

Plan:
1. Root → `bento-grid--fill-screen-kpi` alrededor de `<app-tabs>`.
2. Panel de la tab activa → `bento-fill flex flex-col h-full` con scroll interno del formulario.
3. **Verificar al implementar** (no revisados los 6 componentes en la auditoría): al ser 6
   archivos separados, confirmar que ninguno tenga su propia altura fija o estructura que rompa
   el fill (mismo tipo de anti-patrón que se encontró en `dms-list-content`, ASG-b-071).

## ACs Afectados

- AC-1: Root del componente usa `bento-grid--fill-screen-kpi` (o el modificador fill-screen que
  corresponda tras confirmar la estructura real del componente).
- AC-2: El panel de la tab activa tiene `bento-fill flex flex-col h-full` y scrollea internamente
  su formulario en desktop (lg+).
- AC-3: Cada uno de los 6 `*-tab.component.ts` (general/hero/cursos/promo/contacto/faqs) fue
  revisado individualmente — ninguno rompe el fill con altura fija o estructura propia
  incompatible.
- AC-4: En Mobile, la página revierte a scroll nativo.
- AC-5: Verificado en ambas rutas (`/admin/configuracion-web` y `/secretaria/configuracion-web` —
  componente shared).

## Checklist de cierre (rollout app-like, heredado de ASG-b-072)

- [ ] `force-compact` verificado con drawer abierto
- [ ] Sin lógica de densidad nueva → sin tests obligatorios adicionales
- [ ] `/verify` en **AMBAS rutas** (admin y secretaria), en 390×844, 1440×900 y 768 de alto
- [ ] Revisar los 6 `*-tab.component.ts` uno por uno antes de aplicar el shell — no asumir que
      todos calzan igual

## Cambio
Pendiente de implementación.

## Test de Regresión
`/verify` visual en ambas rutas — sin lógica de densidad nueva que testear.
