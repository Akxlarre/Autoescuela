import { TestBed } from '@angular/core/testing';
import { CiclosTeoricosFacade } from './ciclos-teoricos.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { BranchFacade } from '@core/facades/branch.facade';

/**
 * Builder Supabase encadenable y "awaitable". Devuelve el resultado configurado
 * por nombre de tabla. Cada método de query retorna el mismo builder; al hacer
 * `await` resuelve `{ data, error }`.
 */
function makeSupabaseMock() {
  const results = new Map<string, { data: any; error: any }>();
  const pending = new Map<string, Promise<{ data: any; error: any }>>();
  const updateCalls: { table: string; payload: any }[] = [];
  const eqCalls: { table: string; column: string; value: any }[] = [];
  const orderCalls: { table: string; column: string; options: any }[] = [];
  const limitCalls: { table: string; count: number }[] = [];
  const invoke = vi.fn().mockResolvedValue({ data: { sent: 0, errors: [] }, error: null });

  function builder(table: string): any {
    let lastUpdatePayload: any = null;
    const b: any = {
      select: vi.fn(() => b),
      eq: vi.fn((column: string, value: any) => {
        eqCalls.push({ table, column, value });
        return b;
      }),
      neq: vi.fn(() => b),
      not: vi.fn(() => b),
      gte: vi.fn(() => b),
      order: vi.fn((column: string, options: any) => {
        orderCalls.push({ table, column, options });
        return b;
      }),
      limit: vi.fn((count: number) => {
        limitCalls.push({ table, count });
        return b;
      }),
      update: vi.fn((payload: any) => {
        lastUpdatePayload = payload;
        updateCalls.push({ table, payload });
        return b;
      }),
      // Delega en una Promise real (pendiente o ya resuelta) — evita timing issues
      // de thenables custom bajo zone.js (ver hotfix-020).
      then: (resolve: any, reject?: any) =>
        (
          pending.get(table) ?? Promise.resolve(results.get(table) ?? { data: [], error: null })
        ).then(resolve, reject),
    };
    void lastUpdatePayload;
    return b;
  }

  const supabase = {
    client: {
      from: vi.fn((table: string) => builder(table)),
      functions: { invoke },
    },
  };

  return {
    supabase,
    invoke,
    updateCalls,
    eqCalls,
    orderCalls,
    limitCalls,
    setResult: (table: string, data: any, error: any = null) => results.set(table, { data, error }),
    /** Deja la query de `table` pendiente hasta que se llame al resolver devuelto. */
    deferResult: (table: string): ((data: any, error?: any) => void) => {
      let resolveFn: (value: { data: any; error: any }) => void = () => {};
      pending.set(
        table,
        new Promise((resolve) => {
          resolveFn = resolve;
        }),
      );
      return (data: any, error: any = null) => {
        pending.delete(table);
        resolveFn({ data, error });
      };
    },
  };
}

