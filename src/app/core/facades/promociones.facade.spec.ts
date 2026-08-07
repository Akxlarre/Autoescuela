import { TestBed } from '@angular/core/testing';
import { PromocionesFacade } from './promociones.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';

describe('PromocionesFacade', () => {
  let facade: PromocionesFacade;
  let supabaseSpy: any;
  let toastSpy: any;

  beforeEach(() => {
    supabaseSpy = { client: vi.fn() };
    toastSpy = { error: vi.fn(), success: vi.fn(), info: vi.fn() };

    (supabaseSpy as any).client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
          in: vi.fn().mockReturnValue({
            not: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { id: 1 }, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        PromocionesFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: AuthFacade, useValue: { currentUser: () => ({ role: 'admin' }) } },
        { provide: BranchFacade, useValue: { selectedBranchId: () => null } },
      ],
    });

    facade = TestBed.inject(PromocionesFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should have initial empty state', () => {
    expect(facade.promociones()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
    expect(facade.totalPromociones()).toBe(0);
  });

  it('selectPromocion should update selectedPromocion signal', () => {
    const promo = { id: 1, cursos: [] } as any;
    facade.selectPromocion(promo);
    expect(facade.selectedPromocion()).toBe(promo);
  });
});

/** Builder por tabla: encadenable (select/update/eq/order/not devuelven `this`) y thenable. */
function createTableMock(tables: Record<string, { data?: unknown; error?: unknown }>) {
  const builders = new Map<string, any>();
  const from = vi.fn().mockImplementation((table: string) => {
    if (!builders.has(table)) {
      const cfg = tables[table] ?? {};
      const res = { data: cfg.data ?? [], error: cfg.error ?? null };
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue(res),
        then: (resolve: any, reject: any) => Promise.resolve(res).then(resolve, reject),
      };
      builders.set(table, builder);
    }
    return builders.get(table);
  });
  return { client: { from }, _builders: builders };
}

// fix-053-m — AC3: propagación del ID numérico MTT a promotion_courses
describe('PromocionesFacade — editarPromocion propaga code a promotion_courses', () => {
  it('AC3 — código numérico válido propaga "{code}.{sufijo}" a cada curso', async () => {
    const mockSupabase = createTableMock({
      professional_promotions: { data: [] },
      promotion_courses: {
        data: [
          { id: 10, courses: { license_class: 'A2' } },
          { id: 11, courses: { license_class: 'A4' } },
        ],
      },
    });
    const toast = { error: vi.fn(), success: vi.fn(), info: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        PromocionesFacade,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ToastService, useValue: toast },
        { provide: AuthFacade, useValue: { currentUser: () => ({ role: 'admin' }) } },
        { provide: BranchFacade, useValue: { selectedBranchId: () => null } },
      ],
    });
    const facade = TestBed.inject(PromocionesFacade);

    const ok = await facade.editarPromocion(1, {
      name: 'Promo 156',
      code: '156',
      status: 'planned',
    });

    expect(ok).toBe(true);
    const pcBuilder = mockSupabase._builders.get('promotion_courses');
    expect(pcBuilder.update).toHaveBeenCalledWith({ code: '156.2' });
    expect(pcBuilder.update).toHaveBeenCalledWith({ code: '156.4' });
  });

  it('AC2 — código no-numérico NO propaga a promotion_courses', async () => {
    const mockSupabase = createTableMock({
      professional_promotions: { data: [] },
      promotion_courses: { data: [{ id: 10, courses: { license_class: 'A2' } }] },
    });
    const toast = { error: vi.fn(), success: vi.fn(), info: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        PromocionesFacade,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ToastService, useValue: toast },
        { provide: AuthFacade, useValue: { currentUser: () => ({ role: 'admin' }) } },
        { provide: BranchFacade, useValue: { selectedBranchId: () => null } },
      ],
    });
    const facade = TestBed.inject(PromocionesFacade);

    await facade.editarPromocion(1, {
      name: 'Promo X',
      code: 'PROM-2026-03',
      status: 'planned',
    });

    const pcBuilder = mockSupabase._builders.get('promotion_courses');
    expect(pcBuilder?.update ?? vi.fn()).not.toHaveBeenCalled();
  });
});

