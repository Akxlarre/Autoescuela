# Fix: S17 — el tiempo real de la Agenda recarga la semana una vez por cada clase cambiada y no recarga los nombres ni la lista de instructores
> id: fix-239-b-agenda-tiempo-real-sin-freno-ni-nombres
> refs: ASG-i-026 (fix-186-b, hallazgo H6 / sospecha S17; casos G04 y G05)
> status: done
> closed: 2026-11-06
> created: 2026-11-06

## Root Cause
`AgendaFacade` trata cada refresco silencioso (evento de Realtime de `class_b_sessions` y
re-entrada SWR a la página) como "volver a pedir la semana" y nada más:

1. El handler de Realtime llama a `refreshSilently()` por cada evento, sin agruparlos. Una
   matrícula inserta sus clases de una vez y llega un evento por fila: 12 clases → 12 consultas a
   `v_class_b_schedule_availability` (más 12 a `class_b_sessions`) por cada Agenda abierta.
   Medido en G04: 12 consultas en 27 ms. `enrollment.facade.ts` ya agrupa con un debounce de 300 ms.
2. Los nombres (`instructorMap`, `vehicleMap`) y la lista de instructores solo se cargan en la
   primera carga o al cambiar de sede. Un instructor creado después sale como "#225" y no aparece
   en el filtro hasta recargar la página. Medido en G05.

## ACs Afectados
Ninguno de una spec — hallazgo del checklist de testing `specs/testing-piloto/026-agenda-triple-match.md`:
- **G04**: una ráfaga de eventos de Realtime produce una sola recarga de la semana.
- **G05**: al volver a la Agenda (o con un evento de Realtime), un instructor nuevo sale con su
  nombre y está en la lista de instructores, sin perder el instructor elegido.

## Cambio
- **Archivo:** `src/app/core/facades/agenda.facade.ts`
- **Qué cambia:**
  - El handler de Realtime agenda el refresco con un debounce de 300 ms. `disposeRealtime()`
    cancela el timer pendiente.
  - La re-entrada SWR (`initialize()` con la misma sede) recarga antes los nombres
    (`loadLookupMaps`) y la lista de instructores (`reloadCatalogs()`), conservando el instructor
    elegido o "Todos" si sigue en la lista; si ya no está, elige el primero (como al cambiar de
    sede, fix-010-i, ahora en `anchorSelection()`).
  - Un refresco por Realtime no recarga los catálogos salvo que la semana traiga un instructor o
    vehículo que los mapas no conocen (`hasUnknownLookups()` en `fetchWeekData()`).
  - Primera versión descartada: recargar los catálogos en todo refresco. Medido en G04: sumaba
    ~1,7 s antes de pedir la semana y 4 consultas a cada evento, y los eventos espaciados (más de
    300 ms entre sí) no se agrupan.

## Test de Regresión
- `src/app/core/facades/agenda.facade.spec.ts > tiempo real y refresco — fix-239-b (S17)` ✓ 9 tests
  (ráfaga de 12 → 1 recarga, no antes de 300 ms, `dispose()` cancela, G05 al volver y por
  Realtime, conserva el elegido, re-ancla si ya no está, "Todos" se mantiene, un evento con
  catálogos conocidos no los vuelve a pedir). Sin el cambio fallaban 6.
- `e2e/agenda-4.spec.ts > G04` y `> G05` (los tests viven en el PR #375), corridos contra este
  cambio el 2026-11-06 ✓:
  - G04: 12 clases nuevas → **1** consulta a la vista y 1 a clases, a los 1,2 s (antes 12 y 12),
    sin recargar catálogos. Los 12 borrados uno a uno de la limpieza siguen dando 12 refrescos
    (llegan separados más de 300 ms), a 2 consultas cada uno, igual que antes.
  - G05: el horario sale "Slot disponible 08:30 — Instructor4 Apellido4" (antes "#225") y el
    instructor aparece en la lista al volver.
  - Desde la rama `test/g04-g05-exigen-s17`, G04 exige 1 consulta y G05 exige el nombre y que esté en la lista.
