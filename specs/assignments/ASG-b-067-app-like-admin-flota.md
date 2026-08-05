# Asignación ASG-b-067 — App-like: `/admin/flota` (`flota-list-content`)

> **status:** pendiente
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-08-03
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Tercera pieza del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`). `AdminFlotaComponent` es un
wrapper sin template propio — todo el trabajo vive en
`shared/components/flota-list-content/flota-list-content.component.ts`.

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

## Checklist de cierre (rollout app-like)

- [ ] `force-compact` verificado con un drawer abierto
- [ ] `/verify` en 390×844, 1440×900 y 768 de alto
- [ ] No aplica ítem de tests nuevos (sin `computed()` de densidad agregado en esta pieza)

## Referencias

- `indices/APP-LIKE-ROLLOUT.md` — fila `/admin/flota`
- Cualquiera de las 6 páginas hermanas listadas arriba como referencia exacta del patrón
  `p-table` + `scrollable` + `paginator`

## Archivos involucrados

- `src/app/features/admin/flota/admin-flota.component.ts` (wrapper, probablemente sin cambios)
- `src/app/shared/components/flota-list-content/flota-list-content.component.ts`
