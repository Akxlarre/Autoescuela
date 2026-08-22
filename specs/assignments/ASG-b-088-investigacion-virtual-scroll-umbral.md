# Asignación ASG-b-088 — Investigación empírica: simular datos y validar el umbral de virtual scroll

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

Continuación de `ASG-b-087` (que resuelve la parte barata del hallazgo de "listas sin techo").
Esta asignación es la investigación empírica que decide **si** y **cuándo** hace falta virtual
scroll (`p-table [virtualScroll]`, backed por Angular CDK) en `ex-alumnos` y `servicios-especiales`
(historial de ventas) — las únicas 2 páginas que quedaron como acumulativas reales tras el
estrés-test del 2026-08-03 (ver `docs/research/listas-grandes-virtual-scroll.md`, categoría B).

El equipo decidió explícitamente **no** dejar esto en modo "esperar a que pase en producción" —
se puede y se debe simular ahora, con un entregable concreto, en vez de quedar como deuda técnica
sin fecha.

## Alcance sugerido

- Sembrar ~500-1.000 filas sintéticas en `special_service_sales` y/o `enrollments` (status
  `completed`) en un ambiente de **dev/staging, nunca producción** — simula el "peor caso a 5 años"
  calculado en el documento (§2: Clase B 240-600/año, Profesional 120-240/año, servicios-especiales
  60-240/año).
- Correr una pasada de Performance (Chrome DevTools o Playwright) sobre `ex-alumnos` y
  `servicios-especiales` con ese volumen sembrado, filtrando y buscando como lo haría una
  secretaria real (no un dev con laptop potente — usar hardware de referencia típico de oficina si
  es posible).
- Confirmar o ajustar el umbral estimado de **300 filas filtradas** (§4 del documento) con el dato
  empírico de en qué punto el re-render de un filtro (`@for` + `OnPush`) empieza a sentirse lento.
- Solo si el benchmark confirma jank real por debajo del acumulado proyectado a 5 años: implementar
  — migrar las tablas hand-rolled afectadas a `p-table` (prerequisito, mismo patrón ya adoptado en
  `flota-list-content`/`dms-list-content`/`vehicle-maintenances`) y activar
  `[virtualScroll]="true" [virtualScrollItemSize]="N"` sobre el umbral confirmado, como constante
  compartida (`LIST_VIRTUAL_SCROLL_THRESHOLD` en `core/utils/layout-tier.utils.ts`, junto a
  `sliceByBudget`).
- Si el benchmark NO muestra jank real ni siquiera en el peor caso simulado, documentarlo y cerrar
  sin implementar nada — no construir infraestructura para un problema que no existe.

## Referencias

- `docs/research/listas-grandes-virtual-scroll.md` (documento completo — secciones 3, 4 y 5.2)
- `ASG-b-087` (la parte barata que no depende de esta investigación)

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/core/utils/layout-tier.utils.ts`
- `src/app/features/admin/alumnos/ex-alumnos/admin-ex-alumnos.component.ts`
- `src/app/shared/components/servicios-especiales-content/servicios-especiales-content.component.ts`
- Migraciones/seed de datos sintéticos (nueva, en `supabase/scripts/` o similar — no crear en
  `supabase/migrations/` para no ensuciar el historial idempotente real)

## Notas para quien la reclame

- Prioridad Baja/P2 a propósito — no bloquea nada del rollout app-like ni de `ASG-b-087`. Es
  investigación proactiva, no una urgencia.
- No reclamar esto como excusa para posponer `ASG-b-087` — son independientes, `ASG-b-087` no
  depende de este resultado.
- Verificado en el estrés-test que ninguna de las 2 tablas tiene contenido de altura variable
  (multilínea) que bloquee `virtualScrollItemSize` fijo — no debería haber sorpresas técnicas ahí,
  el benchmark es sobre todo para medir EN QUÉ NÚMERO empieza el jank, no para descubrir si es
  técnicamente viable.
