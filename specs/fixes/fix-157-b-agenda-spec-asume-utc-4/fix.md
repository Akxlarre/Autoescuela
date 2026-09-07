# Fix: el test de `timeRows` asume UTC-4 y falla en horario de verano

> id: fix-157-b-agenda-spec-asume-utc-4
> refs: — (fix autónomo; mismo patrón que fix-155-b, detectado corriendo test:ci durante fix-156-b)
> status: done
> closed: 2026-09-07
> created: 2026-09-07

## Root Cause

`agenda.facade.spec.ts:232` ("une el baseline con un horario real fuera del bloque estándar")
falla desde el domingo 2026-09-06:

```typescript
scheduled_at: `${facade.weekStart()}T17:30:00Z`,
// 17:30 UTC = 13:30 America/Santiago (UTC-4 en horario estándar) — fuera del bloque base.
...
expect(rows).toContain('13:30');
```

El comentario declara el supuesto explícitamente: **UTC-4, "horario estándar"**. Chile entra en
horario de verano el primer domingo de septiembre — en 2026, el **domingo 6**. Verificado con
Node: `new Date('2026-08-31T12:00:00Z').getTimezoneOffset()` = 240 y
`new Date('2026-09-07T12:00:00Z').getTimezoneOffset()` = 180.

Desde ese día `17:30Z` es **14:30** en Santiago, no 13:30, y la aserción `toContain('13:30')`
falla.

**El facade está bien; el test es el que está mal.** `tsToTime()` → `to24hTime()`
(`core/utils/date.utils.ts:44`) convierte con `timeZone: 'America/Santiago'` real, así que
respeta el DST solo. El único lugar que hardcodea un offset es el test.

**Naturaleza: flaky estacional.** Falla ~6 meses al año (septiembre a abril) y pasa los otros 6.
Lo peor de ese perfil no es que falle: es que **se arregla solo en abril**, así que invita a
ignorarlo como ruido en vez de corregirlo.

`rows.length` sigue dando 14 en ambos offsets (tanto 13:30 como 14:30 quedan fuera de
`BASE_TIME_ROWS`), así que la única aserción afectada es la del string literal.

### Relación con fix-155-b

Mismo modo de falla (un test que hardcodea el offset de Chile), distinta causa mecánica:
`fix-155-b` restaba milisegundos y el arreglo fue usar aritmética de calendario; acá el problema
es un **string de hora local esperado**, escrito a mano.

`fix-155-b` corrigió el caso que apareció entonces, sin barrer la suite por la misma suposición —
por eso este sobrevivió una semana más y reapareció en la siguiente corrida.

**Barrido hecho ahora (2026-09-07), para no dejar el mismo residuo:** de los **20** `.spec.ts` que
usan timestamps `...Z`, **este es el único** que afirma una hora local hardcodeada derivada de
uno. No queda deuda latente esperando a abril.

## ACs Afectados

Ninguno — fix autónomo de test. El comportamiento de producción nunca estuvo roto.

## Cambio

- **Archivo:** `src/app/core/facades/agenda.facade.spec.ts`
- **Qué cambia:** la hora local esperada se **deriva** del instante UTC con
  `Intl.DateTimeFormat` + `timeZone: 'America/Santiago'`, en vez de escribirse a mano. Se usa la
  API nativa a propósito, **no** `to24hTime()` del proyecto: el test debe seguir siendo
  independiente de la implementación que verifica (mismo criterio que fix-155-b, que evitó
  `addDaysToIso()` por la misma razón).

## Test de Regresión

- `src/app/core/facades/agenda.facade.spec.ts > AgendaFacade > timeRows — baseline de jornada completa > une el baseline con un horario real fuera del bloque estándar, sin perder ninguna fila base` ✓
- Verificación de las dos direcciones: el test debe pasar **hoy** (UTC-3, horario de verano) y
  también con una fecha en horario estándar (UTC-4), no solo hoy.

### Resultado (2026-09-07)

- `npx vitest run agenda.facade.spec.ts` → **18/18 pass** ✓
- Derivación verificada en los dos offsets: `17:30Z` da **13:30** en junio y abril (UTC-4) y
  **14:30** en septiembre y diciembre (UTC-3). En los 4 casos queda fuera de `BASE_TIME_ROWS`,
  así que `rows.length` sigue siendo 14 todo el año y la aserción no puede desincronizarse.
- `npm run test:ci` → **2293 pass · 0 fail · 5 skipped**. La suite quedó completamente verde
  (antes de este fix: 2292 pass · 1 fail).
