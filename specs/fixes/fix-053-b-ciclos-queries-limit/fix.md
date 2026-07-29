# Fix: Queries de Ciclos Teóricos sin límite explícito
> id: fix-053-b-ciclos-queries-limit
> refs: 0001 (spec original de Ciclos Teóricos)
> status: done
> closed: 2026-07-17
> created: 2026-07-17

## Root Cause
`ciclos-teoricos.facade.ts` — `loadAddableStudents()` y `fetchRoster()` consultan
`enrollments` sin `.order()`/`.limit()` explícito. `supabase/config.toml` fija
`max_rows = 1000`: PostgREST trunca en silencio pasado ese límite (sin lanzar
`error`). Verificado con datos reales vía REST: hoy son solo 19 matrículas activas
Clase B, lejos del límite — no es un bug activo — pero es una query sin red de
seguridad ni orden determinístico que se degradaría en silencio (alumnos activos
invisibles sin ningún error visible) a futuro.

## ACs Afectados
Ninguno funcional — endurecimiento preventivo, no cambia el resultado con los
volúmenes actuales.

## Cambio
- **Archivo:** `src/app/core/facades/ciclos-teoricos.facade.ts`
  - `loadAddableStudents()`: agregar `.order('id', { ascending: true }).limit(1000)`
    explícito a la query (documenta la cota real en vez de depender del default
    implícito de PostgREST).
  - `fetchRoster()`: mismo tratamiento — `.order('id', { ascending: true }).limit(1000)`.
  - Si en cualquiera de los dos el resultado llega exactamente a 1000 filas, loguear
    una advertencia (`console.warn` o `toast.warning`) para que quede visible que se
    alcanzó la cota, en vez de fallar en silencio.

## Test de Regresión
- `ciclos-teoricos.facade.spec.ts` — nuevo caso: la query incluye `.limit(1000)` y
  `.order()` (mock de Supabase verifica los args de la llamada, patrón ya usado en
  `libro-de-clases.facade.spec.ts`).
- `npm run test:ci` verde.
