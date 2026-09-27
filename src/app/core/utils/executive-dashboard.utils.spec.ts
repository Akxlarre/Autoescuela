import { describe, expect, it } from 'vitest';
import {
  buildMonthlySeries,
  computeDelta,
  deltaTone,
  formatDeltaLabel,
  formatMinutesAsHours,
  isValidRange,
  marginPct,
  previousRange,
  resolvePresetRange,
  safeRatePct,
  yoyRange,
  chileTodayIso,
  mapKpiSummary,
  mapReceivables,
  mapInstructorHours,
  buildExecKpiCards,
  describeRange,
  seriesCurrentMonth,
  toHeroKpi,
} from './executive-dashboard.utils';
import type { ExecKpiSummary } from '@core/models/ui/executive-dashboard.model';

describe('resolvePresetRange (AC1)', () => {
  it('this_month = del 1 del mes hasta hoy (month-to-date)', () => {
    expect(resolvePresetRange('this_month', '2026-09-27')).toEqual({
      from: '2026-09-01',
      to: '2026-09-27',
    });
  });

  it('last_month = mes anterior completo', () => {
    expect(resolvePresetRange('last_month', '2026-09-27')).toEqual({
      from: '2026-08-01',
      to: '2026-08-31',
    });
  });

  it('last_month en enero cruza de año', () => {
    expect(resolvePresetRange('last_month', '2026-01-15')).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    });
  });

  it('this_year = 1 de enero hasta hoy', () => {
    expect(resolvePresetRange('this_year', '2026-09-27')).toEqual({
      from: '2026-01-01',
      to: '2026-09-27',
    });
  });
});

describe('previousRange (AC11)', () => {
  it('month-to-date se compara con los mismos días del mes anterior', () => {
    expect(previousRange({ from: '2026-09-01', to: '2026-09-27' })).toEqual({
      from: '2026-08-01',
      to: '2026-08-27',
    });
  });

  it('mes completo se compara con el mes anterior completo (fin de mes ajustado)', () => {
    expect(previousRange({ from: '2026-03-01', to: '2026-03-31' })).toEqual({
      from: '2026-02-01',
      to: '2026-02-28',
    });
  });

  it('día 31 contra un mes de 30 días se ajusta al último día', () => {
    expect(previousRange({ from: '2026-05-01', to: '2026-05-31' })).toEqual({
      from: '2026-04-01',
      to: '2026-04-30',
    });
  });

  it('año a la fecha se compara con el mismo tramo del año anterior', () => {
    expect(previousRange({ from: '2026-01-01', to: '2026-09-27' })).toEqual({
      from: '2025-01-01',
      to: '2025-09-27',
    });
  });

  it('rango arbitrario usa el tramo inmediatamente anterior de igual largo', () => {
    // 10 días: 10–19 sep → 31 ago–9 sep
    expect(previousRange({ from: '2026-09-10', to: '2026-09-19' })).toEqual({
      from: '2026-08-31',
      to: '2026-09-09',
    });
  });
});

describe('yoyRange (AC11, AC-E4)', () => {
  it('desplaza el rango un año atrás', () => {
    expect(yoyRange({ from: '2026-09-01', to: '2026-09-27' })).toEqual({
      from: '2025-09-01',
      to: '2025-09-27',
    });
  });

  it('un rango que cruza años compara contra el mismo cruce del año anterior', () => {
    expect(yoyRange({ from: '2025-11-01', to: '2026-02-15' })).toEqual({
      from: '2024-11-01',
      to: '2025-02-15',
    });
  });

  it('29 de febrero pasa a 28 de febrero', () => {
    expect(yoyRange({ from: '2024-02-01', to: '2024-02-29' })).toEqual({
      from: '2023-02-01',
      to: '2023-02-28',
    });
  });
});

describe('isValidRange', () => {
  it('acepta desde <= hasta', () => {
    expect(isValidRange({ from: '2026-09-01', to: '2026-09-01' })).toBe(true);
  });
  it('rechaza desde > hasta o fechas vacías', () => {
    expect(isValidRange({ from: '2026-09-02', to: '2026-09-01' })).toBe(false);
    expect(isValidRange({ from: '', to: '2026-09-01' })).toBe(false);
  });
});

