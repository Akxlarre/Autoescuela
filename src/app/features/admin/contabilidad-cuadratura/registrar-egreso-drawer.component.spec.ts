import { TestBed } from '@angular/core/testing';
import { RegistrarEgresoDrawerComponent } from './registrar-egreso-drawer.component';
import { CuadraturaFacade } from '@core/facades/cuadratura.facade';
import { FlotaFacade } from '@core/facades/flota.facade';
import { AnticiposFacade } from '@core/facades/anticipos.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import {
  ChangeDetectorRef,
  Component,
  ContentChild,
  NO_ERRORS_SCHEMA,
  signal,
  TemplateRef,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';
import { IconComponent } from '@shared/components/icon/icon.component';

/** Muestra el contenido de inmediato: el loader real espera 350 ms por la animación del drawer. */
@Component({
  selector: 'app-drawer-content-loader',
  imports: [NgTemplateOutlet],
  template: `<ng-container [ngTemplateOutlet]="content ?? null" />`,
})
class LoaderInmediatoComponent {
  // Decorador y no contentChild(): los tests compilan en JIT, que no ve las queries con signals.
  @ContentChild('content') content?: TemplateRef<unknown>;
}

// ─── fix-006-i: vehicleOptions() + preset de tipo consumido al montar ─────────
// ─── fix-243-m: campos condicionales por tipo + ruteo de anticipo ────────────

interface CreateOpts {
  vehicles?: any[];
  preset?: string | null;
  instructores?: { id: number; nombre: string }[];
  branches?: { id: number; name: string }[];
  selectedBranchId?: number | null;
  user?: any;
  anticiposError?: string | null;
}

function createComponent(opts: CreateOpts = {}) {
  const {
    vehicles = [],
    preset = null,
    instructores = [],
    anticiposError = null,
    branches = [
      { id: 1, name: 'Sede Centro' },
      { id: 2, name: 'Sede Norte' },
    ],
    selectedBranchId = null,
    user = { role: 'admin', branchId: 1, canAccessBothBranches: false },
  } = opts;

  const egresoTipoPreset = signal<string | null>(preset);
  const registrarEgreso = vi.fn().mockResolvedValue(true);
  const registrarAnticipo = vi.fn().mockResolvedValue(true);
  const refresh = vi.fn().mockResolvedValue(undefined);
  const reintentar = vi.fn().mockResolvedValue(undefined);
  const instructoresSig = signal(instructores);
  const errorSig = signal<string | null>(anticiposError);
  const isLoadingSig = signal(false);
  const selectedBranchSig = signal<number | null>(selectedBranchId);
  const initializeAnticipos = vi.fn().mockResolvedValue(undefined);

  TestBed.configureTestingModule({
    providers: [
      { provide: CuadraturaFacade, useValue: { egresoTipoPreset, registrarEgreso, refresh } },
      { provide: FlotaFacade, useValue: { vehicles: () => vehicles, initialize: vi.fn() } },
      {
        provide: AnticiposFacade,
        useValue: {
          instructores: instructoresSig,
          error: errorSig,
          isLoading: isLoadingSig,
          initialize: initializeAnticipos,
          reintentar,
          registrarAnticipo,
        },
      },
      {
        provide: BranchFacade,
        useValue: { branches: () => branches, selectedBranchId: selectedBranchSig },
      },
      { provide: AuthFacade, useValue: { currentUser: () => user } },
      { provide: LayoutDrawerFacadeService, useValue: { close: vi.fn() } },
      {
        provide: ErrorSanitizerService,
        useValue: { sanitize: (e: Error) => ({ message: e.message }) },
      },
    ],
  });
  TestBed.overrideComponent(RegistrarEgresoDrawerComponent, {
    remove: { imports: [DrawerContentLoaderComponent, IconComponent] },
    add: { imports: [LoaderInmediatoComponent], schemas: [NO_ERRORS_SCHEMA] },
  });

  const fixture = TestBed.createComponent(RegistrarEgresoDrawerComponent);
  return {
    fixture,
    component: fixture.componentInstance as any,
    registrarEgreso,
    registrarAnticipo,
    refresh,
    reintentar,
    instructoresSig,
    errorSig,
    isLoadingSig,
    selectedBranchSig,
    initializeAnticipos,
  };
}

