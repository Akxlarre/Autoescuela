import { TestBed } from '@angular/core/testing';
import { RegistrarEgresoDrawerComponent } from './registrar-egreso-drawer.component';
import { CuadraturaFacade } from '@core/facades/cuadratura.facade';
import { FlotaFacade } from '@core/facades/flota.facade';
import { AnticiposFacade } from '@core/facades/anticipos.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { signal } from '@angular/core';

// ─── fix-006-i: vehicleOptions() + preset de tipo consumido al montar ─────────
// ─── fix-243-m: campos condicionales por tipo + ruteo de anticipo ────────────

interface CreateOpts {
  vehicles?: any[];
  preset?: string | null;
  instructores?: { id: number; nombre: string }[];
  branches?: { id: number; name: string }[];
  selectedBranchId?: number | null;
  user?: any;
}

function createComponent(opts: CreateOpts = {}) {
  const {
    vehicles = [],
    preset = null,
    instructores = [],
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

  TestBed.configureTestingModule({
    providers: [
      { provide: CuadraturaFacade, useValue: { egresoTipoPreset, registrarEgreso, refresh } },
      { provide: FlotaFacade, useValue: { vehicles: () => vehicles, initialize: vi.fn() } },
      {
        provide: AnticiposFacade,
        useValue: { instructores: () => instructores, initialize: vi.fn(), registrarAnticipo },
      },
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

  const fixture = TestBed.createComponent(RegistrarEgresoDrawerComponent);
  return {
    component: fixture.componentInstance as any,
    registrarEgreso,
    registrarAnticipo,
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

  it('combustible: envía branchId derivado del vehículo al facade', async () => {
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
});
