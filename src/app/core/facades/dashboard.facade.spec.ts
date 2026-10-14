import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DashboardFacade } from './dashboard.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';

// Temporarily declaring jest types since they are reporting missing locally in IDE feedback
declare const describe: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const it: any;
declare const expect: any;

describe('DashboardFacade — día de Chile (spec 0024-m)', () => {
  afterEach(() => vi.useRealTimers());

  it('fetchLiveClasses pide las clases del día de Chile como rango semiabierto a las 23:30', async () => {
    const builders: any[] = [];
    const client = {
      from: vi.fn(() => {
        const b: any = {};
        for (const m of [
          'select',
          'eq',
          'gte',
          'lte',
          'lt',
          'or',
          'in',
          'is',
          'not',
          'order',
          'limit',
        ]) {
          b[m] = vi.fn(() => b);
        }
        b.then = (resolve: any) => resolve({ data: [], error: null });
        builders.push(b);
        return b;
      }),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        DashboardFacade,
        { provide: SupabaseService, useValue: { client } },
        { provide: AuthFacade, useValue: { currentUser: vi.fn(() => ({ name: 'Test' })) } },
        { provide: BranchFacade, useValue: { selectedBranchId: vi.fn(() => null) } },
      ],
    });
    const facade = TestBed.inject(DashboardFacade);

    // 23:30 hora Chile del 6 de octubre: en UTC ya es el día 7.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T02:30:00.000Z'));
    await facade.fetchLiveClasses(null);

    const [practicas, colgadas] = builders;
    expect(practicas.gte).toHaveBeenCalledWith('scheduled_at', '2026-10-06T03:00:00.000Z');
    expect(practicas.lt).toHaveBeenCalledWith('scheduled_at', '2026-10-07T03:00:00.000Z');
    // Sesiones colgadas: todo lo anterior al inicio del día de Chile.
    expect(colgadas.lt).toHaveBeenCalledWith('scheduled_at', '2026-10-06T03:00:00.000Z');
  });
});

describe('DashboardFacade — KPI "Ingresos Mes" incluye servicios especiales (fix-047-i)', () => {
  it('suma las ventas cobradas de servicios especiales a los pagos del mes', async () => {
    const porTabla: Record<string, unknown[]> = {
      payments: [{ total_amount: 1_000_000 }],
      special_service_sales: [{ price: 500_000 }],
    };
    const builders: Record<string, any[]> = {};
    const client = {
      from: vi.fn((tabla: string) => {
        const b: any = {};
        for (const m of [
          'select',
          'eq',
          'gte',
          'lte',
          'lt',
          'or',
          'in',
          'is',
          'not',
          'order',
          'limit',
        ]) {
          b[m] = vi.fn(() => b);
        }
        b.then = (resolve: any) => resolve({ data: porTabla[tabla] ?? [], count: 0, error: null });
        (builders[tabla] ??= []).push(b);
        return b;
      }),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        DashboardFacade,
        { provide: SupabaseService, useValue: { client } },
        { provide: AuthFacade, useValue: { currentUser: vi.fn(() => ({ name: 'Test' })) } },
        { provide: BranchFacade, useValue: { selectedBranchId: vi.fn(() => null) } },
      ],
    });
    const facade = TestBed.inject(DashboardFacade);

    await (facade as any).fetchRealDashboardData(null);

    // Mes actual y mes anterior: dos consultas a special_service_sales, solo ventas cobradas.
    expect(builders['special_service_sales']?.length).toBe(2);
    expect(builders['special_service_sales'][0].eq).toHaveBeenCalledWith('paid', true);
    const revenue = (facade as any).data().kpis.find((k: { id: string }) => k.id === 'revenue');
    expect(revenue.value).toBe(1_500_000); // 1.000.000 + 500.000 (monto completo, fix-399-m)
  });
});

/**
 * Facade con un cliente Supabase falso que registra un builder por consulta, agrupados por tabla.
 * `respuesta(tabla, n)` decide qué devuelve la consulta número `n` (desde 0) de esa tabla.
 */
function crearFacadeConCliente(
  respuesta: (tabla: string, n: number) => Record<string, unknown> = () => ({}),
  user: Record<string, unknown> = { name: 'Test' },
) {
  const builders: Record<string, any[]> = {};
  const client = {
    from: vi.fn((tabla: string) => {
      const b: any = {};
      for (const m of [
        'select',
        'eq',
        'gte',
        'lte',
        'lt',
        'or',
        'in',
        'is',
        'not',
        'order',
        'limit',
      ]) {
        b[m] = vi.fn(() => b);
      }
      const n = (builders[tabla] ??= []).length;
      b.then = (resolve: any) =>
        resolve({ data: [], count: 0, error: null, ...respuesta(tabla, n) });
      builders[tabla].push(b);
      return b;
    }),
    channel: vi.fn(() => {
      const ch: any = { on: vi.fn(() => ch), subscribe: vi.fn(() => ch) };
      return ch;
    }),
    removeChannel: vi.fn(),
  };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    imports: [HttpClientTestingModule],
    providers: [
      DashboardFacade,
      { provide: SupabaseService, useValue: { client } },
      { provide: AuthFacade, useValue: { currentUser: vi.fn(() => user) } },
      { provide: BranchFacade, useValue: { selectedBranchId: vi.fn(() => null) } },
    ],
  });
  return { facade: TestBed.inject(DashboardFacade), builders, client };
}

