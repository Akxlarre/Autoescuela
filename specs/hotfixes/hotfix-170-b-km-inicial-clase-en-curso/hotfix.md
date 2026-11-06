# Hotfix: KM inicial en el detalle de una clase en curso
> id: hotfix-170-b-km-inicial-clase-en-curso
> refs: fix-186-b-testing-agenda-triple-match (E05) · ASG-i-026
> status: done
> closed: 2026-11-06
> created: 2026-11-06

## Problema
Caso E05 del checklist 026: en la Agenda, el detalle de una clase "En progreso" no muestra el
kilometraje con que partió; el bloque de KM solo aparecía en las completadas. Decisión del owner
(2026-11-06): mostrarlo.

## Cambios
- **Archivo:** `src/app/features/agenda/agenda-slot-detail-drawer.component.ts` — el bloque de KM
  también se muestra en `in_progress` (Km inicio con su valor, Km fin "En curso").
- **Archivo:** `e2e/agenda-3.spec.ts` — G01/G02/E05 pasa de anotar a exigir el KM inicial y "En curso".
- **Archivo:** `specs/fixes/fix-186-b-testing-agenda-triple-match/fix.md` — E05 como corregido.

## Verificación
- Chrome con `ng serve` (2026-11-06): `agenda-3.spec.ts -g G01` en verde con la aserción nueva;
  `npm run lint:arch` sin errores.
