import { TestBed } from '@angular/core/testing';
import { FlotaFacade } from './flota.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from './auth.facade';
import { BranchFacade } from './branch.facade';

describe('FlotaFacade', () => {
  let service: FlotaFacade;
  let supabaseMock: any;

  beforeEach(() => {
    supabaseMock = {
      client: {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      },
    };

    TestBed.configureTestingModule({
      providers: [
        FlotaFacade,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: AuthFacade, useValue: { currentUser: vi.fn().mockReturnValue(null) } },
      ],
    });

    service = TestBed.inject(FlotaFacade);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with empty vehicles', () => {
    expect(service.vehicles()).toEqual([]);
    expect(service.isLoading()).toBe(false);
  });

  it('selectVehicle should update selectedVehicleId signal', () => {
    service.selectVehicle(123);
    expect(service.selectedVehicleId()).toBe(123);

    service.selectVehicle(null);
    expect(service.selectedVehicleId()).toBeNull();
  });
});

// ─── spec 0004-m: vehículos "Ambas sedes" ─────────────────────────────────────
describe('FlotaFacade — scope multi-sede (spec 0004-m)', () => {
  function mockChannel() {
    return vi.fn().mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() });
  }

  it('AC7 — fetchVehiclesData() aplica .or(branch_id.eq.X,both_branches.eq.true) cuando hay sede activa', async () => {
    const orSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const supabaseMock = {
      client: {
        channel: mockChannel(),
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({ or: orSpy }),
          }),
        }),
      },
    };
    TestBed.configureTestingModule({
      providers: [
        FlotaFacade,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: AuthFacade, useValue: { currentUser: () => ({ role: 'admin' }) } },
        { provide: BranchFacade, useValue: { selectedBranchId: () => 1 } },
      ],
    });
    const facade = TestBed.inject(FlotaFacade);

    await facade.initialize();

    expect(orSpy).toHaveBeenCalledWith('branch_id.eq.1,both_branches.eq.true');
  });

  it('admin con "Todas las sedes" (null): no aplica or() de sede', async () => {
    const orSpy = vi.fn();
    const supabaseMock = {
      client: {
        channel: mockChannel(),
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null, or: orSpy }),
          }),
        }),
      },
    };
    TestBed.configureTestingModule({
      providers: [
        FlotaFacade,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: AuthFacade, useValue: { currentUser: () => ({ role: 'admin' }) } },
        { provide: BranchFacade, useValue: { selectedBranchId: () => null } },
      ],
    });
    const facade = TestBed.inject(FlotaFacade);

    await facade.initialize();

    expect(orSpy).not.toHaveBeenCalled();
  });

  it('mapToTableRow() propaga bothBranches a VehicleTableRow', async () => {
    const supabaseMock = {
      client: {
        channel: mockChannel(),
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              // branchId activo: la cadena termina en .or(); sin sede: en .order()
              or: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: 1,
                    license_plate: 'AA1111',
                    brand: 'Suzuki',
                    model: 'Swift',
                    year: 2022,
                    status: 'available',
                    current_km: 0,
                    last_maintenance: null,
                    branch_id: 1,
                    both_branches: true,
                    vehicle_assignments: [],
                    vehicle_documents: [],
                  },
                ],
                error: null,
              }),
            }),
          }),
        }),
      },
    };
    TestBed.configureTestingModule({
      providers: [
        FlotaFacade,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: AuthFacade, useValue: { currentUser: () => ({ role: 'admin' }) } },
        { provide: BranchFacade, useValue: { selectedBranchId: () => 1 } },
      ],
    });
    const facade = TestBed.inject(FlotaFacade);

    await facade.initialize();

    expect(facade.vehicles()[0].bothBranches).toBe(true);
  });
});