describe('computeDelta (AC11, AC12)', () => {
  it('sube', () => {
    expect(computeDelta(114_700, 100_000)).toEqual({ pct: 14.7, kind: 'up' });
  });
  it('baja', () => {
    expect(computeDelta(90, 100)).toEqual({ pct: -10, kind: 'down' });
  });
  it('sin cambio', () => {
    expect(computeDelta(50, 50)).toEqual({ pct: 0, kind: 'none' });
  });
  it('base 0 con valor actual → "new", nunca Infinity', () => {
    expect(computeDelta(10, 0)).toEqual({ pct: null, kind: 'new' });
  });
  it('ambos 0 → none sin pct', () => {
    expect(computeDelta(0, 0)).toEqual({ pct: null, kind: 'none' });
  });
  it('base negativa (resultado operacional en pérdida) usa valor absoluto', () => {
    // de -100 a -50 es una mejora del 50%
    expect(computeDelta(-50, -100)).toEqual({ pct: 50, kind: 'up' });
  });
});

describe('deltaTone (AC11)', () => {
  it('subir es bueno por defecto', () => {
    expect(deltaTone({ pct: 5, kind: 'up' })).toBe('success');
    expect(deltaTone({ pct: -5, kind: 'down' })).toBe('error');
  });
  it('para gastos se invierte', () => {
    expect(deltaTone({ pct: 5, kind: 'up' }, true)).toBe('error');
    expect(deltaTone({ pct: -5, kind: 'down' }, true)).toBe('success');
  });
  it('none y new sin base son neutros', () => {
    expect(deltaTone({ pct: null, kind: 'none' })).toBe('muted');
    expect(deltaTone({ pct: null, kind: 'new' })).toBe('muted');
  });
});

describe('formatDeltaLabel', () => {
  it('formatea con signo y coma decimal', () => {
    expect(formatDeltaLabel({ pct: 14.7, kind: 'up' })).toBe('+14,7%');
    expect(formatDeltaLabel({ pct: -3.2, kind: 'down' })).toBe('-3,2%');
    expect(formatDeltaLabel({ pct: 0, kind: 'none' })).toBe('0%');
  });
  it('sin base → "Nuevo" o "—"', () => {
    expect(formatDeltaLabel({ pct: null, kind: 'new' })).toBe('Nuevo');
    expect(formatDeltaLabel({ pct: null, kind: 'none' })).toBe('—');
  });
});

describe('marginPct (AC5)', () => {
  it('resultado / ingresos en %', () => {
    expect(marginPct(250, 1000)).toBe(25);
  });
  it('ingresos 0 → null (nunca NaN)', () => {
    expect(marginPct(-100, 0)).toBeNull();
  });
});

describe('safeRatePct (AC10, AC18)', () => {
  it('calcula el porcentaje con 1 decimal', () => {
    expect(safeRatePct(1, 3)).toBe(33.3);
  });
  it('denominador 0 → null', () => {
    expect(safeRatePct(0, 0)).toBeNull();
  });
});

describe('formatMinutesAsHours (AC16)', () => {
  it('formatea horas y minutos', () => {
    expect(formatMinutesAsHours(630)).toBe('10 h 30 min');
    expect(formatMinutesAsHours(0)).toBe('0 h 0 min');
    expect(formatMinutesAsHours(45)).toBe('0 h 45 min');
  });
});

describe('buildMonthlySeries (AC13, AC14)', () => {
  const rows = [
    { year: 2025, month: 1, ingresos: 100, matriculas: 1 },
    { year: 2025, month: 12, ingresos: 900, matriculas: 9 },
    { year: 2026, month: 1, ingresos: 200, matriculas: 2 },
    { year: 2026, month: 9, ingresos: 500, matriculas: 5 },
  ];

  it('arma 12 puntos por serie con el año anterior completo', () => {
    const s = buildMonthlySeries(rows, 2026, 9);
    expect(s.currentYear).toBe(2026);
    expect(s.ingresos).toHaveLength(12);
    expect(s.ingresos[0]).toEqual({ month: 1, label: 'Ene', current: 200, previous: 100 });
    expect(s.ingresos[11].previous).toBe(900);
    expect(s.matriculas[8]).toEqual({ month: 9, label: 'Sep', current: 5, previous: 0 });
  });

  it('los meses futuros del año actual quedan en null (la línea no cae a 0)', () => {
    const s = buildMonthlySeries(rows, 2026, 9);
    expect(s.ingresos[9].current).toBeNull();
    expect(s.ingresos[11].current).toBeNull();
    expect(s.ingresos[8].current).toBe(500);
  });

  it('meses sin filas valen 0', () => {
    const s = buildMonthlySeries(rows, 2026, 9);
    expect(s.ingresos[1]).toEqual({ month: 2, label: 'Feb', current: 0, previous: 0 });
  });
});

