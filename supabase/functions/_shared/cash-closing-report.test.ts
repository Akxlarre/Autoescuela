// Tests de las reglas del exporte de Caja Diaria (fix-076-i): el archivo dice lo mismo que la
// pantalla (CuadraturaFacade) y, con la caja cerrada, los montos guardados al cerrar.
import { assertEquals } from 'jsr:@std/assert@1';
import {
  diferenciaLabel,
  ingresoByMethod,
  paymentMethodLabel,
  resolveCajaTotals,
  rowsAtClose,
} from './cash-closing-report.ts';

Deno.test('ingresoByMethod: cada medio de pago va a su columna (tarjeta incluida)', () => {
  assertEquals(ingresoByMethod(10_000, 'tarjeta'), {
    efectivo: 0,
    transferencia: 0,
    tarjeta: 10_000,
    sence: 0,
    total: 10_000,
  });
  assertEquals(ingresoByMethod(5_000, null).efectivo, 5_000);
  assertEquals(ingresoByMethod(7_000, 'transferencia').transferencia, 7_000);
  assertEquals(ingresoByMethod(3_000, 'sence').sence, 3_000);
});

Deno.test('resolveCajaTotals: caja abierta = mismo cálculo que la pantalla (E02)', () => {
  // Fondo del borrador $50.000; pagos $530.000 ($270.000 efectivo) + servicio especial $20.000 en
  // efectivo; egresos $30.000 en efectivo + $10.000 con tarjeta.
  const ingresos = [
    { efectivo: 270_000, total: 530_000 },
    { efectivo: 20_000, total: 20_000 },
  ];
  const egresos = [
    { monto: 30_000, metodoPago: 'efectivo' },
    { monto: 10_000, metodoPago: 'tarjeta' },
  ];
  const t = resolveCajaTotals({ ingresos, egresos, fondoInicial: 50_000, snapshot: null });
  assertEquals(t, {
    fondoInicial: 50_000,
    totalIngresos: 550_000,
    totalEfectivo: 290_000,
    totalEgresos: 40_000,
    totalEgresosEfectivo: 30_000,
    saldoTeorico: 310_000,
  });
});

Deno.test(
  'resolveCajaTotals: caja cerrada usa el snapshot, no los movimientos de hoy (E07)',
  () => {
    const t = resolveCajaTotals({
      // Un curso singular inscrito después del cierre ya no cambia el archivo.
      ingresos: [{ efectivo: 0, total: 810_000 }],
      egresos: [],
      fondoInicial: 0,
      snapshot: {
        opening_amount: 50_000,
        total_income: 550_000,
        cash_amount: 290_000,
        total_expenses: 40_000,
        cash_expenses: 30_000,
        balance: 310_000,
      },
    });
    assertEquals(t, {
      fondoInicial: 50_000,
      totalIngresos: 550_000,
      totalEfectivo: 290_000,
      totalEgresos: 40_000,
      totalEgresosEfectivo: 30_000,
      saldoTeorico: 310_000,
    });
  },
);

Deno.test('resolveCajaTotals: cierre antiguo sin cash_expenses lo deduce del saldo', () => {
  const t = resolveCajaTotals({
    ingresos: [],
    egresos: [],
    fondoInicial: 0,
    snapshot: {
      opening_amount: 50_000,
      total_income: 100_000,
      cash_amount: 80_000,
      total_expenses: 20_000,
      cash_expenses: null,
      balance: 115_000,
    },
  });
  // fondo + efectivo − egreso efectivo = saldo → 50.000 + 80.000 − x = 115.000 → x = 15.000
  assertEquals(t.totalEgresosEfectivo, 15_000);
});

Deno.test('rowsAtClose: deja fuera lo registrado después del cierre', () => {
  const rows = [
    { id: 1, registradoEn: '2026-11-10T15:00:00.000Z' },
    { id: 2, registradoEn: '2026-11-10T23:30:00.000Z' },
    { id: 3, registradoEn: null },
  ];
  assertEquals(
    rowsAtClose(rows, '2026-11-10T22:00:00.000Z').map((r) => r.id),
    [1, 3],
  );
  assertEquals(rowsAtClose(rows, null).length, 3);
});

Deno.test('diferenciaLabel: un solo signo, el monto en valor absoluto (M04)', () => {
  assertEquals(diferenciaLabel(-500), 'Faltante: $500');
  assertEquals(diferenciaLabel(1_200), 'Sobrante: $1.200');
  assertEquals(diferenciaLabel(0), 'Cuadrado');
  assertEquals(diferenciaLabel(null), 'Sin arqueo');
});

Deno.test('paymentMethodLabel: nombres de la pantalla', () => {
  assertEquals(paymentMethodLabel('efectivo'), 'Efectivo');
  assertEquals(paymentMethodLabel('tarjeta'), 'Tarjeta');
  assertEquals(paymentMethodLabel('transferencia'), 'Transferencia');
  assertEquals(paymentMethodLabel(null), 'Efectivo');
});
