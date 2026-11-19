import { TestBed } from '@angular/core/testing';
import { RegistrarEgresoDrawerComponent } from './registrar-egreso-drawer.component';
import { CuadraturaFacade } from '@core/facades/cuadratura.facade';
import { FlotaFacade } from '@core/facades/flota.facade';
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
// ─── fix-243-m: campos condicionales por tipo ─────────────────────────────────
// ─── spec 0012-i AC15: sin tipo "Anticipo" (el anticipo ya no es de la caja) ──

interface CreateOpts {
  vehicles?: any[];
  preset?: string | null;
  branches?: { id: number; name: string }[];
  selectedBranchId?: number | null;
  user?: any;
}

function createComponent(opts: CreateOpts = {}) {
  const {
    vehicles = [],
    preset = null,
    branches = [
      { id: 1, name: 'Sede Centro' },
      { id: 2, name: 'Sede Norte' },
    ],
    selectedBranchId = null,
    user = { role: 'admin', branchId: 1, canAccessBothBranches: false },
  } = opts;

  const egresoTipoPreset = signal<string | null>(preset);
  const registrarEgreso = vi.fn().mockResolvedValue(true);
  const refresh = vi.fn().mockResolvedValue(undefined);

  TestBed.configureTestingModule({
    providers: [
      { provide: CuadraturaFacade, useValue: { egresoTipoPreset, registrarEgreso, refresh } },
      { provide: FlotaFacade, useValue: { vehicles: () => vehicles, initialize: vi.fn() } },
      {
        provide: BranchFacade,
        useValue: { branches: () => branches, selectedBranchId: () => selectedBranchId },
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
    refresh,
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

  // ─── spec 0012-i AC15 ─────────────────────────────────────────────────────
  describe('sin tipo "Anticipo" (spec 0012-i AC15)', () => {
    it('el selector de tipo solo ofrece Combustible y Gastos Varios', () => {
      const { component } = createComponent();
      expect(component.tipoOptions.map((o: { value: string }) => o.value)).toEqual([
        'combustible',
        'gasto',
      ]);
    });

    it('el formulario no tiene campo de instructor', () => {
      const { component, fixture } = createComponent();
      fixture.detectChanges();
      expect(component['form'].get('instructorId')).toBeNull();
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('[inputId="egr-instructor"]'),
      ).toBeNull();
    });

    it('un gasto se guarda por CuadraturaFacade como siempre', async () => {
      const { component, registrarEgreso } = createComponent({ selectedBranchId: 1 });
      component['form'].patchValue({ tipo: 'gasto', monto: 5_000, descripcion: 'Insumos' });
      await component['onSubmit']();
      expect(registrarEgreso).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'gasto', monto: 5_000, branchId: 1 }),
      );
    });
  });
});