describe('seriesCurrentMonth', () => {
  it('año actual → mes en curso; pasado → 12; futuro → 0', () => {
    expect(seriesCurrentMonth(2026, '2026-09-27')).toBe(9);
    expect(seriesCurrentMonth(2025, '2026-09-27')).toBe(12);
    expect(seriesCurrentMonth(2027, '2026-09-27')).toBe(0);
  });
});

describe('chileTodayIso', () => {
  it('usa la fecha de Chile, no la UTC (DG-071)', () => {
    // 2026-09-28 01:30 UTC = 2026-09-27 22:30 en Santiago (UTC-3)
    expect(chileTodayIso(new Date('2026-09-28T01:30:00Z'))).toBe('2026-09-27');
  });
});

describe('mapKpiSummary (AC3–AC11)', () => {
  const base = {
    ingresos: 0,
    gastos_variables: 0,
    gastos_fijos: 0,
    costo_instructores: 0,
    nuevas_matriculas: 0,
    alumnos_activos: 0,
    clases_realizadas: 0,
    clases_en_agenda: 0,
    clases_canceladas: 0,
    inasistencias: 0,
    ensayos_total: 0,
    ensayos_aprobados: 0,
    etapa_en_curso: 0,
    etapa_pendiente_examen: 0,
    etapa_finalizados: 0,
  };
  const curr = {
    ...base,
    ingresos: 1000,
    gastos_variables: 100,
    gastos_fijos: 200,
    costo_instructores: 300,
    nuevas_matriculas: 4,
    alumnos_activos: 7,
    clases_realizadas: 6,
    clases_en_agenda: 2,
    clases_canceladas: 1,
    inasistencias: 1,
    ensayos_total: 4,
    ensayos_aprobados: 3,
  };
  const prev = { ...base, ingresos: 800, gastos_variables: 600, nuevas_matriculas: 4 };
  const yoy = { ...base, ingresos: 500, nuevas_matriculas: 0 };

  it('gastos suman las 3 fuentes y resultado = ingresos − gastos', () => {
    const s = mapKpiSummary(curr, prev, yoy);
    expect(s.gastos.value).toBe(600);
    expect(s.gastosDesglose).toEqual({ variables: 100, fijos: 200, instructores: 300 });
    expect(s.resultado.value).toBe(400);
    expect(s.margenPct).toBe(40);
  });

  it('calcula ambos deltas', () => {
    const s = mapKpiSummary(curr, prev, yoy);
    expect(s.ingresos.deltaPrev).toEqual({ pct: 25, kind: 'up' });
    expect(s.ingresos.deltaYoy).toEqual({ pct: 100, kind: 'up' });
    expect(s.nuevasMatriculas.deltaPrev).toEqual({ pct: 0, kind: 'none' });
    expect(s.nuevasMatriculas.deltaYoy).toEqual({ pct: null, kind: 'new' });
  });

  it('tasas de cancelación y ensayos', () => {
    const s = mapKpiSummary(curr, prev, yoy);
    // (1 + 1) / (6 + 1 + 1)
    expect(s.tasaCancelacionPct).toBe(25);
    expect(s.aprobacionEnsayosPct).toBe(75);
  });

  it('sin datos no produce NaN (AC-E1)', () => {
    const s = mapKpiSummary(base, base, base);
    expect(s.margenPct).toBeNull();
    expect(s.tasaCancelacionPct).toBeNull();
    expect(s.aprobacionEnsayosPct).toBeNull();
    expect(s.ingresos.deltaPrev).toEqual({ pct: null, kind: 'none' });
  });
});

describe('mapReceivables (AC6)', () => {
  it('suma total y alumnos, con etiquetas legibles', () => {
    const r = mapReceivables([
      { bucket: '0-30', monto: 100, alumnos: 1 },
      { bucket: '31-60', monto: 0, alumnos: 0 },
      { bucket: '61-90', monto: 0, alumnos: 0 },
      { bucket: '90+', monto: 50, alumnos: 2 },
    ]);
    expect(r.total).toBe(150);
    expect(r.alumnos).toBe(3);
    expect(r.buckets[3].label).toBe('Más de 90 días');
  });
});

describe('describeRange', () => {
  it('mismo año: el año va una sola vez', () => {
    expect(describeRange({ from: '2026-09-01', to: '2026-09-27' })).toBe('1 sep – 27 sep 2026');
  });
  it('cruza años: ambos años', () => {
    expect(describeRange({ from: '2025-11-01', to: '2026-02-15' })).toBe(
      '1 nov 2025 – 15 feb 2026',
    );
  });
  it('un solo día', () => {
    expect(describeRange({ from: '2026-09-27', to: '2026-09-27' })).toBe('27 sep 2026');
  });
});

