# Fix: Reprogramar y reagendar desde la ficha — doble guardado, error ilegible, falso "sin instructores" y 3 clases el mismo día
> id: fix-244-b-reprogramar-y-reagendar-desde-la-ficha
> refs: ASG-i-026 (fix-186-b, grupo 2: casos I15, I16, I18, J07)
> status: done
> created: 2026-11-09
> closed: 2026-11-09

## Root Cause
Cuatro defectos de los dos paneles de la ficha que mueven clases ("Reprogramar Clase" y el paso 2
de "Reagendar Clases"), encontrados en `e2e/agenda-5.spec.ts`. Comparten flujo y archivos; se
corrigen juntos (precedente: fix-241-b).

1. **I16 — doble clic guarda dos veces.** `onConfirm()` / `onSave()` ponen `isSaving` en `true`,
   pero el botón queda deshabilitado recién en el siguiente render: el segundo `click` de un doble
   clic llega antes y vuelve a llamar al facade. Resultado medido: 2 filas idénticas en
   `class_b_reschedule_history` y 2 juegos de avisos.
2. **I15 — el rechazo de la BD se lee "Error al guardar."** El `catch` solo usa
   `ErrorSanitizerService` si `err instanceof Error`; el error de Supabase (`PostgrestError`) es un
   objeto plano, así que cae al texto por defecto y el mensaje del trigger ("El instructor ya tiene
   una clase agendada que se solapa…") nunca se muestra.
3. **I18 — "No hay instructores disponibles." mientras cargan.** `loadInstructores()` no tiene
   estado de carga; el panel decide el skeleton con `isLoadingSchedule()` (la carga de la grilla),
   que en ese momento es `false`. Mientras llega la consulta se ve el estado vacío, o la lista del
   alumno anterior (de otra sede) si el panel ya se había abierto.
4. **J07 — el masivo deja 3 clases el mismo día.** El tope por día de la grilla
   (`schedule-grid.logic.ts`) cuenta solo lo **seleccionado**; `computeBlockedDates()` bloquea un
   día recién cuando el alumno ya tiene 2 clases. Con 1 clase ese día se pueden elegir 2 más.

## ACs Afectados
Ninguno de una spec — casos del checklist `specs/testing-piloto/026-agenda-triple-match.md`:
- **I16:** un doble clic en "Confirmar Reprogramación" (o "Guardar Reagendamiento") guarda una vez.
- **I15:** si la BD rechaza el horario, el panel muestra su mensaje legible y no se cierra.
- **I18:** mientras cargan los instructores se ve un estado de carga, nunca "No hay instructores
  disponibles." ni la lista de otro alumno.
- **J07:** en el masivo, las clases que el alumno ya tiene ese día cuentan para el tope por día.

El valor del tope (1 según `courses.max_classes_per_day`, 2 en la app) es una **decisión pendiente
del owner** (fix-186-b, sexta tanda) y **no** se cambia acá: se mantiene 2.

## Cambio
- `src/app/shared/components/schedule-grid/schedule-grid.logic.ts` — `SlotSelection` acepta
  `existingPerDay` (clases que el alumno ya tiene por fecha) y el tope por día lo suma.
- `src/app/core/models/ui/enrollment-assignment.model.ts` — campo opcional `existingPerDay`.
- `src/app/core/facades/admin-alumno-detalle.facade.ts` — `isLoadingInstructores`;
  `clasesPorDiaParaReagendar` (clases vigentes por fecha, sin las que se están moviendo).
- `src/app/shared/components/matricula-steps/assignment/` — input opcional `instructorsLoading`
  que fuerza el skeleton de la lista de instructores (el masivo lo usa; la matrícula no lo pasa y
  conserva su comportamiento).
- `features/admin/alumno-detalle/reprogramar-clase-drawer/` y `reagendar-clases-drawer/` — guarda
  contra el doble guardado, mensaje del sanitizador para cualquier error, skeleton con
  `isLoadingInstructores`, y `existingPerDay` en el paso 2.

## Test de Regresión
- `schedule-grid.component.spec.ts` (lógica pura) — el tope por día suma `existingPerDay`.
- `admin-alumno-detalle.facade.spec.ts` — `isLoadingInstructores` y `clasesPorDia`.
- Specs de los dos drawers — doble llamada a confirmar = 1 llamada al facade; error plano de
  Supabase → su mensaje.
- `e2e/agenda-5.spec.ts` — I15, I16, I18 y J07 sin `knownBug`, en verde.

## Resultado (2026-11-09)
- Unit: `schedule-grid.component.spec.ts` (4 nuevos), `admin-alumno-detalle.facade.spec.ts`
  (3 nuevos), `admin-reagendar-horarios-drawer.component.spec.ts` (3 nuevos: I16, I15, J07) y
  `admin-reprogramar-clase-drawer.component.spec.ts` (nuevo, 3 tests). `npm run test:ci`:
  4700 passed, 0 fallos.
- e2e: `agenda-5.spec.ts` 15/15 en verde. J07 se reescribió: antes exigía poder hacer clic en 2
  horarios del día y que el contador mostrara 1; con el fix el 2º horario queda deshabilitado, así
  que ahora verifica que tras elegir uno solo queda habilitado ese (para deseleccionarlo).
  Sin datos E2E remanentes en la BD (verificado por SQL).
- `npm run lint:arch`: 0 errores.