describe('DashboardFacade — KPI "Clases Hoy" usa el criterio del panel (fix-398-m)', () => {
  const VALIDAS = ['scheduled', 'in_progress', 'completed', 'no_show'];

  it('cuenta solo clases válidas de matrículas activas, hoy y ayer', async () => {
    const { facade, builders } = crearFacadeConCliente();

    await (facade as any).fetchRealDashboardData(null);

    // Las dos primeras consultas a class_b_sessions son el KPI: hoy y ayer (tendencia).
    const [hoy, ayer] = builders['class_b_sessions'];
    for (const consulta of [hoy, ayer]) {
      expect(consulta.in).toHaveBeenCalledWith('status', VALIDAS);
      expect(consulta.eq).toHaveBeenCalledWith('enrollments.status', 'active');
    }
  });

  it('el KPI y el chip del hero muestran ese conteo', async () => {
    const { facade } = crearFacadeConCliente((tabla, n) =>
      tabla === 'class_b_sessions' && n === 0 ? { count: 3 } : {},
    );

    await (facade as any).fetchRealDashboardData(null);

    const data = (facade as any).data();
    expect(data.kpis.find((k: { id: string }) => k.id === 'classes').value).toBe(3);
    expect(data.hero.classesToday).toBe(3);
  });
});

describe('DashboardFacade — KPI "Ingresos Mes": formato y tramo comparable (fix-399-m)', () => {
  afterEach(() => vi.useRealTimers());

  const revenueKpi = (facade: DashboardFacade) =>
    (facade as any).data().kpis.find((k: { id: string }) => k.id === 'revenue');

  it('entrega el monto completo en pesos, sin dividir por un millón ni sufijo "M"', async () => {
    const { facade } = crearFacadeConCliente((tabla, n) =>
      tabla === 'payments' && n === 0 ? { data: [{ total_amount: 1_234_567 }] } : {},
    );

    await (facade as any).fetchRealDashboardData(null);

    const kpi = revenueKpi(facade);
    expect(kpi.value).toBe(1_234_567);
    expect(kpi.prefix).toBe('$');
    expect(kpi.suffix).toBeUndefined();
  });

  it('compara contra el mismo tramo del mes anterior (13 oct → 1–13 sep)', async () => {
    // 12:00 hora Chile del 13 de octubre.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-13T15:00:00.000Z'));
    const { facade, builders } = crearFacadeConCliente((tabla, n) => {
      if (tabla !== 'payments') return {};
      return { data: [{ total_amount: n === 0 ? 150_000 : 100_000 }] };
    });

    await (facade as any).fetchRealDashboardData(null);

    // Segunda consulta de cada tabla = período anterior.
    for (const [tabla, columna] of [
      ['payments', 'payment_date'],
      ['special_service_sales', 'sale_date'],
    ]) {
      const anterior = builders[tabla][1];
      expect(anterior.gte).toHaveBeenCalledWith(columna, '2026-09-01');
      expect(anterior.lte).toHaveBeenCalledWith(columna, '2026-09-13');
    }
    expect(revenueKpi(facade).trend).toBe(50);
  });

  it('el 31 de marzo compara contra todo febrero', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-31T15:00:00.000Z'));
    const { facade, builders } = crearFacadeConCliente();

    await (facade as any).fetchRealDashboardData(null);

    expect(builders['payments'][1].lte).toHaveBeenCalledWith('payment_date', '2026-02-28');
  });
});

describe('DashboardFacade — KPI "Vehículos" incluye los de ambas sedes (fix-411-m)', () => {
  it('con una sede, pide los vehículos de la sede o marcados "ambas sedes", como Flota', async () => {
    const { facade, builders } = crearFacadeConCliente();

    await (facade as any).fetchRealDashboardData(2);

    const [vehiculos] = builders['vehicles'];
    expect(vehiculos.or).toHaveBeenCalledWith('branch_id.eq.2,both_branches.eq.true');
    expect(vehiculos.eq).not.toHaveBeenCalledWith('branch_id', 2);
  });

  it('con "Todas" no filtra', async () => {
    const { facade, builders } = crearFacadeConCliente();

    await (facade as any).fetchRealDashboardData(null);

    expect(builders['vehicles'][0].or).not.toHaveBeenCalled();
  });
});

