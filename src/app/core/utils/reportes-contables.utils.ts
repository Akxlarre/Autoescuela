/**
 * Núcleo funcional (Functional Core) para el módulo de Reportes Contables.
 * Todas las funciones son puras: (Data In → Data Out), sin efectos secundarios.
 * Testeables sin levantar el framework Angular.
 */

import type {
  CategoriaGasto,
  CategoriaIngreso,
  ClassCountsByGroup,
  DetalleDiario,
  EvolucionMensual,
  RentabilidadCurso,
  ReporteContable,
  ReporteKpis,
} from '@core/models/ui/reportes-contables.model';

// ── Tipos internos (solo usados aquí y en el Facade) ─────────────────────────

export interface PaymentRow {
  total_amount: number;
  type: string | null;
  payment_date: string | null;
  // payments.enrollment_id → enrollments.id es many-to-one: Supabase/PostgREST
  // devuelve la relación como OBJETO plano (no array), aun con el hint `!inner`.
  // (fix-056: el código previo asumía array y leía [0], que en un objeto es
  // siempre undefined — todo pago quedaba fuera del filtro de sede).
  enrollments: { branch_id: number; license_group: string | null };
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

// class_b/complement/special_service reusan tokens `--state-*` porque su color ya tiene
// un significado semántico compartido en el resto de la app (info/warning/success). `professional`
// y `standalone` son categorías de ingreso puras sin equivalente de estado — forzarlas a un
// `--state-*` existente sería apropiarse de un significado que no les corresponde (ninguna es
// "advertencia" ni "éxito"), así que quedan como hex nombrado, igual criterio que `SPEC_COLORS`
// y `COURSE_COLORS` (colores de categoría, no de estado).
const INCOME_COLORS: Record<string, string> = {
  class_b: 'var(--state-info)',
  professional: '#7c3aed',
  complement: 'var(--state-warning)',
  special_service: 'var(--state-success)',
  standalone: '#0d9488',
};

const EXPENSE_LABEL: Record<string, string> = {
  fuel: 'Bencina',
  rent: 'Arriendo',
  cleaning: 'Aseo',
  materials: 'Materiales',
  salary: 'Sueldos',
  utility: 'Servicios Básicos',
  insurance: 'Seguros',
  repair: 'Reparaciones',
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
  // enrollment | monthly_fee | standalone → agrupar por license_group (+ branch si showBranch)
  // Los cursos singulares llegan con license_group='standalone' (fix-016).
  const enr = p.enrollments;
  const lg = enr?.license_group ?? 'unknown';
  return showBranch ? `${lg}:${enr?.branch_id ?? 0}` : lg;
}

/** Convierte una clave de categoría en una etiqueta legible. */
function incomeCategoryLabel(key: string, showBranch: boolean): string {
  if (key === 'complement') return 'Clases Extra';
  if (key === 'special_service') return 'Psicotécnico / Servicios';
  const [lg, branchIdStr] = key.split(':');
  const base =
    lg === 'class_b'
      ? 'Clase B'
      : lg === 'professional'
        ? 'Profesional'
        : lg === 'standalone'
          ? 'Cursos Singulares'
          : 'Otros';
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

/** Cobro de curso singular tal como llega de standalone_course_enrollments. */
export interface SingularSaleReportDto {
  amount_paid: number | null;
  paid_at: string | null;
  branch_id: number;
}

/**
 * Normaliza un cobro de curso singular a la forma `PaymentRow` para que
 * participe de todos los cómputos del reporte (KPIs, categorías, evolución,
 * detalle diario) sin ramas especiales. Categoría: `license_group='standalone'`.
 */
export function mapSingularSaleToPaymentRow(s: SingularSaleReportDto): PaymentRow {
  return {
    total_amount: s.amount_paid ?? 0,
    type: 'standalone',
    payment_date: s.paid_at ? s.paid_at.slice(0, 10) : null,
    enrollments: { branch_id: s.branch_id, license_group: 'standalone' },
  };
}

/**
 * Filtra los pagos según la sede efectiva.
 * Si `branchId` es null, devuelve todos (admin multi-sede).
 */
export function filterPaymentsByBranch(
  payments: PaymentRow[],
  branchId: number | null,
): PaymentRow[] {
  if (branchId === null) return payments;
  return payments.filter((p) => p.enrollments?.branch_id === branchId);
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

// ── Rentabilidad estimada por tipo de curso (fix-237-m) ──────────────────────
//
// NO es un dato exacto: `expenses` no atribuye el gasto a un tipo de curso. Se
// estima por prorrateo híbrido, confirmado con el dueño (2026-09-02):
//   • Bencina (`fuel`) + Reparaciones (`repair`) → se reparten por nº de clases
//     prácticas realizadas de cada tipo de curso (Clase B y Profesional consumen
//     vehículo; psicotécnico/singulares casi no). Si no hay clases contadas en el
//     período, se reparte por participación en ingresos (fallback, no perder el gasto).
//   • Materiales (`materials`) → se reparten por participación en ingresos.
//   • Gastos fijos y pagos a instructores NO entran.

/** Categorías de `expenses` que se reparten por nº de clases prácticas. */
const RENTABILIDAD_VEHICLE_CATEGORIES = ['fuel', 'repair'] as const;
/** Categoría de `expenses` que se reparte por participación en ingresos. */
const RENTABILIDAD_MATERIAL_CATEGORY = 'materials';

/**
 * Reparte `total` entre las claves de `weights` proporcionalmente a su peso,
 * redondeando a enteros y absorbiendo el residuo en la última clave para que
 * la suma de las partes sea exactamente `total`.
 */
function allocateByWeight(
  total: number,
  keys: string[],
  weightOf: (key: string) => number,
): Map<string, number> {
  const result = new Map<string, number>();
  if (total === 0 || keys.length === 0) {
    for (const k of keys) result.set(k, 0);
    return result;
  }
  const totalWeight = keys.reduce((s, k) => s + weightOf(k), 0);
  // Sin pesos → reparto equitativo, para no perder `total` en el redondeo.
  const weight = (k: string) => (totalWeight === 0 ? 1 : weightOf(k));
  const denom = totalWeight === 0 ? keys.length : totalWeight;
  let allocated = 0;
  keys.forEach((k, i) => {
    if (i === keys.length - 1) {
      result.set(k, total - allocated);
      return;
    }
    const part = Math.round((total * weight(k)) / denom);
    result.set(k, part);
    allocated += part;
  });
  return result;
}

/**
 * Construye la tabla "Rentabilidad Estimada por Tipo de Curso" para el rango.
 * `classCounts` mapea `license_group` (`class_b`, `professional`, …) → nº de
 * clases prácticas realizadas en el período.
 */
export function computeRentabilidadCursos(
  payments: PaymentRow[],
  expenses: ExpenseRow[],
  classCounts: ClassCountsByGroup = {},
): RentabilidadCurso[] {
  // 1. Ingresos por tipo de curso (sin desglose por sede).
  const ingresosMap = new Map<string, number>();
  for (const p of payments) {
    const key = incomeCategoryKey(p, false);
    ingresosMap.set(key, (ingresosMap.get(key) ?? 0) + p.total_amount);
  }
  if (ingresosMap.size === 0) return [];

  const keys = Array.from(ingresosMap.keys()).sort(
    (a, b) => (ingresosMap.get(b) ?? 0) - (ingresosMap.get(a) ?? 0),
  );
  const totalIngresos = keys.reduce((s, k) => s + (ingresosMap.get(k) ?? 0), 0);

  // 2. Pools de gasto directo.
  const vehiclePool = expenses
    .filter((e) => RENTABILIDAD_VEHICLE_CATEGORIES.includes((e.category ?? '') as never))
    .reduce((s, e) => s + e.amount, 0);
  const materialPool = expenses
    .filter((e) => (e.category ?? '') === RENTABILIDAD_MATERIAL_CATEGORY)
    .reduce((s, e) => s + e.amount, 0);

  // 3. Reparto: vehículo por nº de clases (fallback a ingresos), materiales por ingresos.
  const totalClasses = keys.reduce((s, k) => s + (classCounts[k] ?? 0), 0);
  const vehicleAlloc = allocateByWeight(vehiclePool, keys, (k) =>
    totalClasses > 0 ? (classCounts[k] ?? 0) : (ingresosMap.get(k) ?? 0),
  );
  const materialAlloc = allocateByWeight(materialPool, keys, (k) => ingresosMap.get(k) ?? 0);

  // 4. Filas.
  return keys.map((key) => {
    const ingresos = ingresosMap.get(key) ?? 0;
    const gastosDirectos = (vehicleAlloc.get(key) ?? 0) + (materialAlloc.get(key) ?? 0);
    const margenNeto = ingresos - gastosDirectos;
    return {
      tipoCurso: incomeCategoryLabel(key, false),
      ingresos,
      gastosDirectos,
      margenNeto,
      rentabilidadPorcentaje: ingresos > 0 ? Math.round((margenNeto / ingresos) * 1000) / 10 : 0,
      colorVisual: incomeBarColor(key),
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
  classCounts: ClassCountsByGroup = {},
  /**
   * Gastos SOLO operacionales (tabla `expenses`), sin los `fixed_expenses`.
   * La estimación de rentabilidad por curso excluye gastos fijos, y `repair`
   * también es categoría de `fixed_expenses` — por eso necesita su propio input.
   * Default: `expenses` (para callers/tests que no distinguen).
   */
  directExpenses: ExpenseRow[] = expenses,
): ReporteContable {
  const showBranch = branchId === null;
  const detalleDiario = computeDetalleDiario(payments, expenses);

  return {
    kpis: computeKpis(payments, expenses),
    ingresosCategoria: computeIngresosCategoria(payments, showBranch),
    gastosCategoria: computeGastosCategoria(expenses),
    evolucionMensual: computeEvolucionMensual(payments, expenses),
    detalleDiario,
    rentabilidadCursos: computeRentabilidadCursos(payments, directExpenses, classCounts),
    diasConMovimientos: detalleDiario.length,
    escuela,
  };
}
