/**
 * Núcleo funcional del Dashboard Ejecutivo de Admin (spec 0044-b).
 *
 * Funciones puras (sin Angular) para rangos de fechas, variaciones porcentuales y formato.
 * Todas las fechas son strings ISO `YYYY-MM-DD` en hora local de Chile; la aritmética se hace
 * sobre (año, mes, día) sin pasar por `Date` con zona horaria para no correr días (DG-071).
 */
import type {
  DeltaTone,
  ExecDateRange,
  ExecDelta,
  ExecKpi,
  ExecKpiCard,
  ExecKpiSummary,
  ExecMonthlySeries,
  ExecPeriodPreset,
  InstructorHoursRow,
  ReceivableAgingBucket,
  ReceivablesSummary,
  StudentStageCounts,
  TodayOpsSummary,
} from '@core/models/ui/executive-dashboard.model';
import type { SectionHeroKpi } from '@core/models/ui/section-hero.model';
import type {
  ExecInstructorHoursRowDto,
  ExecKpisDto,
  ExecMonthlySeriesRowDto,
  ExecReceivablesRowDto,
  ExecTodayOpsDto,
} from '@core/models/dto/executive-dashboard.model';

const MONTH_LABELS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

interface Ymd {
  y: number;
  m: number; // 1–12
  d: number;
}

function parseIso(iso: string): Ymd {
  const [y, m, d] = iso.split('-').map(Number);
  return { y, m, d };
}

function toIso({ y, m, d }: Ymd): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Suma `months` meses; el día se ajusta al último del mes destino si no existe. */
function addMonths(date: Ymd, months: number): Ymd {
  const total = date.y * 12 + (date.m - 1) + months;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return { y, m, d: Math.min(date.d, daysInMonth(y, m)) };
}

function addDays(iso: string, days: number): string {
  const { y, m, d } = parseIso(iso);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return toIso({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() });
}

