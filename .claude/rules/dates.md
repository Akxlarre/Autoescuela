# Fechas de negocio: siempre en hora de Chile

La fecha de negocio de este sistema es el día de **Chile** (`America/Santiago`), no el del
navegador ni el de UTC. Chile va 3 o 4 horas detrás de UTC: desde las 20:00–21:00 hora Chile,
"hoy" en UTC ya es mañana. Un servidor (edge function, Postgres) siempre corre en UTC.

## Dos tipos, y nada más

| Tipo | Qué es | Cómo viaja |
|---|---|---|
| **Instante** | Un momento exacto | `timestamptz` en la BD, `Date`, ISO con zona |
| **Fecha pura** | Un día de calendario, sin hora ni zona | `date` en la BD, `'YYYY-MM-DD'` |

Convertir de uno a otro es la única operación que depende de la zona, y se hace en un solo
lugar por capa:

| Capa | Módulo |
|---|---|
| App (`src/app`) | `core/utils/chile-time.utils.ts` |
| Edge functions | `supabase/functions/_shared/chile-time.ts` (copia espejo, mismos vectores de test) |
| SQL | `public.chile_today()`, `public.chile_date(instante)`, `public.chile_day_start(dia)` |

## Qué usar

| Necesidad | Correcto | Prohibido |
|---|---|---|
| Hoy | `chileToday()` / `public.chile_today()` | `new Date().toISOString().slice(0, 10)`, `CURRENT_DATE` |
| Día de un instante | `toChileDate(instante)` / `public.chile_date(x)` | `.slice(0, 10)` sobre un `timestamptz`, `x::date` |
| Filtrar un día en una columna `timestamptz` | `chileDayRange(dia)` con `.gte(start)` y `.lt(endExclusive)` | `` `${dia}T00:00:00` `` y `T23:59:59` sin zona |
| Sumar días o meses, lunes de la semana | `addDaysIso`, `addMonthsIso`, `mondayOfIso` | `setDate(getDate() + n)`, `getDay()` |
| Días entre dos fechas | `diffDaysIso(desde, hasta)` | restar instantes y dividir por 86.400.000 |
| Leer hora, día o mes de un instante | `chileParts(instante)` | `getHours()`, `getMonth()`, `getFullYear()` |
| Mostrar una fecha u hora | `formatChileDate`, `formatChileTime`, pipe `chileDate` | `toLocaleDateString` sin `timeZone`, pipe `date` de Angular |
| Valor de un selector de fechas (PrimeNG) | `calendarDateToIso(date)` / `isoToCalendarDate(iso)` | tratarlo como un instante |
| Una hora de pared de Chile → instante | `chileWallTimeToInstant(dia, 'HH:MM')` | concatenar un offset fijo `-03:00` |

Medir una **duración** entre dos instantes (cuánto falta para `expires_at`, hace cuánto se creó
algo) no es una conversión a día: ahí sí se restan instantes.

## Tests

- Fijar el reloj con un instante explícito en UTC (`vi.setSystemTime(new Date('2026-10-07T02:30:00.000Z'))`
  = 23:30 hora Chile del día 6). Nunca `new Date(2026, 9, 6)` ni `new Date()` para armar la
  fecha esperada: dependen de la zona del equipo.
- `node scripts/test-tz.mjs <specs>` corre los tests en UTC, Asia/Tokyo y America/Santiago. Un
  test que pasa en una zona y falla en otra delata código que depende del reloj del equipo.

## Guardrail

`npm run lint:arch` falla (ARCH-27 en app y edge functions, ARCH-28 en migraciones nuevas) y
nombra la función que corresponde usar. Una excepción legítima se declara en
`scripts/lib/date-discipline.allowlist.json` con su justificación; no se silencia de otra forma.
