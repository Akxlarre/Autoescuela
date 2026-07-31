import { TestBed } from '@angular/core/testing';
import { Injector, runInInjectionContext } from '@angular/core';
import { AdminReagendarHorariosDrawerComponent } from './admin-reagendar-horarios-drawer.component';
import { AdminAlumnoDetalleFacade } from '@core/facades/admin-alumno-detalle.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';

// ─── fix-008-i: validación de razón de reagendamiento antes de guardar ────────

describe('AdminReagendarHorariosDrawerComponent.onSave — razón (fix-008-i)', () => {
  function createComponent() {
    const facadeSpy = {
      alumno: () => ({ enrollmentId: 100, nombre: 'X', curso: 'Clase B' }),
      reagendarSeleccion: () => [{ sessionId: 1, claseNumero: 1, origen: 'no_show' as const }],
      instructores: () => [],
      scheduleGrid: () => null,
      isLoadingSchedule: () => false,
      loadInstructores: vi.fn().mockResolvedValue(undefined),
      reagendarClasesPenalizadas: vi.fn().mockResolvedValue(undefined),
    };
    const layoutDrawerSpy = { close: vi.fn(), back: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        { provide: AdminAlumnoDetalleFacade, useValue: facadeSpy },
        { provide: LayoutDrawerFacadeService, useValue: layoutDrawerSpy },
        {
          provide: ErrorSanitizerService,
          useValue: { sanitize: (e: Error) => ({ message: e.message }) },
        },
      ],
    });
    const injector = TestBed.inject(Injector);
    const component = runInInjectionContext(
      injector,
      () => new AdminReagendarHorariosDrawerComponent(),
    );
    component['instructorId'].set(9);
    component['selectedSlotIds'].set(['2026-08-01T09:00:00']);
    return { component, facadeSpy, layoutDrawerSpy };
  }

  it('bloquea el guardado y muestra error si no se eligió razón', async () => {
    const { component, facadeSpy } = createComponent();

    await component['onSave']();

    expect(component['saveError']()).toBe('Selecciona una razón para el reagendamiento.');
    expect(facadeSpy.reagendarClasesPenalizadas).not.toHaveBeenCalled();
  });

  it('bloquea el guardado si razón es "otro" sin texto libre', async () => {
    const { component, facadeSpy } = createComponent();
    component['razon'].set('otro');

    await component['onSave']();

    expect(component['saveError']()).toBe('Especifica el motivo cuando eliges "Otro".');
    expect(facadeSpy.reagendarClasesPenalizadas).not.toHaveBeenCalled();
  });

  it('guarda con razón "otro" + texto libre y cierra el drawer', async () => {
    const { component, facadeSpy, layoutDrawerSpy } = createComponent();
    component['razon'].set('otro');
    component['razonOtro'].set('  Se rompió el vehículo  ');

    await component['onSave']();

    expect(facadeSpy.reagendarClasesPenalizadas).toHaveBeenCalledWith({
      enrollmentId: 100,
      instructorId: 9,
      selectedSlotIds: ['2026-08-01T09:00:00'],
      razon: 'otro',
      razonOtro: 'Se rompió el vehículo',
    });
    expect(layoutDrawerSpy.close).toHaveBeenCalled();
  });

  it('guarda con una razón cerrada (no "otro") y razonOtro va null', async () => {
    const { component, facadeSpy } = createComponent();
    component['razon'].set('medica');

    await component['onSave']();

    expect(facadeSpy.reagendarClasesPenalizadas).toHaveBeenCalledWith({
      enrollmentId: 100,
      instructorId: 9,
      selectedSlotIds: ['2026-08-01T09:00:00'],
      razon: 'medica',
      razonOtro: null,
    });
  });
});
