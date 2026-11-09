# Fix: Una clase "En curso" no se reprograma desde la ficha — primero "Cancelar inicio"
> id: fix-246-b-no-reprogramar-clase-en-curso
> refs: ASG-i-026 (fix-186-b, grupo 2: caso I08)
> status: done
> created: 2026-11-09
> closed: 2026-11-09

## Root Cause
El lápiz "Reprogramar" de la ficha técnica se muestra para toda clase no completada, incluida una
`in_progress` (iniciada: tiene `start_time` y `km_start`). `reciclarSesion()` la vuelve a
`scheduled`, borra `start_time`/`end_time` y cambia el vehículo, pero **conserva `km_start`**:
una lectura del odómetro de otro momento y, si cambió el auto, de otro vehículo. Al finalizar la
clase nueva, `km_end − km_start` sale inflado o negativo, o choca con la validación
`km_end ≥ km_start`. El odómetro solo avanza: ese KM no sirve para una clase futura.

**Decisión del owner (2026-11-09):** bloquear la reprogramación de una clase en curso. El camino es
"Cancelar inicio" en Asistencia (`AsistenciaClaseBFacade.cancelStart()`, ya existe: vuelve a
`scheduled` con `start_time` y `km_start` en null) y recién ahí reprogramar.

## ACs Afectados
Ninguno de una spec — caso del checklist `specs/testing-piloto/026-agenda-triple-match.md`:
- **I08:** en la ficha técnica, una clase "En curso" no ofrece el lápiz de reprogramar; muestra
  que está en curso y orienta a "Cancelar inicio" en Asistencia.
- **I08:** si igual llega una reprogramación de una clase en curso (ficha abierta desde antes,
  carrera), el facade la rechaza con un mensaje legible y no toca la fila.

## Cambio
- `src/app/core/models/ui/alumno-detalle.model.ts` — `ClasePracticaUI.enCurso`.
- `src/app/core/facades/admin-alumno-detalle.facade.ts` — mapea `enCurso`; `reciclarSesion()`
  relee el estado y rechaza si es `in_progress`.
- `src/app/features/admin/alumno-detalle/components/ficha-tecnica/admin-ficha-tecnica.component.ts`
  — sin lápiz para `enCurso`; indicador "En curso" con la indicación (tabla y tarjetas).

## Test de Regresión
- `admin-alumno-detalle.facade.spec.ts` — `enCurso` desde `status = 'in_progress'`;
  `reprogramarClase()` sobre una sesión en curso rechaza y no hace UPDATE.
- `admin-ficha-tecnica.component.spec.ts` (nuevo) — clase en curso: sin lápiz, con indicador.

## Resultado (2026-11-09)
- La decisión de la columna se extrajo a la función pura `accionDeClase()` (exportada del
  componente): los tests que renderizan templates están excluidos en `vitest.config.ts`, así que
  el spec prueba la decisión (5 tests) y el binding lo cubre el e2e.
- `admin-alumno-detalle.facade.spec.ts`: `enCurso` desde `in_progress` (en el test de mapeo de
  `fetchClassBProgress`) y reprogramar una sesión en curso rechaza sin UPDATE, historial ni avisos.
- e2e nuevo **I08** en `agenda-5.spec.ts`: la tarjeta de la clase en curso muestra "En curso" con
  la indicación y sin lápiz; la agendada conserva el lápiz. Archivo completo 16/16 en verde.
- `npm run test:ci`: 308 archivos en verde. `npm run lint:arch`: 0 errores (el guard se movió a
  `assertNoEnCurso()` para no alargar `reciclarSesion()`). Sin datos E2E remanentes.
