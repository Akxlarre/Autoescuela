import { describe, expect, it } from 'vitest';
import {
  buildReporte,
  computeDetalleDiario,
  computeEvolucionMensual,
  computeGastosCategoria,
  computeIngresosCategoria,
  computeKpis,
  filterPaymentsByBranch,
  type ExpenseRow,
  type PaymentRow,
} from './reportes-contables.utils';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const mkPayment = (
  total: number,
  type: string,
  licenseGroup: string | null,
  branchId: number,
  date = '2026-04-05',
): PaymentRow => ({
  total_amount: total,
  type,
  payment_date: date,
  enrollments: [{ branch_id: branchId, license_group: licenseGroup }],
});

const mkExpense = (amount: number, category: string, date = '2026-04-05'): ExpenseRow => ({
  amount,
  category,
  date,
});

const PAYMENTS: PaymentRow[] = [
  mkPayment(280_000, 'enrollment', 'class_b', 1, '2026-04-01'),
  mkPayment(560_000, 'enrollment', 'class_b', 1, '2026-04-02'),
  mkPayment(380_000, 'enrollment', 'professional', 2, '2026-04-02'),
  mkPayment(50_000, 'complement', null, 1, '2026-04-03'),
  mkPayment(40_000, 'special_service', null, 2, '2026-04-03'),
];

const EXPENSES: ExpenseRow[] = [
  mkExpense(200_000, 'fuel', '2026-04-01'),
  mkExpense(150_000, 'rent', '2026-04-02'),
  mkExpense(30_000, 'cleaning', '2026-04-03'),
];

// ── filterPaymentsByBranch ────────────────────────────────────────────────────

describe('filterPaymentsByBranch', () => {
  it('returns all payments when branchId is null', () => {
    expect(filterPaymentsByBranch(PAYMENTS, null)).toHaveLength(PAYMENTS.length);
  });

  it('filters to only branch 1 payments', () => {
    const result = filterPaymentsByBranch(PAYMENTS, 1);
    expect(result).toHaveLength(3);
    expect(result.every((p) => p.enrollments[0]?.branch_id === 1)).toBe(true);
  });

  it('filters to only branch 2 payments', () => {
    const result = filterPaymentsByBranch(PAYMENTS, 2);
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.enrollments[0]?.branch_id === 2)).toBe(true);
  });
});

// ── computeKpis ───────────────────────────────────────────────────────────────

describe('computeKpis', () => {
  it('sums totalIngresos correctly', () => {
    const kpis = computeKpis(PAYMENTS, EXPENSES);
    expect(kpis.totalIngresos).toBe(280_000 + 560_000 + 380_000 + 50_000 + 40_000);
  });

  it('sums totalGastos correctly', () => {
    const kpis = computeKpis(PAYMENTS, EXPENSES);
    expect(kpis.totalGastos).toBe(200_000 + 150_000 + 30_000);
  });

  it('calculates totalNeto = ingresos - gastos', () => {
    const kpis = computeKpis(PAYMENTS, EXPENSES);
    expect(kpis.totalNeto).toBe(kpis.totalIngresos - kpis.totalGastos);
  });

  it('calculates margenGanancia as a percentage', () => {
    const kpis = computeKpis(PAYMENTS, EXPENSES);
    const expectedMargen = Math.round((kpis.totalNeto / kpis.totalIngresos) * 1000) / 10;
    expect(kpis.margenGanancia).toBe(expectedMargen);
  });

  it('returns 0 margen when there are no ingresos', () => {
    const kpis = computeKpis([], EXPENSES);
    expect(kpis.margenGanancia).toBe(0);
  });

  it('counts operaciones correctly', () => {
    const kpis = computeKpis(PAYMENTS, EXPENSES);
    expect(kpis.operacionesIngresos).toBe(PAYMENTS.length);
    expect(kpis.operacionesGastos).toBe(EXPENSES.length);
  });
});

// ── computeIngresosCategoria ──────────────────────────────────────────────────

describe('computeIngresosCategoria', () => {
  it('groups class_b and professional separately when showBranch=false', () => {
    const cats = computeIngresosCategoria(PAYMENTS, false);
    const names = cats.map((c) => c.nombre);
    expect(names).toContain('Clase B');
    expect(names).toContain('Profesional');
    expect(names).toContain('Clases Extra');
    expect(names).toContain('Psicotécnico / Servicios');
  });

  it('includes branch abbreviation in label when showBranch=true', () => {
    const cats = computeIngresosCategoria(PAYMENTS, true);
    const names = cats.map((c) => c.nombre);
    expect(names).toContain('Clase B (A. Chillán)');
    expect(names).toContain('Profesional (C. Chillán)');
  });

  it('porcentajes sum to ~100', () => {
    const cats = computeIngresosCategoria(PAYMENTS, false);
    const total = cats.reduce((s, c) => s + c.porcentaje, 0);
    expect(total).toBeCloseTo(100, 0);
  });

  it('sorts categories descending by monto', () => {
    const cats = computeIngresosCategoria(PAYMENTS, false);
    for (let i = 1; i < cats.length; i++) {
      expect(cats[i - 1].monto).toBeGreaterThanOrEqual(cats[i].monto);
    }
  });

  it('returns empty array for empty payments', () => {
    expect(computeIngresosCategoria([], false)).toEqual([]);
  });
});

