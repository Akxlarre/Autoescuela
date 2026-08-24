# Fix: Arqueo de caja física no distingue método de pago en egresos

> id: fix-211-m-arqueo-caja-metodo-pago-egresos
> refs: — (encontrado en UAT manual, docs/UAT-PLAN.md, ítem "Cierre de caja del día")
> status: done
> closed: 2026-08-24
> created: 2026-08-24

## Root Cause

El "Debe Haber en Caja" del arqueo físico (`saldoComputado` en
`cuadratura-content.component.ts`) solo debe reflejar movimientos **en efectivo**, pero:

1. La fila "Ingresos de Sistema" que se muestra junto a él usa `totalIngresosHoy()` (ingresos
   por TODO método: efectivo + transferencia + tarjeta + voucher) en vez de
   `ingresosEfectivoHoy()` (ya existe en el facade, solo no se usa en esa fila). Esto hace que
   el "Debe Haber en Caja" parezca no cuadrar contra los ingresos mostrados arriba, cuando en
   realidad el cálculo interno sí es correcto — el problema es que la UI muestra un total
   distinto al que realmente se usa en la resta.
2. Las tablas `expenses` e `instructor_advances` no tienen columna `payment_method`, y el
   formulario "Registrar Egreso" no pregunta el método de pago. Por lo tanto
   `totalEgresosHoy()` resta el 100% de los egresos del efectivo esperado en caja, asumiendo
   que todo egreso (combustible, gastos, anticipos a instructores) se pagó en efectivo físico,
   incluso cuando se pagó por transferencia o tarjeta de la empresa.
3. (Ampliación tras feedback del usuario en la misma sesión) Los encabezados de la tabla de
   Ingresos ("Clase B", "Clase A", "Sensom.", "Otros") son nombres legacy que en realidad
   corresponden a `cash_amount`/`transfer_amount`/`voucher_amount`/`card_amount` — no a tipos de
   clase. Es la misma confusión de fondo (falta de claridad sobre método de pago en la
   cuadratura), así que se corrige en el mismo fix en vez de abrir uno aparte.
4. (Segunda ampliación, misma sesión) La glosa de ingresos por matrícula muestra solo
   "Matrícula" para todas las filas, sin distinguir cuál matrícula ni si es Clase B o
   Profesional — obliga a abrir cada fila para saber a qué corresponde. `mapPaymentToIngreso`
   no traía el número de matrícula (`enrollments.number`) ni el tipo de curso
   (`enrollments.license_group`), aunque la query ya hace join con `enrollments`.

## ACs Afectados

- Ninguno de una spec formal — corrige el ítem de UAT "Cierre de caja del día → totales
  cuadran contra lo ingresado manualmente" (`docs/UAT-PLAN.md`), que quedó bloqueado por este
  hallazgo.

## Cambio

- **Archivo:** `src/app/shared/components/cuadratura-content/cuadratura-content.component.ts`
  **Qué cambia:** la fila "Ingresos de Sistema" pasa a mostrar `ingresosEfectivoHoy()` (label
  "Ingresos en Efectivo"), coherente con que el arqueo físico es 100% cash.
- **Archivo:** `supabase/migrations/<nueva>_add_payment_method_to_expenses_and_advances.sql`
  **Qué cambia:** agrega columna `payment_method` (`'efectivo' | 'transferencia' | 'tarjeta'`,
  default `'efectivo'` para no romper filas existentes) a `expenses` e
  `instructor_advances`.
- **Archivo:** `src/app/core/models/ui/cuadratura.model.ts` / DTOs `expense.model.ts` /
  `instructor-advance.model.ts`
  **Qué cambia:** agregan el campo `paymentMethod`/`payment_method`.
- **Archivo:** componente "Registrar Egreso" (drawer/modal correspondiente)
  **Qué cambia:** agrega selector de método de pago (efectivo/transferencia/tarjeta),
  default "efectivo".
- **Archivo:** `src/app/core/facades/cuadratura.facade.ts`
  **Qué cambia:** `registrarEgreso()` persiste el método elegido; se agrega
  `totalEgresosEfectivoHoy` (computed, solo egresos con `payment_method === 'efectivo'`) y
  `saldoTeoricoEfectivo` pasa a restar ese total en vez de `totalEgresosHoy()` (que sigue
  existiendo para el total general mostrado en "Total Egresos" de la tabla).
- **Archivo:** `cuadratura-content.component.ts`
  **Qué cambia:** `saldoComputado` resta el nuevo total de egresos-en-efectivo, no el total
  general de egresos; además renombra los encabezados "Clase B"/"Clase A"/"Sensom."/"Otros" a
  "Efectivo"/"Transf."/"Voucher"/"Tarjeta" (tabla desktop y badges de la vista mobile).
- **Archivo:** `cuadratura.facade.ts`
  **Qué cambia:** `fetchPayments()` agrega `number, license_group` al join con `enrollments`;
  `mapPaymentToIngreso()` usa el nuevo helper `buildPaymentGlosa()` para armar
  `"Matrícula #<number> — Clase B"` / `"Matrícula #<number> — Clase Profesional"` cuando el tipo
  de pago es de matrícula y viene el join; cae a "Matrícula" a secas si no viene.

## Test de Regresión

- `src/app/core/facades/cuadratura.facade.spec.ts > totalEgresosEfectivoHoy excluye egresos con payment_method distinto de efectivo (fix-211-m)` ✓
- `src/app/core/facades/cuadratura.facade.spec.ts > saldoTeoricoEfectivo resta solo egresos en efectivo, no el total (fix-211-m)` ✓
- `src/app/core/facades/cuadratura.facade.spec.ts > mapPaymentToIngreso > enriquece la glosa con número de matrícula y "Clase B"/"Clase Profesional" (fix-211-m)` ✓
- `src/app/core/facades/cuadratura.facade.spec.ts > mapPaymentToIngreso > cae a "Matrícula" a secas si no viene el join de enrollments (fix-211-m)` ✓
- `src/app/core/facades/cuadratura.facade.spec.ts > mapPaymentToIngreso > no enriquece glosas que no son "Matrícula" aunque venga el join (fix-211-m)` ✓

No se agregó test a nivel de `cuadratura-content.component.ts`: `saldoComputado` usa la misma
fórmula que `saldoTeoricoEfectivo` (ya cubierta arriba), y `fixture.componentRef.setInput()`
sobre este componente falla con NG0303 en el entorno de test actual — limitación de tooling ya
documentada en `alert-card.component.spec.ts` (requiere `@analogjs/vite-plugin-angular` para
compilar templates con inputs signal), no específica de este fix.