function diffDays(fromIso: string, toIso_: string): number {
  const a = parseIso(fromIso);
  const b = parseIso(toIso_);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

function isLastDayOfMonth(date: Ymd): boolean {
  return date.d === daysInMonth(date.y, date.m);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Rango de un preset del filtro (AC1). `custom` lo resuelve el componente de filtro. */
export function resolvePresetRange(
  preset: Exclude<ExecPeriodPreset, 'custom'>,
  todayIsoStr: string,
): ExecDateRange {
  const today = parseIso(todayIsoStr);
  switch (preset) {
    case 'this_month':
      return { from: toIso({ ...today, d: 1 }), to: todayIsoStr };
    case 'last_month': {
      const prev = addMonths({ ...today, d: 1 }, -1);
      return { from: toIso(prev), to: toIso({ ...prev, d: daysInMonth(prev.y, prev.m) }) };
    }
    case 'this_year':
      return { from: `${today.y}-01-01`, to: todayIsoStr };
  }
}

export function isValidRange(range: ExecDateRange): boolean {
  return !!range.from && !!range.to && range.from <= range.to;
}

/**
 * Período anterior de igual largo (AC11).
 * - Si el rango arranca el día 1 y no cruza de año, se desplaza por meses calendario
 *   (sep 1–27 → ago 1–27; mar completo → feb completo; ene–sep → mismo tramo año anterior).
 * - Si no, es el tramo inmediatamente anterior con la misma cantidad de días.
 */
export function previousRange(range: ExecDateRange): ExecDateRange {
  const from = parseIso(range.from);
  const to = parseIso(range.to);

  if (from.d === 1 && from.y === to.y) {
    // "Año a la fecha" (arranca el 1 de enero) se compara con el mismo tramo del año
    // anterior: comparar ene–sep contra abr–dic del año pasado no dice nada útil.
    const span = from.m === 1 && to.m > 1 ? 12 : to.m - from.m + 1;
    const prevFrom = addMonths(from, -span);
    const shiftedTo = addMonths(to, -span);
    const prevTo = isLastDayOfMonth(to)
      ? { ...shiftedTo, d: daysInMonth(shiftedTo.y, shiftedTo.m) }
      : shiftedTo;
    return { from: toIso(prevFrom), to: toIso(prevTo) };
  }

  const length = diffDays(range.from, range.to) + 1;
  const prevTo = addDays(range.from, -1);
  return { from: addDays(prevTo, -(length - 1)), to: prevTo };
}

/** Mismo rango un año atrás (AC11, AC-E4). 29-feb pasa a 28-feb. */
export function yoyRange(range: ExecDateRange): ExecDateRange {
  return {
    from: toIso(addMonths(parseIso(range.from), -12)),
    to: toIso(addMonths(parseIso(range.to), -12)),
  };
}

/**
 * Variación porcentual (AC11/AC12). Con base 0 no hay porcentaje: `new` si hay valor actual,
 * `none` si ambos son 0 — nunca `Infinity` ni `NaN`. Usa `|base|` para que una pérdida que se
 * achica (-100 → -50) cuente como mejora.
 */
export function computeDelta(current: number, base: number): ExecDelta {
  if (base === 0) {
    return { pct: null, kind: current === 0 ? 'none' : 'new' };
  }
  const pct = round1(((current - base) / Math.abs(base)) * 100);
  if (pct > 0) return { pct, kind: 'up' };
  if (pct < 0) return { pct, kind: 'down' };
  return { pct: 0, kind: 'none' };
}

/** Tono del delta. `invert` = true para métricas donde subir es malo (gastos). */
export function deltaTone(delta: ExecDelta, invert = false): DeltaTone {
  if (delta.kind === 'up') return invert ? 'error' : 'success';
  if (delta.kind === 'down') return invert ? 'success' : 'error';
  return 'muted';
}

export function formatDeltaLabel(delta: ExecDelta): string {
  if (delta.pct === null) return delta.kind === 'new' ? 'Nuevo' : '—';
  const sign = delta.pct > 0 ? '+' : '';
  return `${sign}${String(delta.pct).replace('.', ',')}%`;
}

/** Margen % = resultado / ingresos (AC5). `null` si no hay ingresos. */
export function marginPct(resultado: number, ingresos: number): number | null {
  if (ingresos <= 0) return null;
  return round1((resultado / ingresos) * 100);
}

/** Porcentaje con 1 decimal; `null` si el denominador es 0 (AC10/AC18). */
export function safeRatePct(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return round1((numerator / denominator) * 100);
}

/** `630` → `10 h 30 min` (AC16). */
export function formatMinutesAsHours(minutes: number): string {
  const safe = Math.max(0, Math.round(minutes));
  return `${Math.floor(safe / 60)} h ${safe % 60} min`;
}

export function monthShortLabel(month: number): string {
  return MONTH_LABELS[month - 1] ?? '';
}

/** `{2026-09-01, 2026-09-27}` → `1 sep – 27 sep 2026` (texto del hero). */
export function describeRange(range: ExecDateRange): string {
  const a = parseIso(range.from);
  const b = parseIso(range.to);
  const day = (x: Ymd) => `${x.d} ${monthShortLabel(x.m).toLowerCase()}`;
  if (range.from === range.to) return `${day(b)} ${b.y}`;
  if (a.y === b.y) return `${day(a)} – ${day(b)} ${b.y}`;
  return `${day(a)} ${a.y} – ${day(b)} ${b.y}`;
}

/**
 * Convierte las 24 filas de `exec_dashboard_monthly_series` en 2 series de 12 puntos
 * (AC13/AC14). Los meses posteriores a `currentMonth` del año actual quedan en `null`
 * para que la línea termine en el mes en curso en vez de caer a 0.
 */
export function buildMonthlySeries(
  rows: ExecMonthlySeriesRowDto[],
  currentYear: number,
  currentMonth: number,
): ExecMonthlySeries {
  const find = (year: number, month: number) =>
    rows.find((r) => r.year === year && r.month === month);

  const build = (field: 'ingresos' | 'matriculas') =>
    Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      return {
        month,
        label: monthShortLabel(month),
        current: month > currentMonth ? null : (find(currentYear, month)?.[field] ?? 0),
        previous: find(currentYear - 1, month)?.[field] ?? 0,
      };
    });

  return { currentYear, ingresos: build('ingresos'), matriculas: build('matriculas') };
}

/**
 * Hasta qué mes se dibuja la serie del año `seriesYear`: el mes en curso si es el año actual,
 * 12 si es un año pasado y 0 si es futuro.
 */
export function seriesCurrentMonth(seriesYear: number, todayIsoStr: string): number {
  const today = parseIso(todayIsoStr);
  if (seriesYear === today.y) return today.m;
  return seriesYear < today.y ? 12 : 0;
}

