# Asignación ASG-b-066 — App-like: familia "instructores" (`admin` + `secretaria`)

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

Segunda pieza del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`). `/admin/instructores`
(`AdminInstructoresComponent`) y `/secretaria/instructores` (`SecretariaInstructoresComponent`)
son casi el mismo HTML/CSS línea por línea (secretaria no tiene columna "Sede") — mismo cambio en
2 archivos, un solo esfuerzo de diseño.

Hoy: tabla paginada (10/página, botones "Anterior"/"Siguiente" fijos en desktop Y mobile),
`.bento-banner.card.dual-viewport-container` + `bento-grid--hero-fit` (este modificador NO aporta
app-like, solo fija `grid-template-rows:auto` — confirmado en `_bento-grid.scss:111`).

**Decisión de diseño ya tomada con el owner (2026-08-02):** sacar la paginación fija, reemplazar
por el patrón real de `alumnos-list-content.component.ts:867-936`:

1. Root: `bento-grid--hero-fit` → `bento-grid--fill-screen`.
2. Card `dual-viewport-container` → agregar `bento-fill flex flex-col h-full`.
3. `.viewport-content` (hoy solo `bg-surface`) → agregar `flex-1 min-h-0 overflow-y-auto`.
4. **Desktop:** la tabla pasa de `paginatedInstructores()` a `filteredInstructores()` completo
   (sin paginar, el scroll interno reemplaza Anterior/Siguiente).
5. **Mobile:** cards pasan de `paginatedInstructores()` a `visibleCards()` =
   `sliceByBudget(filteredInstructores(), mobileShown())`, con `mobileShown = signal(6)` y botón
   "Cargar más (N restantes)" al final — mismo paso de 6 y mismo texto que `alumnos-list-content`.
6. `mobileShown` se resetea a 6 en cada cambio de `activeFilter`.
7. Eliminar todo el bloque de paginación fija: `currentPage`, `totalPages`,
   `paginationStart/End`, footer "Anterior/Siguiente".

Aplicar EXACTAMENTE igual en los 2 archivos — son independientes (cada uno su propio `.spec.ts`,
no comparten componente).

## Checklist de cierre (rollout app-like)

- [ ] `force-compact` verificado con un drawer abierto en ambas rutas
- [ ] `.spec.ts` nuevo para `mobileShown`/`visibleCards` en CADA archivo (2 sets de tests, no
      comparten lógica al no compartir componente) — obligatorio por `testing-tdd.md`
- [ ] `/verify` en 390×844, 1440×900 y 768 de alto, en AMBAS rutas (`/admin/instructores` y
      `/secretaria/instructores` — no alcanza con verificar solo una)
- [ ] Confirmar que sacar la paginación no rompe ningún deep-link ni estado guardado que dependa
      de un número de página

## Referencias

- `indices/APP-LIKE-ROLLOUT.md` — filas `/admin/instructores` y `/secretaria/instructores`
- `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts:867-936` —
  patrón exacto a copiar (`CARDS_STEP`, `mobileShown`, `visibleCards`, `remainingCards`,
  `loadMoreCards`, `updateFilter`)

## Archivos involucrados

- `src/app/features/admin/instructores/admin-instructores.component.ts`
- `src/app/features/secretaria/instructores/secretaria-instructores.component.ts`
