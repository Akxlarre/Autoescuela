# Fix: Ciclos Teóricos deja mover a un ciclo de otra sede y "Actualizar" no relee el ciclo
> id: fix-387-m-ciclos-teoricos-otra-sede-y-actualizar
> refs: fix-366-m-testing-asistencia-clase-b (L11, L13, M03, S18) · ASG-i-027 · spec 0001
> status: done
> closed: 2026-10-12
> created: 2026-10-12

## Síntoma

Bloque 4 de `fix-366-m`:
- **L11:** el admin, en "Todas las sedes", abre "Cambiar de ciclo" de un alumno de Autoescuela
  Chillán y el selector de destino ofrece también los ciclos de Conductores Chillán. Lo mueve, sale
  "Alumno reasignado de ciclo" y el alumno queda en un ciclo de otra sede: recibiría el enlace Zoom
  de una sede que no es la suya.
- **L13:** otra persona mueve un alumno o cambia el tema de una clase. "Actualizar" no lo muestra:
  el roster y las clases del ciclo elegido quedan como estaban hasta cambiar de ciclo y volver.
- **M03 (anotado):** al cambiar rápido de sede, una respuesta vieja puede llegar después de una
  más nueva y dejar los ciclos de la sede anterior.

## Root Cause

`CiclosTeoricosFacade` carga la lista de ciclos sin distinguir sede cuando el filtro es "todas", y:
- el selector de destino (`otherCycleOptions`) usa esa lista completa, y `moveStudentToCycle()` no
  compara la sede del destino con la del ciclo de origen;
- `loadCycles()` solo vuelve a leer clases y roster cuando el ciclo elegido desaparece de la lista;
- ni `loadCycles()` ni `selectCycle()` descartan una respuesta obsoleta.

## Fix

- `ciclo-select-groups.util.ts`: `cycleMoveTargets(cycles, selectedId)` devuelve solo los ciclos de
  la misma sede que el elegido; lo usa `otherCycleOptions` del componente.
- `ciclos-teoricos.facade.ts`:
  - `moveStudentToCycle()` rechaza un destino de otra sede, sin escribir.
  - `loadCycles()` relee en silencio las clases y el roster del ciclo que sigue elegido.
  - `createRequestGuard()` en `loadCycles()` y en la carga del ciclo (`facades.md` §7).

Sin candado en la BD: `enrollments.theory_cycle_id` sigue aceptando un ciclo de otra sede si se
escribe por fuera de la pantalla.

## Acceptance Criteria

- [x] AC1 — En "Todas las sedes", el selector de destino solo ofrece ciclos de la sede del ciclo
  elegido.
- [x] AC2 — `moveStudentToCycle()` con un destino de otra sede no escribe y avisa.
- [x] AC3 — "Actualizar" trae el roster y las clases del ciclo elegido, sin skeleton.
- [x] AC4 — Una respuesta vieja de `loadCycles()` o de la carga de un ciclo no pisa a la más nueva.

## Regression Test

`ciclo-select-groups.util.spec.ts`, `ciclos-teoricos.facade.spec.ts` y verificación en navegador.

## Verificación (2026-10-12)

- `ciclo-select-groups.util.spec.ts` 6/6 y `ciclos-teoricos.facade.spec.ts` 24/24 (4 nuevos).
- Navegador (admin): en "Todas las sedes", con el ciclo del 12-10 de Autoescuela Chillán elegido,
  el selector de destino lista 8 ciclos, todos de esa sede. Tras mover un alumno y cambiar un tema
  por API, "Actualizar" baja el roster de 15 a 14 y muestra el tema nuevo.
