import { TestBed } from '@angular/core/testing';
import { AsistenciaProfesionalFacade } from './asistencia-profesional.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';

describe('AsistenciaProfesionalFacade', () => {
  let facade: AsistenciaProfesionalFacade;
  let supabaseSpy: jasmine.SpyObj<SupabaseService>;
  let toastSpy: jasmine.SpyObj<ToastService>;
  let confirmSpy: jasmine.SpyObj<ConfirmModalService>;

  beforeEach(() => {
    supabaseSpy = jasmine.createSpyObj('SupabaseService', ['client']);
    toastSpy = jasmine.createSpyObj('ToastService', ['success', 'error']);
    confirmSpy = jasmine.createSpyObj('ConfirmModalService', ['confirm']);

    // Mock supabase client
    (supabaseSpy as any).client = {
      from: jasmine.createSpy('from').and.returnValue({
        select: jasmine.createSpy('select').and.returnValue({
          in: jasmine.createSpy('in').and.returnValue({
            order: jasmine.createSpy('order').and.resolveTo({ data: [], error: null })
          }),
          eq: jasmine.createSpy('eq').and.returnValue({
            order: jasmine.createSpy('order').and.resolveTo({ data: [], error: null }),
            not: jasmine.createSpy('not').and.resolveTo({ data: [], error: null })
          })
        }),
        update: jasmine.createSpy('update').and.returnValue({
          eq: jasmine.createSpy('eq').and.resolveTo({ error: null })
        }),
        insert: jasmine.createSpy('insert').and.resolveTo({ error: null }),
        delete: jasmine.createSpy('delete').and.returnValue({
          eq: jasmine.createSpy('eq').and.resolveTo({ error: null })
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
      confirmSpy.confirm.and.resolveTo(true);
      const result = await facade.confirm(config);
      expect(confirmSpy.confirm).toHaveBeenCalledWith(config);
      expect(result).toBeTrue();
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
