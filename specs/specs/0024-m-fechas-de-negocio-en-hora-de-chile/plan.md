# Plan 0024-m — Fechas de negocio en hora de Chile

> **Spec:** [spec.md](./spec.md) · **Inventario:** [inventario.md](./inventario.md)
> **Status:** approved (Matías, 2026-10-08)
> **Created:** 2026-10-08
> **Talla:** L — más de 100 archivos, guardrail nuevo, varias migraciones. Revisar antes de implementar.

---

## 1. Resumen ejecutivo

Se crea un único módulo de "hora de Chile" por capa (app, edge functions, SQL) y se enciende un
guardrail que prohíbe calcular días fuera de él. El guardrail arranca con una línea base de las
ocurrencias actuales y se va vaciando por tandas, de modo que el avance se mide con un número y no
con una lista revisada a mano. Orden grueso: utils con tests → guardrail → app → edge functions →
SQL y cron → cierre.

---

## 2. Inventario de impacto

### Archivos a CREAR

| Path | Tipo | Propósito |
|------|------|-----------|
| `src/app/core/utils/chile-time.utils.ts` | Util pura | Único lugar de la app donde un instante se convierte en día de Chile y viceversa |
| `src/app/core/utils/chile-time.utils.spec.ts` | Test | Contrato de la util, incluidos cambio de horario y bordes de medianoche |
| `src/app/core/utils/chile-time.vectors.json` | Datos de test | Casos (instante → día, día → rango) compartidos con la copia de edge functions |
| `src/app/shared/pipes/chile-date.pipe.ts` + `.spec.ts` | Pipe | Reemplaza al pipe `date` de Angular, que usa la zona del navegador |
| `supabase/functions/_shared/chile-time.ts` | Módulo Deno | Misma API que la util de la app |
| `supabase/functions/_shared/chile-time.test.ts` | Test | Corre los mismos vectores |
| `scripts/lib/date-discipline.js` + `.test.mjs` | Guardrail | Detección de patrones prohibidos en `src/app` y `supabase/functions` |
| `scripts/lib/date-discipline.baseline.json` | Línea base | Ocurrencias existentes; solo puede achicarse |
| `scripts/test-tz.mjs` | Script | Corre los specs de fecha con `TZ=UTC` y `TZ=Asia/Tokyo` |
| `supabase/migrations/20261008120000_time_fn_chile_today.sql` | Migración | Funciones SQL de día de Chile |
| `supabase/migrations/20261008121000_time_fix_business_day_objects.sql` | Migración | Redefine policies, funciones, vistas y triggers que usan `CURRENT_DATE` |
| `supabase/migrations/20261008122000_time_cron_absences_2100_chile.sql` | Migración | Corte de inasistencias a las 21:00 hora Chile fija |
| `supabase/tests/timezone/0024-m-business-day.sql` | Test SQL | Verifica AC9–AC12 contra la BD |

### Archivos a MODIFICAR

| Path | Cambio | Motivo |
|------|--------|--------|
| `src/app/core/utils/date.utils.ts` | `todayIso`, `monthsAgoIso`, `toISODate`, `formatChileanDate`, `buildDayLabel` delegan en `chile-time.utils`; `getChileDateTimeRange` se elimina | Corrige de una vez sus 68 usos |
| Archivos de `inventario.md` §1 (43 ocurrencias, ~35 archivos) | Reemplazo por la util | AC1, AC2, AC5 |
| Archivos de `inventario.md` §3 (9 facades) | Rangos semiabiertos con `chileDayRange` y `.lt()` | AC3, AC-E1, AC-E2 |
| Archivos de `inventario.md` §2 (~17 cortes de string) | `toChileDate()` cuando el origen es un instante | AC4 |
| Archivos de `inventario.md` §4 (177 + ~100 ocurrencias) | Aritmética y formato vía util / pipe | AC6, AC-E4 |
| 19 archivos con el pipe `date` (28 usos) | `chileDate` | AC6 |
| Edge functions de `inventario.md` §5 (~20 archivos) | `_shared/chile-time.ts` | AC7, AC8 |
| `scripts/lib/sql-schema.js` + `.test.mjs` | Regla para migraciones nuevas | AC13 |
| `scripts/architect.js` | Cablear `date-discipline` como ARCH-27 y la regla SQL como ARCH-28 | AC13. **Archivo protegido**: ver riesgo R1 |
| `e2e/transversal-shell.spec.ts` | Quitar `knownBug` de `T02` | AC1 |
| `indices/UTILS.md`, `indices/DATABASE.md`, `indices/DOMAIN-GOTCHAS.md` (DG-071), `.claude/rules/` | Documentar la regla | Sincronización |

