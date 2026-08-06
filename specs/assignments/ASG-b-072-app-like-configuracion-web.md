# Asignación ASG-b-072 — App-like: `/admin/configuracion-web` + `/secretaria/configuracion-web`

> **status:** reclamada
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-08-03
> **created_by:** b
> **claimed_by:** m
> **claimed_at:** 2026-08-06
> **resulting_track:** fix-124-m-app-like-configuracion-web

---

## Contexto / Objetivo

Paso 6b del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`). `AdminConfiguracionWebComponent`
(shared entre admin y secretaria) tiene 6 tabs — `general`/`hero`/`cursos`/`promo`/`contacto`/
`faqs` — cada una su PROPIO componente `*-tab.component.ts` separado, usando `<app-tabs>` (el
shared `TabsComponent`, no hand-rolled). Base ideal para el patrón: las tabs ya existen, solo
falta el shell.

Plan:
1. Root → `bento-grid--fill-screen-kpi` alrededor de `<app-tabs>`.
2. Panel de la tab activa → `bento-fill flex flex-col h-full` con scroll interno del formulario.
3. **Verificar al implementar** (no revisados los 6 componentes en la auditoría): al ser 6
   archivos separados, confirmar que ninguno tenga su propia altura fija o estructura que rompa
   el fill (mismo tipo de anti-patrón que se encontró en `dms-list-content`, ASG-b-071).

## Checklist de cierre (rollout app-like)

- [ ] `force-compact` verificado con drawer abierto
- [ ] Sin lógica de densidad nueva → sin tests obligatorios adicionales
- [ ] `/verify` en **AMBAS rutas** (admin y secretaria — componente `shared`), en 390×844,
      1440×900 y 768 de alto
- [ ] Revisar los 6 `*-tab.component.ts` uno por uno antes de aplicar el shell — no asumir que
      todos calzan igual

## Referencias

- `indices/APP-LIKE-ROLLOUT.md` — fila `/admin/configuracion-web`, `/secretaria/configuracion-web`

## Archivos involucrados

- `src/app/features/admin/configuracion-web/admin-configuracion-web.component.ts`
- `src/app/features/admin/configuracion-web/tabs/general-tab.component.ts`
- `src/app/features/admin/configuracion-web/tabs/hero-tab.component.ts`
- `src/app/features/admin/configuracion-web/tabs/cursos-tab.component.ts`
- `src/app/features/admin/configuracion-web/tabs/promo-tab.component.ts`
- `src/app/features/admin/configuracion-web/tabs/contacto-tab.component.ts`
- `src/app/features/admin/configuracion-web/tabs/faqs-tab.component.ts`
