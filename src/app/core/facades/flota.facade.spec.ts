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
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'expenses') {
            const resolved = Promise.resolve({ data: [], error: null }) as any;
            resolved.eq = vi.fn().mockResolvedValue({ data: [], error: null });
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  not: vi.fn().mockReturnValue({
                    gte: vi.fn().mockReturnValue(resolved),
                  }),
                }),
              }),
            };
          }
          return {
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
          };
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

// ─── fix-007-i: combustibleMes por vehículo ────────────────────────────────────

describe('FlotaFacade.initialize — combustibleMes (fix-007-i)', () => {
  function buildSupabaseMock(vehicleRows: any[], expenseRows: any[]) {
    const channelMock = { on: vi.fn(() => channelMock), subscribe: vi.fn(() => channelMock) };
    return {
      client: {
        channel: vi.fn(() => channelMock),
        removeChannel: vi.fn(),
        from: vi.fn((table: string) => {
          if (table === 'vehicles') {
            return {
              select: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({ data: vehicleRows, error: null }),
              })),
            };
          }
          if (table === 'expenses') {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  not: vi.fn(() => ({
                    gte: vi.fn().mockResolvedValue({ data: expenseRows, error: null }),
                  })),
                })),
              })),
            };
          }
          throw new Error(`tabla inesperada: ${table}`);
        }),
      },
    };
  }

  it('suma los egresos de combustible del mes por vehículo y los mergea en VehicleTableRow', async () => {
    const vehicleRows = [
      {
        id: 1,
        license_plate: 'ABC-123',
        brand: 'Toyota',
        model: 'Yaris',
        year: 2022,
        status: 'available',
        current_km: 1000,
        last_maintenance: null,
        branch_id: 1,
        vehicle_assignments: [],
        vehicle_documents: [],
      },
      {
        id: 2,
        license_plate: 'XYZ-987',
        brand: 'Nissan',
        model: 'Versa',
        year: 2021,
        status: 'available',
        current_km: 2000,
        last_maintenance: null,
        branch_id: 1,
        vehicle_assignments: [],
        vehicle_documents: [],
      },
    ];
    const expenseRows = [
      { vehicle_id: 1, amount: 15_000 },
      { vehicle_id: 1, amount: 10_000 },
    ];

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        FlotaFacade,
        { provide: SupabaseService, useValue: buildSupabaseMock(vehicleRows, expenseRows) },
        {
          provide: AuthFacade,
          useValue: { currentUser: vi.fn().mockReturnValue({ role: 'admin' }) },
        },
        { provide: BranchFacade, useValue: { selectedBranchId: vi.fn().mockReturnValue(null) } },
      ],
    });
    const flotaFacade = TestBed.inject(FlotaFacade);

    await flotaFacade.initialize();

    const rows = flotaFacade.vehicles();
    expect(rows.find((v) => v.id === 1)?.combustibleMes).toBe(25_000);
    expect(rows.find((v) => v.id === 2)?.combustibleMes).toBe(0);
  });
});