describe('CiclosTeoricosFacade', () => {
  let facade: CiclosTeoricosFacade;
  let mock: ReturnType<typeof makeSupabaseMock>;
  let toast: any;

  beforeEach(() => {
    mock = makeSupabaseMock();
    toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        CiclosTeoricosFacade,
        { provide: SupabaseService, useValue: mock.supabase },
        { provide: ToastService, useValue: toast },
        {
          provide: BranchFacade,
          useValue: { branches: vi.fn().mockReturnValue([{ id: 1, name: 'Chillán' }]) },
        },
      ],
    });

    facade = TestBed.inject(CiclosTeoricosFacade);
  });

  it('se crea con estado vacío', () => {
    expect(facade).toBeTruthy();
    expect(facade.cycles()).toEqual([]);
    expect(facade.selectedCycleId()).toBeNull();
  });

  describe('loadCycles', () => {
    it('mapea ciclos con etiqueta y nombre de sede, y autoselecciona el primer activo', async () => {
      mock.setResult('class_b_theory_cycles', [
        { id: 5, branch_id: 1, start_date: '2026-03-09', end_date: '2026-03-20', status: 'active' },
      ]);
      // selectCycle dispara fetch de clases + roster (ambas a otras tablas → [] por defecto)
      facade.setBranchFilter(1);
      await facade.loadCycles();

      const cycles = facade.cycles();
      expect(cycles).toHaveLength(1);
      expect(cycles[0].label).toBe('Ciclo — Lunes 9 de marzo');
      expect(cycles[0].branchName).toBe('Chillán');
      expect(facade.selectedCycleId()).toBe(5);
    });

    it('si no hay ciclos deja la selección vacía', async () => {
      mock.setResult('class_b_theory_cycles', []);
      await facade.loadCycles();
      expect(facade.selectedCycleId()).toBeNull();
      expect(facade.clases()).toEqual([]);
    });

    it('con "Todas las escuelas" agrega el nombre de sede al label para distinguir ciclos con el mismo lunes', async () => {
      mock.setResult('class_b_theory_cycles', [
        { id: 5, branch_id: 1, start_date: '2026-03-09', end_date: '2026-03-20', status: 'active' },
        { id: 6, branch_id: 2, start_date: '2026-03-09', end_date: '2026-03-20', status: 'active' },
      ]);
      facade.setBranchFilter(null); // "Todas las escuelas"
      await facade.loadCycles();

      const cycles = facade.cycles();
      expect(cycles).toHaveLength(2);
      expect(cycles[0].label).toBe('Ciclo — Lunes 9 de marzo · Chillán');
      // La sede 2 no está en BranchFacade.branches() del mock → cae a 'Sin sede'
      expect(cycles[1].label).toBe('Ciclo — Lunes 9 de marzo · Sin sede');
    });
  });

  describe('selectCycle', () => {
    it('carga clases y roster del ciclo', async () => {
      mock.setResult('class_b_theory_sessions', [
        {
          id: 11,
          class_number: 1,
          class_date: '2026-03-09',
          topic: null,
          zoom_link: null,
          zoom_sent_at: null,
        },
      ]);
      mock.setResult('enrollments', [
        {
          id: 100,
          students: {
            id: 7,
            users: { first_names: 'Juan', paternal_last_name: 'Pérez', email: 'j@x.cl' },
          },
        },
      ]);

      await facade.selectCycle(5);

      expect(facade.clases()).toHaveLength(1);
      expect(facade.clases()[0].label).toContain('Clase 1');
      expect(facade.roster()).toHaveLength(1);
      expect(facade.roster()[0].nombre).toBe('Pérez Juan');
    });

    it('arma el nombre con apellido materno y ordena el roster ascendente por apellido paterno', async () => {
      mock.setResult('class_b_theory_sessions', []);
      mock.setResult('enrollments', [
        {
          id: 100,
          students: {
            id: 7,
            users: {
              first_names: 'Juan',
              paternal_last_name: 'Pérez',
              maternal_last_name: 'Soto',
              email: 'j@x.cl',
            },
          },
        },
        {
          id: 101,
          students: {
            id: 8,
            users: {
              first_names: 'Ana',
              paternal_last_name: 'Soto',
              maternal_last_name: 'Díaz',
              email: 'a@x.cl',
            },
          },
        },
      ]);

      await facade.selectCycle(5);

      expect(facade.roster().map((r) => r.nombre)).toEqual(['Pérez Soto Juan', 'Soto Díaz Ana']);
    });

    it('fetchRoster aplica .order()+.limit(1000) explícito como red de seguridad (fix-053)', async () => {
      mock.setResult('class_b_theory_sessions', []);
      mock.setResult('enrollments', []);

      await facade.selectCycle(5);

      const order = mock.orderCalls.find((c) => c.table === 'enrollments');
      expect(order?.column).toBe('id');
      expect(order?.options).toEqual({ ascending: true });
      const limit = mock.limitCalls.find((c) => c.table === 'enrollments');
      expect(limit?.count).toBe(1000);
    });
  });

  describe('sendZoomEmail', () => {
    beforeEach(async () => {
      mock.setResult('class_b_theory_sessions', [
        {
          id: 11,
          class_number: 1,
          class_date: '2026-03-09',
          topic: 'Reglamento',
          zoom_link: 'https://zoom.us/j/1',
          zoom_sent_at: null,
        },
      ]);
      mock.setResult('enrollments', [
        {
          id: 100,
          students: {
            id: 7,
            users: { first_names: 'Juan', paternal_last_name: 'Pérez', email: 'j@x.cl' },
          },
        },
      ]);
      await facade.selectCycle(5);
    });

    it('bloquea el envío si la clase no tiene enlace Zoom', async () => {
      mock.setResult('class_b_theory_sessions', [
        {
          id: 12,
          class_number: 2,
          class_date: '2026-03-11',
          topic: null,
          zoom_link: null,
          zoom_sent_at: null,
        },
      ]);
      await facade.selectCycle(5);
      await facade.sendZoomEmail(12, [100]);
      expect(mock.invoke).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalled();
    });

    it('bloquea si no hay destinatarios seleccionados', async () => {
      await facade.sendZoomEmail(11, []);
      expect(mock.invoke).not.toHaveBeenCalled();
    });

    it('envía solo a los destinatarios seleccionados e incluye el tema en el asunto', async () => {
      mock.invoke.mockResolvedValueOnce({ data: { sent: 1, errors: [] }, error: null });
      await facade.sendZoomEmail(11, [100]);

      expect(mock.invoke).toHaveBeenCalledTimes(1);
      const body = mock.invoke.mock.calls[0][1].body;
      expect(body.recipients).toEqual([{ name: 'Pérez Juan', email: 'j@x.cl' }]);
      expect(body.sessionTopic).toContain('Reglamento');
      // Marca zoom_sent_at en la clase
      expect(facade.clases()[0].zoomSentAt).not.toBeNull();
    });

    it('expone sendingClassId mientras el envío está en curso y lo limpia al terminar', async () => {
      let resolveInvoke: (value: any) => void = () => {};
      mock.invoke.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveInvoke = resolve;
        }),
      );

      const sendPromise = facade.sendZoomEmail(11, [100]);
      expect(facade.sendingClassId()).toBe(11);

      resolveInvoke({ data: { sent: 1, errors: [] }, error: null });
      await sendPromise;

      expect(facade.sendingClassId()).toBeNull();
    });
  });

  describe('saveZoomLink', () => {
    it('actualiza el enlace en BD y en el estado local', async () => {
      mock.setResult('class_b_theory_sessions', [
        {
          id: 11,
          class_number: 1,
          class_date: '2026-03-09',
          topic: null,
          zoom_link: null,
          zoom_sent_at: null,
        },
      ]);
      mock.setResult('enrollments', []);
      await facade.selectCycle(5);

      await facade.saveZoomLink(11, '  https://zoom.us/j/9  ');
      expect(facade.clases()[0].zoomLink).toBe('https://zoom.us/j/9');
      expect(mock.updateCalls.some((c) => c.table === 'class_b_theory_sessions')).toBe(true);
    });
  });

  describe('loadAddableStudents', () => {
    it('expone isLoadingAddable mientras la carga está en curso y lo limpia al terminar (hotfix-020)', async () => {
      mock.setResult('class_b_theory_cycles', [
        { id: 5, branch_id: 1, start_date: '2026-03-09', end_date: '2026-03-20', status: 'active' },
      ]);
      facade.setBranchFilter(1);
      await facade.loadCycles();
      expect(facade.isLoadingAddable()).toBe(false);

      const resolveEnrollments = mock.deferResult('enrollments');

      const loadPromise = facade.loadAddableStudents();
      expect(facade.isLoadingAddable()).toBe(true);

      resolveEnrollments([]);
      await loadPromise;
      expect(facade.isLoadingAddable()).toBe(false);
    });

    it('filtra por la sede del ciclo seleccionado, no por el filtro global del dashboard', async () => {
      // "Todas las escuelas" en el dashboard admin (branchFilter = null)
      mock.setResult('class_b_theory_cycles', [
        { id: 5, branch_id: 1, start_date: '2026-03-09', end_date: '2026-03-20', status: 'active' },
      ]);
      facade.setBranchFilter(null);
      await facade.loadCycles();
      expect(facade.selectedCycleId()).toBe(5);
      expect(facade.selectedCycle()?.branchId).toBe(1);

      mock.setResult('enrollments', []);
      await facade.loadAddableStudents();

      const branchEq = mock.eqCalls.find(
        (c) => c.table === 'enrollments' && c.column === 'branch_id',
      );
      expect(branchEq?.value).toBe(1);
    });

    it('aplica .order()+.limit(1000) explícito como red de seguridad ante max_rows (fix-053)', async () => {
      mock.setResult('class_b_theory_cycles', [
        { id: 5, branch_id: 1, start_date: '2026-03-09', end_date: '2026-03-20', status: 'active' },
      ]);
      facade.setBranchFilter(1);
      await facade.loadCycles();

      mock.setResult('enrollments', []);
      await facade.loadAddableStudents();

      const order = mock.orderCalls.find((c) => c.table === 'enrollments');
      expect(order?.column).toBe('id');
      expect(order?.options).toEqual({ ascending: true });
      const limit = mock.limitCalls.find((c) => c.table === 'enrollments');
      expect(limit?.count).toBe(1000);
    });

    it('loguea una advertencia si el resultado alcanza la cota de 1000 filas (fix-053)', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mock.setResult('class_b_theory_cycles', [
        { id: 5, branch_id: 1, start_date: '2026-03-09', end_date: '2026-03-20', status: 'active' },
      ]);
      facade.setBranchFilter(1);
      await facade.loadCycles();

      const row = {
        id: 1,
        theory_cycle_id: 9,
        students: { id: 1, users: { first_names: 'A', paternal_last_name: 'B', email: 'a@x.cl' } },
        class_b_theory_cycles: { id: 9, start_date: '2026-01-05' },
      };
      mock.setResult(
        'enrollments',
        Array.from({ length: 1000 }, (_, i) => ({ ...row, id: i })),
      );
      await facade.loadAddableStudents();

      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe('moveStudentToCycle', () => {
    it('actualiza theory_cycle_id de la matrícula', async () => {
      await facade.moveStudentToCycle(100, 9);
      const call = mock.updateCalls.find((c) => c.table === 'enrollments');
      expect(call?.payload).toEqual({ theory_cycle_id: 9 });
      expect(toast.success).toHaveBeenCalled();
    });
  });
});
