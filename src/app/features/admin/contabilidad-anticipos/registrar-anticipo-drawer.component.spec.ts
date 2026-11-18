import { TestBed } from '@angular/core/testing';
import { ChangeDetectorRef, NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { RegistrarAnticipoDrawerComponent } from './registrar-anticipo-drawer.component';
import { AnticiposFacade } from '@core/facades/anticipos.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { DateInputComponent } from '@shared/components/date-input/date-input.component';

// ─── spec 0060-b (T1.5): sin instructores por un error, el selector no parece vacío ───
describe('RegistrarAnticipoDrawerComponent — instructores que no cargaron (spec 0060-b)', () => {
  const ERROR = 'No se pudieron cargar los anticipos.';
  const SELECTOR = '[data-llm-description^="Selector del instructor"]';
  const REINTENTAR = '[data-llm-action="reintentar-instructores-anticipo"]';
  const GUARDAR = '[data-llm-action="save-anticipo"]';

  function setup(
    estado: {
      error?: string | null;
      refreshFailed?: boolean;
      instructores?: { id: number; nombre: string }[];
      preseleccionado?: number | null;
    } = {},
  ) {
    const facade = {
      instructores: signal(estado.instructores ?? []),
      error: signal(estado.error ?? null),
      refreshFailed: signal(estado.refreshFailed ?? false),
      isLoading: signal(false),
      isSaving: signal(false),
      selectedInstructorId: signal(estado.preseleccionado ?? null),
      registrarAnticipo: vi.fn().mockResolvedValue(true),
      reintentar: vi.fn().mockResolvedValue(undefined),
    };
    const drawer = { close: vi.fn() };
    TestBed.configureTestingModule({
      imports: [RegistrarAnticipoDrawerComponent],
      providers: [
        { provide: AnticiposFacade, useValue: facade },
        { provide: LayoutDrawerFacadeService, useValue: drawer },
      ],
    }).overrideComponent(RegistrarAnticipoDrawerComponent, {
      remove: { imports: [IconComponent, DateInputComponent] },
      add: { schemas: [NO_ERRORS_SCHEMA] },
    });
    const fixture = TestBed.createComponent(RegistrarAnticipoDrawerComponent);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const cmp = fixture.componentInstance as any;
    const completar = () => {
      cmp.form.patchValue({ instructorId: 7, amount: 50000 });
      // El form no es un signal: con OnPush hay que marcar la vista para que se repinte.
      fixture.debugElement.injector.get(ChangeDetectorRef).markForCheck();
      fixture.detectChanges();
    };
    return { facade, drawer, fixture, host, cmp, completar };
  }

  it('con error de carga muestra el aviso con "Reintentar" en vez del selector', () => {
    const { host } = setup({ error: ERROR });

    expect(host.querySelector(SELECTOR)).toBeNull();
    const alerta = host.querySelector('[role="alert"]');
    expect(alerta?.textContent).toContain('No se pudo cargar la lista de instructores');
    expect(alerta?.querySelector(REINTENTAR)?.textContent).toContain('Reintentar');
  });

  it('"Reintentar" llama a reintentar() del facade', () => {
    const { host, facade } = setup({ error: ERROR });

    (host.querySelector(REINTENTAR) as HTMLButtonElement).click();

    expect(facade.reintentar).toHaveBeenCalledTimes(1);
  });

  it('"Reintentar" se deshabilita mientras carga', () => {
    const { host, facade, fixture } = setup({ error: ERROR });

    facade.isLoading.set(true);
    fixture.detectChanges();

    expect((host.querySelector(REINTENTAR) as HTMLButtonElement).disabled).toBe(true);
  });

  it('con error no se puede guardar, aunque hubiera un instructor elegido', async () => {
    const { host, facade, cmp, completar } = setup({ error: ERROR, preseleccionado: 7 });
    completar();

    expect((host.querySelector(GUARDAR) as HTMLButtonElement).disabled).toBe(true);
    await cmp.onSubmit();
    expect(facade.registrarAnticipo).not.toHaveBeenCalled();
  });

  it('si el reintento sale bien vuelve el selector y se puede guardar', async () => {
    const { host, facade, fixture, cmp, completar, drawer } = setup({ error: ERROR });

    facade.error.set(null);
    facade.instructores.set([{ id: 7, nombre: 'Ana Díaz' }]);
    fixture.detectChanges();
    completar();

    expect(host.querySelector(SELECTOR)).not.toBeNull();
    expect(host.querySelector(REINTENTAR)).toBeNull();
    await cmp.onSubmit();
    expect(facade.registrarAnticipo).toHaveBeenCalledTimes(1);
    expect(drawer.close).toHaveBeenCalled();
  });

  it('caso B: con la lista anterior se sigue pudiendo registrar', async () => {
    const { host, facade, cmp, completar } = setup({
      refreshFailed: true,
      instructores: [{ id: 7, nombre: 'Ana Díaz' }],
    });
    completar();

    expect(host.querySelector(SELECTOR)).not.toBeNull();
    expect(host.querySelector(REINTENTAR)).toBeNull();
    expect((host.querySelector(GUARDAR) as HTMLButtonElement).disabled).toBe(false);
    await cmp.onSubmit();
    expect(facade.registrarAnticipo).toHaveBeenCalledTimes(1);
  });

  it('sin error y sin instructores no muestra un error falso', () => {
    const { host } = setup();

    expect(host.querySelector(SELECTOR)).not.toBeNull();
    expect(host.querySelector(REINTENTAR)).toBeNull();
  });
});
