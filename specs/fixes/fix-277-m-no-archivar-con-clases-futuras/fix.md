# Fix: Se puede archivar a un alumno que tiene clases agendadas a futuro
> id: fix-277-m-no-archivar-con-clases-futuras
> refs: fix-264-m (caso L09 de `024a`), ASG-i-024
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Root Cause

Antes de archivar, `AdminAlumnosFacade.checkHistorial()` solo averigua si el alumno tiene pagos o
clases para elegir qué modal mostrar. Nada mira si tiene clases agendadas a futuro: el alumno se
archiva y sus clases siguen en la agenda, ocupando el horario del instructor y del vehículo, sin
que el alumno aparezca ya en ningún listado.

**Decisión del owner (Matías, 2026-10-01):** no se puede archivar a un alumno con clases
futuras; primero hay que cancelarlas o reagendarlas.

## ACs Afectados

- AC-1: al pedir archivar a un alumno con al menos una clase práctica agendada a futuro
  (`class_b_sessions.status = 'scheduled'` y `scheduled_at` posterior a ahora), no se abre el
  modal de confirmación: se muestra un aviso que dice cuántas clases tiene y qué hacer.
- AC-2: sin clases futuras, el flujo de archivado no cambia (modal simple o con historial).
- AC-3: aplica igual desde la lista de admin, la lista de secretaria y la ficha.

Fuera de alcance: las clases de la Academia Profesional (`ASG-i-025`) y un bloqueo a nivel de base
de datos (hoy la regla vive en la app).

## Cambio

- **Archivo:** `src/app/core/utils/archive-confirmation.utils.ts` — `buildFutureClassesBlockMessage(n)`.
- **Archivo:** `src/app/core/facades/admin-alumnos.facade.ts` — `checkHistorial()` cuenta además
  las clases futuras, y `prepararArchivado()` decide si se puede archivar (avisa por toast si no).
- **Archivos:** `src/app/features/admin/alumnos/admin-alumnos.component.ts`,
  `src/app/features/secretaria/alumnos/secretaria-alumnos.component.ts`,
  `src/app/features/admin/alumno-detalle/admin-alumno-detalle.component.ts` — usan
  `prepararArchivado()`.
- **Archivo:** `e2e/support/alumnos-seed.ts` — `addFutureClass()`: siembra una clase futura para
  un alumno de prueba.

## Test de Regresión

- `src/app/core/utils/archive-confirmation.utils.spec.ts > buildFutureClassesBlockMessage` ✓
- `src/app/core/facades/admin-alumnos.facade.spec.ts > prepararArchivado — fix-277-m` ✓ (3 tests)
- `e2e/alumnos-b-lista.spec.ts > L09` ✓ — alumno de prueba con una clase agendada a futuro: al
  pedir archivarlo desde la lista y desde la ficha aparece el aviso y no se abre el modal.

## Verificación
Verificado el 2026-10-01: `tsc` de la app sin errores, 55 tests de los dos `.spec.ts` en verde y
L09 pasa en navegador (secretaria). La lista de admin usa el mismo método del facade y no se
probó aparte.

## Nota de implementación
El aviso es un toast de error ("No se puede archivar" + cuántas clases tiene y qué hacer), no un
modal: es la respuesta a una acción que no se va a ejecutar. Las bases Profesional tienen su
propio `checkHistorial()` y no cambian.
