/**
 * Núcleo funcional (Functional Core) para el módulo de Reportes Contables.
 * Todas las funciones son puras: (Data In → Data Out), sin efectos secundarios.
 * Testeables sin levantar el framework Angular.
 */

import type {
  CategoriaGasto,
  CategoriaIngreso,
  DetalleDiario,
  EvolucionMensual,
  ReporteContable,
  ReporteKpis,
} from '@core/models/ui/reportes-contables.model';

// ── Tipos internos (solo usados aquí y en el Facade) ─────────────────────────

export interface PaymentRow {
  total_amount: number;
  type: string | null;
  payment_date: string | null;
  // Supabase devuelve relaciones siempre como array, incluso con !inner
  enrollments: { branch_id: number; license_group: string | null }[];
}

export interface ExpenseRow {
  amount: number;
  category: string | null;
  date: string;
}

// ── Constantes de configuración ───────────────────────────────────────────────

const BRANCH_ABBREV: Record<number, string> = {
  1: 'A. Chillán',
  2: 'C. Chillán',
};

const INCOME_COLORS: Record<string, string> = {
  class_b: 'var(--state-info)',
  professional: '#7c3aed',
  complement: 'var(--state-warning)',
  special_service: 'var(--state-success)',
};

const EXPENSE_LABEL: Record<string, string> = {
  fuel: 'Bencina',
  rent: 'Arriendo',
  cleaning: 'Aseo',
  materials: 'Materiales',
  other: 'Otros',
};

// ── Helpers internos ──────────────────────────────────────────────────────────

/** Formatea YYYY-MM como "Enero 2026". */
function monthLabel(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
}

/**
 * Determina la clave de categoría de ingreso para un pago.
 * Retorna una clave compuesta `"<tipo>:<branchId>"` para que las categorías
 * puedan agruparse incluyendo la sede cuando corresponda.
 */
function incomeCategoryKey(p: PaymentRow, showBranch: boolean): string {
  const type = p.type ?? 'unknown';
  if (type === 'complement') return 'complement';
  if (type === 'special_service') return 'special_service';
  // enrollment | monthly_fee → agrupar por license_group (+ branch si showBranch)
  const enr = p.enrollments[0];
  const lg = enr?.license_group ?? 'unknown';
  return showBranch ? `${lg}:${enr?.branch_id ?? 0}` : lg;
}

/** Convierte una clave de categoría en una etiqueta legible. */
function incomeCategoryLabel(key: string, showBranch: boolean): string {
  if (key === 'complement') return 'Clases Extra';
  if (key === 'special_service') return 'Psicotécnico / Servicios';
  const [lg, branchIdStr] = key.split(':');
  const base = lg === 'class_b' ? 'Clase B' : lg === 'professional' ? 'Profesional' : 'Otros';
  if (showBranch && branchIdStr) {
    const abbrev = BRANCH_ABBREV[Number(branchIdStr)] ?? `Sede ${branchIdStr}`;
    return `${base} (${abbrev})`;
  }
  return base;
}

/** Determina el color de barra para una categoría de ingreso. */
function incomeBarColor(key: string): string {
  if (key === 'complement') return INCOME_COLORS['complement'];
  if (key === 'special_service') return INCOME_COLORS['special_service'];
  const lg = key.split(':')[0];
  return INCOME_COLORS[lg] ?? 'var(--state-info)';
}

// ── Funciones exportadas (usadas por el Facade) ───────────────────────────────

/**
 * Filtra los pagos según la sede efectiva.
 * Si `branchId` es null, devuelve todos (admin multi-sede).
 */
export function filterPaymentsByBranch(
  payments: PaymentRow[],
  branchId: number | null,
): PaymentRow[] {
  if (branchId === null) return payments;
  return payments.filter((p) => p.enrollments[0]?.branch_id === branchId);
}

/** Calcula los KPIs a partir de los arrays raw de pagos y gastos. */
export function computeKpis(payments: PaymentRow[], expenses: ExpenseRow[]): ReporteKpis {
  const totalIngresos = payments.reduce((s, p) => s + p.total_amount, 0);
  const totalGastos = expenses.reduce((s, e) => s + e.amount, 0);
  const totalNeto = totalIngresos - totalGastos;
  const margenGanancia =
    totalIngresos > 0 ? Math.round((totalNeto / totalIngresos) * 1000) / 10 : 0;

  return {
    totalIngresos,
    totalGastos,
    totalNeto,
    operacionesIngresos: payments.length,
    operacionesGastos: expenses.length,
    margenGanancia,
  };
}

/**
 * Agrupa los pagos por categoría de ingreso y calcula porcentajes.
 * `showBranch` = true cuando el admin ve todas las sedes (branchId === null).
 */
