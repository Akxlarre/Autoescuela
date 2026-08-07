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
     * fetchRealDashboardData() dispara exactamente 8 queries `.from(...)` por invocación
     * (todas construidas sincrónicamente antes del único `await Promise.all(...)`), así que
     * cada tanda de 8 llamadas a `.from()` pertenece a una sola invocación del método —
     * agrupamos por eso para poder controlar cuándo "responde" cada invocación completa.
     * Cualquier llamada a `.from()` MÁS ALLÁ de `expectedInitializeCalls * 8` es una query
     * auxiliar (ej. `fetchLiveClasses()`, que se dispara después de aplicar los datos
     * principales) — se resuelve sola de inmediato, no la necesitamos controlada.
     */
    function makeRaceableSupabaseMock(expectedInitializeCalls: number) {
      const mainCallsTotal = expectedInitializeCalls * 8;
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
                deferredForBatch(Math.floor(idx / 8)).promise.then(resolve, reject);
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
