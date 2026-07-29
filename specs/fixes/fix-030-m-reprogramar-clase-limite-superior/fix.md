# fix-030-m — Reprogramar Clase: falta límite superior por clase siguiente

## Contexto

El dueño detectó que el drawer "Reprogramar Clase"
(`admin-reprogramar-clase-drawer.component.ts`) solo valida el límite
inferior: bloquea slots anteriores o iguales a la clase N-1 (`prevClase`,
líneas 332-351), pero no valida el límite superior contra la clase N+1.

Ejemplo real: la clase #3 estaba agendada el 09-07, la #4 el 10-07. El
drawer permitía reprogramar la #3 al 20-07 (posterior a la #4), rompiendo
el orden secuencial de las clases prácticas.

## Alcance

En `admin-reprogramar-clase-drawer.component.ts`, agregar de forma
simétrica a `prevClase`/`minAllowedTimestamp`/`isBeforePrevClass`:

1. `nextClase` — computed que busca `clasesPracticas()` con
   `numero === target.claseNumero + 1`.
2. `maxAllowedTimestamp` — timestamp ISO de `nextClase()?.scheduledAt`.
3. `isAfterNextClass(slotId)` — true si el slot es `>=` a `maxAllowedTimestamp`.
4. Aplicar el bloqueo visual (mismo patrón que `isBeforePrevClass`) en el
   grid de slots y en `canConfirm()`.
5. Aviso en UI análogo al de la clase anterior: "Clase siguiente #N está
   agendada el [fecha]. Solo se muestran disponibles horarios anteriores."

No se toca el Facade ni la BD — la restricción es de UI/UX, igual que el
límite inferior ya existente.

## Acceptance Criteria

- [x] AC0: Si la clase N+1 tiene horario agendado, los slots posteriores o
  iguales a ese horario aparecen deshabilitados (mismo estilo visual que
  los bloqueados por `isBeforePrevClass`). Cubierto en template vía
  `isAfterNextClass(slot.id)` agregado a la condición de slot deshabilitado.
- [x] AC1: `canConfirm()` retorna `false` si el slot seleccionado es
  posterior o igual al horario de la clase N+1.
- [x] AC2: Si la clase N+1 no existe o no tiene horario, no hay restricción
  superior (comportamiento actual se mantiene) — `maxAllowedTimestamp()`
  retorna `null` y `isAfterNextClass()` retorna `false` sin importar el slot.
- [x] AC3: El aviso de restricción por clase siguiente se muestra en el
  drawer cuando aplica, sin remplazar el aviso de clase anterior (ambos
  bloques `@if` son independientes y pueden coexistir).

## Cierre

Fix aplicado en `admin-reprogramar-clase-drawer.component.ts`: agregados
`nextClase`, `maxAllowedTimestamp`, `nextClaseNumero/Fecha/Hora`,
`isAfterNextClass()`, wired en `selectSlot()`, `canConfirm()`, el grid de
slots y un segundo aviso de restricción en el template. Test de regresión
verde (3/3).

## Test de regresión

`admin-reprogramar-clase-drawer.component.spec.ts` (nuevo) — cubre: slot
bloqueado por clase siguiente, `canConfirm()` false ante slot inválido,
ausencia de restricción cuando no hay clase N+1 agendada.