// 0002-m — AC6: recuperación de feriados en end_date (crearPromocion + previewEndDate)
describe('PromocionesFacade — recuperación de feriados en end_date (0002-m)', () => {
  const START = '2026-08-03'; // lunes
  const HOLIDAY = '2026-08-13'; // jueves, semana 2 → 1 feriado ⇒ end_date = start + 35

  function stubFeriados(fechas: string[]) {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => fechas.map((fecha) => ({ fecha })),
      }),
    );
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('crearPromocion() con feriados en el rango → end_date del INSERT refleja la extensión, no start+33', async () => {
    stubFeriados([HOLIDAY]);
    const mockSupabase = createTableMock({
      professional_promotions: { data: { id: 5 } },
      promotion_courses: { data: [] },
    });
    const toast = { error: vi.fn(), success: vi.fn(), info: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        PromocionesFacade,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ToastService, useValue: toast },
        { provide: AuthFacade, useValue: { currentUser: () => ({ role: 'admin' }) } },
        { provide: BranchFacade, useValue: { selectedBranchId: () => null } },
      ],
    });
    const facade = TestBed.inject(PromocionesFacade);

    await facade.crearPromocion({
      name: 'Promo Nueva',
      startDate: START,
      endDate: '2026-09-05', // valor "fijo" que el fix debe IGNORAR
      cursos: [],
    });

    const promoBuilder = mockSupabase._builders.get('professional_promotions');
    expect(promoBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ end_date: '2026-09-07' }),
    );
  });

  it('previewEndDate(startDate) retorna el mismo valor que calcularía crearPromocion() para ese startDate', async () => {
    stubFeriados([HOLIDAY]);
    const mockSupabase = createTableMock({
      professional_promotions: { data: { id: 5 } },
      promotion_courses: { data: [] },
    });
    TestBed.configureTestingModule({
      providers: [
        PromocionesFacade,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ToastService, useValue: { error: vi.fn(), success: vi.fn(), info: vi.fn() } },
        { provide: AuthFacade, useValue: { currentUser: () => ({ role: 'admin' }) } },
        { provide: BranchFacade, useValue: { selectedBranchId: () => null } },
      ],
    });
    const facade = TestBed.inject(PromocionesFacade);

    const preview = await facade.previewEndDate(START);
    expect(preview).toBe('2026-09-07');

    await facade.crearPromocion({
      name: 'Promo Nueva',
      startDate: START,
      endDate: 'irrelevante',
      cursos: [],
    });
    const promoBuilder = mockSupabase._builders.get('professional_promotions');
    expect(promoBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ end_date: preview }),
    );
  });
});

// fix-138-m — fetch de feriados falla → señal visible en vez de asumir 0 feriados en silencio
describe('PromocionesFacade — fallo del fetch de feriados es visible (fix-138)', () => {
  const START = '2026-08-17'; // lunes

  function makeFacade() {
    const mockSupabase = createTableMock({
      professional_promotions: { data: { id: 5 } },
      promotion_courses: { data: [] },
    });
    TestBed.configureTestingModule({
      providers: [
        PromocionesFacade,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ToastService, useValue: { error: vi.fn(), success: vi.fn(), info: vi.fn() } },
        { provide: AuthFacade, useValue: { currentUser: () => ({ role: 'admin' }) } },
        { provide: BranchFacade, useValue: { selectedBranchId: () => null } },
      ],
    });
    return TestBed.inject(PromocionesFacade);
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetch rechaza (ej. ERR_NAME_NOT_RESOLVED) → previewEndDate() sigue devolviendo start+33, pero holidaysCheckFailed() queda en true', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const facade = makeFacade();

    expect(facade.holidaysCheckFailed()).toBe(false);
    const preview = await facade.previewEndDate(START);

    expect(preview).toBe('2026-09-19'); // start+33, sin feriados
    expect(facade.holidaysCheckFailed()).toBe(true);
  });

  it('fetch exitoso → holidaysCheckFailed() permanece en false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    const facade = makeFacade();

    await facade.previewEndDate(START);

    expect(facade.holidaysCheckFailed()).toBe(false);
  });

  it('fetch falla en previewEndDate() pero luego se recupera en crearPromocion() → la señal vuelve a false', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal('fetch', fetchMock);
    const facade = makeFacade();

    await facade.previewEndDate(START);
    expect(facade.holidaysCheckFailed()).toBe(true);

    await facade.crearPromocion({ name: 'Promo Nueva', startDate: START, endDate: '', cursos: [] });
    expect(facade.holidaysCheckFailed()).toBe(false);
  });
});

