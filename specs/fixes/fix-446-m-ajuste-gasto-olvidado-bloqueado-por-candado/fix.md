# Fix: El ajuste "gasto olvidado" de un cierre pasado quedó bloqueado por el candado de fix-445
> id: fix-446-m-ajuste-gasto-olvidado-bloqueado-por-candado
> refs: 0002-i-cuadratura-editable-ajustes · fix-445-m (regresión)
> status: done
> closed: 2026-10-16
> created: 2026-10-16

## Root Cause

Regresión de `fix-445-m`. El ajuste "Gasto olvidado" del Historial de Cuadraturas (spec 0002-i, AC2)
corrige un día cerrado insertando el gasto en `expenses` **con la fecha del cierre** — por diseño:
así el gasto cuenta en Reportes y Contabilidad como cualquier otro, y el cierre congelado no se toca
(el total vigente = arqueo + ajustes, AC4). `guard_egreso_en_caja_cerrada()` rechaza justamente todo
INSERT de un gasto en un día cerrado, así que registrar ese ajuste fallaba con "Error al registrar el
ajuste". El único canal oficial para corregir un cierre quedó roto.

Por qué pasó: en la auditoría se leyó cada UPDATE sobre `expenses`, pero se asumió que todo INSERT en
un día cerrado era ilegítimo y no se leyó el de `historial-cuadraturas.facade.ts`, que estaba en la
lista. Además, en `fix-445-m` se citó "el gasto 7 de agosto" como caso del hueco: era el gasto de un
ajuste legítimo (creado en el mismo segundo que el único `cuadratura_adjustments`).

Problema previo que se resuelve en el mismo cambio: el gasto y el ajuste se insertaban en dos llamadas
separadas desde el navegador; si fallaba la segunda, el gasto quedaba en el día cerrado sin su ajuste.

## ACs Afectados

- 0002-i AC2 (gasto olvidado → gasto en `expenses` con la fecha del cierre + ajuste): vuelve a
  funcionar.
- 0002-i AC3, AC7, AC-E1, AC-E3: se mantienen (corrección manual sin gasto; solo admin; no sobre un
  día sin cerrar; vehículo del gasto).
- `fix-445-m` AC-1/AC-2: se mantienen fuera del ajuste (Caja y Anticipos siguen bloqueados).

ACs propios:

- AC-1: el admin registra un ajuste "gasto olvidado" sobre un cierre cerrado: se crean el gasto (fecha
  y sede del cierre) y el ajuste enlazado, en una sola transacción.
- AC-2: si algo falla, no queda ni el gasto ni el ajuste.
- AC-3: un gasto directo (no ajuste) en un día cerrado sigue rechazado.
- AC-4: la secretaria no puede registrar ajustes; tampoco sobre un cierre que no está cerrado.

## Cambio

- `supabase/migrations/20261016170000_fix446_rpc_registrar_ajuste_cuadratura.sql` — RPC
  `registrar_ajuste_cuadratura(...)` `SECURITY DEFINER`: valida admin, cierre `closed`, tipo y monto;
  inserta el gasto (si corresponde) y el ajuste. Marca la transacción con
  `set_config('app.ajuste_cuadratura', 'on', true)`; `guard_egreso_en_caja_cerrada()` deja pasar el
  INSERT de un gasto solo con esa marca (el cliente no puede fijar ese ajuste: PostgREST no expone
  `set_config`).
- `core/facades/historial-cuadraturas.facade.ts` — `registrarAjuste()` llama a la RPC; el error se
  muestra con `toFriendlyDbMessage()`.

## Progreso

- [x] Ensayo migración + test en transacción revertida: 7/7 (canal del ajuste ok, gasto directo
  bloqueado antes y después, corrección manual, borrador rechazado, atomicidad, secretaria
  rechazada); la RPC no quedó en la BD — 2026-10-16
- [x] `set_config` no está expuesta por la API: `POST /rest/v1/rpc/set_config` → 404 (PGRST202)
- [x] Tests del facade; `test:ci` 4339 verdes; `lint:arch` 0 errores; DG-114 ampliado
- [x] Matías aplica `20261016170000_fix446_rpc_registrar_ajuste_cuadratura.sql`
- [x] Test SQL contra dev: 7/7; el de `fix-445-m` sigue 9/9
- [x] `/verify` (admin): Historial de Cuadraturas → 27-08-2026 (sede 1) → Registrar ajuste "Gasto
  olvidado", Gastos Varios, $3.500 → RPC 200, "Ajuste registrado correctamente.". En la BD: ajuste 7
  (-3500) enlazado al gasto 63 (3500, 2026-08-27, sede 1). Quedan como dato de prueba en dev (los
  ajustes son inmutables por diseño).
- [x] `/fix-close` y commit

## Test de Regresión

- `supabase/tests/caja/fix-446-m-ajuste-gasto-olvidado.sql` (transacción revertida).
- `historial-cuadraturas.facade.spec.ts > registrarAjuste`.