### Archivos a ELIMINAR

| Path | Motivo |
|------|--------|
| — | Ninguno |

---

## 3. Reutilización (Discovery)

### Lo que existe y se aprovecha
- `date.utils.ts`: se conservan los nombres (`todayIso`, `toISODate`, …) para no tocar 26 archivos
  solo por un rename; cambia la implementación.
- `to24hTime` ya fija `America/Santiago`: es el patrón a generalizar.
- `student-payment`, `public-enrollment`, `_shared/enrollment-sheet-format.ts`: ya formatean en hora
  de Chile; su lógica se mueve a `_shared/chile-time.ts`.
- `mark_end_of_day_class_b_absences()` ya compara en `America/Santiago`: solo cambia el horario.
- `scripts/lib/class-discipline.js` + `class-discipline.baseline.json`: precedente del patrón
  "regla + línea base que solo se achica".
- `scripts/lib/sql-schema.js`: lugar para la regla de migraciones.

### Lo que no existe y se crea
- `chile-time.utils.ts`: hoy la conversión está repartida y `getChileDateTimeRange` tiene dos bordes
  (offset tomado a mediodía, fin en `23:59:59`).
- Copia en `_shared/`: las edge functions no pueden importar desde `src/app` (mismo caso que
  `promotion-end-date.utils.ts` ↔ `_shared/holidays.ts`). La paridad se asegura con los vectores
  compartidos.

### API de la util (igual en app y edge functions)

Todas puras; las que dependen de "ahora" reciben `now?: Date` para poder testearse.

| Función | Devuelve |
|---|---|
| `chileToday(now?)` | `'YYYY-MM-DD'` |
| `chileMonth(now?)` / `chileYear(now?)` | `'YYYY-MM'` / número |
| `toChileDate(instante)` | Día de Chile de un instante |
| `chileParts(instante)` | `{ year, month, day, hour, minute, weekday }` |
| `chileDayRange(dia)` / `chileRange(desde, hasta)` / `chileMonthRange(mes)` | `{ start, endExclusive }` como instantes ISO |
| `chileWallTimeToInstant(dia, 'HH:MM')` | Instante de una hora de pared de Chile |
| `addDaysIso(dia, n)` / `diffDaysIso(a, b)` / `weekdayOfIso(dia)` / `mondayOfIso(dia)` | Aritmética de fechas puras, sin zona |
| `formatChileDate(valor, opciones)` / `formatChileTime(instante)` | Texto en `es-CL`, zona fija |

---

## 4. Modelo de datos

### Migraciones

```sql
-- 20261008120000_time_fn_chile_today.sql
CREATE OR REPLACE FUNCTION public.chile_today() RETURNS date
  LANGUAGE sql STABLE SET search_path = ''
  AS $$ SELECT (now() AT TIME ZONE 'America/Santiago')::date $$;

CREATE OR REPLACE FUNCTION public.chile_date(p_instant timestamptz) RETURNS date ...;      -- IMMUTABLE
CREATE OR REPLACE FUNCTION public.chile_day_start(p_day date) RETURNS timestamptz ...;     -- IMMUTABLE

-- 20261008121000_time_fix_business_day_objects.sql
-- CREATE OR REPLACE / DROP+CREATE POLICY de cada objeto de inventario.md §6:
--   CURRENT_DATE            → public.chile_today()
--   CURRENT_DATE::TIMESTAMP → public.chile_day_start(public.chile_today())
--   x::date sobre timestamptz → public.chile_date(x)

-- 20261008122000_time_cron_absences_2100_chile.sql
-- pg_cron solo entiende UTC: se agenda a las 00:00 y 01:00 UTC y una función envoltorio
-- ejecuta el corte solo si en Chile son las 21.
SELECT cron.schedule('mark-end-of-day-class-b-absences', '0 0,1 * * *',
  $$ SELECT public.run_class_b_absences_cutoff(); $$);
```

