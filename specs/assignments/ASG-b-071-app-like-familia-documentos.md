# Asignación ASG-b-071 — App-like: familia "documentos" (`admin` + `secretaria`)

> **status:** completada
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-08-03
> **created_by:** b
> **claimed_by:** b
> **claimed_at:** 2026-08-10
> **resulting_track:** fix-129-b-app-like-familia-documentos

---

## Contexto / Objetivo

Paso 6 del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`). `/admin/documentos` y
`/secretaria/documentos` comparten el mismo componente `dms-list-content` (4 tabs:
`students`/`school`/`templates`/`instructors`), root hoy `bento-grid--rows-fit`.

**Hallazgo importante:** la tab "students" tiene `h-125` (500px) **hardcodeado** — anti-patrón,
hay que sacarlo ANTES de aplicar fill (una altura fija no convive con `.bento-fill`). Posible
split de columnas 8/4 dentro de esa tab sin verificar completo (archivo de 753 líneas, no
mapeado del todo en la auditoría).

Plan:
1. Root → `bento-grid--fill-screen-kpi` (hero=auto, tabs-nav=auto, panel activo=fill).
2. Envolver el `@switch(activeTab())` completo en un contenedor `bento-fill flex flex-col h-full`
   (una sola celda, sin importar cuál tab esté activa).
3. Sacar el `h-125` fijo de la tab "students" → `h-full flex-1 min-h-0`.
4. Los 2 `p-table` (students, instructors) → agregar `[scrollable]="true" scrollHeight="flex"`
   manteniendo el paginador condicional (`length > 10`) — mismo patrón ya probado en 6 páginas
   hermanas (`alumnos-list-content`, etc.).
5. **Verificar al implementar** (no resuelto en la auditoría): el split 8/4 de columnas en
   "students", y la estructura de las tabs "school"/"templates" (no se leyeron completas).

## Checklist de cierre (rollout app-like)

- [ ] `force-compact` verificado con drawer abierto
- [ ] `.spec.ts`: sin lógica de densidad nueva (el paginador condicional ya existía) — no
      obligatorio salvo que se agregue algo nuevo al implementar
- [ ] `/verify` en **AMBAS rutas** (`/admin/documentos` Y `/secretaria/documentos` — componente
      `shared`, ver ítem 4 de "Edge cases estresados"), en 390×844, 1440×900 y 768 de alto
- [ ] `app-empty-state`/skeletons dentro del `.bento-fill` en wrapper centrado (regla nueva)

## Referencias

- `indices/APP-LIKE-ROLLOUT.md` — filas `/admin/documentos` y `/secretaria/documentos`

## Archivos involucrados

- `src/app/shared/components/dms-list-content/dms-list-content.component.ts`
