# Asignación ASG-b-073 — App-like: familia "servicios especiales" (`admin` + `secretaria`)

> **status:** reclamada
> **owner:** i
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-08-03
> **created_by:** b
> **claimed_by:** i
> **claimed_at:** 2026-08-08
> **resulting_track:** fix-021-i-app-like-servicios-especiales

---

## Contexto / Objetivo

Paso 7 del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`). `servicios-especiales-content`
(shared entre admin y secretaria): hero + **2 `.bento-banner` apiladas de ancho completo**
(Catálogo arriba, Historial de Ventas abajo) — NO son 2 columnas lado a lado. Historial es una
`<table>` hecha a mano SIN paginación de ningún tipo (ni desktop ni fallback mobile `sm:hidden`).

Plan:
1. Root → `bento-grid--fill-screen-2` (2 filas fill apiladas — no `--fill-screen` singular).
2. Catálogo: `bento-fill flex flex-col h-full` en el card; grid interno de servicios →
   `flex-1 min-h-0 overflow-y-auto`.
3. Historial: mismo tratamiento; tabla desktop `hidden sm:block overflow-x-auto` agrega
   `flex-1 min-h-0 overflow-y-auto`. Mobile (`sm:hidden` cards) sin cambios.

Sin decisión de paginación pendiente — nunca la tuvo, no hay que agregar `sliceByBudget`.

## Checklist de cierre (rollout app-like)

- [ ] `force-compact` verificado con drawer abierto
- [ ] Sin `.spec.ts` nuevo obligatorio (sin lógica de densidad nueva)
- [ ] `/verify` en **AMBAS rutas** (`/admin/servicios-especiales` y
      `/secretaria/servicios-especiales` — componente `shared`), en 390×844, 1440×900 y 768 de alto
- [ ] `app-empty-state` en el historial (si aplica) dentro de wrapper centrado

## Referencias

- `indices/APP-LIKE-ROLLOUT.md` — fila `/admin/servicios-especiales`

## Archivos involucrados

- `src/app/shared/components/servicios-especiales-content/servicios-especiales-content.component.ts`
