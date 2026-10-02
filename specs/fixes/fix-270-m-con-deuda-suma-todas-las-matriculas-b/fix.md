# Fix: "Con deuda" ignora la deuda de las matrículas Clase B anteriores
> id: fix-270-m-con-deuda-suma-todas-las-matriculas-b
> refs: fix-264-m (bug B8, caso D04 de `024a`), ASG-i-024
> status: done
> closed: 2026-10-01
> created: 2026-10-01

## Root Cause

`AdminAlumnosFacade.mapToAlumnoTableRow()` elige una sola matrícula Clase B para representar la
fila (la más reciente con estado válido) y toma de ella `pending_balance` y `total_paid`. Un
alumno con dos matrículas B que debe plata de la más antigua queda con `pago_por_pagar = 0`, y el
KPI "Con deuda" (que cuenta filas con `pago_por_pagar > 0`) no lo cuenta.

Confirmado en navegador por `fix-264-m` (B8): un alumno con una matrícula B de hace un año con
saldo de $90.000 y una matrícula de refuerzo al día no suma en "Con deuda".

**Decisión del owner (Matías, 2026-10-01):** "Con deuda" y el saldo de la fila suman **todas las
matrículas Clase B** del alumno. Las matrículas Profesional siguen fuera (tienen su propia base).

## ACs Afectados

- AC-1: `pago_por_pagar` es la suma de `pending_balance` de todas las matrículas Clase B válidas
  del alumno (no borrador, no cancelada, no pago online abandonado), no solo de la más reciente.
- AC-2: `pago_total` es la suma de `total_paid` de esas mismas matrículas.
- AC-3: un alumno con deuda solo en una matrícula B antigua cuenta en el KPI "Con deuda".
- AC-4: las matrículas Profesional y las incompletas no suman (regresión de `0016-b` AC-E1).

## Cambio

- **Archivo:** `src/app/core/facades/admin-alumnos.facade.ts`
- **Qué cambia:** `pago_por_pagar` y `pago_total` se calculan sumando sobre las matrículas B
  válidas (`sorted`), en vez de leer solo `sorted[0]`.
- **Archivo:** `src/app/core/models/ui/alumno-table-row.model.ts`
- **Qué cambia:** comentarios de `pago_por_pagar` / `pago_total`.

## Test de Regresión

- `src/app/core/facades/admin-alumnos.facade.spec.ts > saldo de todas las matrículas B — fix-270-m` ✓
- `e2e/alumnos-b-lista.spec.ts > C05 · D04 (S11)` — deja de estar marcado `knownBug` ✓

## Verificación
Verificado el 2026-10-01: los 36 tests de `admin-alumnos.facade.spec.ts` en verde y el test E2E
C05 · D04 pasa en navegador sin la marca `knownBug`. La suite completa (`npm run test:ci`,
`npm run lint:arch`) se corre al cerrar la tanda de la lista de alumnos.