- Antes de escribir la segunda migración se lee la **definición vigente** de cada objeto desde la BD
  (`pg_get_functiondef`, `pg_policies`, `pg_views`), no desde la historia de migraciones.
- El CHECK de edad mínima (`birth_date <= CURRENT_DATE - 17 years`) queda como excepción
  declarada: un CHECK no debe depender de una función no inmutable y el desfase es de horas sobre
  17 años.
- Las tres migraciones las aplica Matías.

### RLS

| Tabla | Rol | Operación | Política |
|-------|-----|-----------|----------|
| `cash_closings` | secretaria | la actual | Igual, con `date >= public.chile_today() - 2` |

### Modelos UI/DTO
- Sin cambios.

---

## 5. Arquitectura

```
Componente / Facade ──► chile-time.utils ──► Intl (America/Santiago)
        │                     ▲
        └── date.utils ───────┘        (nombres históricos, delegan)

Edge function ──► _shared/chile-time.ts          (misma API, mismos vectores de test)

Policy / función / vista / trigger ──► public.chile_today() · chile_date() · chile_day_start()

lint:arch ──► date-discipline (ARCH-27: app + functions) · sql-schema (ARCH-28: migraciones nuevas)
```

**Reglas del guardrail (ARCH-27).** Fuera de los módulos `chile-time`, es error:

1. `toISOString()` seguido de `.slice` / `.split` / `.substring`.
2. Un literal `T00:00:00` o `T23:59:59` sin offset.
3. `toLocaleDateString`, `toLocaleTimeString` o `Intl.DateTimeFormat` sin `timeZone`.
4. Getters y setters locales de `Date` (`getFullYear`, `getMonth`, `getDate`, `getDay`, `getHours`,
   `setHours`, `setDate`, `setMonth`).
5. El pipe `date` de Angular en un template.

**ARCH-28**, solo en migraciones posteriores a esta spec: `CURRENT_DATE`, `now()::date`,
`LOCALTIMESTAMP`, `::timestamp` sin zona y columnas `timestamp without time zone`.

Las excepciones van en una lista con justificación por entrada (mismo esquema que
`shared-organisms.allowlist.json`).

---

## 6. Restricciones aplicables

- [x] `architecture.md` — Núcleo funcional: la lógica vive en funciones puras de `core/utils/`
- [x] `facades.md` — Los facades con filtro por día siguen siendo branch-scoped; no cambia el guard de requestId
- [ ] `models.md`
- [ ] `visual-system.md` — Sin cambio visual
- [ ] `swr-pattern.md`
- [ ] `notifications.md`
- [x] `testing-tdd.md` — Spec de la util antes que la implementación; specs de facades con reloj fijo
- [ ] `ai-readability.md`
- [x] `database.md` — Migraciones idempotentes, documentadas en `indices/DATABASE.md`

---

## 7. Plan de testing

- **Unitarios (util):** vectores con instantes a las 00:00:00.000, 20:59, 21:00, 23:30 y
  23:59:59.999 hora Chile; los dos días de cambio de horario de 2026 y 2027; 31 de diciembre; fechas
  puras que no deben moverse.
- **Zona del proceso:** `node scripts/test-tz.mjs` corre esos specs y los de los facades con filtro
  por día con `TZ=UTC` y `TZ=Asia/Tokyo` (AC6).
- **Facades:** en cada facade de §3 del inventario, test con `vi.setSystemTime` a las 23:30 hora
  Chile que verifica el rango enviado a Supabase.
- **Guardrail:** `date-discipline.test.mjs` con un caso positivo y uno negativo por regla.
- **Edge functions:** `_shared/chile-time.test.ts` con los mismos vectores.
- **SQL:** `supabase/tests/timezone/0024-m-business-day.sql` (AC9–AC12), incluida la consulta a
  `information_schema.columns`.