describe('RegistrarEgresoDrawerComponent', () => {
  it('vehicleOptions() muestra el instructor asignado cuando existe', () => {
    const { component } = createComponent({
      vehicles: [
        {
          id: 1,
          brand: 'Toyota',
          model: 'Yaris',
          licensePlate: 'ABC-123',
          instructorName: 'Juan Pérez',
        },
      ],
    });
    expect(component['vehicleOptions']()[0].label).toBe(
      'Toyota Yaris - ABC-123 (Asignado a: Juan Pérez)',
    );
  });

  it('vehicleOptions() muestra "Sin instructor asignado" cuando instructorName es null', () => {
    const { component } = createComponent({
      vehicles: [
        { id: 2, brand: 'Nissan', model: 'Versa', licensePlate: 'XYZ-987', instructorName: null },
      ],
    });
    expect(component['vehicleOptions']()[0].label).toBe(
      'Nissan Versa - XYZ-987 (Sin instructor asignado)',
    );
  });

  it('precarga el tipo "combustible" desde egresoTipoPreset() y lo consume una sola vez', () => {
    const { component } = createComponent({ preset: 'combustible' });
    expect(component['form'].get('tipo')?.value).toBe('combustible');
  });

  it('isCombustible() es true cuando el tipo seleccionado es "combustible"', () => {
    const { component } = createComponent({ preset: 'combustible' });
    expect(component['isCombustible']()).toBe(true);
  });

  it('isCombustible() es false para otros tipos', () => {
    const { component } = createComponent();
    component['form'].patchValue({ tipo: 'gasto' });
    expect(component['isCombustible']()).toBe(false);
  });

  // ─── AC-2: Combustible exige vehículo ──────────────────────────────────────
  it('combustible: el form es inválido sin vehículo y válido al elegir uno', () => {
    const { component } = createComponent({
      preset: 'combustible',
      vehicles: [{ id: 5, brand: 'Kia', model: 'Rio', licensePlate: 'AA-11', branchId: 2 }],
    });
    component['form'].patchValue({ monto: 20_000, descripcion: 'Carga bencina' });
    expect(component['form'].get('vehiculoId')?.hasError('required')).toBe(true);

    component['form'].patchValue({ vehiculoId: 5 });
    expect(component['form'].valid).toBe(true);
    // No pide sede: el vehículo tiene branchId.
    expect(component['showSedeField']()).toBe(false);
  });

  it('combustible con vehículo legacy sin sede: aparece el campo Sede obligatorio', () => {
    const { component } = createComponent({
      preset: 'combustible',
      vehicles: [{ id: 7, brand: 'Kia', model: 'Rio', licensePlate: 'BB-22', branchId: null }],
    });
    component['form'].patchValue({ monto: 20_000, descripcion: 'Carga bencina', vehiculoId: 7 });
    expect(component['showSedeField']()).toBe(true);
    expect(component['form'].get('branchId')?.hasError('required')).toBe(true);
  });

  it('C07 (fix-082-i): combustible de un auto de otra sede queda en la caja de quien registra', async () => {
    const { component, registrarEgreso } = createComponent({
      preset: 'combustible',
      user: { role: 'secretary', branchId: 1, canAccessBothBranches: false },
      vehicles: [{ id: 5, brand: 'Kia', model: 'Rio', licensePlate: 'AA-11', branchId: 2 }],
    });
    component['form'].patchValue({ monto: 20_000, descripcion: 'Carga bencina', vehiculoId: 5 });
    await component['onSubmit']();
    expect(registrarEgreso).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'combustible', vehiculoId: 5, branchId: 1 }),
    );
  });

  it('combustible con el admin en "Todas las sedes": usa la sede del vehículo', async () => {
    const { component, registrarEgreso } = createComponent({
      preset: 'combustible',
      vehicles: [{ id: 5, brand: 'Kia', model: 'Rio', licensePlate: 'AA-11', branchId: 2 }],
    });
    component['form'].patchValue({ monto: 20_000, descripcion: 'Carga bencina', vehiculoId: 5 });
    await component['onSubmit']();
    expect(registrarEgreso).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'combustible', vehiculoId: 5, branchId: 2 }),
    );
  });

  it('O03 (hotfix-084-b): combustible de un vehículo "Ambas" queda en la caja de quien registra', async () => {
    const { component, registrarEgreso } = createComponent({
      preset: 'combustible',
      user: { role: 'secretary', branchId: 2, canAccessBothBranches: false },
      vehicles: [
        {
          id: 5,
          brand: 'Kia',
          model: 'Rio',
          licensePlate: 'AA-11',
          branchId: 1,
          bothBranches: true,
        },
      ],
    });
    component['form'].patchValue({ monto: 20_000, descripcion: 'Carga bencina', vehiculoId: 5 });
    await component['onSubmit']();
    expect(registrarEgreso).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'combustible', vehiculoId: 5, branchId: 2 }),
    );
  });

  // ─── AC-4: Gastos Varios exige sede ───────────────────────────────────────
  it('gasto con admin en "Todas las sedes": el form es inválido hasta elegir sede', () => {
    const { component } = createComponent({ selectedBranchId: null });
    component['form'].patchValue({ tipo: 'gasto', monto: 10_000, descripcion: 'Insumos' });
    expect(component['showSedeField']()).toBe(true);
    expect(component['form'].get('branchId')?.hasError('required')).toBe(true);

    component['form'].patchValue({ branchId: 1 });
    expect(component['form'].valid).toBe(true);
  });

  it('gasto: precarga la sede activa del admin cuando hay una seleccionada', () => {
    const { component } = createComponent({ selectedBranchId: 2 });
    component['form'].patchValue({ tipo: 'gasto' });
    expect(component['form'].get('branchId')?.value).toBe(2);
  });

  it('gasto: secretaria no ve el campo Sede y el facade recibe su sede', async () => {
    const { component, registrarEgreso } = createComponent({
      user: { role: 'secretary', branchId: 3, canAccessBothBranches: false },
    });
    component['form'].patchValue({ tipo: 'gasto', monto: 5_000, descripcion: 'Café' });
    expect(component['showSedeField']()).toBe(false);
    await component['onSubmit']();
    expect(registrarEgreso).toHaveBeenCalledWith(expect.objectContaining({ branchId: 3 }));
  });

  // ─── AC-3: Anticipo exige instructor y se enruta a AnticiposFacade ─────────
  it('anticipo: exige instructor y NO llama a CuadraturaFacade.registrarEgreso', async () => {
    const { component, registrarEgreso, registrarAnticipo, refresh } = createComponent({
      preset: 'anticipo',
      instructores: [{ id: 9, nombre: 'Ana Díaz' }],
    });
    component['form'].patchValue({ monto: 15_000, descripcion: 'Anticipo sueldo' });
    expect(component['form'].get('instructorId')?.hasError('required')).toBe(true);

    component['form'].patchValue({ instructorId: 9, metodoPago: 'transferencia' });
    await component['onSubmit']();

    expect(registrarEgreso).not.toHaveBeenCalled();
    expect(registrarAnticipo).toHaveBeenCalledWith(
      expect.objectContaining({ instructorId: 9, amount: 15_000, paymentMethod: 'transferencia' }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  // ─── spec 0060-b (T1.5): sin instructores por un error, el selector no parece vacío ───
  describe('instructores que no cargaron (spec 0060-b)', () => {
    const ERROR = 'No se pudieron cargar los anticipos.';
    const SELECTOR = '[data-llm-description^="Selector del instructor"]';
    const REINTENTAR = '[data-llm-action="reintentar-instructores-egreso"]';
    const GUARDAR = '[data-llm-action="guardar-egreso-cuadratura"]';

    function render(opts: CreateOpts) {
      const ctx = createComponent(opts);
      ctx.fixture.detectChanges();
      return { ...ctx, host: ctx.fixture.nativeElement as HTMLElement };
    }

    /** El form no es un signal: con OnPush hay que marcar la vista para que se repinte. */
    function repintar(fixture: ReturnType<typeof createComponent>['fixture']) {
      fixture.debugElement.injector.get(ChangeDetectorRef).markForCheck();
      fixture.detectChanges();
    }

    it('anticipo con error: muestra el aviso con "Reintentar" en vez del selector', () => {
      const { host } = render({ preset: 'anticipo', anticiposError: ERROR });

      expect(host.querySelector(SELECTOR)).toBeNull();
      const alerta = host.querySelector('[role="alert"]');
      expect(alerta?.textContent).toContain('No se pudo cargar la lista de instructores');
      expect(alerta?.querySelector(REINTENTAR)?.textContent).toContain('Reintentar');
    });

    it('"Reintentar" llama a reintentar() de AnticiposFacade', () => {
      const { host, reintentar } = render({ preset: 'anticipo', anticiposError: ERROR });

      (host.querySelector(REINTENTAR) as HTMLButtonElement).click();

      expect(reintentar).toHaveBeenCalledTimes(1);
    });

    it('"Reintentar" se deshabilita mientras carga', () => {
      const { host, isLoadingSig, fixture } = render({
        preset: 'anticipo',
        anticiposError: ERROR,
      });

      isLoadingSig.set(true);
      repintar(fixture);

      expect((host.querySelector(REINTENTAR) as HTMLButtonElement).disabled).toBe(true);
    });

    it('anticipo con error: no guarda aunque hubiera un instructor elegido', async () => {
      const { host, component, fixture, registrarAnticipo } = render({
        preset: 'anticipo',
        anticiposError: ERROR,
      });
      component['form'].patchValue({ monto: 15_000, descripcion: 'Anticipo', instructorId: 9 });
      repintar(fixture);

      expect((host.querySelector(GUARDAR) as HTMLButtonElement).disabled).toBe(true);
      await component['onSubmit']();
      expect(registrarAnticipo).not.toHaveBeenCalled();
    });

    it('si el reintento sale bien vuelve el selector y se puede guardar', async () => {
      const { host, component, fixture, errorSig, instructoresSig, registrarAnticipo } = render({
        preset: 'anticipo',
        anticiposError: ERROR,
      });

      errorSig.set(null);
      instructoresSig.set([{ id: 9, nombre: 'Ana Díaz' }]);
      component['form'].patchValue({ monto: 15_000, descripcion: 'Anticipo', instructorId: 9 });
      repintar(fixture);

      expect(host.querySelector(SELECTOR)).not.toBeNull();
      expect(host.querySelector(REINTENTAR)).toBeNull();
      await component['onSubmit']();
      expect(registrarAnticipo).toHaveBeenCalledTimes(1);
    });

    it('gasto con anticipos caídos: sin aviso y se guarda normalmente', async () => {
      const { host, component, fixture, registrarEgreso } = render({
        anticiposError: ERROR,
        selectedBranchId: 1,
      });
      component['form'].patchValue({ tipo: 'gasto', monto: 5_000, descripcion: 'Insumos' });
      repintar(fixture);

      expect(host.querySelector(REINTENTAR)).toBeNull();
      expect((host.querySelector(GUARDAR) as HTMLButtonElement).disabled).toBe(false);
      await component['onSubmit']();
      expect(registrarEgreso).toHaveBeenCalledTimes(1);
    });

    it('combustible con anticipos caídos: sin aviso y se guarda normalmente', async () => {
      const { host, component, fixture, registrarEgreso } = render({
        preset: 'combustible',
        anticiposError: ERROR,
        vehicles: [{ id: 5, brand: 'Kia', model: 'Rio', licensePlate: 'AA-11', branchId: 2 }],
      });
      component['form'].patchValue({ monto: 20_000, descripcion: 'Bencina', vehiculoId: 5 });
      repintar(fixture);

      expect(host.querySelector(REINTENTAR)).toBeNull();
      expect((host.querySelector(GUARDAR) as HTMLButtonElement).disabled).toBe(false);
      await component['onSubmit']();
      expect(registrarEgreso).toHaveBeenCalledTimes(1);
    });

    it('anticipo sin error y sin instructores no muestra un error falso', () => {
      const { host } = render({ preset: 'anticipo' });

      expect(host.querySelector(SELECTOR)).not.toBeNull();
      expect(host.querySelector(REINTENTAR)).toBeNull();
    });
  });

  // ─── hotfix-189-b: un instructor de otra sede no sobrevive al cambio de sede ───
  describe('cambio de sede con el drawer abierto (hotfix-189-b)', () => {
    const ERROR = 'No se pudieron cargar los anticipos.';
    const GUARDAR = '[data-llm-action="guardar-egreso-cuadratura"]';
    const ANA = { id: 9, nombre: 'Ana Díaz' };
    const BETO = { id: 10, nombre: 'Beto Soto' };

    function anticipoAbierto(opts: CreateOpts = {}) {
      const ctx = createComponent({ preset: 'anticipo', instructores: [ANA], ...opts });
      ctx.fixture.detectChanges();
      ctx.component['form'].patchValue({
        monto: 15_000,
        descripcion: 'Anticipo',
        instructorId: ANA.id,
      });
      ctx.fixture.debugElement.injector.get(ChangeDetectorRef).markForCheck();
      ctx.fixture.detectChanges();
      const host = ctx.fixture.nativeElement as HTMLElement;
      return {
        ...ctx,
        host,
        instructorId: () => ctx.component['form'].controls.instructorId.value,
        guardar: () => host.querySelector(GUARDAR) as HTMLButtonElement,
        empiezaCarga: () => {
          ctx.isLoadingSig.set(true);
          ctx.instructoresSig.set([]);
          ctx.fixture.detectChanges();
        },
        terminaCarga: (lista: { id: number; nombre: string }[]) => {
          ctx.instructoresSig.set(lista);
          ctx.isLoadingSig.set(false);
          ctx.errorSig.set(null);
          ctx.fixture.detectChanges();
        },
      };
    }

    it('al cambiar de sede pide la lista de la sede nueva', () => {
      const { fixture, selectedBranchSig, initializeAnticipos } = anticipoAbierto({
        selectedBranchId: 1,
      });
      expect(initializeAnticipos).toHaveBeenCalledTimes(1);

      selectedBranchSig.set(2);
      fixture.detectChanges();

      expect(initializeAnticipos).toHaveBeenCalledTimes(2);
    });

    it('no vuelve a pedir la lista si la sede no cambió', () => {
      const { fixture, initializeAnticipos } = anticipoAbierto({ selectedBranchId: 1 });

      fixture.detectChanges();

      expect(initializeAnticipos).toHaveBeenCalledTimes(1);
    });

    it('una secretaria anclada a su sede no recarga por el selector', () => {
      const { fixture, selectedBranchSig, initializeAnticipos } = anticipoAbierto({
        user: { role: 'secretary', branchId: 1, canAccessBothBranches: false },
        selectedBranchId: 1,
      });

      selectedBranchSig.set(2);
      fixture.detectChanges();

      expect(initializeAnticipos).toHaveBeenCalledTimes(1);
    });

    it('mientras carga conserva el valor, pero no se puede guardar', async () => {
      const { component, instructorId, guardar, empiezaCarga, registrarAnticipo } =
        anticipoAbierto();

      empiezaCarga();

      expect(instructorId()).toBe(ANA.id);
      expect(guardar().disabled).toBe(true);
      await component['onSubmit']();
      expect(registrarAnticipo).not.toHaveBeenCalled();
    });

    it('si el instructor no está en la lista nueva limpia el campo y lo avisa', async () => {
      const ctx = anticipoAbierto();
      ctx.empiezaCarga();

      ctx.terminaCarga([BETO]);

      expect(ctx.instructorId()).toBeNull();
      expect(ctx.host.textContent).toContain('Seleccione un instructor.');
      expect(ctx.guardar().disabled).toBe(true);
      await ctx.component['onSubmit']();
      expect(ctx.registrarAnticipo).not.toHaveBeenCalled();
    });

    it('si sigue en la lista lo conserva y se puede guardar', async () => {
      const ctx = anticipoAbierto();
      ctx.empiezaCarga();

      ctx.terminaCarga([BETO, ANA]);

      expect(ctx.instructorId()).toBe(ANA.id);
      expect(ctx.guardar().disabled).toBe(false);
      await ctx.component['onSubmit']();
      expect(ctx.registrarAnticipo).toHaveBeenCalledWith(
        expect.objectContaining({ instructorId: ANA.id }),
      );
    });

    it('con error mantiene el valor y, tras un reintento exitoso, aplica la regla', () => {
      const ctx = anticipoAbierto();
      ctx.empiezaCarga();
      ctx.isLoadingSig.set(false);
      ctx.errorSig.set(ERROR);
      ctx.fixture.detectChanges();

      expect(ctx.instructorId()).toBe(ANA.id);
      expect(ctx.guardar().disabled).toBe(true);

      ctx.terminaCarga([BETO]);

      expect(ctx.instructorId()).toBeNull();
    });

    it('un refresco silencioso que saca al instructor también deshabilita el guardado', () => {
      const ctx = anticipoAbierto();

      ctx.instructoresSig.set([BETO]);
      ctx.fixture.detectChanges();

      expect(ctx.instructorId()).toBeNull();
      expect(ctx.guardar().disabled).toBe(true);
    });

    it('onSubmit lo comprueba aunque la vista todavía no se haya actualizado', async () => {
      const ctx = anticipoAbierto();

      ctx.instructoresSig.set([BETO]);
      await ctx.component['onSubmit']();

      expect(ctx.registrarAnticipo).not.toHaveBeenCalled();
      expect(ctx.instructorId()).toBeNull();
    });

    it('gasto: una carga de instructores en curso no bloquea ni toca el formulario', async () => {
      const ctx = anticipoAbierto({ selectedBranchId: 1 });
      ctx.component['form'].patchValue({ tipo: 'gasto', descripcion: 'Insumos' });
      ctx.fixture.debugElement.injector.get(ChangeDetectorRef).markForCheck();
      ctx.fixture.detectChanges();

      ctx.empiezaCarga();

      expect(ctx.guardar().disabled).toBe(false);
      await ctx.component['onSubmit']();
      expect(ctx.registrarEgreso).toHaveBeenCalledTimes(1);
      expect(ctx.registrarAnticipo).not.toHaveBeenCalled();
    });

    it('combustible: una lista nueva no bloquea el guardado', async () => {
      const ctx = anticipoAbierto({
        vehicles: [{ id: 5, brand: 'Kia', model: 'Rio', licensePlate: 'AA-11', branchId: 2 }],
      });
      ctx.component['form'].patchValue({ tipo: 'combustible', vehiculoId: 5 });
      ctx.fixture.debugElement.injector.get(ChangeDetectorRef).markForCheck();
      ctx.fixture.detectChanges();

      ctx.terminaCarga([BETO]);

      expect(ctx.guardar().disabled).toBe(false);
      await ctx.component['onSubmit']();
      expect(ctx.registrarEgreso).toHaveBeenCalledTimes(1);
    });

    it('al volver al tipo anticipo limpia un instructor que ya no está en la lista', () => {
      const ctx = anticipoAbierto({ selectedBranchId: 1 });
      ctx.component['form'].patchValue({ tipo: 'gasto' });
      ctx.fixture.detectChanges();
      ctx.terminaCarga([BETO]);
      expect(ctx.instructorId()).toBe(ANA.id);

      ctx.component['form'].patchValue({ tipo: 'anticipo' });
      ctx.fixture.detectChanges();

      expect(ctx.instructorId()).toBeNull();
    });
  });
});