describe('DashboardFacade — cambio de usuario (fix-409-m)', () => {
  it('otro usuario en la misma sede no ve los datos del anterior: se descartan y carga con skeleton', async () => {
    const user = { id: 'uid-1', name: 'Secretaria Uno' };
    const { facade } = crearFacadeConCliente(() => ({}), user);
    await facade.initialize();
    expect(facade.data()?.hero.userName).toBe('Secretaria Uno');

    // Cierra sesión y entra otra persona en la misma pestaña (el facade es un singleton).
    user.id = 'uid-2';
    user.name = 'Secretaria Dos';
    const carga = facade.initialize();

    expect(facade.data()).toBeNull();
    expect(facade.loading()).toBe(true);
    await carga;
    expect(facade.data()?.hero.userName).toBe('Secretaria Dos');
  });

  it('el mismo usuario que vuelve sigue viendo sus datos al instante', async () => {
    const { facade } = crearFacadeConCliente(() => ({}), { id: 'uid-1', name: 'Secretaria Uno' });
    await facade.initialize();

    void facade.initialize();

    expect(facade.data()?.hero.userName).toBe('Secretaria Uno');
    expect(facade.loading()).toBe(false);
  });
});

describe('DashboardFacade — errores de consulta (fix-405-m)', () => {
  const fallo = { data: null, count: null, error: { message: 'Failed to fetch' } };

  it('si falla una consulta de KPI, la carga falla: error() avisa y no se publican ceros', async () => {
    const { facade } = crearFacadeConCliente((tabla, n) =>
      tabla === 'enrollments' && n === 0 ? fallo : {},
    );

    await facade.initialize();

    expect(facade.error()).toBe('Error al cargar datos del dashboard');
    expect(facade.data()).toBeNull();
    expect(facade.loading()).toBe(false);
  });

  it('si fallan las clases actuales, la carga también falla', async () => {
    // class_b_sessions: 0 y 1 son el KPI (hoy y ayer); 2 y 3, el panel "Clases Actuales".
    const { facade } = crearFacadeConCliente((tabla, n) =>
      tabla === 'class_b_sessions' && n === 2 ? fallo : {},
    );

    await facade.initialize();

    expect(facade.error()).toBe('Error al cargar datos del dashboard');
    expect(facade.data()).toBeNull();
  });

  it('tras un error, volver a llamar initialize() carga de nuevo', async () => {
    let roto = true;
    const { facade } = crearFacadeConCliente((tabla, n) => {
      if (roto) return fallo;
      return tabla === 'class_b_sessions' && n % 4 === 0 ? { count: 3 } : {};
    });

    await facade.initialize();
    expect(facade.error()).not.toBeNull();

    roto = false;
    await facade.initialize();

    expect(facade.error()).toBeNull();
    expect(facade.data()?.hero.classesToday).toBe(3);
  });

  it('un refresco en segundo plano que falla conserva los datos ya cargados', async () => {
    let roto = false;
    const { facade } = crearFacadeConCliente((tabla, n) => {
      if (roto) return fallo;
      return tabla === 'class_b_sessions' && n === 0 ? { count: 3 } : {};
    });
    await facade.initialize();

    roto = true;
    await (facade as any).refreshSilently();

    expect(facade.data()?.hero.classesToday).toBe(3);
    expect(facade.error()).toBeNull();
  });
});

