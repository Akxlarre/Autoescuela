import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { CoursesFacade } from './courses.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { BranchFacade } from '@core/facades/branch.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';

/**
 * Spec 0004 — CoursesFacade.
 * Lectura del catálogo operacional (`courses`) para alimentar el dropdown
 * del admin de Configuración Web. Branch-scoped según facades.md sec 7.
 */
describe('CoursesFacade', () => {
  let facade: CoursesFacade;
  let supabaseSpy: any;
  let branchFacadeSpy: any;
  let authFacadeSpy: any;
  let toastSpy: any;

  const mockCourses = [
    { id: 1, name: 'Clase B', license_class: 'B', base_price: 350000, active: true, branch_id: 1 },
    { id: 2, name: 'Clase B SENCE', license_class: 'B', base_price: 350000, active: true, branch_id: 1 },
  ];

  /**
   * Construye un mock encadenable de Supabase `.from().select().eq().eq()`
   * que termina resolviendo con `{ data, error }`.
   * Cada llamada a `.eq()` retorna el mismo nivel, soportando múltiples filtros.
   */
  function buildSupabaseChain(data: any, error: any = null) {
    const terminal = Promise.resolve({ data, error });
    const eqChain: any = { eq: vi.fn(), then: terminal.then.bind(terminal) };
    eqChain.eq.mockReturnValue(eqChain);
    const selectSpy = vi.fn().mockReturnValue(eqChain);
    return {
      from: vi.fn().mockReturnValue({ select: selectSpy }),
      _selectSpy: selectSpy,
      _eqChain: eqChain,
    };
  }

  beforeEach(() => {
    supabaseSpy = { client: {} };
    branchFacadeSpy = { selectedBranchId: signal<number | null>(1) };
    authFacadeSpy = {
      currentUser: signal<{ role: string; branchId: number | null } | null>({
        role: 'admin',
        branchId: null,
      }),
    };
    toastSpy = { success: vi.fn(), error: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        CoursesFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: BranchFacade, useValue: branchFacadeSpy },
        { provide: AuthFacade, useValue: authFacadeSpy },
        { provide: ToastService, useValue: toastSpy },
      ],
    });

    facade = TestBed.inject(CoursesFacade);
  });

  it('debe crearse correctamente', () => {
    expect(facade).toBeTruthy();
  });

  it('estado inicial: arrays vacíos y flags en false', () => {
    expect(facade.availableCourses()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
    expect(facade.error()).toBeNull();
  });

  describe('loadAvailableCourses(branchId)', () => {
    it('AC1: filtra por branch_id Y active=true, retorna courses del catálogo', async () => {
      const chain = buildSupabaseChain(mockCourses);
      supabaseSpy.client = chain;

      await facade.loadAvailableCourses(1);

      expect(supabaseSpy.client.from).toHaveBeenCalledWith('courses');
      expect(chain._selectSpy).toHaveBeenCalledWith('id, name, license_class, base_price, active');
      // Dos .eq encadenados: branch_id + active
      expect(chain._eqChain.eq).toHaveBeenCalledWith('branch_id', 1);
      expect(chain._eqChain.eq).toHaveBeenCalledWith('active', true);

      expect(facade.availableCourses()).toEqual(mockCourses);
      expect(facade.isLoading()).toBe(false);
      expect(facade.error()).toBeNull();
    });

    it('AC-E4: branch sin cursos activos retorna []', async () => {
      const chain = buildSupabaseChain([]);
      supabaseSpy.client = chain;

      await facade.loadAvailableCourses(999);

      expect(facade.availableCourses()).toEqual([]);
      expect(facade.isLoading()).toBe(false);
      expect(facade.error()).toBeNull();
    });

    it('setea error y dispara toast cuando Supabase falla', async () => {
      const chain = buildSupabaseChain(null, { message: 'PG connection refused' });
      supabaseSpy.client = chain;

      await facade.loadAvailableCourses(1);

      expect(facade.availableCourses()).toEqual([]);
      expect(facade.isLoading()).toBe(false);
      expect(facade.error()).toBe('PG connection refused');
      expect(toastSpy.error).toHaveBeenCalledWith(
        'Error al cargar cursos del catálogo',
        'PG connection refused',
      );
    });

    it('SWR: segunda llamada con el mismo branchId NO prende skeleton', async () => {
      const chain = buildSupabaseChain(mockCourses);
      supabaseSpy.client = chain;

      await facade.loadAvailableCourses(1);
      expect(facade.isLoading()).toBe(false);

      const reloadPromise = facade.loadAvailableCourses(1);
      // En re-entry del mismo branch isLoading nunca se pone true (refresh silent)
      expect(facade.isLoading()).toBe(false);
      await reloadPromise;
      expect(facade.isLoading()).toBe(false);
    });

    it('SWR: cambio de branchId invalida cache y vuelve a prender skeleton', async () => {
      const chain1 = buildSupabaseChain(mockCourses);
      supabaseSpy.client = chain1;
      await facade.loadAvailableCourses(1);

      const chain2 = buildSupabaseChain([
        { id: 3, name: 'Profesional A2', license_class: 'A2', base_price: 800000, active: true, branch_id: 2 },
      ]);
      supabaseSpy.client = chain2;

      const loadPromise = facade.loadAvailableCourses(2);
      expect(facade.isLoading()).toBe(true);
      await loadPromise;

      expect(facade.availableCourses().length).toBe(1);
      expect(facade.availableCourses()[0].id).toBe(3);
    });

    it('primera carga muestra skeleton (isLoading=true antes de resolver)', async () => {
      let resolveQuery: (value: any) => void;
      const pendingQuery = new Promise((resolve) => {
        resolveQuery = resolve;
      });
      const eqChain: any = { eq: vi.fn(), then: pendingQuery.then.bind(pendingQuery) };
      eqChain.eq.mockReturnValue(eqChain);
      supabaseSpy.client = {
        from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue(eqChain) }),
      };

      const loadPromise = facade.loadAvailableCourses(1);
      expect(facade.isLoading()).toBe(true);

      resolveQuery!({ data: mockCourses, error: null });
      await loadPromise;
      expect(facade.isLoading()).toBe(false);
    });
  });
});
