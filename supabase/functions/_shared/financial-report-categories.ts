// supabase/functions/_shared/financial-report-categories.ts
//
// Nombres de categoría y totales del Reporte Contable exportado (generate-financial-report).
// Copia espejo de las reglas de la pantalla (src/app/core/utils/reportes-contables.utils.ts y
// payment-status.utils.ts): el Excel/PDF tiene que decir lo mismo que la pantalla (fix-077-i).
// Si cambia un nombre o una categoría allá, cambiarlo acá y en el test.

/** Estados de `payments` que cuentan como ingreso (= PAYMENT_STATUSES_QUE_SUMAN de la app). */
export const PAYMENT_STATUSES_QUE_SUMAN: readonly string[] = ['paid', 'completado'];

export function paymentCountsAsIncome(status: string | null | undefined): boolean {
  return PAYMENT_STATUSES_QUE_SUMAN.includes(status ?? '');
}

const EXPENSE_LABEL: Record<string, string> = {
  fuel: 'Bencina',
  rent: 'Arriendo',
  cleaning: 'Aseo',
  materials: 'Materiales',
  salary: 'Sueldos',
  utility: 'Servicios Básicos',
  insurance: 'Seguros',
  repair: 'Reparaciones',
  general: 'Gastos Varios',
  other: 'Otros',
};

/** El egreso de la Caja guarda `combustible`: es la misma categoría que `fuel` (fix-244-m). */
const EXPENSE_CATEGORY_ALIAS: Record<string, string> = {
  combustible: 'fuel',
};

const BRANCH_ABBREV: Record<number, string> = {
  1: 'A. Chillán',
  2: 'C. Chillán',
};

export interface Category {
  key: string;
  label: string;
}

/**
 * Categoría de un gasto (`expenses` o `fixed_expenses`). Sin categoría = "Gastos Varios";
 * una clave sin nombre conocido = "Otros".
 */
export function expenseCategory(raw: string | null | undefined): Category {
  const base = raw ?? 'general';
  const canonical = EXPENSE_CATEGORY_ALIAS[base] ?? base;
  const key = canonical in EXPENSE_LABEL ? canonical : 'other';
  return { key, label: EXPENSE_LABEL[key] };
}

export interface IncomeSource {
  /** `payments.type`, o `standalone` / `special_service` para cursos y servicios. */
  type: string | null;
  licenseGroup: string | null;
  branchId: number | null;
}

/**
 * Categoría de un ingreso. Con todas las sedes (`showBranch`), Clase B / Profesional / Cursos
 * se separan por sede, igual que la pantalla; Clases Extra y Servicios no.
 */
export function incomeCategory(p: IncomeSource, showBranch: boolean): Category {
  if (p.type === 'complement') return { key: 'complement', label: 'Clases Extra' };
  if (p.type === 'special_service') {
    return { key: 'special_service', label: 'Psicotécnico / Servicios' };
  }
  const lg = p.licenseGroup ?? 'unknown';
  const base =
    lg === 'class_b'
      ? 'Clase B'
      : lg === 'professional'
        ? 'Profesional'
        : lg === 'standalone'
          ? 'Cursos Singulares'
          : 'Otros';
  if (!showBranch || p.branchId == null) return { key: lg, label: base };
  const abbrev = BRANCH_ABBREV[p.branchId] ?? `Sede ${p.branchId}`;
  return { key: `${lg}:${p.branchId}`, label: `${base} (${abbrev})` };
}

export interface FinancialTotals {
  totalIngresos: number;
  totalGastos: number;
  totalNeto: number;
}

/** Total Gastos = gastos operacionales + gastos fijos, como en la pantalla. */
export function sumFinancialTotals(
  payments: { amount: number }[],
  expenses: { amount: number }[],
  fixedExpenses: { amount: number }[],
): FinancialTotals {
  const totalIngresos = payments.reduce((s, p) => s + p.amount, 0);
  const totalGastos = [...expenses, ...fixedExpenses].reduce((s, e) => s + e.amount, 0);
  return { totalIngresos, totalGastos, totalNeto: totalIngresos - totalGastos };
}
