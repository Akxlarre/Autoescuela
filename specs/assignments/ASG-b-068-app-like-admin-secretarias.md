# Asignación ASG-b-068 — App-like: `/admin/secretarias`

> **status:** completada
> **owner:** i
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-08-03
> **created_by:** b
> **claimed_by:** i
> **claimed_at:** 2026-08-05
> **resulting_track:** fix-017-i-app-like-admin-secretarias

---

## Contexto / Objetivo

Cuarta pieza del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`). `AdminSecretariasComponent`
tiene hero + **1 sola fila** con 2 celdas lado a lado: `bento-wide` (9 cols, lista de secretarias
con paginación Anterior/Siguiente hand-rolled) + `bento-tall` (3 cols, sidebar estático:
descripción de rol + permisos + link a auditoría).

**⚠️ Importante — modificador correcto (ya verificado, no repetir el análisis):** es
`bento-grid--fill-screen` (singular — 1 fila que se reparte en columnas), **NO**
`--fill-screen-2` (que es para 2 filas apiladas verticalmente, como `/admin/dashboard`). Se
confirmó leyendo `_bento-grid.scss`: `--fill-screen` = `grid-template-rows: auto minmax(0,1fr)`
(hero + 1 fila fill que reparte en columnas); `--fill-screen-2` = `auto minmax(0,1fr)
minmax(0,1fr)` (hero + 2 filas fill apiladas).

Plan:

1. Root: agregar `bento-grid--fill-screen` (elimina el `style="--bento-row-min: 125px"` inline si
   ya no aporta nada con las filas explícitas del modificador — verificar).
2. Card lista (`bento-wide`, ya tiene `flex flex-col h-full`) → agregar `bento-fill`.
3. Su `<div class="flex-1">` interno (línea ~148 del componente actual) → agregar
   `min-h-0 overflow-y-auto`.
4. Sidebar (`bento-tall`, ya `h-full flex flex-col`) → agregar `bento-fill` TAMBIÉN — comparte la
   misma fila `minmax(0,1fr)` que la lista, necesita `contain:size` igual para no estirar la fila
   con su propio contenido.
5. Pagination Anterior/Siguiente (hand-rolled, no `p-table`) → mismo tratamiento que
   instructores (ver ASG-b-066): `LayoutService` + `mobileShown` + `sliceByBudget` + "Cargar más",
   reset en cada cambio de búsqueda/filtro.

## Checklist de cierre (rollout app-like)

- [ ] `force-compact` verificado con un drawer abierto
- [ ] `.spec.ts` nuevo para `mobileShown`/densidad — obligatorio por `testing-tdd.md`
- [ ] `/verify` en 390×844, 1440×900 y 768 de alto — prestar atención especial a cómo se ve el
      sidebar `bento-tall` en 768px de alto (contenido casi seguro cabe siempre, pero confirmar)

## Referencias

- `indices/APP-LIKE-ROLLOUT.md` — fila `/admin/secretarias`
- `src/app/shared/components/alumnos-list-content/alumnos-list-content.component.ts:867-936` —
  patrón de densidad a copiar

## Archivos involucrados

- `src/app/features/admin/secretarias/admin-secretarias.component.ts`
