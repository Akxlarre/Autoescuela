import { vi, describe, it, expect, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { ExecutiveDashboardFacade } from './executive-dashboard.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

type RpcResponse = { data: unknown; error: unknown };

const KPIS = {
  ingresos: 1000,
  gastos_variables: 100,
  gastos_fijos: 100,
  costo_instructores: 100,
  nuevas_matriculas: 3,
  alumnos_activos: 5,
  clases_realizadas: 10,
  clases_en_agenda: 2,
  clases_canceladas: 0,
  inasistencias: 0,
  ensayos_total: 0,
  ensayos_aprobados: 0,
  etapa_en_curso: 4,
  etapa_pendiente_examen: 1,
  etapa_finalizados: 2,
};

function defaultResponses(): Record<string, RpcResponse> {
  return {
    exec_dashboard_kpis: { data: KPIS, error: null },
    exec_dashboard_monthly_series: {
      data: [{ year: 2026, month: 9, ingresos: 1000, matriculas: 3 }],
      error: null,
    },
    exec_dashboard_instructor_hours: {
      data: [{ instructor_id: 1, nombre: 'Patricia', clases: 14, minutos: 630 }],
      error: null,
    },
    exec_dashboard_receivables: {
      data: [
        { bucket: '0-30', monto: 100, alumnos: 1 },
        { bucket: '31-60', monto: 0, alumnos: 0 },
        { bucket: '61-90', monto: 0, alumnos: 0 },
        { bucket: '90+', monto: 50, alumnos: 1 },
      ],
      error: null,
    },
    exec_dashboard_today_ops: {
      data: {
        clases_programadas: 3,
        clases_realizadas: 0,
        clases_canceladas: 0,
        instructores_activos: 5,
        vehiculos_disponibles: 5,
        vehiculos_mantencion: 0,
      },
      error: null,
    },
  };
}

function setup(opts: { responses?: Record<string, RpcResponse>; branchId?: number | null } = {}) {
  const responses = { ...defaultResponses(), ...(opts.responses ?? {}) };
  const rpc = vi.fn((name: string) => Promise.resolve(responses[name]));
  let branchId = opts.branchId ?? null;
  const mockBranch = { selectedBranchId: vi.fn(() => branchId) };

  TestBed.configureTestingModule({
    providers: [
      { provide: SupabaseService, useValue: { client: { rpc } } },
      { provide: BranchFacade, useValue: mockBranch },
    ],
  });
  return {
    facade: TestBed.inject(ExecutiveDashboardFacade),
    rpc,
    setBranch: (id: number | null) => (branchId = id),
  };
}

function kpiCalls(rpc: ReturnType<typeof vi.fn>) {
  return rpc.mock.calls.filter((c) => c[0] === 'exec_dashboard_kpis').map((c) => c[1]);
}

describe('ExecutiveDashboardFacade', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('AC11: llama exec_dashboard_kpis para el rango, el período anterior y el año anterior', async () => {
    const { facade, rpc } = setup();
    // custom: un preset se re-resolvería contra la fecha real del día (fix-175-b).
    facade.setRange({ from: '2026-09-01', to: '2026-09-27' }, 'custom');
    await facade.initialize();

    expect(kpiCalls(rpc)).toEqual([
      { p_from: '2026-09-01', p_to: '2026-09-27', p_branch_id: null },
      { p_from: '2026-08-01', p_to: '2026-08-27', p_branch_id: null },
      { p_from: '2025-09-01', p_to: '2025-09-27', p_branch_id: null },
    ]);
  });

  it('AC2: pasa la sede seleccionada a todas las RPC', async () => {
    const { facade, rpc } = setup({ branchId: 2 });
    await facade.initialize();
    for (const [, params] of rpc.mock.calls) {
      expect((params as { p_branch_id: number | null }).p_branch_id).toBe(2);
    }
  });

  it('mapea cada sección al modelo UI', async () => {
    const { facade } = setup();
    await facade.initialize();

    expect(facade.kpis()?.gastos.value).toBe(300);
    expect(facade.kpis()?.resultado.value).toBe(700);
    expect(facade.series()?.ingresos).toHaveLength(12);
    expect(facade.instructorHours()[0].horasLabel).toBe('10 h 30 min');
    expect(facade.receivables()?.total).toBe(150);
    expect(facade.stages()).toEqual({
      nuevos: 3,
      enCurso: 4,
      pendienteExamen: 1,
      finalizados: 2,
      conSaldo: 2,
    });
    expect(facade.todayOps()?.clasesProgramadas).toBe(3);
  });

  it('AC23: primera carga con isLoading; re-entrada SWR sin skeleton', async () => {
    const { facade } = setup();
    const first = facade.initialize();
    expect(facade.isLoading()).toBe(true);
    await first;
    expect(facade.isLoading()).toBe(false);

    const second = facade.initialize();
    expect(facade.isLoading()).toBe(false);
    await second;
  });

  it('AC23: cambiar el rango con datos ya cargados no vuelve a mostrar skeleton', async () => {
    const { facade } = setup();
    await facade.initialize();
    const p = facade.applyRange({ from: '2026-08-01', to: '2026-08-31' }, 'last_month');
    expect(facade.isLoading()).toBe(false);
    await p;
    expect(facade.range()).toEqual({ from: '2026-08-01', to: '2026-08-31' });
  });

  it('AC-E2: si una RPC falla, solo esa sección queda en error', async () => {
    const { facade } = setup({
      responses: { exec_dashboard_receivables: { data: null, error: { message: 'boom' } } },
    });
    await facade.initialize();

    expect(facade.sectionError('cartera')).toBeTruthy();
    expect(facade.sectionError('kpis')).toBeNull();
    expect(facade.kpis()).not.toBeNull();
    expect(facade.instructorHours()).toHaveLength(1);
  });

  it('AC-E2: un rechazo de red también se aísla por sección', async () => {
    const { facade, rpc } = setup();
    rpc.mockImplementation((name: string) =>
      name === 'exec_dashboard_today_ops'
        ? Promise.reject(new Error('network'))
        : Promise.resolve(defaultResponses()[name]),
    );
    await facade.initialize();
    expect(facade.sectionError('hoy')).toBeTruthy();
    expect(facade.kpis()).not.toBeNull();
  });

  it('AC-E3: una respuesta vieja no pisa a la más reciente', async () => {
    const { facade, rpc, setBranch } = setup();
    const resolvers: Array<() => void> = [];
    // Primera ronda: queda colgada hasta que la liberemos.
    rpc.mockImplementation((name: string, params: { p_branch_id: number | null }) => {
      const res = defaultResponses()[name];
      if (params.p_branch_id === 1 && name === 'exec_dashboard_kpis') {
        return new Promise((r) =>
          resolvers.push(() => r({ data: { ...KPIS, ingresos: 111 }, error: null })),
        );
      }
      if (name === 'exec_dashboard_kpis') {
        return Promise.resolve({ data: { ...KPIS, ingresos: 222 }, error: null });
      }
      return Promise.resolve(res);
    });

    setBranch(1);
    const slow = facade.initialize();
    setBranch(2);
    await facade.reload();
    resolvers.forEach((r) => r());
    await slow;

    expect(facade.kpis()?.ingresos.value).toBe(222);
  });

  it('fix-174-b: una carga vieja no apaga el skeleton de la vigente', async () => {
    const { facade, rpc } = setup();
    // Cada carga dispara 7 RPC; las de cada ronda quedan retenidas hasta liberar esa ronda.
    const pending: Array<Array<() => void>> = [[], []];
    let calls = 0;
    rpc.mockImplementation((name: string) => {
      const roundIdx = Math.floor(calls++ / 7);
      return new Promise((resolve) =>
        pending[roundIdx].push(() => resolve(defaultResponses()[name])),
      );
    });
    const release = (roundIdx: number) => pending[roundIdx].forEach((r) => r());

    const first = facade.initialize(); // carga 1 (sin datos → skeleton)
    const second = facade.applyRange({ from: '2026-08-01', to: '2026-08-31' }, 'last_month'); // carga 2
    expect(facade.isLoading()).toBe(true);

    release(0); // termina la carga vieja
    await first;
    expect(facade.isLoading()).toBe(true); // la vigente sigue en vuelo

    release(1); // termina la vigente
    await second;
    expect(facade.isLoading()).toBe(false);
    expect(facade.kpis()).not.toBeNull();
  });

  it('fix-175-b: "Este mes" se re-resuelve al cambiar de mes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-09-30T15:00:00Z')); // 30-sep en Chile
      const { facade, rpc } = setup();
      await facade.initialize();
      expect(kpiCalls(rpc)[0]).toMatchObject({ p_from: '2026-09-01', p_to: '2026-09-30' });

      vi.setSystemTime(new Date('2026-10-02T15:00:00Z')); // la app siguió abierta
      rpc.mockClear();
      await facade.reload();
      expect(facade.range()).toEqual({ from: '2026-10-01', to: '2026-10-02' });
      expect(kpiCalls(rpc)[0]).toMatchObject({ p_from: '2026-10-01', p_to: '2026-10-02' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('fix-175-b: un rango personalizado no se re-resuelve', async () => {
    const { facade } = setup();
    await facade.applyRange({ from: '2025-03-01', to: '2025-03-15' }, 'custom');
    await facade.reload();
    expect(facade.range()).toEqual({ from: '2025-03-01', to: '2025-03-15' });
  });

  it('series usa el año del fin del rango', async () => {
    const { facade, rpc } = setup();
    facade.setRange({ from: '2025-03-01', to: '2025-03-31' }, 'custom');
    await facade.initialize();
    const call = rpc.mock.calls.find((c) => c[0] === 'exec_dashboard_monthly_series');
    expect(call?.[1]).toEqual({ p_year: 2025, p_branch_id: null });
  });
});
