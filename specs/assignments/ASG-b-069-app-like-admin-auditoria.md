# Asignación ASG-b-069 — App-like: `/admin/auditoria`

> **status:** completada
> **owner:** m
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-08-03
> **created_by:** b
> **claimed_by:** m
> **claimed_at:** 2026-08-05
> **resulting_track:** fix-122-m-app-like-admin-auditoria

---

## Contexto / Objetivo

Quinta pieza del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`). `AdminAuditoriaComponent`
tiene hero (`bento-grid--hero-fit`, no aporta app-like) + card de tabla (grid CSS custom, no
`<table>`) con `<p-paginator>` **server-side** (`facade.setPage()` dispara un fetch nuevo al
backend, 25 registros/página — comentario explícito en el código: "Debe coincidir con PAGE_SIZE
de AuditoriaFacade") + un banner informativo sobre política de correos como 3ra celda separada
del grid.

**⚠️ El paginador NO se saca** (a diferencia de instructores/secretarias) — es server-side, no
hay una lista completa cargada en memoria para scrollear. Cargar todo el log de auditoría de una
vez podría ser miles de filas.

**Decisión ya tomada sobre el banner (2026-08-02):** se mueve DENTRO de la card de tabla como
footer fijo (debajo del `<p-paginator>`, `shrink-0`), en vez de quedar como 3ra celda del grid —
ningún modificador `--fill-screen-*` existente soporta "hero + fila fill + fila estática abajo",
y el banner es contenido corto directamente relacionado con la tabla de arriba (no pierde
contexto al moverse).

Plan:

1. Mantener `<p-paginator>` tal cual (server-side, 25/página) — sin cambios en su lógica.
2. Root: `bento-grid--hero-fit` → `bento-grid--fill-screen`.
3. Card de tabla → agregar `bento-fill flex flex-col h-full`.
4. Wrapper de filas (hoy `overflow-x-auto`) → agregar `flex-1 min-h-0 overflow-y-auto` (scroll
   interno de las 25 filas de la página actual; toolbar de filtros y paginador quedan fijos
   arriba/abajo).
5. Mover el banner informativo de política de correos dentro de la card, como último elemento
   (`shrink-0`), debajo del `<p-paginator>`.

Sin lógica de densidad nueva que testear (el paginador ya existe y es server-side).

## Checklist de cierre (rollout app-like)

- [ ] `force-compact` verificado con un drawer abierto
- [ ] `/verify` en 390×844, 1440×900 y 768 de alto
- [ ] Confirmar que mover el banner dentro de la card no rompe el export a Excel/PDF (la
      auditoría tiene exportación — verificar que el banner movido no interfiera visualmente con
      el menú de exportar, que usa `position:absolute`)

## Referencias

- `indices/APP-LIKE-ROLLOUT.md` — fila `/admin/auditoria`

## Archivos involucrados

- `src/app/features/admin/auditoria/admin-auditoria.component.ts`
