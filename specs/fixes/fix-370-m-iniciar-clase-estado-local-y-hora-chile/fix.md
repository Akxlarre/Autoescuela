# Fix: al iniciar una clase B, KPIs y vehículo quedan desactualizados y la hora sale del navegador
> id: fix-370-m-iniciar-clase-estado-local-y-hora-chile
> refs: fix-366-m-testing-asistencia-clase-b (C02, C05) · ASG-i-027 · 0024-m
> status: done
> closed: 2026-10-11
> created: 2026-10-11

## Síntoma

Bloque 2 de `fix-366-m`:
- **C02:** tras "Comenzar Clase" la fila pasa a "En curso" pero los KPIs siguen en "En Curso 0 /
  Pendientes 3" hasta recargar.
- **C05:** se inicia con otro vehículo (BBCD12). La BD lo guarda, pero la fila y el drawer de
  Finalizar siguen mostrando la patente vieja (ABCD43) hasta recargar.
- La hora real de inicio y fin se toma del reloj del navegador.

## Root Cause

- `AsistenciaClaseBFacade.startClass()` actualiza la fila a mano (`status`, `kmStart`,
  `horaInicioReal`) sin recalcular KPIs y sin los datos del vehículo nuevo; solo guarda
  `vehicleId` en la práctica seleccionada, no patente/marca/modelo.
- `start_time`/`end_time` se arman con `new Date().toTimeString()`, la hora local del equipo. En
  un navegador que no esté en hora de Chile la clase queda con otra hora (regla
  `.claude/rules/dates.md`). Lo mismo en `InstructorClasesFacade` (portal Instructor, bloqueado
  en el piloto). ARCH-27 no detectaba `toTimeString()`.

## Fix

1. `startClass()`: tras guardar, `refreshSilently()` (como hacen las demás mutaciones del
   facade): fila, vehículo y KPIs salen de la BD. Se mantiene la actualización optimista de la
   práctica seleccionada para el drawer que sigue abierto, ahora con el vehículo completo.
2. `chileTimeOfDay(instante)` → `'HH:MM:SS'` de Chile en `core/utils/chile-time.utils.ts`, con
   test; reemplaza los 5 `toTimeString()` (2 facades).
3. ARCH-27 (`scripts/lib/date-discipline.js`): `toTimeString()`/`toDateString()` cuentan como
   `local-date-parts`, con test.

## Acceptance Criteria

- [x] AC1 — Tras iniciar, los KPIs "En Curso" y "Pendientes" cambian sin recargar.
- [x] AC2 — Tras iniciar con otro vehículo, la fila y el drawer de Finalizar muestran el nuevo.
- [x] AC3 — `start_time`/`end_time` se guardan en hora de Chile aunque el navegador esté en otra
      zona (test con zona distinta).
- [x] AC4 — `npm run lint:arch` marca `toTimeString()` en código nuevo.

## Regression Test

- `chile-time.utils.spec.ts` → `chileTimeOfDay`.
- `asistencia-clase-b.facade.spec.ts` → `startClass` refresca y guarda la hora de Chile.
- `scripts/lib/date-discipline.test.mjs`.

## Verificación (2026-10-11)

Secretaria, clase de las 18:00 iniciada con XXYZ34 en vez de ABCD43: sin recargar, "En Curso" pasa
a 1 y la fila muestra XXYZ34; el drawer de Finalizar dice "XXYZ34 · Km ini: 7850". Tests en UTC,
Tokio y Santiago (`chileTimeOfDay`, `startClass` con reloj fijo → `start_time` '14:30:44'). ARCH-27
detecta `toTimeString()`/`toDateString()` (test del script) y salió además
`notification.utils.ts` (agrupaba por `toDateString()`): corregido con `toChileDate()` y test de
agrupación nocturna. `lint:arch` 0 errores, backlog ARCH-27 0.
