# Fix: test de weekMeta falla durante la semana del cambio de hora

> id: fix-155-b-test-semana-flaky-cambio-de-hora
> refs: — (fix autónomo, detectado corriendo test:ci durante fix-153-b)
> status: done
> created: 2026-09-01

## Root Cause

`student-horario.facade.spec.ts:74` ("weekMeta arranca en lunes y cierra 6 días después") falla con
`expected 5.958333333333333 to be 6`.

El test calcula el largo de la semana restando timestamps:

```typescript
const diff = (new Date(weekEnd + 'T12:00:00').getTime() - monday.getTime()) / (24 * 3600 * 1000);
expect(diff).toBe(6);
```

Eso asume que **todos los días duran 24 horas**. Chile entra en horario de verano el primer domingo
de septiembre — en 2026, el **domingo 6 de septiembre**. Verificado con Node:
`new Date(2026,7,31).getTimezoneOffset()` = 240 y `new Date(2026,8,6).getTimezoneOffset()` = 180.

Por lo tanto la semana Lun 31-ago → Dom 6-sep dura 6 días **menos una hora**, y la división da
5.958333… = 6 − 1/24. La diferencia es exactamente la hora del cambio.

El `'T12:00:00'` que ya trae el test es un intento correcto de blindarse contra DST, pero solo
protege los **extremos** (evita que parsear una medianoche inexistente corra la fecha). No sirve
acá porque el salto ocurre **entre** las dos fechas.

**El facade está bien; el test es el que está mal.** `weekMeta()` calcula `addDays(start, 6)` y
`addDaysToIso()` usa `d.setDate(d.getDate() + days)` — aritmética de calendario, inmune a DST. El
test es el único que traduce a milisegundos, y es esa traducción la que introduce el error.

**Naturaleza: flaky latente.** Falla solo durante las 2 semanas del año con cambio de hora, y pasa
los otros ~50. Pasaba ayer y volverá a pasar la semana próxima, lo que lo hace fácil de descartar
como ruido.

## ACs Afectados

Ninguno — fix autónomo de test. El comportamiento de producción nunca estuvo roto.

## Cambio

- **Archivo:** `src/app/core/facades/student-horario.facade.spec.ts`
- **Qué cambia:** la aserción pasa de comparar una resta de milisegundos a comparar la **fecha de
  calendario** esperada, construida con `Date.prototype.setDate()` nativo (no con el util del
  proyecto, para que el test siga siendo independiente de la implementación que verifica).

## Test de Regresión

- `student-horario.facade.spec.ts > navegación de semanas (client-side, sin re-fetch) > weekMeta arranca en lunes y cierra 6 días después` ✓

### Verificado bajo la condición exacta que fallaba (2026-09-01)

La evidencia más fuerte disponible es que **hoy es la semana del cambio de hora** (Lun 31-ago →
Dom 6-sep). Es decir, el fix se verificó bajo la condición precisa que producía el fallo, no en una
semana normal donde el test pasaría de todos modos:

| Momento | Resultado |
|---|---|
| Antes del cambio, corriendo hoy | **1 failed** — `expected 5.958333333333333 to be 6` |
| Después del cambio, corriendo hoy | **10 passed** ✓ |

### Verificado que el test no quedó vacuo (test de mutación)

Cambiar la aserción a algo más laxo (p. ej. `Math.round`) también habría puesto el test en verde,
pero debilitándolo. Se comprobó que la nueva aserción sigue detectando una regresión real:

| Estado del facade | Resultado |
|---|---|
| `addDays(start, 6)` (correcto) | **10 passed** ✓ |
| `addDays(start, 5)` (mutación temporal) | **1 failed** / 9 passed — falla exactamente este test ✓ |

La mutación se revirtió con `git checkout --` y se confirmó que el facade quedó sin modificar.

## Alcance verificado — el patrón NO se repite en otro lado

Se buscaron en toda la suite las demás aritméticas de milisegundos-por-día
(`86400000`, `24 * 3600 * 1000`, `1000 * 60 * 60 * 24`). Aparecen en otros 3 lugares, y **ninguno
tiene este defecto**:

| Uso | Por qué NO es vulnerable |
|---|---|
| `admin-pre-inscritos.facade.spec.ts:82,125` — construye `expires_at` y asevera `diasParaVencer === 3` | El facade calcula `Math.ceil(diffMs / 86400000)`, también en ms puros. Ambos lados se mueven juntos, así que el DST se cancela. |
| `student-home.facade.spec.ts:51` — construye `scheduled_at` de sesiones | Ningún assert depende del día de calendario de esas sesiones; la única aserción de fecha usa un ISO literal (`'2026-07-01T12:00:00Z'`). |

La distinción que importa: el defecto aparece cuando se compara una **resta en milisegundos**
contra un concepto de **calendario**. Mezclar las dos unidades es lo que rompe; usar ms de punta a
punta, o calendario de punta a punta, es seguro.
