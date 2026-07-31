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
