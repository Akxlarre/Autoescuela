# Asignación ASG-b-078 — App-like: portal instructor (resto — `dashboard`, `alumnos`, `liquidacion`, `ensayos-teoricos`, `notificaciones`)

> **status:** completada
> **owner:** b
> **tipo_sugerido:** fix
> **priority:** P2
> **created:** 2026-08-03
> **created_by:** b
> **claimed_by:** b
> **claimed_at:** 2026-08-11
> **resulting_track:** fix-139-b-app-like-portal-instructor-resto

---

## Contexto / Objetivo

Paso 11 del rollout app-like (`indices/APP-LIKE-ROLLOUT.md`) — el resto del portal instructor
que no forma parte de otra familia (tareas y horario ya están en otras piezas). 5 páginas
independientes, sin componente compartido entre ellas — se puede repartir entre varias personas
si conviene, o reclamar entera.

### `/instructor/dashboard` (`InstructorDashboardComponent`)

Hero + 1 SOLA `.bento-banner` con grid Tailwind interno `lg:grid-cols-3` (Clases de Hoy
`col-span-2` + sidebar `col-span-1`) — NO son celdas bento separadas.

Plan: root → `--fill-screen` singular (no `-kpi`). La banner → `bento-fill flex flex-col h-full
overflow-y-auto` (scroll COMPARTIDO de todo el bloque — la lista "de hoy" suele ser corta, no
justifica separar scrolls). ⚠️ Si más adelante se quiere scroll independiente por columna, hay
que convertir el `grid` interno a `flex` (gotcha documentada: grid no propaga altura a hijos
para su propio scroll, spec 0031) — no hacerlo ahora salvo que se decida explícitamente.

### `/instructor/alumnos` (`InstructorAlumnosComponent`)

Paginación hand-rolled real (`PAGE_SIZE=9`, `pageStart/pageEnd`), cards en un `.bento-grid`
ANIDADO dentro de la `.bento-banner` externa.

Plan: root → `--fill-screen`. Banner externa → `bento-fill flex flex-col h-full`; el
`.bento-grid` anidado de cards → `flex-1 min-h-0 overflow-y-auto` (es contenedor de cards, no
necesita su propio `contain:size`). Sacar paginación → mismo patrón `sliceByBudget`+"Cargar más"
mobile / todo+scroll desktop que instructores (ASG-b-066).

### `/instructor/liquidacion` (`InstructorLiquidacionComponent`)

NO son 2 banners — es 1 SOLA `.bento-banner` con `flex flex-col gap-6` interno: chart de
desglose (altura natural) + tabla de logs diarios (necesita scroll).

Plan: root → `--fill-screen` singular. Banner → `bento-fill flex flex-col h-full`; chart card →
`shrink-0`; tabla de logs → `flex-1 min-h-0 overflow-y-auto`.

### `/instructor/ensayos-teoricos` (`InstructorEnsayosTeoricosComponent`)

Hero + 1 `.bento-banner` con 2 `<table>` hand-rolled (resultados/historial), sin paginación.

Plan: `--fill-screen` singular, `.bento-fill` en la banner, cada tabla `flex-1 min-h-0
overflow-y-auto` si ambas caben, o evaluar scroll independiente al implementar.

### `/instructor/notificaciones` (`InstructorNotificacionesComponent`)

Lista corta de notificaciones (única página de notificaciones NO stub de los 4 portales).
Prioridad baja dentro de este lote — `--fill-screen` opcional, la lista suele ser corta y no
compite por alto.

## Checklist de cierre (rollout app-like, aplica a las 5)

- [ ] `force-compact` verificado con drawer abierto en cada página
- [ ] `.spec.ts` nuevo SOLO para `/instructor/alumnos` (`sliceByBudget`/`mobileShown`) —
      obligatorio por `testing-tdd.md`. Las otras 4 no agregan lógica de densidad nueva.
- [ ] `/verify` en 390×844, 1440×900 y 768 de alto, cada página

## Referencias

- `indices/APP-LIKE-ROLLOUT.md` — filas de las 5 páginas, sección "Instructor"

## Archivos involucrados

- `src/app/features/instructor/dashboard/instructor-dashboard.component.ts`
- `src/app/features/instructor/alumnos/instructor-alumnos.component.ts`
- `src/app/features/instructor/liquidacion/instructor-liquidacion.component.ts`
- `src/app/features/instructor/ensayos-teoricos/instructor-ensayos-teoricos.component.ts`
- `src/app/features/instructor/notificaciones/instructor-notificaciones.component.ts`
