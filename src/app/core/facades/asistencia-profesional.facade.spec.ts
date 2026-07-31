import { TestBed } from '@angular/core/testing';
import { AsistenciaProfesionalFacade } from './asistencia-profesional.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { AuthFacade } from './auth.facade';
import { BranchFacade } from './branch.facade';

describe('AsistenciaProfesionalFacade', () => {
  let facade: AsistenciaProfesionalFacade;
  let supabaseSpy: any;
  let toastSpy: any;
  let confirmSpy: any;

  beforeEach(() => {
    supabaseSpy = { client: vi.fn() };
    toastSpy = { success: vi.fn(), error: vi.fn() };
    confirmSpy = { confirm: vi.fn() };

    // Mock supabase client
    (supabaseSpy as any).client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
            not: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        AsistenciaProfesionalFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: ConfirmModalService, useValue: confirmSpy },
        { provide: AuthFacade, useValue: { currentUser: vi.fn().mockReturnValue(null) } },
        { provide: BranchFacade, useValue: { selectedBranchId: () => null } },
      ],
    });

    facade = TestBed.inject(AsistenciaProfesionalFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  describe('UI Wrappers', () => {
    it('should call confirmModal.confirm on confirm', async () => {
      const config = { title: 'Test', message: 'Msg' };
      confirmSpy.confirm.mockResolvedValue(true);
      const result = await facade.confirm(config);
      expect(confirmSpy.confirm).toHaveBeenCalledWith(config);
      expect(result).toBe(true);
    });
  });

  describe('Navigation', () => {
    it('nextWeek should increment weekOffset', () => {
      facade.nextWeek();
      expect(facade.weekOffset()).toBe(1);
    });

    it('prevWeek should decrement weekOffset', () => {
      facade.prevWeek();
      expect(facade.weekOffset()).toBe(-1);
    });

    it('goToCurrentWeek should reset weekOffset to 0', () => {
      facade.nextWeek();
      facade.goToCurrentWeek();
      expect(facade.weekOffset()).toBe(0);
    });
  });

  it('clearSelectedSesion should clear states', () => {
    (facade as any)._selectedSesion.set({ id: 1 } as any);
    (facade as any)._asistenciaAlumnos.set([{ id: 1 }] as any);
    facade.clearSelectedSesion();
    expect(facade.selectedSesion()).toBeNull();
    expect(facade.asistenciaAlumnos()).toEqual([]);
  });
});

/** Builder encadenable (select/in/order/eq devuelven `this`) y thenable, para `professional_promotions`. */
function createPromocionesQueryMock() {
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    then: (resolve: any, reject: any) =>
      Promise.resolve({ data: [], error: null }).then(resolve, reject),
  };
  return { client: { from: vi.fn().mockReturnValue(builder) }, builder };
}

// fix-090-m — AC2: scope de sede en carga de promociones para Asistencia Profesional
describe('AsistenciaProfesionalFacade — scope de sede (fix-090)', () => {
  it('AC2 — loadPromociones() filtra por branch_id cuando hay una sede activa', async () => {
    const mockSupabase = createPromocionesQueryMock();
    TestBed.configureTestingModule({
      providers: [
        AsistenciaProfesionalFacade,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: ConfirmModalService, useValue: { confirm: vi.fn() } },
        { provide: AuthFacade, useValue: { currentUser: () => ({ role: 'admin' }) } },
        { provide: BranchFacade, useValue: { selectedBranchId: () => 7 } },
      ],
    });
    const facade = TestBed.inject(AsistenciaProfesionalFacade);

    await facade.initialize();

    expect(mockSupabase.builder.eq).toHaveBeenCalledWith('branch_id', 7);
  });

  it('AC2 — loadPromociones() no filtra cuando el admin ve "todas las sedes" (null)', async () => {
    const mockSupabase = createPromocionesQueryMock();
    TestBed.configureTestingModule({
      providers: [
        AsistenciaProfesionalFacade,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: ConfirmModalService, useValue: { confirm: vi.fn() } },
        { provide: AuthFacade, useValue: { currentUser: () => ({ role: 'admin' }) } },
        { provide: BranchFacade, useValue: { selectedBranchId: () => null } },
      ],
    });
    const facade = TestBed.inject(AsistenciaProfesionalFacade);

    await facade.initialize();

    expect(mockSupabase.builder.eq).not.toHaveBeenCalled();
  });
});
