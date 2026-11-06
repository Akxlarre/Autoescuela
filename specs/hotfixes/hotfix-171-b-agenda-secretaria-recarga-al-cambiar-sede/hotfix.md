# Hotfix: la Agenda de secretaria recarga al cambiar de sede
> id: hotfix-171-b-agenda-secretaria-recarga-al-cambiar-sede
> refs: ASG-i-026
> status: done
> closed: 2026-11-06
> created: 2026-11-06

## Problema
F06 / S16 (`fix-186-b`): la secretaria con acceso a las dos sedes elige otra sede en el topbar y la
Agenda sigue mostrando los instructores y horarios de la anterior. `SecretariaAgendaComponent`
llama a `initialize()` una sola vez en `ngOnInit`; `AdminAgendaComponent` lo hace en un `effect`
que sigue `BranchFacade.selectedBranchId()`.

## Cambios
- **Archivo:** `src/app/features/secretaria/agenda/secretaria-agenda.component.ts` — `initialize()` en un `effect` sobre `selectedBranchId()`, igual que admin (`facades.md` §7: la reactividad de sede va en el Smart Component). El SWR de `initialize()` ya distingue "misma sede" (refresco silencioso) de "otra sede" (carga completa).
- **Archivo:** `e2e/agenda-4.spec.ts` — F06 deja de ser `knownBug`.
- **Archivo:** `src/app/features/secretaria/agenda/secretaria-agenda.component.spec.ts` — nuevo: carga al entrar, recarga al cambiar de sede, cierra el canal al salir.

## Verificación
- `e2e/agenda-4.spec.ts` F06 en verde sin `knownBug`; las 4 suites de Agenda (`agenda`, `-2`, `-3`, `-4`): 56/56.
- En el navegador como `secretaria.multisede@test.com`: "Todas las sedes" 19 opciones → Conductores 9 (sin Instructor1) → Autoescuela 11 (sin Instructor9), sin recargar la página.
- `npm run test:ci`: 4660 ok. `npm run lint:arch`: 0 errores.
