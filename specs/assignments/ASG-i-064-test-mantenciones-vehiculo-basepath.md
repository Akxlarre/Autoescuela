# Asignación ASG-i-064 — Arreglar el test de mantenciones de vehículo (falta `basePath` en la ruta simulada)

> **status:** completada
> **owner:** b
> **tipo_sugerido:** hotfix
> **priority:** P1
> **created:** 2026-10-16
> **created_by:** i
> **claimed_by:** b
> **claimed_at:** 2026-10-15
> **resulting_track:** hotfix-076-b-test-mantenimientos-basepath

> Resuelta antes de crearse: Benjamín ya lo había corregido en `hotfix-076-b` (2026-10-15, commit
> `e51d656f`). Se vio al traer main a `fixes_final_boss` el 2026-10-16: los 4342 tests en verde.

---

## Contexto / Objetivo

En `main` (`c66aacec`) fallan los 3 tests de
`src/app/features/admin/flota/vehicle-maintenances/vehicle-maintenances.component.spec.ts` con
`TypeError: Cannot read properties of undefined (reading 'basePath')`. Desde la spec 0051-b el
componente arma `backRoute` con `route.snapshot.data['basePath']`, pero el `ActivatedRoute`
simulado del spec solo tiene `snapshot.paramMap`, sin `data`. La app funciona; solo se rompió el
test, y deja `npm run test:ci` en rojo para todo el equipo.

## Alcance sugerido

- Agregar `data: {}` (o `data: { basePath: '/app/admin' }`) al `ActivatedRoute` del spec.
- Revisar si otros specs de Flota que leen `basePath` tienen la misma ruta simulada incompleta.

## Referencias

- Spec `0051-b-flota-secretaria` (commit `07666667`).

## Archivos involucrados (opcional, para detectar solapes)

- `src/app/features/admin/flota/vehicle-maintenances/vehicle-maintenances.component.spec.ts`

## Notas para quien la reclame

- Detectado por Ignacio al traer main a `fixes_final_boss` (2026-10-16): 4245 tests en verde y
  estos 3 en rojo.