describe('DashboardFacade', () => {
  let facade: DashboardFacade;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [DashboardFacade],
    });

    facade = TestBed.inject(DashboardFacade);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('debería ser creado', () => {
    expect(facade).toBeTruthy();
  });

  it('debería inicializar con state vacío', () => {
    expect(facade.loading()).toBe(false);
    expect(facade.error()).toBeNull();
    expect(facade.data()).toBeNull();
  });

  describe('initialize', () => {
    it('debería setear state de loading al iniciar mock', () => {
      void facade.initialize();
      expect(facade.loading()).toBe(true);
      expect(facade.error()).toBeNull();
    });

    // Como el facade actual usa un `of(mockData)` con `delay(800)`, deberíamos usar fakeAsync para testear el valor final.
    // Por simplicidad, este test es estructural para cumplir con la regla de arquitectura TDD.
  });

  describe('Request guard — respuestas stale (spec 0005-m, AC1, AC4, AC-E1)', () => {
    /**
     * fetchRealDashboardData() dispara exactamente QUERIES_POR_CARGA queries `.from(...)` por
     * invocación (todas construidas sincrónicamente antes del único `await Promise.all(...)`), así
     * que cada tanda de QUERIES_POR_CARGA llamadas a `.from()` pertenece a una sola invocación del
     * método — agrupamos por eso para poder controlar cuándo "responde" cada invocación completa.
     * Eran 8; fix-047-i sumó 2 (ventas de servicios especiales del mes y del mes anterior) y
     * fix-404-m otras 2: las de `fetchLiveClasses()`, que ahora van en la misma tanda para que el
     * guard las cubra. Si agregas una query al método, actualiza la constante o estos tests se
     * cuelgan esperando.
     * Cualquier llamada a `.from()` MÁS ALLÁ de `expectedInitializeCalls * QUERIES_POR_CARGA` es una
     * query auxiliar — se resuelve sola de inmediato, no la necesitamos controlada.
     */
    const QUERIES_POR_CARGA = 12;

    function makeRaceableSupabaseMock(expectedInitializeCalls: number) {
      const mainCallsTotal = expectedInitializeCalls * QUERIES_POR_CARGA;
      const deferreds: {
        promise: Promise<any>;
        resolve: (v: any) => void;
        reject: (e: any) => void;
      }[] = [];
      let fromCallCount = 0;

      function deferredForBatch(batchIndex: number) {
        if (!deferreds[batchIndex]) {
          let resolve!: (v: any) => void;
          let reject!: (e: any) => void;
          const promise = new Promise((res, rej) => {
            resolve = res;
            reject = rej;
          });
          deferreds[batchIndex] = { promise, resolve, reject };
        }
        return deferreds[batchIndex];
      }

      const client = {
        from: vi.fn(() => {
          const idx = fromCallCount++;
          const isAuxiliaryQuery = idx >= mainCallsTotal;
          const then = isAuxiliaryQuery
            ? (resolve: any) => resolve({ data: [], error: null })
            : (resolve: any, reject: any) =>
                deferredForBatch(Math.floor(idx / QUERIES_POR_CARGA)).promise.then(resolve, reject);
          const builder: any = {
            select: vi.fn(() => builder),
            eq: vi.fn(() => builder),
            gte: vi.fn(() => builder),
            lte: vi.fn(() => builder),
            lt: vi.fn(() => builder),
            or: vi.fn(() => builder),
            in: vi.fn(() => builder),
            order: vi.fn(() => builder),
            limit: vi.fn(() => builder),
            then,
          };
          return builder;
        }),
        channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
        removeChannel: vi.fn(),
      };

      return {
        client,
        resolveBatch: (i: number, count: number) =>
          deferredForBatch(i).resolve({ data: [], count, error: null }),
        rejectBatch: (i: number, err: Error) => deferredForBatch(i).reject(err),
      };
    }

    it('AC-E2: si la fetch vigente falla, el error se setea igual — el guard no enmascara errores reales', async () => {
      const mock = makeRaceableSupabaseMock(2);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [
          DashboardFacade,
          { provide: SupabaseService, useValue: mock },
          { provide: AuthFacade, useValue: { currentUser: vi.fn(() => ({ name: 'Test' })) } },
          { provide: BranchFacade, useValue: { selectedBranchId: vi.fn(() => null) } },
        ],
      });
      const dashFacade = TestBed.inject(DashboardFacade);

      const oldCall = dashFacade.initialize(); // batch 0 (vieja)
      const newCall = dashFacade.initialize(); // batch 1 (vigente)

      mock.resolveBatch(0, 100);
      await oldCall;
      mock.rejectBatch(1, new Error('network fail'));
      await newCall;

      expect(dashFacade.error()).toBe('Error al cargar datos del dashboard');
    });

    it('AC1/AC-E1: solo aplica el resultado de la fetch MÁS RECIENTE, aunque la vieja resuelva después', async () => {
      const mock = makeRaceableSupabaseMock(2);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [
          DashboardFacade,
          { provide: SupabaseService, useValue: mock },
          { provide: AuthFacade, useValue: { currentUser: vi.fn(() => ({ name: 'Test' })) } },
          { provide: BranchFacade, useValue: { selectedBranchId: vi.fn(() => null) } },
        ],
      });
      const dashFacade = TestBed.inject(DashboardFacade);

      const oldCall = dashFacade.initialize(); // batch 0 (vieja)
      const newCall = dashFacade.initialize(); // batch 1 (vigente) — dispara antes de que la vieja resuelva

      // Orden de llegada invertido: la vigente resuelve primero.
      mock.resolveBatch(1, 200);
      await newCall;
      mock.resolveBatch(0, 100);
      await oldCall;

      expect(dashFacade.data()?.hero.classesToday).toBe(200);
    });

    function facadeConCarrera(cargas: number) {
      const mock = makeRaceableSupabaseMock(cargas);
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [
          DashboardFacade,
          { provide: SupabaseService, useValue: mock },
          { provide: AuthFacade, useValue: { currentUser: vi.fn(() => ({ name: 'Test' })) } },
          { provide: BranchFacade, useValue: { selectedBranchId: vi.fn(() => null) } },
        ],
      });
      return { mock, dashFacade: TestBed.inject(DashboardFacade) };
    }

    it('fix-404-m: una carga vieja que termina primero no apaga el skeleton de la vigente', async () => {
      const { mock, dashFacade } = facadeConCarrera(2);

      const oldCall = dashFacade.initialize(); // batch 0 (vieja)
      const newCall = dashFacade.initialize(); // batch 1 (vigente)

      mock.resolveBatch(0, 100);
      await oldCall;
      expect(dashFacade.loading()).toBe(true);
      expect(dashFacade.data()).toBeNull();

      mock.resolveBatch(1, 200);
      await newCall;
      expect(dashFacade.loading()).toBe(false);
      expect(dashFacade.data()?.hero.classesToday).toBe(200);
    });

    describe('eventos Realtime seguidos (fix-407-m)', () => {
      /** Deja correr las promesas ya resueltas (la cadena de un refresco encolado). */
      const asentar = async () => {
        for (let i = 0; i < 10; i++) await Promise.resolve();
      };
      const evento = (facade: DashboardFacade) => (facade as any).refreshSilently();
      const cargasPedidas = (mock: { client: { from: { mock: { calls: unknown[] } } } }) =>
        mock.client.from.mock.calls.length / QUERIES_POR_CARGA;

      it('un evento durante la primera carga no la descarta: se muestra y después se refresca', async () => {
        const { mock, dashFacade } = facadeConCarrera(2);

        const carga = dashFacade.initialize(); // batch 0
        void evento(dashFacade); // llega un cambio por Realtime mientras carga
        expect(cargasPedidas(mock)).toBe(1);

        mock.resolveBatch(0, 100);
        await carga;
        expect(dashFacade.data()?.hero.classesToday).toBe(100);
        expect(dashFacade.loading()).toBe(false);

        // El refresco que quedó pendiente corre una vez terminada la carga.
        await asentar();
        expect(cargasPedidas(mock)).toBe(2);
        mock.resolveBatch(1, 200);
        await asentar();
        expect(dashFacade.data()?.hero.classesToday).toBe(200);
      });

      it('varios eventos durante un refresco en curso producen un solo refresco más', async () => {
        const { mock, dashFacade } = facadeConCarrera(3);
        const carga = dashFacade.initialize();
        mock.resolveBatch(0, 100);
        await carga;

        const refresco = evento(dashFacade); // batch 1, en curso
        void evento(dashFacade);
        void evento(dashFacade);
        void evento(dashFacade);
        expect(cargasPedidas(mock)).toBe(2);

        mock.resolveBatch(1, 200);
        await asentar();
        expect(dashFacade.data()?.hero.classesToday).toBe(200);
        expect(cargasPedidas(mock)).toBe(3);

        mock.resolveBatch(2, 300);
        await refresco;
        expect(dashFacade.data()?.hero.classesToday).toBe(300);
        expect(cargasPedidas(mock)).toBe(3);
      });

      it('un cambio de sede durante un refresco sigue ganando', async () => {
        const { mock, dashFacade } = facadeConCarrera(3);
        const carga = dashFacade.initialize();
        mock.resolveBatch(0, 100);
        await carga;

        const refresco = evento(dashFacade); // batch 1, en curso
        (dashFacade as any)._lastBranchId = 99; // la sede activa ya no es la cargada
        const otraSede = dashFacade.initialize(); // batch 2

        mock.resolveBatch(2, 300);
        await otraSede;
        expect(dashFacade.data()?.hero.classesToday).toBe(300);
        expect(dashFacade.loading()).toBe(false);

        mock.resolveBatch(1, 200); // el refresco viejo llega después: se descarta
        await refresco;
        expect(dashFacade.data()?.hero.classesToday).toBe(300);
      });
    });

    it('fix-404-m: una carga vieja que falla no apaga el skeleton ni muestra error', async () => {
      const { mock, dashFacade } = facadeConCarrera(2);

      const oldCall = dashFacade.initialize();
      const newCall = dashFacade.initialize();

      mock.rejectBatch(0, new Error('network fail'));
      await oldCall;
      expect(dashFacade.loading()).toBe(true);
      expect(dashFacade.error()).toBeNull();

      mock.resolveBatch(1, 200);
      await newCall;
      expect(dashFacade.loading()).toBe(false);
      expect(dashFacade.error()).toBeNull();
    });
  });

  describe('fetchLiveClasses', () => {
    /**
     * Builder Supabase encadenable y awaitable. fetchLiveClasses() ahora dispara DOS
     * queries por invocación (hoy + sesiones in_progress colgadas de días anteriores,
     * fix-131-m) — cada `.from()` devuelve un builder nuevo para no mezclar resultados;
     * la primera llamada responde `rows` (hoy), la segunda `stuckRows` (colgadas, vacío
     * por defecto para no romper los tests existentes que solo esperan datos de hoy).
     */
    function makeSupabaseMock(rows: any[], stuckRows: any[] = []) {
      const builders: any[] = [];
      const from = vi.fn(() => {
        const data = builders.length === 0 ? rows : stuckRows;
        const b: any = {
          select: vi.fn(() => b),
          eq: vi.fn(() => b),
          gte: vi.fn(() => b),
          lte: vi.fn(() => b),
          lt: vi.fn(() => b),
          neq: vi.fn(() => b),
          in: vi.fn(() => b),
          then: (resolve: any) => resolve({ data, error: null }),
        };
        builders.push(b);
        return b;
      });
      return {
        client: { from },
        get builder() {
          return builders[0];
        },
        get stuckBuilder() {
          return builders[1];
        },
      };
    }

    it('excluye sesiones canceladas del resultado y filtra por query', async () => {
      const rows = [
        {
          id: 1,
          class_number: 1,
          scheduled_at: '2026-07-09T11:00:00',
          status: 'completed',
          vehicles: null,
          instructors: null,
          enrollments: { branch_id: 1, students: { users: null } },
        },
      ];
      const mock = makeSupabaseMock(rows);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [
          DashboardFacade,
          { provide: SupabaseService, useValue: mock },
          { provide: AuthFacade, useValue: {} },
          { provide: BranchFacade, useValue: {} },
        ],
      });
      const dashFacade = TestBed.inject(DashboardFacade);

      const result = await dashFacade.fetchLiveClasses(1);

      expect(result.every((c) => c.status !== 'cancelled')).toBe(true);
    });

    it('preserva no_show en vez de colapsarlo a completed (fix-193)', async () => {
      const rows = [
        {
          id: 2,
          class_number: 1,
          scheduled_at: '2026-08-18T17:30:00',
          status: 'no_show',
          vehicles: null,
          instructors: null,
          enrollments: { branch_id: 1, students: { users: null } },
        },
      ];
      const mock = makeSupabaseMock(rows);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [
          DashboardFacade,
          { provide: SupabaseService, useValue: mock },
          { provide: AuthFacade, useValue: {} },
          { provide: BranchFacade, useValue: {} },
        ],
      });
      const dashFacade = TestBed.inject(DashboardFacade);

      const [result] = await dashFacade.fetchLiveClasses(1);

      expect(result.status).toBe('no_show');
      expect(result.excused).toBe(false);
    });

    it('fix-381-m: marca justificada una falta con asistencia vigente excused', async () => {
      const rows = [
        {
          id: 3,
          class_number: 4,
          scheduled_at: '2026-08-18T17:30:00',
          status: 'no_show',
          vehicles: null,
          instructors: null,
          enrollments: { branch_id: 1, students: { users: null } },
          class_b_practice_attendance: [
            { status: 'absent', archived_at: '2026-08-10T12:00:00Z' },
            { status: 'excused', archived_at: null },
          ],
        },
      ];
      const mock = makeSupabaseMock(rows);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [
          DashboardFacade,
          { provide: SupabaseService, useValue: mock },
          { provide: AuthFacade, useValue: {} },
          { provide: BranchFacade, useValue: {} },
        ],
      });
      const dashFacade = TestBed.inject(DashboardFacade);

      const [result] = await dashFacade.fetchLiveClasses(1);

      expect(result.excused).toBe(true);
    });

    it('no incluye sesiones reserved de enrollments draft (fix-110)', async () => {
      const mock = makeSupabaseMock([]);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [
          DashboardFacade,
          { provide: SupabaseService, useValue: mock },
          { provide: AuthFacade, useValue: {} },
          { provide: BranchFacade, useValue: {} },
        ],
      });
      const dashFacade = TestBed.inject(DashboardFacade);

      await dashFacade.fetchLiveClasses(1);

      expect(mock.builder.in).toHaveBeenCalledWith('status', [
        'scheduled',
        'in_progress',
        'completed',
        'no_show',
      ]);
      expect(mock.builder.eq).toHaveBeenCalledWith('enrollments.status', 'active');
    });

    it('mapea studentId y kmStart desde la fila de class_b_sessions (fix-076)', async () => {
      const rows = [
        {
          id: 5,
          class_number: 3,
          scheduled_at: '2026-07-27T11:50:00',
          status: 'in_progress',
          km_start: 12000,
          vehicles: null,
          instructors: null,
          enrollments: { branch_id: 1, student_id: 42, students: { users: null } },
        },
      ];
      const mock = makeSupabaseMock(rows);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [
          DashboardFacade,
          { provide: SupabaseService, useValue: mock },
          { provide: AuthFacade, useValue: {} },
          { provide: BranchFacade, useValue: {} },
        ],
      });
      const dashFacade = TestBed.inject(DashboardFacade);

      const [result] = await dashFacade.fetchLiveClasses(1);

      expect(result.studentId).toBe(42);
      expect(result.kmStart).toBe(12000);
    });

    it('mapea durationMin desde duration_min, con fallback a 45 si viene null (spec 0001-i)', async () => {
      const rows = [
        {
          id: 6,
          class_number: 2,
          scheduled_at: '2026-08-04T09:00:00',
          duration_min: 60,
          status: 'in_progress',
          vehicles: null,
          instructors: null,
          enrollments: { branch_id: 1, students: { users: null } },
        },
        {
          id: 7,
          class_number: 3,
          scheduled_at: '2026-08-04T10:00:00',
          duration_min: null,
          status: 'pending',
          vehicles: null,
          instructors: null,
          enrollments: { branch_id: 1, students: { users: null } },
        },
      ];
      const mock = makeSupabaseMock(rows);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [
          DashboardFacade,
          { provide: SupabaseService, useValue: mock },
          { provide: AuthFacade, useValue: {} },
          { provide: BranchFacade, useValue: {} },
        ],
      });
      const dashFacade = TestBed.inject(DashboardFacade);

      const [first, second] = await dashFacade.fetchLiveClasses(1);

      expect(first.durationMin).toBe(60);
      expect(second.durationMin).toBe(45);
    });

    it('incluye sesiones in_progress colgadas de días anteriores junto con las de hoy (fix-131-m)', async () => {
      const todayRows = [
        {
          id: 10,
          class_number: 1,
          scheduled_at: '2026-08-06T18:30:00',
          duration_min: 45,
          status: 'pending',
          vehicles: null,
          instructors: null,
          enrollments: { branch_id: 1, students: { users: null } },
        },
      ];
      const stuckRows = [
        {
          id: 9,
          class_number: 1,
          scheduled_at: '2026-08-05T18:30:00',
          duration_min: 45,
          status: 'in_progress',
          vehicles: null,
          instructors: null,
          enrollments: { branch_id: 1, students: { users: null } },
        },
      ];
      const mock = makeSupabaseMock(todayRows, stuckRows);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [
          DashboardFacade,
          { provide: SupabaseService, useValue: mock },
          { provide: AuthFacade, useValue: {} },
          { provide: BranchFacade, useValue: {} },
        ],
      });
      const dashFacade = TestBed.inject(DashboardFacade);

      const result = await dashFacade.fetchLiveClasses(1);

      expect(result).toHaveLength(2);
      expect(result.some((c) => c.originalId === 9 && c.status === 'in_progress')).toBe(true);
      expect(mock.stuckBuilder.lt).toHaveBeenCalledWith('scheduled_at', expect.any(String));
      expect(mock.stuckBuilder.eq).toHaveBeenCalledWith('status', 'in_progress');
    });

    it('refreshLiveClassesOnly() (fix-079) actualiza solo liveClasses, sin tocar el resto de data()', async () => {
      const rows = [
        {
          id: 7,
          class_number: 1,
          scheduled_at: '2026-07-27T11:50:00',
          status: 'in_progress',
          km_start: 1000,
          vehicles: null,
          instructors: null,
          enrollments: { branch_id: 1, student_id: 1, students: { users: null } },
        },
      ];
      const mock = makeSupabaseMock(rows);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [
          DashboardFacade,
          { provide: SupabaseService, useValue: mock },
          { provide: AuthFacade, useValue: { currentUser: vi.fn().mockReturnValue(null) } },
          { provide: BranchFacade, useValue: { selectedBranchId: vi.fn().mockReturnValue(null) } },
        ],
      });
      const dashFacade = TestBed.inject(DashboardFacade);
      dashFacade.data.set({
        kpis: [],
        activities: [],
        alerts: [],
        quickActions: [],
        systemStatus: [],
        liveClasses: [],
      });

      await dashFacade.refreshLiveClassesOnly();

      const data = dashFacade.data();
      expect(data?.liveClasses?.length).toBe(1);
      expect(data?.kpis).toEqual([]);
    });
  });

  describe('Realtime lifecycle (fix-004-i)', () => {
    function makeChannelMock() {
      const channel = { on: vi.fn(() => channel), subscribe: vi.fn(() => channel) };
      return {
        client: {
          channel: vi.fn(() => channel),
          removeChannel: vi.fn(),
        },
        channel,
      };
    }

    it('setupRealtime() ya no agenda polling con setInterval (anti-patrón prohibido por swr-pattern.md)', () => {
      const mock = makeChannelMock();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [
          DashboardFacade,
          { provide: SupabaseService, useValue: mock },
          { provide: AuthFacade, useValue: {} },
          { provide: BranchFacade, useValue: {} },
        ],
      });
      const dashFacade = TestBed.inject(DashboardFacade);
      const refreshSpy = vi.spyOn(dashFacade, 'refreshLiveClassesOnly');

      vi.useFakeTimers();
      dashFacade.setupRealtime();
      vi.advanceTimersByTime(120000); // 2 minutos: si hubiera setInterval(60s), ya habría disparado 2 veces
      vi.useRealTimers();

      expect(refreshSpy).not.toHaveBeenCalled();
    });

    it('destroyRealtime() remueve el canal Realtime suscrito', () => {
      const mock = makeChannelMock();
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [
          DashboardFacade,
          { provide: SupabaseService, useValue: mock },
          { provide: AuthFacade, useValue: {} },
          { provide: BranchFacade, useValue: {} },
        ],
      });
      const dashFacade = TestBed.inject(DashboardFacade);

      dashFacade.setupRealtime();
      dashFacade.destroyRealtime();

      expect(mock.client.removeChannel).toHaveBeenCalledWith(mock.channel);
    });
  });

  describe('fetchActivityHistory (fix-105-m)', () => {
    /** Builder Supabase encadenable y awaitable para audit_log, con resultado fijo. */
    function makeAuditLogMock(rows: any[]) {
      const b: any = {
        select: vi.fn(() => b),
        order: vi.fn(() => b),
        limit: vi.fn(() => b),
        or: vi.fn(() => b),
        then: (resolve: any) => resolve({ data: rows, error: null }),
      };
      return { client: { from: vi.fn(() => b) }, builder: b };
    }

    function setupWithRows(rows: any[]) {
      const mock = makeAuditLogMock(rows);
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        imports: [HttpClientTestingModule],
        providers: [
          DashboardFacade,
          { provide: SupabaseService, useValue: mock },
          { provide: AuthFacade, useValue: { currentUser: () => null } },
          { provide: BranchFacade, useValue: { selectedBranchId: () => null } },
        ],
      });
      return TestBed.inject(DashboardFacade);
    }

    it('DELETE conserva el detalle real en vez de un mensaje genérico', async () => {
      const rows = [
        {
          id: 1,
          action: 'DELETE',
          entity: 'enrollments',
          entity_id: 42,
          detail: 'Eliminado: Juan Perez - Clase Profesional A2 ($800.000)',
          created_at: new Date().toISOString(),
          users: { first_names: 'Ana', paternal_last_name: 'Soto' },
        },
      ];
      const dashFacade = setupWithRows(rows);

      const [result] = await dashFacade.fetchActivityHistory(10);

      expect(result.title).toBe('Matrícula eliminada');
      expect(result.description).toBe(
        'Ana Soto eliminó: Juan Perez - Clase Profesional A2 ($800.000)',
      );
      expect(result.description).not.toContain('Eliminada por');
    });

    it('DELETE sin detalle cae al mensaje genérico como fallback', async () => {
      const rows = [
        {
          id: 2,
          action: 'DELETE',
          entity: 'enrollments',
          entity_id: 43,
          detail: null,
          created_at: new Date().toISOString(),
          users: null,
        },
      ];
      const dashFacade = setupWithRows(rows);

      const [result] = await dashFacade.fetchActivityHistory(10);

      expect(result.description).toBe('Eliminada por Sistema / Online');
    });

    it('INSERT incluye el detalle del registro creado (fix-107-m)', async () => {
      const rows = [
        {
          id: 4,
          action: 'INSERT',
          entity: 'student_documents',
          entity_id: 51,
          detail: 'Registrado: Foto (Carnet) de Patricia Aguilar',
          created_at: new Date().toISOString(),
          users: null,
        },
      ];
      const dashFacade = setupWithRows(rows);

      const [result] = await dashFacade.fetchActivityHistory(10);

      expect(result.description).toBe(
        'Sistema / Online registró: Foto (Carnet) de Patricia Aguilar',
      );
      expect(result.description).not.toBe('Registrado por Sistema / Online');
    });

    it('INSERT sin detalle cae al mensaje genérico como fallback', async () => {
      const rows = [
        {
          id: 5,
          action: 'INSERT',
          entity: 'enrollments',
          entity_id: 52,
          detail: null,
          created_at: new Date().toISOString(),
          users: { first_names: 'Ana', paternal_last_name: 'Soto' },
        },
      ];
      const dashFacade = setupWithRows(rows);

      const [result] = await dashFacade.fetchActivityHistory(10);

      expect(result.description).toBe('Registrada por Ana Soto');
    });

    it('usa el nombre de entidad correcto para tablas antes ausentes del diccionario', async () => {
      const rows = [
        {
          id: 3,
          action: 'DELETE',
          entity: 'vehicle_documents',
          entity_id: 7,
          detail: 'Eliminado: SOAP - AB-CD-12',
          created_at: new Date().toISOString(),
          users: { first_names: 'Ana', paternal_last_name: 'Soto' },
        },
      ];
      const dashFacade = setupWithRows(rows);

      const [result] = await dashFacade.fetchActivityHistory(10);

      expect(result.title).toBe('Documento de Vehículo eliminado');
      expect(result.title).not.toContain('Registro');
    });
  });
});