// fix-139-m — apis.digital.gob.cl inalcanzable → fallback a api.boostr.cl antes de rendirse
describe('PromocionesFacade — fallback a fuente alternativa de feriados (fix-139)', () => {
  const START = '2026-08-03'; // lunes
  const HOLIDAY = '2026-08-13'; // jueves, semana 2 → 1 feriado ⇒ end_date = start + 35

  function makeFacade() {
    const mockSupabase = createTableMock({
      professional_promotions: { data: { id: 5 } },
      promotion_courses: { data: [] },
    });
    TestBed.configureTestingModule({
      providers: [
        PromocionesFacade,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ToastService, useValue: { error: vi.fn(), success: vi.fn(), info: vi.fn() } },
        { provide: AuthFacade, useValue: { currentUser: () => ({ role: 'admin' }) } },
        { provide: BranchFacade, useValue: { selectedBranchId: () => null } },
      ],
    });
    return TestBed.inject(PromocionesFacade);
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('gob.cl falla (DNS) pero boostr.cl responde con el feriado real → end_date lo refleja y holidaysCheckFailed() queda en false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('apis.digital.gob.cl')) {
          return Promise.reject(new TypeError('Failed to fetch'));
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({ data: [{ date: HOLIDAY, title: 'Feriado de prueba' }] }),
        });
      }),
    );
    const facade = makeFacade();

    const preview = await facade.previewEndDate(START);

    expect(preview).toBe('2026-09-07'); // start+35: feriado recuperado vía boostr, no start+33
    expect(facade.holidaysCheckFailed()).toBe(false);
  });

  it('ambas fuentes fallan → holidaysCheckFailed() en true (último recurso, comportamiento fix-138 preservado)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const facade = makeFacade();

    const preview = await facade.previewEndDate(START);

    expect(preview).toBe('2026-09-05'); // start+33, sin feriados
    expect(facade.holidaysCheckFailed()).toBe(true);
  });
});

// fix-090-m — AC1 + AC3: scope de sede en listado y creación de promociones
describe('PromocionesFacade — scope de sede (fix-090)', () => {
  it('AC1 — fetchData() filtra por branch_id cuando hay una sede activa', async () => {
    const mockSupabase = createTableMock({ professional_promotions: { data: [] } });
    const toast = { error: vi.fn(), success: vi.fn(), info: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        PromocionesFacade,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ToastService, useValue: toast },
        { provide: AuthFacade, useValue: { currentUser: () => ({ role: 'admin' }) } },
        { provide: BranchFacade, useValue: { selectedBranchId: () => 7 } },
      ],
    });
    const facade = TestBed.inject(PromocionesFacade);

    await facade.initialize();

    const promoBuilder = mockSupabase._builders.get('professional_promotions');
    expect(promoBuilder.eq).toHaveBeenCalledWith('branch_id', 7);
  });

  it('AC1 — fetchData() no filtra cuando el admin ve "todas las sedes" (null)', async () => {
    const mockSupabase = createTableMock({ professional_promotions: { data: [] } });
    const toast = { error: vi.fn(), success: vi.fn(), info: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        PromocionesFacade,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ToastService, useValue: toast },
        { provide: AuthFacade, useValue: { currentUser: () => ({ role: 'admin' }) } },
        { provide: BranchFacade, useValue: { selectedBranchId: () => null } },
      ],
    });
    const facade = TestBed.inject(PromocionesFacade);

    await facade.initialize();

    const promoBuilder = mockSupabase._builders.get('professional_promotions');
    expect(promoBuilder.eq).not.toHaveBeenCalled();
  });

  it('AC3 — crearPromocion() graba la sede activa, no un branch_id hardcodeado', async () => {
    const mockSupabase = createTableMock({
      professional_promotions: { data: { id: 5 } },
      promotion_courses: { data: [] },
    });
    const toast = { error: vi.fn(), success: vi.fn(), info: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        PromocionesFacade,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ToastService, useValue: toast },
        { provide: AuthFacade, useValue: { currentUser: () => ({ role: 'admin' }) } },
        { provide: BranchFacade, useValue: { selectedBranchId: () => 7 } },
      ],
    });
    const facade = TestBed.inject(PromocionesFacade);

    await facade.crearPromocion({
      name: 'Promo Nueva',
      startDate: '2026-08-01',
      endDate: '2026-08-30',
      cursos: [],
    });

    const promoBuilder = mockSupabase._builders.get('professional_promotions');
    expect(promoBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ branch_id: 7 }));
  });
});
