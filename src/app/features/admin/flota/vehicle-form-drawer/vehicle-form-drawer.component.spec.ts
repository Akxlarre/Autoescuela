import { TestBed } from '@angular/core/testing';
import { VehicleFormDrawerComponent } from './vehicle-form-drawer.component';
import { FlotaFacade } from '@core/facades/flota.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';

describe('VehicleFormDrawerComponent', () => {
  let component: VehicleFormDrawerComponent;
  let flotaFacadeSpy: any;

  function setup(opts?: { selectedVehicleId?: number | null; vehicles?: unknown[] }): void {
    flotaFacadeSpy = {
      selectedVehicleId: vi.fn().mockReturnValue(opts?.selectedVehicleId ?? null),
      vehicles: vi.fn().mockReturnValue(opts?.vehicles ?? []),
      updateVehicle: vi.fn().mockResolvedValue(undefined),
      createVehicle: vi.fn().mockResolvedValue(undefined),
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
