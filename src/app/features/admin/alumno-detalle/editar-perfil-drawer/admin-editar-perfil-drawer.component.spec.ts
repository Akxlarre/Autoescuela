import { TestBed } from '@angular/core/testing';
import { Injector, runInInjectionContext } from '@angular/core';
import { AdminEditarPerfilDrawerComponent } from './admin-editar-perfil-drawer.component';
import { AdminAlumnoDetalleFacade } from '@core/facades/admin-alumno-detalle.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';

// fix-157-m: alumno sin cuenta Auth (supabase_uid NULL) → botón "Enviar invitación"

describe('AdminEditarPerfilDrawerComponent — Enviar invitación (fix-157-m)', () => {
  function createComponent(hasAuthAccount: boolean) {
    const alumno = {
      userId: 55,
      firstName: 'Pedro',
      paternalLastName: 'Morales',
      maternalLastName: 'Torres',
      email: 'pedromoralespokegol@gmail.cl',
      telefono: '923434006',
      hasAuthAccount,
    };
    const facadeSpy = {
      alumno: () => alumno,
      enviarInvitacion: vi.fn().mockResolvedValue(undefined),
      actualizarPerfilAlumno: vi.fn().mockResolvedValue(undefined),
    };
    const layoutDrawerSpy = { close: vi.fn() };

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
    const component = runInInjectionContext(injector, () => new AdminEditarPerfilDrawerComponent());
    component.ngOnInit();
    return { component, facadeSpy };
  }

  it('el alumno sin cuenta Auth queda marcado como tal para que el template muestre el botón', () => {
    const { component } = createComponent(false);
    expect(component['facade'].alumno()!.hasAuthAccount).toBe(false);
  });

  it('un alumno con cuenta Auth ya creada no queda marcado para mostrar el botón', () => {
    const { component } = createComponent(true);
    expect(component['facade'].alumno()!.hasAuthAccount).toBe(true);
  });

  it('onEnviarInvitacion invoca facade.enviarInvitacion con el userId y el email del formulario', async () => {
    const { component, facadeSpy } = createComponent(false);

    await component['onEnviarInvitacion']();

    expect(facadeSpy.enviarInvitacion).toHaveBeenCalledWith(55, 'pedromoralespokegol@gmail.cl');
  });

  it('onEnviarInvitacion no llama al facade si el email del formulario es inválido', async () => {
    const { component, facadeSpy } = createComponent(false);
    component['form'].get('email')!.setValue('correo-invalido');

    await component['onEnviarInvitacion']();

    expect(facadeSpy.enviarInvitacion).not.toHaveBeenCalled();
  });

  it('onEnviarInvitacion propaga el error del facade como saveError', async () => {
    const { component, facadeSpy } = createComponent(false);
    facadeSpy.enviarInvitacion.mockRejectedValue(new Error('Error al enviar la invitación'));

    await component['onEnviarInvitacion']();

    expect(component['saveError']()).toBe('Error al enviar la invitación');
  });
});
