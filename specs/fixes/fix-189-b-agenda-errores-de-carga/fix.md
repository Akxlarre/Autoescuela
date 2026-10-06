# Fix: La Agenda no avisa cuando falla la carga
> id: fix-189-b-agenda-errores-de-carga
> refs: ASG-i-026 (hallazgo H3 de fix-186-b — sospecha S11 del checklist 026)
> status: done
> created: 2026-10-06

## Root Cause
[Confirmado en fix-186-b, caso A08: con las consultas cortadas la Agenda muestra una semana
vacía, sin mensaje.] En `AgendaFacade`, `fetchAvailableSlots`, `fetchSessions`, `loadInstructors` y
`loadLookupMaps` toman solo `data` y descartan `error`: una consulta fallida (timeout de la vista,
ya visto en producción en `hotfix-003-i`, o un corte de red) devuelve `[]` y se ve igual que una
semana sin horarios. Además, aunque `loadWeek()` tiene un `catch` que llena el signal `error`,
nunca se dispara (nada lanza) y ninguna de las 2 páginas lo muestra.

## ACs Afectados
Ninguno de una spec previa. ACs propios:

- **F1:** si falla cualquiera de las consultas de la Agenda, el facade expone `error` y no deja
  la grilla de otra semana como si fuera la actual.
- **F2:** la Agenda (admin y secretaria) muestra "No se pudo cargar la agenda" con un botón
  "Reintentar" que vuelve a cargar todo.
- **F3:** cuando una carga posterior sale bien (reintento, cambio de semana o tiempo real), el
  mensaje desaparece.
- **F4:** un refresco silencioso que falla (tiempo real) no tapa datos que ya se estaban viendo.

## Cambio
- `src/app/core/facades/agenda.facade.ts` (+ spec)
- `src/app/shared/components/agenda-semanal/agenda-semanal.component.ts` — inputs `error`, output `retry`
- `src/app/features/admin/agenda/admin-agenda.component.ts`, `features/secretaria/agenda/secretaria-agenda.component.ts`
- `e2e/agenda.spec.ts` — A08 deja de ser `knownBug`

## Test de Regresión
- `npx vitest run src/app/core/facades/agenda.facade.spec.ts`
- `npx playwright test e2e/agenda.spec.ts -g A08` contra el build de producción.

## Resultado (2026-10-06)
- `agenda.facade.spec.ts` 24/24 (6 nuevos: falla de la vista, de las clases y de instructores;
  semana que falla no deja la grilla anterior; `retry()` limpia el error; refresco silencioso que
  falla no borra lo visible). `npm run test:ci` 3359/3359, `ng build` OK, `lint:arch` 0 errores.
- E2E `e2e/agenda.spec.ts` 25/25 contra el build de producción: **A08 deja de ser `knownBug`** y
  pasa — con las consultas cortadas aparece "No se pudo cargar la agenda"; al reconectar,
  "Reintentar" carga la grilla y el aviso desaparece.
- Fuera de alcance (mismo patrón, otra pantalla): la grilla de "Reprogramar" de la ficha
  (`admin-alumno-detalle.facade.ts`) también muestra "Sin disponibilidad" ante un error.
