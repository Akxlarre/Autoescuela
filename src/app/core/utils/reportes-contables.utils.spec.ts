import { describe, expect, it } from 'vitest';
import {
  buildReporte,
  computeEvolucionMensual,
  computeEvolucionRange,
  computeGastosCategoria,
  computeIngresosCategoria,
  computeKpis,
  computeRentabilidadCursos,
  filterPaymentsByBranch,
  mapSingularSaleToPaymentRow,
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
  // Forma real que devuelve Supabase para una relación many-to-one (fix-056): objeto, no array.
  enrollments: { branch_id: branchId, license_group: licenseGroup },
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
    expect(result.every((p) => p.enrollments?.branch_id === 1)).toBe(true);
  });

  it('filters to only branch 2 payments', () => {
    const result = filterPaymentsByBranch(PAYMENTS, 2);
    expect(result).toHaveLength(2);
    expect(result.every((p) => p.enrollments?.branch_id === 2)).toBe(true);
  });
});

// ── fix-056: regresión H-013 (bug array-vs-objeto en la relación enrollments) ─

describe('fix-056: enrollments como objeto (no array) desde Supabase', () => {
  it('un pago real de matrícula (enrollment) de la sede de la secretaria NO se descarta', () => {
    const pagoMatriculaWebpay = mkPayment(180_000, 'enrollment', 'class_b', 2, '2026-07-22');
    const result = filterPaymentsByBranch([pagoMatriculaWebpay], 2);
    expect(result).toHaveLength(1);
  });

  it('con showBranch, categoriza por la sede real en vez de caer en "Otros (Sede 0)"', () => {
    const pagoMatriculaWebpay = mkPayment(180_000, 'enrollment', 'class_b', 2, '2026-07-22');
    const cats = computeIngresosCategoria([pagoMatriculaWebpay], true);
    expect(cats.map((c) => c.nombre)).not.toContain('Otros (Sede 0)');
    expect(cats.map((c) => c.nombre)).toContain('Clase B (C. Chillán)');
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

  it('porcentajes suman exactamente 100.0 (resto mayor, hotfix-101-m)', () => {
    const cats = computeIngresosCategoria(PAYMENTS, false);
    const totalDecimas = cats.reduce((s, c) => s + Math.round(c.porcentaje * 10), 0);
    expect(totalDecimas).toBe(1000);
  });

  it('el caso 1.17M / 0.81M / 0.54M da 100.0 y no 99.9 (hotfix-101-m)', () => {
    const payments = [
      mkPayment(1_170_000, 'enrollment', 'class_b', 2, '2026-09-01'),
      mkPayment(810_000, 'enrollment', 'class_b', 1, '2026-09-02'),
      mkPayment(540_000, 'enrollment', 'professional', 2, '2026-09-03'),
    ];
    const cats = computeIngresosCategoria(payments, true);
    const totalDecimas = cats.reduce((s, c) => s + Math.round(c.porcentaje * 10), 0);
    expect(totalDecimas).toBe(1000);
    // cada porcentaje sigue teniendo a lo sumo 1 decimal
    for (const c of cats) expect(Math.round(c.porcentaje * 10) / 10).toBe(c.porcentaje);
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

  it('porcentajes suman exactamente 100.0 (resto mayor, hotfix-101-m)', () => {
    const cats = computeGastosCategoria(EXPENSES);
    const totalDecimas = cats.reduce((s, c) => s + Math.round(c.porcentaje * 10), 0);
    expect(totalDecimas).toBe(1000);
  });

  it('tres montos que redondearían a 99.9 suman 100 (hotfix-101-m)', () => {
    const cats = computeGastosCategoria([
      mkExpense(1_170_000, 'fuel'),
      mkExpense(810_000, 'rent'),
      mkExpense(540_000, 'materials'),
    ]);
    const totalDecimas = cats.reduce((s, c) => s + Math.round(c.porcentaje * 10), 0);
    expect(totalDecimas).toBe(1000);
  });

  it('total 0 → todos los porcentajes en 0; una sola categoría → 100 (hotfix-101-m)', () => {
    expect(
      computeGastosCategoria([mkExpense(0, 'fuel'), mkExpense(0, 'rent')]).every(
        (c) => c.porcentaje === 0,
      ),
    ).toBe(true);
    expect(computeGastosCategoria([mkExpense(5_000, 'fuel')])[0].porcentaje).toBe(100);
  });

  it('rotula "fuel" y el alias legacy "combustible" como "Bencina" (fix-244-m)', () => {
    const cats = computeGastosCategoria([
      mkExpense(50_000, 'fuel'),
      mkExpense(30_000, 'combustible'),
    ]);
    expect(cats.map((c) => c.nombre)).toEqual(['Bencina']);
    expect(cats[0].monto).toBe(80_000);
    expect(cats[0].registros).toBe(2);
  });

  it('rotula "general" y category=null como "Gastos Varios" (fix-244-m)', () => {
    const cats = computeGastosCategoria([
      mkExpense(10_000, 'general'),
      mkExpense(5_000, null as unknown as string),
    ]);
    expect(cats.map((c) => c.nombre)).toEqual(['Gastos Varios']);
    expect(cats[0].monto).toBe(15_000);
  });

  it('agrupa toda categoría desconocida en una sola fila "Otros" (fix-244-m)', () => {
    const cats = computeGastosCategoria([
      mkExpense(10_000, 'xyz'),
      mkExpense(20_000, 'no-existe'),
      mkExpense(30_000, 'other'),
    ]);
    const otros = cats.filter((c) => c.nombre === 'Otros');
    expect(otros).toHaveLength(1);
    expect(otros[0].monto).toBe(60_000);
    expect(otros[0].registros).toBe(3);
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

  it('setea sinMovimientos por fila también sin lista de meses (spec 0015-m)', () => {
    const res = computeEvolucionMensual(
      [mkPayment(100_000, 'enrollment', 'class_b', 1, '2026-04-10')],
      [mkExpense(20_000, 'fuel', '2026-05-01')],
    );
    // abril: solo ingresos → no está "sin movimientos"; mayo: solo gastos → tampoco
    expect(res.find((r) => /abril/i.test(r.mes))?.sinMovimientos).toBe(false);
    expect(res.find((r) => /mayo/i.test(r.mes))?.sinMovimientos).toBe(false);
  });

  // ── spec 0015-m: relleno de meses vacíos con lista explícita ──────────────────
  describe('con lista de meses explícita (spec 0015-m)', () => {
    const MESES = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];

    it('emite exactamente esos meses, en ese orden, aunque no tengan datos', () => {
      const res = computeEvolucionMensual(
        [mkPayment(300_000, 'enrollment', 'class_b', 1, '2026-04-05')],
        [mkExpense(40_000, 'fuel', '2026-09-20')],
        MESES,
      );
      expect(res).toHaveLength(6);
      expect(res.map((r) => r.mes.toLowerCase())).toEqual([
        expect.stringContaining('abril'),
        expect.stringContaining('mayo'),
        expect.stringContaining('junio'),
        expect.stringContaining('julio'),
        expect.stringContaining('agosto'),
        expect.stringContaining('septiembre'),
      ]);
    });

    it('meses sin ingresos NI gastos quedan en 0 y sinMovimientos=true (AC7, AC-E3)', () => {
      const res = computeEvolucionMensual([], [], MESES);
      expect(res).toHaveLength(6);
      for (const r of res) {
        expect(r.ingresos).toBe(0);
        expect(r.gastos).toBe(0);
        expect(r.neto).toBe(0);
        expect(r.sinMovimientos).toBe(true);
      }
    });

    it('un mes con solo ingresos o solo gastos NO es "sin movimientos" (AC-E4)', () => {
      const res = computeEvolucionMensual(
        [mkPayment(500_000, 'enrollment', 'class_b', 1, '2026-05-05')],
        [mkExpense(30_000, 'fuel', '2026-07-10')],
        MESES,
      );
      const byMes = (re: RegExp) => res.find((r) => re.test(r.mes))!;
      expect(byMes(/mayo/i).sinMovimientos).toBe(false); // solo ingresos
      expect(byMes(/julio/i).sinMovimientos).toBe(false); // solo gastos
      expect(byMes(/abril/i).sinMovimientos).toBe(true); // nada
      expect(byMes(/junio/i).sinMovimientos).toBe(true); // nada
    });

    it('ignora datos fuera de la ventana de meses pedida', () => {
      const res = computeEvolucionMensual(
        [
          mkPayment(999_999, 'enrollment', 'class_b', 1, '2026-01-05'), // fuera
          mkPayment(100_000, 'enrollment', 'class_b', 1, '2026-06-05'), // dentro
        ],
        [],
        MESES,
      );
      expect(res.reduce((s, r) => s + r.ingresos, 0)).toBe(100_000);
    });
  });
});

// ── computeEvolucionRange (spec 0015-m) ───────────────────────────────────────

describe('computeEvolucionRange', () => {
  const SEP_2026 = new Date(2026, 8, 15); // 15 de septiembre de 2026

  it('ultimos_6_meses → 6 meses [abr..sep], desde 1° abril, hasta fin septiembre', () => {
    const r = computeEvolucionRange('ultimos_6_meses', SEP_2026);
    expect(r.meses).toEqual(['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09']);
    expect(r.desde).toBe('2026-04-01');
    expect(r.hasta).toBe('2026-09-30');
  });

  it('ultimos_12_meses → 12 meses [oct 2025 .. sep 2026]', () => {
    const r = computeEvolucionRange('ultimos_12_meses', SEP_2026);
    expect(r.meses).toHaveLength(12);
    expect(r.meses[0]).toBe('2025-10');
    expect(r.meses[11]).toBe('2026-09');
    expect(r.desde).toBe('2025-10-01');
    expect(r.hasta).toBe('2026-09-30');
  });

  it('anio_actual → enero hasta el mes en curso, inclusive (AC5)', () => {
    const r = computeEvolucionRange('anio_actual', SEP_2026);
    expect(r.meses).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
      '2026-08',
      '2026-09',
    ]);
    expect(r.desde).toBe('2026-01-01');
    expect(r.hasta).toBe('2026-09-30');
  });

  it('anio_actual en enero → un solo mes (AC-E1)', () => {
    const r = computeEvolucionRange('anio_actual', new Date(2026, 0, 10));
    expect(r.meses).toEqual(['2026-01']);
    expect(r.desde).toBe('2026-01-01');
    expect(r.hasta).toBe('2026-01-31');
  });

  it('anio_anterior → los 12 meses del año calendario anterior (AC6)', () => {
    const r = computeEvolucionRange('anio_anterior', SEP_2026);
    expect(r.meses).toHaveLength(12);
    expect(r.meses[0]).toBe('2025-01');
    expect(r.meses[11]).toBe('2025-12');
    expect(r.desde).toBe('2025-01-01');
    expect(r.hasta).toBe('2025-12-31');
  });
});

// ── buildReporte (integración) ────────────────────────────────────────────────

describe('buildReporte', () => {
  it('sets escuela correctly', () => {
    const reporte = buildReporte(PAYMENTS, EXPENSES, 'Test Escuela', null);
    expect(reporte.escuela).toBe('Test Escuela');
  });

  it('computes full reporte without throwing', () => {
    expect(() => buildReporte(PAYMENTS, EXPENSES, 'Escuela', 1)).not.toThrow();
  });

  it('returns empty arrays for empty inputs', () => {
    const reporte = buildReporte([], [], 'Vacío', null);
    expect(reporte.ingresosCategoria).toEqual([]);
    expect(reporte.gastosCategoria).toEqual([]);
    expect(reporte.evolucionMensual).toEqual([]);
    expect(reporte.rentabilidadCursos).toEqual([]);
  });
});

// ── fix-016: cursos singulares como categoría de ingreso ──────────────────────

describe('cursos singulares (standalone) en el reporte', () => {
  it('mapSingularSaleToPaymentRow normaliza el cobro a PaymentRow', () => {
    const row = mapSingularSaleToPaymentRow({
      amount_paid: 200_000,
      paid_at: '2026-04-10T15:30:00+00:00',
      branch_id: 2,
    });
    expect(row.total_amount).toBe(200_000);
    expect(row.type).toBe('standalone');
    expect(row.payment_date).toBe('2026-04-10');
    expect(row.enrollments).toEqual({ branch_id: 2, license_group: 'standalone' });
  });

  it('mapSingularSaleToPaymentRow tolera amount_paid y paid_at nulos', () => {
    const row = mapSingularSaleToPaymentRow({ amount_paid: null, paid_at: null, branch_id: 1 });
    expect(row.total_amount).toBe(0);
    expect(row.payment_date).toBeNull();
  });

  it('aparece como categoría "Cursos Singulares" en computeIngresosCategoria', () => {
    const payments = [
      ...PAYMENTS,
      mapSingularSaleToPaymentRow({
        amount_paid: 220_000,
        paid_at: '2026-04-10T12:00:00+00:00',
        branch_id: 1,
      }),
    ];
    const categorias = computeIngresosCategoria(payments, false);
    const singular = categorias.find((c) => c.nombre === 'Cursos Singulares');
    expect(singular).toBeDefined();
    expect(singular!.monto).toBe(220_000);
    expect(singular!.operaciones).toBe(1);
  });

  it('con showBranch incluye la sede en la etiqueta', () => {
    const payments = [
      mapSingularSaleToPaymentRow({
        amount_paid: 220_000,
        paid_at: '2026-04-10T12:00:00+00:00',
        branch_id: 1,
      }),
    ];
    const categorias = computeIngresosCategoria(payments, true);
    expect(categorias[0].nombre).toBe('Cursos Singulares (A. Chillán)');
  });

  it('filterPaymentsByBranch respeta la sede del curso singular', () => {
    const payments = [
      mapSingularSaleToPaymentRow({ amount_paid: 100, paid_at: '2026-04-10', branch_id: 1 }),
      mapSingularSaleToPaymentRow({ amount_paid: 200, paid_at: '2026-04-10', branch_id: 2 }),
    ];
    expect(filterPaymentsByBranch(payments, 1)).toHaveLength(1);
    expect(filterPaymentsByBranch(payments, 2)[0].total_amount).toBe(200);
  });

  it('suma en los KPIs y en la evolución mensual como cualquier ingreso', () => {
    const payments = [
      mkPayment(100_000, 'enrollment', 'class_b', 1, '2026-04-10'),
      mapSingularSaleToPaymentRow({
        amount_paid: 220_000,
        paid_at: '2026-04-10T12:00:00+00:00',
        branch_id: 1,
      }),
    ];
    expect(computeKpis(payments, []).totalIngresos).toBe(320_000);
    const mes = computeEvolucionMensual(payments, []).find((m) => /abril/i.test(m.mes));
    expect(mes?.ingresos).toBe(320_000);
  });
});

// ── fix-237-m: rentabilidad estimada por tipo de curso ────────────────────────

describe('computeRentabilidadCursos', () => {
  it('agrupa ingresos por tipo de curso sin desglose por sede', () => {
    const payments = [
      mkPayment(300_000, 'enrollment', 'class_b', 1, '2026-04-01'),
      mkPayment(100_000, 'enrollment', 'class_b', 2, '2026-04-02'),
      mkPayment(400_000, 'enrollment', 'professional', 2, '2026-04-03'),
    ];
    const filas = computeRentabilidadCursos(payments, [], {});
    const claseB = filas.find((f) => f.tipoCurso === 'Clase B');
    const prof = filas.find((f) => f.tipoCurso === 'Profesional');
    expect(claseB?.ingresos).toBe(400_000);
    expect(prof?.ingresos).toBe(400_000);
    expect(filas).toHaveLength(2);
  });

  it('reparte fuel+repair por nº de clases y materials por ingresos; el TOTAL cuadra exacto', () => {
    const payments = [
      mkPayment(600_000, 'enrollment', 'class_b', 1, '2026-04-01'),
      mkPayment(400_000, 'enrollment', 'professional', 2, '2026-04-02'),
    ];
    const expenses: ExpenseRow[] = [
      mkExpense(100_000, 'fuel'),
      mkExpense(20_000, 'repair'),
      mkExpense(50_000, 'materials'),
      mkExpense(999_999, 'rent'), // gasto fijo — NO debe entrar
      mkExpense(888_888, 'salary'), // gasto fijo — NO debe entrar
    ];
    // Clase B hizo 3 clases, Profesional 1 → pool vehículo (120k) se reparte 90k / 30k
    const filas = computeRentabilidadCursos(payments, expenses, { class_b: 3, professional: 1 });
    const claseB = filas.find((f) => f.tipoCurso === 'Clase B')!;
    const prof = filas.find((f) => f.tipoCurso === 'Profesional')!;

    // materials (50k) por ingresos: 60% / 40% → 30k / 20k
    expect(claseB.gastosDirectos).toBe(90_000 + 30_000);
    expect(prof.gastosDirectos).toBe(30_000 + 20_000);

    const totalGastos = filas.reduce((s, f) => s + f.gastosDirectos, 0);
    expect(totalGastos).toBe(100_000 + 20_000 + 50_000); // fuel+repair+materials exacto
    expect(claseB.margenNeto).toBe(claseB.ingresos - claseB.gastosDirectos);
  });

  it('el pool de vehículo incluye category="combustible" (alias legacy de fuel, fix-244-m)', () => {
    const payments = [
      mkPayment(600_000, 'enrollment', 'class_b', 1, '2026-04-01'),
      mkPayment(400_000, 'enrollment', 'professional', 2, '2026-04-02'),
    ];
    const expenses: ExpenseRow[] = [mkExpense(120_000, 'combustible')];
    const filas = computeRentabilidadCursos(payments, expenses, { class_b: 3, professional: 1 });
    const claseB = filas.find((f) => f.tipoCurso === 'Clase B')!;
    const prof = filas.find((f) => f.tipoCurso === 'Profesional')!;
    // 120k por nº de clases 3/1 → 90k / 30k (mismo reparto que 'fuel')
    expect(claseB.gastosDirectos).toBe(90_000);
    expect(prof.gastosDirectos).toBe(30_000);
  });

  it('sin clases contadas → el pool de vehículo cae al fallback por ingresos', () => {
    const payments = [
      mkPayment(700_000, 'enrollment', 'class_b', 1, '2026-04-01'),
      mkPayment(300_000, 'enrollment', 'professional', 2, '2026-04-02'),
    ];
    const expenses: ExpenseRow[] = [mkExpense(100_000, 'fuel')];
    const filas = computeRentabilidadCursos(payments, expenses, {});
    const claseB = filas.find((f) => f.tipoCurso === 'Clase B')!;
    const prof = filas.find((f) => f.tipoCurso === 'Profesional')!;
    expect(claseB.gastosDirectos + prof.gastosDirectos).toBe(100_000);
    expect(claseB.gastosDirectos).toBe(70_000); // 70% de participación en ingresos
  });

  it('un tipo sin clases prácticas solo recibe su share de materiales; sin NaN/Infinity', () => {
    const payments = [
      mkPayment(500_000, 'enrollment', 'class_b', 1, '2026-04-01'),
      mkPayment(500_000, 'special_service', null, 1, '2026-04-02'),
    ];
    const expenses: ExpenseRow[] = [mkExpense(80_000, 'fuel'), mkExpense(40_000, 'materials')];
    const filas = computeRentabilidadCursos(payments, expenses, { class_b: 4 });
    const psico = filas.find((f) => f.tipoCurso === 'Psicotécnico / Servicios')!;
    // toda la bencina va a Clase B (única con clases); psico solo materiales (50% → 20k)
    expect(psico.gastosDirectos).toBe(20_000);
    expect(Number.isFinite(psico.rentabilidadPorcentaje)).toBe(true);
  });

  it('ingresos en cero no producen NaN en el porcentaje', () => {
    const filas = computeRentabilidadCursos(
      [mkPayment(0, 'enrollment', 'class_b', 1, '2026-04-01')],
      [mkExpense(10_000, 'fuel')],
      {},
    );
    expect(filas[0].rentabilidadPorcentaje).toBe(0);
  });

  it('sin pagos → devuelve arreglo vacío', () => {
    expect(computeRentabilidadCursos([], [mkExpense(10_000, 'fuel')], {})).toEqual([]);
  });

  it('buildReporte expone rentabilidadCursos y usa solo gastos operacionales', () => {
    const reporte = buildReporte(
      [mkPayment(100_000, 'enrollment', 'class_b', 1, '2026-04-01')],
      [mkExpense(10_000, 'fuel'), mkExpense(5_000, 'rent')], // "todos" los gastos
      'Escuela',
      1,
      { class_b: 2 },
      [mkExpense(10_000, 'fuel')], // solo operacionales para rentabilidad
    );
    expect(reporte.rentabilidadCursos).toHaveLength(1);
    expect(reporte.rentabilidadCursos[0].gastosDirectos).toBe(10_000);
  });
});
