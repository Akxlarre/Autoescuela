# Fix: Asistencia B de la secretaria multi-sede ignora el selector de sede
> id: fix-385-m-asistencia-secretaria-multisede-ignora-el-selector
> refs: fix-366-m-testing-asistencia-clase-b (M04, S12) · ASG-i-027 · spec 0017 (RF-013)
> status: done
> closed: 2026-10-12
> created: 2026-10-12

## Síntoma

Bloque 4 de `fix-366-m`, M04: una secretaria con acceso a las dos sedes tiene selector de sede en
la barra superior. En Asistencia elige "Conductores Chillán" y la pantalla sigue mostrando las
clases, las alertas y los ciclos de Autoescuela Chillán. La barra dice una sede y los datos son de
otra. Con "Todas las sedes" pasa lo mismo, y sin columna Sede.

## Root Cause

`SecretariaAsistenciaComponent` toma `currentUser().branchId` una sola vez en `ngOnInit` y nunca
mira `BranchFacade.selectedBranchId()`. El resto de las pantallas de secretaria resuelve la sede
con `resolveBranchScope()` (fix-027 / spec 0017), que respeta el selector cuando la secretaria
tiene el permiso.

## Fix

En `secretaria-asistencia.component.ts`:
- `branchId` pasa a ser un `computed()` con `resolveBranchScope()`.
- Un `effect()` aplica la sede a los dos facades y carga; se repite al cambiar el selector.
- La columna Sede se muestra cuando la sede resuelta es "todas" (`null`).

## Acceptance Criteria

- [x] AC1 — Secretaria sin el permiso: siempre su sede, elija lo que elija el selector (no lo tiene).
- [x] AC2 — Secretaria multi-sede: al cambiar el selector, la tabla, las alertas y los ciclos pasan
  a la sede elegida.
- [x] AC3 — Secretaria multi-sede en "Todas las sedes": ve las dos sedes, con columna Sede.

## Regression Test

`secretaria-asistencia.component.spec.ts` y verificación en navegador con
`secretaria.multisede@test.com`.

## Verificación (2026-10-12)

- `secretaria-asistencia.component.spec.ts` 3/3.
- Navegador con `secretaria.multisede@test.com`: en "Todas las sedes" 9 clases (8 + 1 de la otra
  sede); al elegir "Conductores Chillán" queda 1 clase y el ciclo de esa sede (2 alumnos).
  `secretaria@test.com` sigue viendo solo las 8 de su sede.
