# Hotfix: No hay forma de filtrar los instructores con la licencia ya vencida
> id: hotfix-069-b-filtro-licencias-vencidas
> refs: ASG-i-034 (caso B06, §5) — decisión del owner 2026-10-07: "Por vencer" no incluye las vencidas; filtro aparte "Vencidas"
> status: closed
> created: 2026-10-07

## Problema
La lista de Instructores tiene las pills Todos / Activos / "Licencia por vencer". Las licencias ya
vencidas (desde fix-202-b se calculan con la fecha) no entran en "por vencer" y no hay otra forma de
encontrarlas: justo las más urgentes quedan escondidas en "Todos".

## Cambios
- **Archivo:** `src/app/core/facades/instructores.facade.ts` (+ spec) — computed `licenciasVencidas`.
- **Archivo:** `src/app/features/admin/instructores/admin-instructores.component.ts` — pill
  "Licencia vencida (N)" (estilo de error si N > 0) que filtra `licenseStatus === 'expired'`.

## Verificación
- vitest del facade; `ng build`, `lint:arch`; e2e de la pill contra el build de producción.

## Resultado (2026-10-07)
- `instructores.facade.spec.ts` 35/35 (con `licenciasVencidas`), `ng build` OK, `lint:arch` 0 errores (182).
- `e2e/instructores-filtro-vencidas.spec.ts` contra el build de producción: la pill cuenta las filas "Vencida" de Todos y al pulsarla solo quedan esas. 1/1.
