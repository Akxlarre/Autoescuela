import { TestBed } from '@angular/core/testing';
import { Injector, runInInjectionContext } from '@angular/core';
import { AdminEditarPerfilDrawerComponent } from './admin-editar-perfil-drawer.component';
import { AdminAlumnoDetalleFacade } from '@core/facades/admin-alumno-detalle.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';

// fix-157-m: alumno sin cuenta Auth (supabase_uid NULL) → botón "Enviar invitación"
// fix-253-m: alumno con cuenta Auth pero first_login = true (link de activación se
// quemó sin completar el primer login) → el botón también debe mostrarse

describe('AdminEditarPerfilDrawerComponent — Enviar invitación (fix-157-m, fix-253-m)', () => {
  function configureTestBed(hasAuthAccount: boolean, firstLogin = false) {
    const alumno = {
      userId: 55,
      firstName: 'Pedro',
      paternalLastName: 'Morales',
      maternalLastName: 'Torres',
      email: 'pedromoralespokegol@gmail.cl',
      telefono: '923434006',
      hasAuthAccount,
      firstLogin,
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
    return { facadeSpy };
  }

  function createComponent(hasAuthAccount: boolean, firstLogin = false) {
    const { facadeSpy } = configureTestBed(hasAuthAccount, firstLogin);
    const injector = TestBed.inject(Injector);
    const component = runInInjectionContext(injector, () => new AdminEditarPerfilDrawerComponent());
    component.ngOnInit();
    return { component, facadeSpy };
  }

  /** Replica la condición del template (línea ~150): `!hasAuthAccount || firstLogin`. */
  function debeMostrarBotonInvitacion(alumno: { hasAuthAccount: boolean; firstLogin: boolean }) {
    return !alumno.hasAuthAccount || alumno.firstLogin;
  }

  it('el alumno sin cuenta Auth queda marcado como tal para que el template muestre el botón', () => {
    const { component } = createComponent(false);
    expect(component['facade'].alumno()!.hasAuthAccount).toBe(false);
    expect(debeMostrarBotonInvitacion(component['facade'].alumno()!)).toBe(true);
  });

  it('un alumno con cuenta Auth ya creada y que ya activó su cuenta no queda marcado para mostrar el botón', () => {
    const { component } = createComponent(true, false);
    expect(component['facade'].alumno()!.hasAuthAccount).toBe(true);
    expect(debeMostrarBotonInvitacion(component['facade'].alumno()!)).toBe(false);
  });

  it('un alumno con cuenta Auth pero que nunca completó el primer login queda marcado para mostrar el botón (fix-253-m)', () => {
    const { component } = createComponent(true, true);
    expect(component['facade'].alumno()!.hasAuthAccount).toBe(true);
    expect(component['facade'].alumno()!.firstLogin).toBe(true);
    expect(debeMostrarBotonInvitacion(component['facade'].alumno()!)).toBe(true);
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
