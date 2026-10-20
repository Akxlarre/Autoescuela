# Hotfix: la Agenda muestra "V36" en vez de la patente de un vehículo de la otra sede
> id: hotfix-077-b-agenda-patente-vehiculo-ambas
> refs: ASG-i-032 (checklist 032, S12)
> status: done
> created: 2026-10-15

## Problema
Con una sede elegida, `AgendaFacade.loadLookupMaps()` arma el mapa id → patente solo con los
vehículos de esa sede (`.eq('branch_id', …)`). Una clase de la sede con un vehículo "Ambas"
registrado en la otra sede (o un vehículo que se cambió de sede) sale en la Agenda como `V36` en
vez de `ZZ4103`. El mapa es solo para mostrar la patente: qué clases se ven ya lo filtra la
consulta de sesiones por sede.

## Cambios
- **Archivo:** `src/app/core/facades/agenda.facade.ts` (+ spec) — el mapa de patentes no filtra
  por sede (la RLS de `vehicles` sigue aplicando).

## Verificación
- [x] Test del facade: con sede elegida, la consulta de `vehicles` no filtra por `branch_id` y la
  clase muestra la patente del vehículo de la otra sede.
