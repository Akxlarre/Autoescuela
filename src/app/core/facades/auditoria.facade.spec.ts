import { TestBed } from '@angular/core/testing';
import { AuditoriaFacade } from './auditoria.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { AuthFacade } from './auth.facade';

describe('AuditoriaFacade', () => {
  let facade: AuditoriaFacade;
  let supabaseSpy: any;
  let toastSpy: any;

  beforeEach(() => {
    supabaseSpy = { client: vi.fn() };
    toastSpy = { error: vi.fn(), success: vi.fn() };

    (supabaseSpy as any).client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
            }),
            not: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
          }),
        }),
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        AuditoriaFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: AuthFacade, useValue: { currentUser: vi.fn().mockReturnValue(null) } },
      ],
    });

    facade = TestBed.inject(AuditoriaFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should have initial empty state', () => {
    expect(facade.logs()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
    expect(facade.currentPage()).toBe(1);
  });

  it('setPage should update currentPage signal', () => {
    facade.setPage(2);
    expect(facade.currentPage()).toBe(2);
  });

  it('clearFilters should reset filters', () => {
    facade.setFilters({ accion: 'INSERT' });
    facade.clearFilters();
    expect(facade.filters().accion).toBeNull();
  });

  // fix-206-b (S18 de ASG-i-034): las 3 tablas que ahora se auditan tienen módulo propio.
  describe('módulos de las tablas auditadas en fix-206-b', () => {
    function chainableQuery(): any {
      const q: any = {};
      for (const m of ['select', 'eq', 'order', 'range', 'gte', 'lte', 'in', 'not']) {
        q[m] = vi.fn().mockReturnValue(q);
      }
      q.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null, count: 0 });
      return q;
    }

    it.each([
      ['Instructores', ['instructors', 'vehicle_assignments']],
      ['Liquidaciones', ['branch_payroll_config']],
    ])('filtrar por "%s" consulta %j', async (modulo, entities) => {
      const q = chainableQuery();
      supabaseSpy.client.from = vi.fn().mockReturnValue(q);
      facade.setFilters({ modulo });
      await facade.initialize();
      expect(q.in).toHaveBeenCalledWith('entity', entities);
    });
  });
});
