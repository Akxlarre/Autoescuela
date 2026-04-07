import { TestBed } from '@angular/core/testing';
import { AsistenciaProfesionalFacade } from './asistencia-profesional.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';

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
            order: vi.fn().mockResolvedValue({ data: [], error: null })
          }),
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
            not: vi.fn().mockResolvedValue({ data: [], error: null })
          })
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        })
      })
    };

    TestBed.configureTestingModule({
      providers: [
        AsistenciaProfesionalFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: ConfirmModalService, useValue: confirmSpy }
      ]
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