- **E2E:** `npx playwright test e2e/transversal-shell.spec.ts -g T02` contra el build de producción,
  ambos casos en verde.
- **Regresión:** `npm run test:ci` y `npm run lint:arch` al cierre de cada tanda. La línea base
  conocida de tests fallando preexistentes se compara antes y después.

---

## 8. Riesgos y mitigaciones

| # | Riesgo | Prob. | Mitigación |
|---|--------|-------|------------|
| R1 | `scripts/architect.js` está protegido por el File Protector; puede que el agente no logre cablear ARCH-27/28 | Alta | Toda la lógica va en `scripts/lib/` (editable). El cableado es un diff de pocas líneas que Matías aplica si el hook lo bloquea |
| R2 | El día del cambio a horario de verano la medianoche no existe en Chile (00:00 pasa a 01:00) | Media | `chileDayRange` define el inicio como el primer instante cuyo día de Chile es D, no como "00:00 + offset"; vectores específicos |
| R3 | Tocar 177 cálculos de fecha rompe lógica de agenda, horas de instructor o promociones | Alta | Tandas por dominio, cada una con sus tests en verde antes de seguir; la línea base muestra cuánto falta |
| R4 | La definición vigente de un objeto SQL difiere de la última migración que lo nombra | Media | Leer la definición desde la BD antes de redefinir; test SQL que falla si queda algún `CURRENT_DATE` |
| R5 | La copia de la util en `_shared/` se desvía de la de la app | Media | Vectores compartidos en JSON; ambos tests los corren |
| R6 | `TZ` como variable de entorno no surte efecto en Node sobre Windows | Baja | `test-tz.mjs` verifica al arrancar que `Intl.DateTimeFormat().resolvedOptions().timeZone` cambió; si no, falla en vez de pasar en falso |
| R7 | La regla 4 marca usos legítimos (medir duración, reloj de un cronómetro) | Media | Lista de excepciones con justificación; la regla apunta a getters de calendario, no a `getTime()` ni `Date.now()` |
| R8 | Los jobs a las 00:00 y 01:00 UTC ejecutan el corte dos veces | Baja | La función envoltorio exige hora Chile = 21; el corte ya es idempotente (`status = 'scheduled'`) |

Alternativa descartada: fijar la zona de la base en `America/Santiago`. Arreglaría `CURRENT_DATE`
de un golpe, pero es implícito, depende del rol y de la conexión, cambia el formato en que la API
devuelve los instantes y no cubre ni la app ni las edge functions.

---

## 9. Orden de implementación

| Tanda | Qué | AC |
|---|---|---|
| 0 | Util de la app (test primero), vectores, `test-tz.mjs`; `date.utils.ts` delega | AC6, AC-E1–E4 |
| 1 | `date-discipline` + tests + línea base; regla SQL; cableado en `architect.js` | AC13 |
| 2 | App: "hoy" que se escribe o se usa para filtrar (inventario §1) + `T02` | AC1, AC2, AC5 |
| 3 | App: rangos de día en los 9 facades (inventario §3) | AC3 |
| 4 | App: instantes cortados a día (inventario §2) | AC4 |
| 5 | App: aritmética y formato (inventario §4) y pipe `chileDate`, por dominio: caja y contabilidad → agenda y horario → instructores y horas → promociones y profesional → resto | AC6, AC-E4 |
| 6 | Edge functions: `_shared/chile-time.ts` y reemplazos (inventario §5) | AC7, AC8 |
| 7 | SQL: tres migraciones y test; Matías las aplica | AC9–AC12 |
| 8 | Línea base en cero o con excepciones justificadas; índices, DG-071 y regla; `/spec-verify` | AC14 |

Cada tanda cierra con `npm run test:ci` y `npm run lint:arch`. Las tandas 2 a 6 no dependen de la 7.

---

## 10. Estimación

L — entre 5 y 7 sesiones de trabajo. La tanda 5 es la mitad del total.

---

## Changelog

- 2026-10-08 — plan inicial
