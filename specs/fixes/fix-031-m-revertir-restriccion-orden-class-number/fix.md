# fix-031-m — Revertir restricción de orden cronológico por class_number en Reprogramar Clase

## Contexto

fix-030 agregó una restricción simétrica (N-1 y N+1) que bloqueaba
reprogramar una clase fuera del orden cronológico de su `class_number`. Al
revisar el flujo completo (incluyendo el reagendamiento masivo por
penalización, RF-053), el dueño concluyó que esa restricción es un error de
diseño: `class_number` es solo un contador de progreso (X/12), no una
secuencia cronológica obligatoria.

Caso concreto que rompe la restricción: alumno falta a la clase #3 (lunes),
pero sí asiste a la clase #4 (martes, ya ocurrida/agendada). Al reagendar la
#3, **cualquier** fecha futura disponible es necesariamente posterior a la
#4 ya ocurrida — la restricción `isAfterNextClass` (fix-030) bloquearía
todas las fechas, haciendo imposible recuperar la clase.

## Decisión de negocio

Las únicas invariantes reales de la matrícula Clase B son:
1. Exactamente 12 sesiones por matrícula (`CHECK`/`UNIQUE` en BD, fix-028).
2. Sin doble-booking de instructor/vehículo (grilla de disponibilidad).
3. Tope diario de clases por alumno (`computeBlockedDates()`).

Ninguna depende del orden cronológico entre `class_number`s. Se revierte
tanto la restricción superior (N+1, agregada en fix-030) como la inferior
preexistente (N-1, ya existía antes de fix-030) — ambas partían de la misma
premisa incorrecta.

## Alcance

En `admin-reprogramar-clase-drawer.component.ts`:

1. Eliminar `prevClase`, `minAllowedTimestamp`, `prevClaseNumero`,
   `prevClaseFecha`, `prevClaseHora`, `isBeforePrevClass()`.
2. Eliminar `nextClase`, `maxAllowedTimestamp`, `nextClaseNumero`,
   `nextClaseFecha`, `nextClaseHora`, `isAfterNextClass()` (agregados por
   fix-030).
3. Simplificar `canConfirm()`, `selectSlot()` y la condición de slot
   deshabilitado en el template — solo `slot.status === 'occupied'` sigue
   bloqueando.
4. Eliminar ambos avisos amarillos de restricción cronológica del template.
5. Eliminar el test de regresión de fix-030
   (`admin-reprogramar-clase-drawer.component.spec.ts`) ya que testea un
   comportamiento removido.
6. `indices/COMPONENTS.md` — quitar la nota de fix-030 de la entrada de
   `AdminReprogramarClaseDrawerComponent`.

No se toca el Facade ni la BD.

## Acceptance Criteria

- [x] AC0: El drawer permite reprogramar cualquier clase a cualquier slot
  disponible sin restricción de orden respecto a clases N-1/N+1.
- [x] AC1: Sigue bloqueando slots `occupied` (sin cambios en esa lógica —
  única condición restante en el template).
- [x] AC2: El caso "falta a #3, asiste a #4, reagenda #3 a fecha posterior a
  #4" ya no queda bloqueado (no existe código que lo evalúe).
- [x] AC3: No quedan referencias muertas a `prevClase`/`nextClase` y afines
  (confirmado leyendo el archivo completo tras el revert; `tsc --noEmit` sin
  errores en el archivo).

## Cierre

Revertido `admin-reprogramar-clase-drawer.component.ts` a su forma sin
restricción de orden cronológico. Eliminado
`admin-reprogramar-clase-drawer.component.spec.ts` (testeaba el
comportamiento removido). Actualizado `indices/COMPONENTS.md`.
`admin-alumno-detalle.facade.spec.ts` (17/17) sigue verde — no se tocó el
Facade. `tsc --noEmit` sin errores en el archivo modificado.

## Test de regresión

Se eliminó el spec de fix-030. No se agrega spec nuevo — tras remover las
restricciones, el componente vuelve a ser un binding simple sobre
`slot.status`, sin lógica de decisión adicional que testear.
