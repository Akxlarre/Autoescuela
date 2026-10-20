# Hotfix: la Agenda muestra "#237" en las clases de un instructor desactivado
> id: hotfix-097-b-agenda-nombre-instructor-inactivo
> refs: ASG-i-026 (checklist 026, B11)
> status: done
> created: 2026-10-19

## Problema
`AgendaFacade.loadLookupMaps()` arma el mapa id → nombre de instructor solo con los activos
(`.eq('active', true)`). Las clases de un instructor que se desactivó (las futuras que quedan por
reasignar — fix-205-b avisa de ellas al desactivar — y las ya dictadas) salen en la Agenda como
"#237". El mapa es solo para mostrar: el filtro de instructores (`loadInstructors`) sigue con solo
los activos.

## Cambios
- **Archivo:** `src/app/core/facades/agenda.facade.ts` (+ spec) — el mapa de nombres no filtra por
  activos.

## Verificación
- [x] vitest del facade.
