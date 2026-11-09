import { TestBed } from '@angular/core/testing';
import { Injector, runInInjectionContext } from '@angular/core';
import { AdminReprogramarClaseDrawerComponent } from './admin-reprogramar-clase-drawer.component';
import { AdminAlumnoDetalleFacade } from '@core/facades/admin-alumno-detalle.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';

// ─── fix-244-b: doble guardado (I16) y mensaje del rechazo de la BD (I15) ─────

describe('AdminReprogramarClaseDrawerComponent.onConfirm — fix-244-b', () => {
  function createComponent() {
    const facadeSpy = {
      reprogramarTarget: () => ({ sessionId: 55, enrollmentId: 100, claseNumero: 3 }),
      instructores: () => [],
      scheduleGrid: () => null,
      isLoadingSchedule: () => false,
      isLoadingInstructores: () => false,
      loadInstructores: vi.fn().mockResolvedValue(undefined),
      loadScheduleGrid: vi.fn().mockResolvedValue(undefined),
      reprogramarClase: vi.fn().mockResolvedValue(undefined),
    };
    const layoutDrawerSpy = { close: vi.fn(), back: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: AdminAlumnoDetalleFacade, useValue: facadeSpy },
        { provide: LayoutDrawerFacadeService, useValue: layoutDrawerSpy },
        {
          provide: ErrorSanitizerService,
          useValue: { sanitize: (e: { message: string }) => ({ message: e.message }) },
        },
      ],
    });
    const injector = TestBed.inject(Injector);
    const component = runInInjectionContext(
      injector,
      () => new AdminReprogramarClaseDrawerComponent(),
    );
    component['selectedInstructorId'].set(9);
    component['selectedSlotId'].set('2026-11-10T09:00:00-03:00');
    component['razon'].set('medica');
    return { component, facadeSpy, layoutDrawerSpy };
  }

  it('I16: un doble clic en Confirmar llama una sola vez al facade', async () => {
    const { component, facadeSpy } = createComponent();
    let resolver!: () => void;
    facadeSpy.reprogramarClase.mockReturnValue(new Promise<void>((r) => (resolver = r)));

    const primero = component['onConfirm']();
    const segundo = component['onConfirm']();
    resolver();
    await Promise.all([primero, segundo]);

    expect(facadeSpy.reprogramarClase).toHaveBeenCalledTimes(1);
  });

  it('I15: un error plano de Supabase (no Error) muestra su mensaje y no cierra', async () => {
    const { component, facadeSpy, layoutDrawerSpy } = createComponent();
    facadeSpy.reprogramarClase.mockRejectedValue({
      message: 'El instructor ya tiene una clase agendada que se solapa',
      code: 'P0001',
    });

    await component['onConfirm']();

    expect(component['saveError']()).toBe(
      'El instructor ya tiene una clase agendada que se solapa',
    );
    expect(layoutDrawerSpy.close).not.toHaveBeenCalled();
    expect(component['isSaving']()).toBe(false);
  });

  it('guarda una vez y cierra el panel', async () => {
    const { component, facadeSpy, layoutDrawerSpy } = createComponent();

    await component['onConfirm']();

    expect(facadeSpy.reprogramarClase).toHaveBeenCalledTimes(1);
    expect(layoutDrawerSpy.close).toHaveBeenCalled();
  });
});