export function computeIngresosCategoria(
  payments: PaymentRow[],
  showBranch: boolean,
): CategoriaIngreso[] {
  const totalIngresos = payments.reduce((s, p) => s + p.total_amount, 0);
  const map = new Map<string, { monto: number; operaciones: number }>();

  for (const p of payments) {
    const key = incomeCategoryKey(p, showBranch);
    const current = map.get(key) ?? { monto: 0, operaciones: 0 };
    map.set(key, { monto: current.monto + p.total_amount, operaciones: current.operaciones + 1 });
  }

  return Array.from(map.entries())
    .map(([key, { monto, operaciones }]) => ({
      nombre: incomeCategoryLabel(key, showBranch),
      monto,
      operaciones,
      porcentaje: totalIngresos > 0 ? Math.round((monto / totalIngresos) * 1000) / 10 : 0,
      barColor: incomeBarColor(key),
    }))
    .sort((a, b) => b.monto - a.monto);
}

/** Agrupa los gastos por categoría y calcula porcentajes. */
export function computeGastosCategoria(expenses: ExpenseRow[]): CategoriaGasto[] {
  const totalGastos = expenses.reduce((s, e) => s + e.amount, 0);
  const map = new Map<string, { monto: number; registros: number }>();

  for (const e of expenses) {
    const cat = e.category ?? 'other';
    const current = map.get(cat) ?? { monto: 0, registros: 0 };
    map.set(cat, { monto: current.monto + e.amount, registros: current.registros + 1 });
  }

  return Array.from(map.entries())
    .map(([cat, { monto, registros }]) => ({
      nombre: EXPENSE_LABEL[cat] ?? 'Otros',
      monto,
      registros,
      porcentaje: totalGastos > 0 ? Math.round((monto / totalGastos) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.monto - a.monto);
}

/** Construye la evolución mensual agrupando por YYYY-MM. */
export function computeEvolucionMensual(
  payments: PaymentRow[],
  expenses: ExpenseRow[],
): EvolucionMensual[] {
  const ingresosPorMes = new Map<string, number>();
  const gastosPorMes = new Map<string, number>();
  const meses = new Set<string>();

  for (const p of payments) {
    if (!p.payment_date) continue;
    const mes = p.payment_date.substring(0, 7);
    meses.add(mes);
    ingresosPorMes.set(mes, (ingresosPorMes.get(mes) ?? 0) + p.total_amount);
  }

  for (const e of expenses) {
    const mes = e.date.substring(0, 7);
    meses.add(mes);
    gastosPorMes.set(mes, (gastosPorMes.get(mes) ?? 0) + e.amount);
  }

  return Array.from(meses)
    .sort()
    .map((mes) => {
      const ingresos = ingresosPorMes.get(mes) ?? 0;
      const gastos = gastosPorMes.get(mes) ?? 0;
      const neto = ingresos - gastos;
      const margen = ingresos > 0 ? Math.round((neto / ingresos) * 1000) / 10 : 0;
      return { mes: monthLabel(mes), ingresos, gastos, neto, margen };
    });
}

/** Construye el detalle diario agrupando por YYYY-MM-DD. */
export function computeDetalleDiario(
  payments: PaymentRow[],
  expenses: ExpenseRow[],
): DetalleDiario[] {
  const ingresosPorDia = new Map<string, { monto: number; ops: number }>();
  const gastosPorDia = new Map<string, number>();
  const dias = new Set<string>();

  for (const p of payments) {
    if (!p.payment_date) continue;
    dias.add(p.payment_date);
    const current = ingresosPorDia.get(p.payment_date) ?? { monto: 0, ops: 0 };
    ingresosPorDia.set(p.payment_date, {
      monto: current.monto + p.total_amount,
      ops: current.ops + 1,
    });
  }

  for (const e of expenses) {
    dias.add(e.date);
    gastosPorDia.set(e.date, (gastosPorDia.get(e.date) ?? 0) + e.amount);
  }

  return Array.from(dias)
    .sort()
    .map((fecha) => {
      const ingData = ingresosPorDia.get(fecha) ?? { monto: 0, ops: 0 };
      const gastos = gastosPorDia.get(fecha) ?? 0;
      return {
        fecha,
        operaciones: ingData.ops + (gastosPorDia.has(fecha) ? 1 : 0),
        ingresos: ingData.monto,
        gastos,
        neto: ingData.monto - gastos,
      };
    });
}

/**
 * Punto de entrada principal: construye el `ReporteContable` completo
 * a partir de los arrays raw y el contexto de sede.
 */
export function buildReporte(
  payments: PaymentRow[],
  expenses: ExpenseRow[],
  escuela: string,
  branchId: number | null,
): ReporteContable {
  const showBranch = branchId === null;
  const detalleDiario = computeDetalleDiario(payments, expenses);

  return {
    kpis: computeKpis(payments, expenses),
    ingresosCategoria: computeIngresosCategoria(payments, showBranch),
    gastosCategoria: computeGastosCategoria(expenses),
    evolucionMensual: computeEvolucionMensual(payments, expenses),
    detalleDiario,
    diasConMovimientos: detalleDiario.length,
    escuela,
  };
}