// ── computeGastosCategoria ────────────────────────────────────────────────────

describe('computeGastosCategoria', () => {
  it('maps expense categories to Spanish labels', () => {
    const cats = computeGastosCategoria(EXPENSES);
    const names = cats.map((c) => c.nombre);
    expect(names).toContain('Bencina');
    expect(names).toContain('Arriendo');
    expect(names).toContain('Aseo');
  });

  it('porcentajes sum to ~100', () => {
    const cats = computeGastosCategoria(EXPENSES);
    const total = cats.reduce((s, c) => s + c.porcentaje, 0);
    expect(total).toBeCloseTo(100, 0);
  });

  it('null category falls back to Otros', () => {
    const cats = computeGastosCategoria([mkExpense(10_000, null as unknown as string)]);
    expect(cats[0].nombre).toBe('Otros');
  });
});

// ── computeEvolucionMensual ───────────────────────────────────────────────────

describe('computeEvolucionMensual', () => {
  it('groups by month and sorts ascending', () => {
    const multiMonth: PaymentRow[] = [
      mkPayment(100_000, 'enrollment', 'class_b', 1, '2026-03-15'),
      mkPayment(200_000, 'enrollment', 'class_b', 1, '2026-04-10'),
    ];
    const result = computeEvolucionMensual(multiMonth, []);
    expect(result).toHaveLength(2);
    expect(result[0].mes).toMatch(/marzo/i);
    expect(result[1].mes).toMatch(/abril/i);
  });

  it('calculates neto = ingresos - gastos per month', () => {
    const result = computeEvolucionMensual(PAYMENTS, EXPENSES);
    for (const row of result) {
      expect(row.neto).toBe(row.ingresos - row.gastos);
    }
  });

  it('returns empty array when both inputs are empty', () => {
    expect(computeEvolucionMensual([], [])).toEqual([]);
  });

  it('includes months with only expenses (ingresos = 0)', () => {
    const onlyExpense = [mkExpense(50_000, 'fuel', '2026-05-01')];
    const result = computeEvolucionMensual([], onlyExpense);
    expect(result).toHaveLength(1);
    expect(result[0].ingresos).toBe(0);
    expect(result[0].gastos).toBe(50_000);
  });
});

// ── computeDetalleDiario ──────────────────────────────────────────────────────

describe('computeDetalleDiario', () => {
  it('creates a row per unique date', () => {
    const result = computeDetalleDiario(PAYMENTS, EXPENSES);
    const fechas = result.map((r) => r.fecha);
    expect(fechas).toContain('2026-04-01');
    expect(fechas).toContain('2026-04-02');
    expect(fechas).toContain('2026-04-03');
  });

  it('sorts rows ascending by date', () => {
    const result = computeDetalleDiario(PAYMENTS, EXPENSES);
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].fecha <= result[i].fecha).toBe(true);
    }
  });

  it('calculates neto per day', () => {
    const result = computeDetalleDiario(PAYMENTS, EXPENSES);
    for (const row of result) {
      expect(row.neto).toBe(row.ingresos - row.gastos);
    }
  });
});

// ── buildReporte (integración) ────────────────────────────────────────────────

describe('buildReporte', () => {
  it('sets escuela correctly', () => {
    const reporte = buildReporte(PAYMENTS, EXPENSES, 'Test Escuela', null);
    expect(reporte.escuela).toBe('Test Escuela');
  });

  it('diasConMovimientos equals length of detalleDiario', () => {
    const reporte = buildReporte(PAYMENTS, EXPENSES, '', null);
    expect(reporte.diasConMovimientos).toBe(reporte.detalleDiario.length);
  });

  it('computes full reporte without throwing', () => {
    expect(() => buildReporte(PAYMENTS, EXPENSES, 'Escuela', 1)).not.toThrow();
  });

  it('returns empty arrays for empty inputs', () => {
    const reporte = buildReporte([], [], 'Vacío', null);
    expect(reporte.ingresosCategoria).toEqual([]);
    expect(reporte.gastosCategoria).toEqual([]);
    expect(reporte.evolucionMensual).toEqual([]);
    expect(reporte.detalleDiario).toEqual([]);
    expect(reporte.diasConMovimientos).toBe(0);
  });
});