/** Fecha de hoy en Chile (`YYYY-MM-DD`), independiente de la zona del navegador (DG-071). */
export function chileTodayIso(now: Date = new Date()): string {
  // en-CA formatea como YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

// ── Mapeo DTO → UI ─────────────────────────────────────────────────────────

function totalGastos(dto: ExecKpisDto): number {
  return dto.gastos_variables + dto.gastos_fijos + dto.costo_instructores;
}

function kpi(current: number, prev: number, yoy: number): ExecKpi {
  return {
    value: current,
    deltaPrev: computeDelta(current, prev),
    deltaYoy: computeDelta(current, yoy),
  };
}

/**
 * Arma los KPIs a partir de las 3 llamadas a `exec_dashboard_kpis`
 * (rango actual, período anterior y mismo rango del año anterior).
 */
export function mapKpiSummary(
  curr: ExecKpisDto,
  prev: ExecKpisDto,
  yoy: ExecKpisDto,
): ExecKpiSummary {
  const gastos = totalGastos(curr);
  const resultado = curr.ingresos - gastos;
  const eventosClase = curr.clases_realizadas + curr.clases_canceladas + curr.inasistencias;

  return {
    ingresos: kpi(curr.ingresos, prev.ingresos, yoy.ingresos),
    gastos: kpi(gastos, totalGastos(prev), totalGastos(yoy)),
    gastosDesglose: {
      variables: curr.gastos_variables,
      fijos: curr.gastos_fijos,
      instructores: curr.costo_instructores,
    },
    resultado: kpi(resultado, prev.ingresos - totalGastos(prev), yoy.ingresos - totalGastos(yoy)),
    margenPct: marginPct(resultado, curr.ingresos),
    nuevasMatriculas: kpi(curr.nuevas_matriculas, prev.nuevas_matriculas, yoy.nuevas_matriculas),
    alumnosActivos: curr.alumnos_activos,
    clasesRealizadas: curr.clases_realizadas,
    clasesEnAgenda: curr.clases_en_agenda,
    tasaCancelacionPct: safeRatePct(curr.clases_canceladas + curr.inasistencias, eventosClase),
    aprobacionEnsayosPct: safeRatePct(curr.ensayos_aprobados, curr.ensayos_total),
  };
}

/** Etapas del alumno (AC17). `conSaldo` sale de la cartera por cobrar. */
export function mapStageCounts(dto: ExecKpisDto, alumnosConSaldo: number): StudentStageCounts {
  return {
    nuevos: dto.nuevas_matriculas,
    enCurso: dto.etapa_en_curso,
    pendienteExamen: dto.etapa_pendiente_examen,
    finalizados: dto.etapa_finalizados,
    conSaldo: alumnosConSaldo,
  };
}

const BUCKET_LABELS: Record<ReceivableAgingBucket['bucket'], string> = {
  '0-30': '0–30 días',
  '31-60': '31–60 días',
  '61-90': '61–90 días',
  '90+': 'Más de 90 días',
};

/** Cartera por antigüedad (AC6). */
export function mapReceivables(rows: ExecReceivablesRowDto[]): ReceivablesSummary {
  const buckets = rows.map((r) => ({
    bucket: r.bucket,
    label: BUCKET_LABELS[r.bucket] ?? r.bucket,
    monto: Number(r.monto) || 0,
    alumnos: Number(r.alumnos) || 0,
  }));
  return {
    total: buckets.reduce((s, b) => s + b.monto, 0),
    alumnos: buckets.reduce((s, b) => s + b.alumnos, 0),
    buckets,
  };
}

/** Horas por instructor (AC16): desc por minutos, los que tienen 0 al final. */
export function mapInstructorHours(rows: ExecInstructorHoursRowDto[]): InstructorHoursRow[] {
  return rows
    .map((r) => ({
      instructorId: r.instructor_id,
      nombre: r.nombre || '—',
      clases: Number(r.clases) || 0,
      minutos: Number(r.minutos) || 0,
      horasLabel: formatMinutesAsHours(Number(r.minutos) || 0),
    }))
    .sort((a, b) => b.minutos - a.minutos || a.nombre.localeCompare(b.nombre, 'es'));
}

// ── Tarjetas KPI ───────────────────────────────────────────────────────────

function trendOf(delta: ExecDelta): number | undefined {
  return delta.pct === null ? undefined : delta.pct;
}

function prevLabel(delta: ExecDelta): string {
  if (delta.pct !== null) return 'vs período anterior';
  return delta.kind === 'new' ? 'Nuevo vs período anterior' : 'Sin base el período anterior';
}

function yoyLabel(delta: ExecDelta): string {
  return delta.pct !== null ? 'vs año anterior' : 'Sin base el año anterior';
}

function withDeltas(kpi: ExecKpi) {
  return {
    trend: trendOf(kpi.deltaPrev),
    trendLabel: prevLabel(kpi.deltaPrev),
    secondaryTrend: trendOf(kpi.deltaYoy),
    secondaryTrendLabel: yoyLabel(kpi.deltaYoy),
  };
}

function pctText(n: number): string {
  return `${String(n).replace('.', ',')}%`;
}

/**
 * Las 8 tarjetas KPI del Dashboard Ejecutivo, en orden de lectura: primero plata
 * (ingresos, gastos, resultado, cartera), después operación (matrículas, alumnos,
 * clases, cancelación).
 */
export function buildExecKpiCards(
  s: ExecKpiSummary,
  receivables: ReceivablesSummary | null,
): ExecKpiCard[] {
  const res = s.resultado.value;
  const margin = s.margenPct === null ? 'sin ingresos' : pctText(s.margenPct);
  const d = s.gastosDesglose;
  const clp = (n: number) => `$${Math.round(n).toLocaleString('es-CL')}`;

  const base = {
    prefix: '',
    suffix: '',
    color: 'default' as const,
    trendLabel: '',
    secondaryTrendLabel: '',
    invertTrend: false,
    subValue: '',
  };

  return [
    {
      ...base,
      ...withDeltas(s.ingresos),
      id: 'ingresos',
      label: 'Ingresos Clase B',
      value: s.ingresos.value,
      prefix: '$',
      icon: 'trending-up',
      tooltip: 'Pagos recibidos de matrículas Clase B en el período (no incluye pagos pendientes).',
    },
    {
      ...base,
      ...withDeltas(s.gastos),
      id: 'gastos',
      label: 'Gastos',
      value: s.gastos.value,
      prefix: '$',
      icon: 'receipt',
      invertTrend: true,
      tooltip:
        `Egresos ${clp(d.variables)} + gastos fijos ${clp(d.fijos)} + sueldos devengados de ` +
        `instructores ${clp(d.instructores)}. Los meses sin liquidar se valorizan con la ` +
        'tarifa por hora actual de la sede.',
    },
    {
      ...base,
      ...withDeltas(s.resultado),
      id: 'resultado',
      label: `Resultado · margen ${margin}`,
      value: Math.abs(res),
      prefix: res < 0 ? '-$' : '$',
      icon: 'landmark',
      color: res < 0 ? 'error' : 'default',
      tooltip: 'Ingresos Clase B menos gastos (incluye sueldos devengados de instructores).',
    },
    {
      ...base,
      id: 'saldo',
      label: 'Saldo por cobrar',
      value: receivables?.total ?? 0,
      prefix: '$',
      icon: 'hand-coins',
      color: (receivables?.total ?? 0) > 0 ? 'warning' : 'default',
      subValue: `${receivables?.alumnos ?? 0} alumnos con saldo`,
      tooltip: 'Deuda vigente de matrículas Clase B. Es la foto de hoy, no depende del período.',
    },
    {
      ...base,
      ...withDeltas(s.nuevasMatriculas),
      id: 'matriculas',
      label: 'Nuevas matrículas',
      value: s.nuevasMatriculas.value,
      icon: 'user-plus',
      tooltip: 'Matrículas Clase B confirmadas en el período (sin borradores ni canceladas).',
    },
    {
      ...base,
      id: 'activos',
      label: 'Alumnos activos',
      value: s.alumnosActivos,
      icon: 'users',
      subValue: 'En proceso formativo',
      tooltip: 'Matrículas Clase B activas hoy.',
    },
    {
      ...base,
      id: 'clases',
      label: 'Clases realizadas',
      value: s.clasesRealizadas,
      icon: 'car',
      subValue: `${s.clasesEnAgenda} en agenda`,
      tooltip: 'Clases prácticas completadas en el período y las que quedan agendadas en él.',
    },
    {
      ...base,
      id: 'cancelacion',
      label: 'Cancelación e inasistencia',
      value: s.tasaCancelacionPct ?? 0,
      suffix: '%',
      icon: 'circle-x',
      color: (s.tasaCancelacionPct ?? 0) >= 20 ? 'warning' : 'default',
      subValue:
        s.tasaCancelacionPct === null ? 'Sin clases en el período' : 'de las clases del período',
      tooltip: '(Canceladas + inasistencias) / (realizadas + canceladas + inasistencias).',
    },
  ];
}

/**
 * Convierte una tarjeta KPI al formato compacto de la tira de KPIs del hero slim.
 * El hero muestra un solo trend: va el de período anterior; el de año anterior pasa a subValue.
 */
export function toHeroKpi(card: ExecKpiCard): SectionHeroKpi {
  const yoyText =
    card.secondaryTrend !== undefined
      ? `${card.secondaryTrend > 0 ? '+' : ''}${pctText(card.secondaryTrend)} vs año ant.`
      : card.secondaryTrendLabel;
  return {
    id: card.id,
    label: card.label,
    value: card.value.toLocaleString('es-CL', { maximumFractionDigits: 1 }),
    prefix: card.prefix,
    suffix: card.suffix,
    trend: card.trend,
    trendSuffix: '%',
    trendLabel: card.trend !== undefined ? 'vs per. ant.' : undefined,
    subValue: card.subValue || yoyText,
    color: card.color,
  };
}

export function mapTodayOps(dto: ExecTodayOpsDto): TodayOpsSummary {
  return {
    clasesProgramadas: dto.clases_programadas,
    clasesRealizadas: dto.clases_realizadas,
    clasesCanceladas: dto.clases_canceladas,
    instructoresActivos: dto.instructores_activos,
    vehiculosDisponibles: dto.vehiculos_disponibles,
    vehiculosMantencion: dto.vehiculos_mantencion,
  };
}
