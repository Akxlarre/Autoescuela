import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CorreoEscuelasDrawerComponent } from './correo-escuelas-drawer.component';
import { BranchEmailFacade } from '@core/facades/branch-email.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';

// spec 0061-b — configuración de correo por escuela (AC11, AC12, AC-E6).
describe('CorreoEscuelasDrawerComponent', () => {
  const CONFIG = {
    branchId: 1,
    branchName: 'Autoescuela Chillán',
    senderName: 'Autoescuela Chillán',
    senderAddress: 'autoescuela-chillan@gestordeautoescuelas.cl',
    replyTo: 'otecchillan@gmail.com',
    phone: '+56 42 232 7800',
  };
  let facade: any;

  function setup() {
    facade = {
      configs: signal([CONFIG]),
      isLoading: signal(false),
      isSaving: signal(false),
      isSendingTest: signal(false),
      error: signal(null),
      load: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(true),
      enviarPrueba: vi.fn().mockResolvedValue(true),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: BranchEmailFacade, useValue: facade },
        { provide: LayoutDrawerFacadeService, useValue: { back: vi.fn(), close: vi.fn() } },
      ],
    });
    return TestBed.runInInjectionContext(() => new CorreoEscuelasDrawerComponent()) as any;
  }

  beforeEach(() => TestBed.resetTestingModule());

  it('carga la configuración al abrirse', () => {
    setup();
    expect(facade.load).toHaveBeenCalled();
  });

  it('sin cambios no está sucio y el formulario muestra lo guardado', () => {
    const c = setup();
    expect(c.isDirty(1)).toBe(false);
    expect(c.formFor(1).replyTo).toBe('otecchillan@gmail.com');
  });

  it('un cambio lo deja sucio y deshabilita la prueba hasta guardar (AC12 usa lo guardado)', () => {
    const c = setup();
    c.setField(1, 'replyTo', 'nuevo@gmail.com');
    expect(c.isDirty(1)).toBe(true);
    expect(c.canSendTest(1)).toBe(false);
  });

  it('AC-E6: muestra el error de dominio y no deja guardar', () => {
    const c = setup();
    c.setField(1, 'senderAddress', 'escuela@gmail.com');
    expect(c.errorsFor(1).senderAddress).toContain('@gestordeautoescuelas.cl');
    expect(c.canSave(1)).toBe(false);
  });

  it('guardar llama a la facade con el formulario y limpia el borrador', async () => {
    const c = setup();
    c.setField(1, 'replyTo', 'nuevo@gmail.com');
    await c.save(1);
    expect(facade.save).toHaveBeenCalledWith(1, { ...c.formFor(1), replyTo: 'nuevo@gmail.com' });
    expect(c.isDirty(1)).toBe(false);
  });

  it('enviar prueba llama a la facade con la escuela', async () => {
    const c = setup();
    expect(c.canSendTest(1)).toBe(true);
    await c.sendTest(1);
    expect(facade.enviarPrueba).toHaveBeenCalledWith(1);
  });
});
