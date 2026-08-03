# Asignación ASG-b-064 — Ningún Facade descarta respuestas "stale" ante cambios rápidos de filtro/sede

> **status:** pendiente
> **owner:** cualquiera
> **tipo_sugerido:** spec
> **priority:** P2
> **created:** 2026-08-03
> **created_by:** b
> **claimed_by:** —
> **claimed_at:** —
> **resulting_track:** —

---

## Contexto / Objetivo

Ninguno de los Facades del proyecto (grep en `core/` de `AbortController`, `requestId`/
`requestToken`, `switchMap`, `debounceTime` — cero resultados salvo un `AbortController` de
timeout en `libro-de-clases.facade.ts:674`, que no es esto) protege contra respuestas
"out-of-order": si un usuario cambia de sede, rango de fechas o filtro dos veces seguidas y la
primera consulta (a la sede/filtro viejo) tarda más en responder que la segunda, el resultado
que gana en pantalla es el **viejo** — sin error, sin indicio visual de que los datos no
corresponden al filtro actualmente seleccionado.

Es fácil de gatillar: `BranchFacade.selectedBranchId()` dispara recargas vía `effect()` en
cada Facade branch-scoped (`AdminAlumnosFacade`, `DashboardFacade`, `FlotaFacade`, etc. — ver
`.claude/rules/facades.md` §7), así que un usuario "clickeando rápido" el selector de sede en
el topbar ya alcanza para reproducirlo, sin necesidad de red lenta artificial (aunque en red
lenta/móvil la ventana de la condición de carrera es mucho más ancha).

Detectado en la misma auditoría que `ASG-b-063` ("qué pasa si un usuario usa la app de la peor
forma posible").

## Alcance sugerido

- No es un fix de un archivo — es un patrón ausente en TODA la capa de Facades. Candidato a
  spec porque probablemente conviene una utilidad compartida (`core/utils/` o un mixin/helper
  de Facade) en vez de resolverlo caso por caso en 100+ archivos.
- Patrón mínimo viable: guardar un `_requestId` incremental por Facade; antes de aplicar el
  resultado de una fetch, comparar si sigue siendo el request más reciente disparado; si no,
  descartar la respuesta sin tocar el signal de estado.
- Priorizar primero los Facades **branch-scoped** de la tabla en `.claude/rules/facades.md` §7
  (`AdminAlumnosFacade`, `DashboardFacade`, `FlotaFacade`, `DmsFacade`, `EnrollmentFacade`) —
  son los que reaccionan a un `effect()` externo y no controlan la cadencia de sus propias
  llamadas, a diferencia de un buscador con debounce propio.
- No confundir con debounce de input de búsqueda — `GlobalSearchFacade` ya está bien resuelto
  (filtra en memoria sobre signals ya cargados, no golpea Supabase por keystroke) y no necesita
  este fix.

## Referencias

- `.claude/rules/facades.md` §7 (Facades Multi-Sede) — lista completa de Facades branch-scoped
  afectados y el patrón de `effect()` en el Smart Component que dispara las recargas.
- `.claude/rules/swr-pattern.md` — el patrón SWR/Realtime existente no cubre este caso (resuelve
  cache vs. skeleton, no orden de llegada de respuestas).

## Archivos involucrados (opcional, para detectar solapes)

- Ninguno declarado — el alcance real (qué Facades entran en la primera pasada) se decide al
  escribir la spec, ver "Alcance sugerido" arriba para la lista candidata inicial.

## Notas para quien la reclame

- Prioridad P2: el síntoma es "se ve el dato viejo un instante hasta el próximo refresh/acción",
  no pérdida de datos ni de dinero (a diferencia de `ASG-b-063`) — pero sí puede llevar a una
  secretaria a tomar una decisión sobre datos de la sede equivocada si no vuelve a mirar.
- Vale la pena spikear el patrón en UN Facade primero (sugerido: `AdminAlumnosFacade`, el más
  simple de los branch-scoped) antes de comprometerse a aplicarlo a los ~100 Facades del
  proyecto — puede que el alcance real termine siendo "solo los branch-scoped", no todos.