describe('buildExecKpiCards', () => {
  const summary: ExecKpiSummary = {
    ingresos: {
      value: 1000,
      deltaPrev: { pct: 14.7, kind: 'up' },
      deltaYoy: { pct: null, kind: 'new' },
    },
    gastos: {
      value: 1500,
      deltaPrev: { pct: 10, kind: 'up' },
      deltaYoy: { pct: -5, kind: 'down' },
    },
    gastosDesglose: { variables: 500, fijos: 500, instructores: 500 },
    resultado: {
      value: -500,
      deltaPrev: { pct: null, kind: 'none' },
      deltaYoy: { pct: null, kind: 'none' },
    },
    margenPct: -50,
    nuevasMatriculas: {
      value: 2,
      deltaPrev: { pct: 0, kind: 'none' },
      deltaYoy: { pct: 100, kind: 'up' },
    },
    alumnosActivos: 3,
    clasesRealizadas: 20,
    clasesEnAgenda: 6,
    tasaCancelacionPct: null,
    aprobacionEnsayosPct: 50,
  };
  const receivables = { total: 235_000, alumnos: 3, buckets: [] };

  it('arma las 8 tarjetas en orden', () => {
    const cards = buildExecKpiCards(summary, receivables);
    expect(cards.map((c) => c.id)).toEqual([
      'ingresos',
      'gastos',
      'resultado',
      'saldo',
      'matriculas',
      'activos',
      'clases',
      'cancelacion',
    ]);
  });

  it('ingresos: delta vs período anterior y "nuevo" vs año anterior sin porcentaje', () => {
    const c = buildExecKpiCards(summary, receivables)[0];
    expect(c.trend).toBe(14.7);
    expect(c.secondaryTrend).toBeUndefined();
    expect(c.secondaryTrendLabel).toBe('Sin base el año anterior');
    expect(c.label).toContain('Clase B');
  });

  it('gastos invierte el color y explica que incluye sueldos', () => {
    const c = buildExecKpiCards(summary, receivables)[1];
    expect(c.invertTrend).toBe(true);
    expect(c.tooltip).toContain('sueldos devengados');
  });

  it('resultado negativo muestra el signo en el prefijo y el margen', () => {
    const c = buildExecKpiCards(summary, receivables)[2];
    expect(c.value).toBe(500);
    expect(c.prefix).toBe('-$');
    expect(c.color).toBe('error');
    expect(c.label).toBe('Resultado · margen -50%');
  });

  it('saldo por cobrar sin cartera cargada → 0', () => {
    const c = buildExecKpiCards(summary, null)[3];
    expect(c.value).toBe(0);
  });

  it('clases incluye las que están en agenda; cancelación sin datos → "—"', () => {
    const cards = buildExecKpiCards(summary, receivables);
    expect(cards[6].subValue).toBe('6 en agenda');
    expect(cards[7].subValue).toBe('Sin clases en el período');
  });
});

describe('toHeroKpi', () => {
  const card = {
    id: 'matriculas',
    label: 'Nuevas matrículas',
    value: 9,
    prefix: '',
    suffix: '',
    icon: 'user-plus',
    color: 'default' as const,
    trend: 28.6,
    trendLabel: 'vs período anterior',
    secondaryTrend: 50,
    secondaryTrendLabel: 'vs año anterior',
    invertTrend: false,
    subValue: '',
    tooltip: '',
  };

  it('usa el trend de período anterior y mueve el de año anterior al subValue', () => {
    const k = toHeroKpi(card);
    expect(k.trend).toBe(28.6);
    expect(k.trendLabel).toBe('vs per. ant.');
    expect(k.subValue).toBe('+50% vs año ant.');
  });

  it('respeta el subValue propio y formatea decimales en es-CL', () => {
    const k = toHeroKpi({
      ...card,
      value: 3.1,
      suffix: '%',
      trend: undefined,
      subValue: 'de las clases',
    });
    expect(k.value).toBe('3,1');
    expect(k.trendLabel).toBeUndefined();
    expect(k.subValue).toBe('de las clases');
  });
});

describe('mapInstructorHours (AC16)', () => {
  it('ordena por minutos desc y deja los 0 al final', () => {
    const rows = mapInstructorHours([
      { instructor_id: 1, nombre: 'B', clases: 0, minutos: 0 },
      { instructor_id: 2, nombre: 'A', clases: 14, minutos: 630 },
      { instructor_id: 3, nombre: 'C', clases: 4, minutos: 180 },
    ]);
    expect(rows.map((r) => r.instructorId)).toEqual([2, 3, 1]);
    expect(rows[0].horasLabel).toBe('10 h 30 min');
  });
});
