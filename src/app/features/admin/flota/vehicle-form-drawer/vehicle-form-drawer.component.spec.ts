import { TestBed } from '@angular/core/testing';
import { VehicleFormDrawerComponent } from './vehicle-form-drawer.component';
import { FlotaFacade } from '@core/facades/flota.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ToastService } from '@core/services/ui/toast.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';

describe('VehicleFormDrawerComponent', () => {
  let component: VehicleFormDrawerComponent;
  let flotaFacadeSpy: any;

  function setup(opts?: { selectedVehicleId?: number | null; vehicles?: unknown[] }): void {
    flotaFacadeSpy = {
      selectedVehicleId: vi.fn().mockReturnValue(opts?.selectedVehicleId ?? null),
      vehicles: vi.fn().mockReturnValue(opts?.vehicles ?? []),
      updateVehicle: vi.fn().mockResolvedValue(undefined),
      createVehicle: vi.fn().mockResolvedValue(null),
      upsertVehicleDocument: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        VehicleFormDrawerComponent,
        { provide: FlotaFacade, useValue: flotaFacadeSpy },
        { provide: BranchFacade, useValue: { branches: vi.fn().mockReturnValue([]) } },
        {
          provide: AuthFacade,
          useValue: { currentUser: vi.fn().mockReturnValue({ role: 'admin' }) },
        },
        { provide: LayoutDrawerFacadeService, useValue: { close: vi.fn() } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        {
          provide: ErrorSanitizerService,
          useValue: { sanitize: vi.fn().mockReturnValue({ message: 'Error sanitizado' }) },
        },
      ],
    });

    component = TestBed.inject(VehicleFormDrawerComponent);
  }

  it('should be created', () => {
    setup();
    expect(component).toBeTruthy();
  });

  it('deshabilita el selector de sede cuando el vehículo tiene instructor activo asignado', () => {
    setup({
      selectedVehicleId: 1,
      vehicles: [{ id: 1, instructorId: 42, instructorName: 'Juan Pérez' }],
    });

    expect(component.sedeDisabledReason()).toContain('Juan Pérez');
  });

  it('no restringe el selector de sede cuando el vehículo no tiene instructor activo', () => {
    setup({
      selectedVehicleId: 1,
      vehicles: [{ id: 1, instructorId: null, instructorName: null }],
    });

    expect(component.sedeDisabledReason()).toBeNull();
  });

  it('no restringe el selector de sede al crear un vehículo nuevo', () => {
    setup({ selectedVehicleId: null, vehicles: [] });

    expect(component.sedeDisabledReason()).toBeNull();
  });
});

// ─── fix-154-m: staged docs al crear un vehículo (patrón admin-instructor-crear-drawer) ───────
describe('VehicleFormDrawerComponent — staged docs al crear (fix-154-m)', () => {
  let component: VehicleFormDrawerComponent;
  let flotaFacadeSpy: any;

  function setup(): void {
    flotaFacadeSpy = {
      selectedVehicleId: vi.fn().mockReturnValue(null),
      vehicles: vi.fn().mockReturnValue([]),
      updateVehicle: vi.fn().mockResolvedValue(undefined),
      createVehicle: vi.fn().mockResolvedValue(99),
      upsertVehicleDocument: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        VehicleFormDrawerComponent,
        { provide: FlotaFacade, useValue: flotaFacadeSpy },
        { provide: BranchFacade, useValue: { branches: vi.fn().mockReturnValue([]) } },
        {
          provide: AuthFacade,
          useValue: { currentUser: vi.fn().mockReturnValue({ role: 'admin' }) },
        },
        { provide: LayoutDrawerFacadeService, useValue: { close: vi.fn() } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        {
          provide: ErrorSanitizerService,
          useValue: { sanitize: vi.fn().mockReturnValue({ message: 'Error sanitizado' }) },
        },
      ],
    });

    component = TestBed.inject(VehicleFormDrawerComponent);
  }

  it('addStagedDoc no agrega nada sin tipo o sin fecha de vencimiento', () => {
    setup();
    component.pendingDocExpiry.set('2099-01-01');
    component.addStagedDoc();
    expect(component.stagedDocs()).toEqual([]);

    component.pendingDocType.set('soap');
    component.pendingDocExpiry.set('');
    component.addStagedDoc();
    expect(component.stagedDocs()).toEqual([]);
  });

  it('addStagedDoc agrega el doc y lo saca de availableDocTypes; removeStagedDoc lo devuelve', () => {
    setup();
    component.pendingDocType.set('soap');
    component.pendingDocExpiry.set('2099-01-01');
    component.addStagedDoc();

    expect(component.stagedDocs()).toEqual([
      { type: 'soap', expiryDate: '2099-01-01', file: null },
    ]);
    expect(component.availableDocTypes().some((t) => t.value === 'soap')).toBe(false);

    component.removeStagedDoc('soap');
    expect(component.stagedDocs()).toEqual([]);
    expect(component.availableDocTypes().some((t) => t.value === 'soap')).toBe(true);
  });

  it('al crear el vehículo, sube cada doc staged con el vehicleId nuevo', async () => {
    setup();
    component.vehicleForm.patchValue({
      license_plate: 'AB1234',
      brand: 'Nissan',
      model: 'Versa',
      branch_id: 1,
    });
    component.pendingDocType.set('soap');
    component.pendingDocExpiry.set('2099-01-01');
    component.addStagedDoc();

    await component.onSubmit();

    expect(flotaFacadeSpy.createVehicle).toHaveBeenCalled();
    expect(flotaFacadeSpy.upsertVehicleDocument).toHaveBeenCalledWith({
      vehicleId: 99,
      type: 'soap',
      expiryDate: '2099-01-01',
      file: null,
    });
  });

  it('si upsertVehicleDocument falla para un doc, no bloquea el resto ni el cierre del drawer', async () => {
    setup();
    flotaFacadeSpy.upsertVehicleDocument.mockRejectedValueOnce(new Error('boom'));
    component.vehicleForm.patchValue({
      license_plate: 'AB1234',
      brand: 'Nissan',
      model: 'Versa',
      branch_id: 1,
    });
    component.pendingDocType.set('soap');
    component.pendingDocExpiry.set('2099-01-01');
    component.addStagedDoc();
    component.pendingDocType.set('insurance');
    component.pendingDocExpiry.set('2099-01-01');
    component.addStagedDoc();

    await expect(component.onSubmit()).resolves.not.toThrow();
    expect(flotaFacadeSpy.upsertVehicleDocument).toHaveBeenCalledTimes(2);
  });
});
