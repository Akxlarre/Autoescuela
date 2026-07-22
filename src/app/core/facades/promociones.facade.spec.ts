import { TestBed } from '@angular/core/testing';
import { PromocionesFacade } from './promociones.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';

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
