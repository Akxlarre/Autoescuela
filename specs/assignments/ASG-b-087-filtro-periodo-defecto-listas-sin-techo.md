# Asignación ASG-b-087 — Listas sin techo: filtro de período por defecto + búsqueda/export deben ignorarlo + límite en Deudores

> **status:** completada
> **owner:** cualquiera
> **tipo_sugerido:** fix
> **priority:** P1
> **created:** 2026-08-03
> **created_by:** b
> **claimed_by:** b
> **claimed_at:** 2026-08-22
> **resulting_track:** 0038-b-filtro-periodo-listas-sin-techo

---

## Contexto / Objetivo

Investigación completa en `docs/research/listas-grandes-virtual-scroll.md` (hallazgo original de
`indices/APP-LIKE-ROLLOUT.md` §"Edge cases estresados", más una ronda de estrés-test con `grill_me`
el 2026-08-03 que corrigió el alcance). De las ~10 páginas que la auditoría original sospechaba en
riesgo por "mostrar todo + scroll sin paginar", solo quedan 3 acciones reales de bajo esfuerzo — el
resto ya estaba resuelto o mal clasificado (ver §5.1 y §6 del documento para el detalle completo).

Esta asignación cubre **solo la parte barata** (sin virtual scroll — eso es `ASG-b-088` aparte).

## Alcance sugerido

- `PagosFacade.fetchDeudores` (`src/app/core/facades/pagos.facade.ts:265-271`) no tiene `.limit()` —
  agregar `.limit(200)`, mismo patrón que ya usa `fetchPagosRecientes` unas líneas más abajo
  (`:290-298`, que sí tiene `.limit(50)`).
- Agregar selector de período "Últimos 12 meses / Todo el historial" (default: 12 meses) en:
  - `ex-alumnos` — Clase B y Profesional (`ExAlumnosFacade.loadEgresadosList`, hoy trae TODO el
    historial sin filtro de fecha — el filtro nuevo es de renderizado, no de query, el dataset
    completo se sigue fetcheando igual).
  - `servicios-especiales` (historial de ventas).
  - Misma ventana de 12 meses para ambos cursos (Clase B y Profesional) — decisión ya tomada en el
    estrés-test, no usar ventanas distintas por curso.
- **Regla crítica, no negociable:** la búsqueda (nombre/RUT/n° expediente) y el exportar (Excel/PDF)
  en ambas páginas deben **ignorar siempre** el filtro de período por defecto y operar sobre el
  dataset completo ya fetcheado. Sin esto: (a) buscar a alguien con una matrícula de hace 2 años da
  "0 resultados" en vez de encontrarlo, y (b) exportar puede truncar silenciosamente el historial
  sin que nadie lo note (peor que (a), porque un Excel incompleto no avisa el error). Ver §2.1 y §6
  del documento para el patrón de código recomendado (`computed()` que solo aplica el período
  cuando no hay término de búsqueda activo).
- NO incluye: virtual scroll, migración de tablas hand-rolled a `p-table` — eso es `ASG-b-088`.

## Referencias

- `docs/research/listas-grandes-virtual-scroll.md` (documento completo, secciones 2, 2.1, 5.1 y 6)
- `indices/APP-LIKE-ROLLOUT.md` §"Edge cases estresados" (hallazgo original, en la rama
  `claude/tareas-pendientes-sfh2vp` — no está mergeado en todas las ramas todavía)

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/facades/pagos.facade.ts`
- `src/app/core/facades/ex-alumnos.facade.ts`
- `src/app/features/admin/alumnos/ex-alumnos/admin-ex-alumnos.component.ts`
- `src/app/shared/components/servicios-especiales-content/servicios-especiales-content.component.ts`

## Notas para quien la reclame

- Prioridad Media-Alta porque el caso de "búsqueda de matrícula vieja da 0 resultados" es un bug de
  UX real y silencioso, no solo deuda técnica de performance — vale la pena resolverlo aunque el
  volumen de datos actual sea bajo (hoy la BD solo tiene datos de seed, no de producción real).
- `liquidaciones` fue investigada y descartada — ya está scopeada por mes
  (`liquidaciones-content.component.ts:739-748`), no necesita ningún cambio de esta asignación.
- El componente de selector de período: evaluar si conviene un componente compartido reusable
  (dado que aplica igual a 2 páginas hoy, y potencialmente a más si se agregan listas históricas a
  futuro) o resolverlo suelto en cada una — no hay una decisión previa tomada sobre esto.

---

## Revalidación contra `main` (2026-08-22)

Esta asignación vivió 19 días sin mergear en `claude/exciting-curie-2bdfdd` (164 commits detrás
de `main`). Al rescatarla se revalidaron los 3 puntos del alcance contra el código actual:

| Punto del alcance | Estado hoy | Nota |
|---|---|---|
| `.limit()` en deudores | ✅ **Sigue vigente** | ⚠️ El método se **renombró**: ya no es `fetchDeudores` sino **`fetchAlumnosConDeuda(branchId)`** en `pagos.facade.ts`. Sigue sin `.limit()`. El patrón de referencia también se movió: `fetchPagosRecientes` tiene su `.limit(50)` en `:302` |
| Selector de período en `ex-alumnos` | ✅ **Sigue vigente** | `ExAlumnosFacade.loadEgresadosList()` sigue trayendo **todos** los `enrollments` con `status='completed'`, sin `.limit()` ni filtro de fecha. Ojo al buscar: el `.gte('updated_at', startOfYear)` que aparece cerca es de `loadStatistics()` (el conteo anual), **no** de la lista |
| Selector de período en `servicios-especiales` | ⚠️ **Parcialmente resuelto** | La query del historial ya tiene `.limit(200)` (`servicios-especiales.facade.ts:185`), así que la parte de "lista sin techo" ya no aplica. Lo que **sí** falta ahí es el selector de período como tal |

La **regla crítica** (búsqueda y export ignoran siempre el filtro de período) no cambió y sigue
siendo el corazón de la asignación — es el bug de UX silencioso, no la performance.

Las rutas de archivo de la sección "Archivos involucrados" arriba siguen siendo correctas; lo que
cambió son los nombres de método dentro de `pagos.facade.ts`.
