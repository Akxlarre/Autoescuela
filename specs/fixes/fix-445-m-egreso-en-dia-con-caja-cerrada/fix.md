# Fix: Un gasto o un anticipo se puede registrar (o mover) a un día con la caja ya cerrada
> id: fix-445-m-egreso-en-dia-con-caja-cerrada
> refs: fix-044-i · fix-051-i · fix-444-m · auditoría de triggers y policies de octubre (2026-10-16)
> status: done
> closed: 2026-10-16
> created: 2026-10-16

## Root Cause

El cierre de caja guarda totales congelados (DG-065). `fix-044-i` protegió los egresos de un día
cerrado solo contra el **borrado** (`trg_expenses_caja_cerrada`, `trg_instructor_advances_caja_cerrada`,
`BEFORE DELETE`), y `fix-051-i` agregó el candado de **inserción** solo para `payments`. Para gastos
y anticipos nada impide:

- registrar un anticipo con la fecha de un día cerrado: el formulario de Anticipos
  (`registrar-anticipo-drawer`) deja elegir cualquier fecha;
- registrar un gasto o anticipo hoy, después de cerrar, desde una pestaña abierta antes del cierre
  (la Caja deshabilita el botón, pero la BD no lo exige);
- cambiar el monto, la fecha o el medio de pago de un egreso de un día cerrado.

En todos los casos los egresos del día cambian después del cierre y el cierre congelado deja de
cuadrar. Encontrado en la auditoría de triggers y policies de octubre, no es una regresión de un fix.

> **Corrección (fix-446-m):** aquí se citaba "el gasto 7 de agosto" como caso del hueco; era el gasto
> de un ajuste "gasto olvidado" legítimo. No hay casos reales del hueco en dev. Y este fix **rompió**
> ese ajuste (que inserta un gasto con la fecha del día cerrado): lo corrige `fix-446-m`.

## ACs Afectados

- `fix-051-i` AC-F2 (no se registra dinero en un día con caja cerrada) se extiende a gastos y
  anticipos.

ACs propios:

- AC-1: registrar un gasto o un anticipo con fecha de un día con caja cerrada de su sede se rechaza
  con un mensaje claro en español, para admin y secretaria.
- AC-2: cambiar la fecha, el monto, la sede/instructor o el medio de pago de un egreso de un día
  cerrado (o moverlo a un día cerrado) se rechaza.
- AC-3: los UPDATE que no mueven dinero siguen funcionando en días cerrados: marcar anticipos como
  descontados o pendientes en Liquidaciones (`status`, `deducted_on`), editar la descripción.
- AC-4: un día sin cierre, o con cierre en borrador, no cambia.

## Cambio

- **Archivo:** `supabase/migrations/20261016150000_fix445_egresos_caja_cerrada.sql`
- **Qué cambia:** nueva función `guard_egreso_en_caja_cerrada()` (`SECURITY DEFINER`, mismo criterio
  de sede que `guard_movimiento_caja_cerrada`) y triggers `BEFORE INSERT OR UPDATE` en `expenses` y
  `instructor_advances`. En UPDATE solo revisa si cambia una columna de dinero (lección de
  `fix-444-m`). Sin sesión (service role, mantenimiento) no aplica, igual que en `payments`.

- `core/facades/cuadratura.facade.ts` (`registrarEgreso`) y `core/facades/anticipos.facade.ts`
  (`registrarAnticipo`): el error pasa por `toFriendlyDbMessage()`. Antes la Caja siempre decía
  "Error al registrar el egreso" y Anticipos solo mostraba el mensaje si el error era `instanceof
  Error` (el de supabase-js no lo es): el rechazo del candado salía genérico (AC-1).

## Progreso

- [x] Test SQL contra dev **sin** la migración: fallan 1, 2, 3, 6 y 7 (el hueco existe) — 2026-10-16
- [x] Ensayo migración + test en una transacción revertida: 9/9 ok; la función no quedó en la BD
- [x] Tests unitarios de los dos mensajes; `test:ci` 4338 verdes; `lint:arch` 0 errores
- [x] Matías aplica `20261016150000_fix445_egresos_caja_cerrada.sql`
- [x] Test SQL contra dev con la migración aplicada: 9/9
- [x] `/verify` en Anticipos (admin): anticipo con fecha 27-08-2026 (caja cerrada, sede 1) → 400 y
  toast "La caja de ese día ya está cerrada…". Además `registrarAnticipo` ya no pone el error de
  guardado en `error` (la página lo mostraba como "Error al cargar anticipos"). Un anticipo de
  prueba que quedó con fecha de hoy al fallar el selector se borró (id 21).
- [x] `/fix-close` y commit

## Test de Regresión

- `supabase/tests/caja/fix-445-m-egresos-caja-cerrada.sql` (transacción revertida).
- `cuadratura.facade.spec.ts > fix-445-m`, `anticipos.facade.spec.ts > fix-445-m`.
