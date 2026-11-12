# Fix: Cerrar la caja sin arqueo falla siempre que haya efectivo esperado
> id: fix-074-i-cierre-sin-arqueo-falla
> refs: fix-073-i (caso D03) · ASG-i-029
> status: done
> closed: 2026-11-12
> created: 2026-11-10
> priority: P0

## Root Cause

Encontrado en `fix-073-i`, tanda 2 (sede 2, 2026-11-10): "Cerrar Caja" con el arqueo apagado
devuelve 400 `new row for relation "cash_closings" violates check constraint "chk_arqueo_amount"`.

`buildCierrePayload()` (`core/facades/cuadratura.facade.ts`) arma, con el arqueo apagado,
`arqueoTotal = saldoTeoricoEfectivo()` y todas las cantidades de billetes/monedas en 0.
`chk_arqueo_amount` (`20260301000005_05_payments_and_finances.sql`) exige
`arqueo_amount IS NULL OR arqueo_amount = Σ cantidades × denominación`. Con saldo esperado ≠ 0
la fila nunca cumple: **sin arqueo solo se puede cerrar una caja con saldo esperado $0**.

El resto del flujo se comporta bien: el cierre no se guarda, la caja sigue abierta y el error se
ve en pantalla (fix-044-i).

## Decisión (Ignacio, 2026-11-12) — responde F10 del checklist

Un cierre sin conteo físico guarda `arqueo_amount = NULL` y `difference = NULL` (no hubo conteo,
no hay diferencia que medir), en vez de fingir un conteo igual al saldo esperado. Historial,
detalle y exportes lo muestran como **"Sin arqueo"**, nunca como "Cuadrado" ni como faltante.
No hace falta migración: ambas columnas son nullable y `chk_arqueo_amount` admite NULL.

Los 7 cierres de prueba antiguos (abril y 6-ago) con `arqueo_amount = 0` y diferencia −50.000
no se tocan: son datos de prueba previos al fix.

## ACs Afectados

- `0004-i` / checklist D03: "Cerrar sin arqueo: botón habilitado; el cierre se guarda".
- AC-1: con el arqueo apagado y saldo esperado ≠ 0, "Cerrar Caja" guarda el cierre (`status
  closed`) sin error.
- AC-2: ese cierre se ve en Historial y en su detalle como "Sin arqueo", sin diferencia ni
  "Cuadrado"/"Descuadre".
- AC-3: con el arqueo encendido, el cierre sigue guardando el conteo y la diferencia como hoy.

## Cambio

- `core/facades/cuadratura.facade.ts` + `core/models/ui/cuadratura.model.ts`: sin arqueo,
  `arqueoTotal` es `null` → `arqueo_amount` y `difference` NULL (antes: saldo esperado con los
  billetes en 0, que rechazaba el CHECK).
- `features/admin/contabilidad-cuadratura/arqueo-cierre-drawer.component.ts`: la confirmación
  avisa "Vas a cerrar sin contar el efectivo: el día quedará como «Sin arqueo»".
- `core/facades/historial-cuadraturas.facade.ts` + `core/models/ui/historial-cuadraturas.model.ts`:
  estado nuevo `unaudited`; `saldoFisico`/`diferencia` nullable; el Excel del mes deja esas celdas
  vacías y el estado "Sin arqueo"; `totalVigente` parte del saldo esperado si no hubo conteo.
- `shared/components/historial-cuadraturas-content` (calendario escritorio y móvil) y
  `shared/components/detalle-cuadratura-modal`: etiqueta "Sin arqueo", "No se contó", guion en
  la diferencia y "No se hizo arqueo este día" en el desglose.
- `supabase/functions/_shared/cash-arqueo.ts` (nuevo, `resolveArqueo`): lectura compartida del
  arqueo para `generate-cash-history-report` (estado "Sin arqueo", "—" en saldo físico, KPI
  "N sin arqueo") y `generate-cash-closing-report` ("Físico arqueado: no se contó", "Sin
  arqueo"). **Pendiente de deploy** de las dos funciones.

## Test de Regresión

- `src/app/core/facades/cuadratura.facade.spec.ts > cerrar sin arqueo guarda arqueo_amount y difference en null, no inventa un conteo (fix-074-i)` ✓
- `src/app/core/facades/cuadratura.facade.spec.ts > cerrar con arqueo guarda el conteo y la diferencia contra el saldo esperado (fix-074-i)` ✓
- `src/app/core/facades/historial-cuadraturas.facade.spec.ts > sin arqueo (arqueo_amount null) queda "sin arqueo"…` + `con arqueo mantiene…` + `totalVigente — cierre sin arqueo` ✓
- `src/app/features/admin/contabilidad-cuadratura/arqueo-cierre-drawer.component.spec.ts` (3) ✓
- `supabase/functions/_shared/cash-arqueo.test.ts` (3, `deno test`) ✓
- Suite completa `npm run test:ci`: 5089 passed, 5 skipped, 0 failed. `npm run lint:arch`: 0 errores.

## Verificación en navegador (2026-11-12, `ng serve` en :4300)

- Sede 2 (`secretaria2`), fondo $5.000, arqueo apagado → confirmación con el aviso → cierre 200
  con `arqueo_amount: null`, `difference: null`, `arqueo_enabled: false`; chip "Caja Cerrada". AC-1 ✓
- Admin, Historial sede 2: día 12 "Sin arqueo" con "—"; detalle "Sin arqueo", "Saldo físico: No se
  contó", diferencia "—", "No se hizo arqueo este día". AC-2 ✓
- El día 10 (con arqueo) sigue "Cuadrado $0". AC-3 ✓
- Excel del mes (sede 2): fila del 12 con Saldo Físico y Diferencia vacíos y Estado "Sin arqueo"; la
  del 10 sigue "Cuadrado". ✓
- Móvil 375 px: la lista muestra "Sin arqueo" con punto gris y "—". Modo oscuro: calendario y
  detalle legibles. ✓ Con el drawer abierto la celda del calendario es angosta y la etiqueta
  "Sin arqueo" ocupa dos líneas (igual que "Cuadrado", que se corta): es el ancho de la celda, no
  de este fix.
- Deploy (autorizado por Ignacio, 2026-11-12): `generate-cash-history-report` y
  `generate-cash-closing-report` desde `fixes_final_boss`.
- PDF del mes (sede 2): día 12 "Sin arqueo" con "-" en Saldo Fís.; KPI "Días Cuadrados 1 / 2 ·
  1 sin arqueo"; día 10 "Cuadrado". ✓
- PDF del cierre del 12 desde el detalle: "Físico Arqueado: no se contó · Sin arqueo", sin tabla
  de billetes. ✓
- Dato de prueba nuevo: `cash_closings` sede 2, 2026-11-12, `closed`, fondo 5.000, sin arqueo
  (limpieza junto con los QA-073 de `fix-073-i`).
