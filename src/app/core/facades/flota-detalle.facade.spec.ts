import { TestBed } from '@angular/core/testing';
import { FlotaDetalleFacade } from './flota-detalle.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from './auth.facade';
import { addDaysIso, chileToday } from '@core/utils/chile-time.utils';

describe('FlotaDetalleFacade', () => {
  let service: FlotaDetalleFacade;
  let supabaseMock: any;

  beforeEach(() => {
    supabaseMock = {
      client: {
        from: (window as any).vi?.fn() || (() => ({})),
      },
    };

    TestBed.configureTestingModule({
      providers: [
        FlotaDetalleFacade,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: AuthFacade, useValue: { currentUser: () => ({ role: 'admin' }) } },
      ],
    });

    service = TestBed.inject(FlotaDetalleFacade);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with null vehicle and empty maintenances', () => {
    expect(service.vehicle()).toBe(null);
    expect(service.maintenances()).toEqual([]);
  });

  it('selectMaintenance should update selectedMaintenanceId signal', () => {
    service.selectMaintenance(456);
    expect(service.selectedMaintenanceId()).toBe(456);

    service.selectMaintenance(null);
    expect(service.selectedMaintenanceId()).toBe(null);
  });
});

describe('FlotaDetalleFacade — detalle, vencimientos y KPIs (hotfix-074-b)', () => {
  let service: FlotaDetalleFacade;
  let vehicleResult: { data: unknown; error: unknown };
  let maintenancesResult: { data: unknown; error: unknown };
  let invoke: ReturnType<typeof vi.fn>;
  let currentUser: { role: string; branchId: number | null; canAccessBothBranches: boolean };

  /** Vencimiento a N días de hoy (hora Chile). */
  const enDias = (n: number) => addDaysIso(chileToday(), n);
  const vehiculo = (docs: { type: string; expiry_date: string | null }[]) => ({
    id: 7,
    license_plate: 'ABCD43',
    brand: 'Toyota',
    model: 'Yaris',
    year: 2022,
    status: 'available',
    current_km: 45200,
    last_maintenance: null,
    branch_id: 1,
    both_branches: false,
    vehicle_assignments: [],
    vehicle_documents: docs.map((d) => ({ ...d, status: null, file_url: null })),
  });

  beforeEach(() => {
    vehicleResult = { data: vehiculo([]), error: null };
    maintenancesResult = { data: [], error: null };
    invoke = vi.fn();
    currentUser = { role: 'admin', branchId: null, canAccessBothBranches: false };

    const client = {
      functions: { invoke },
      from: (table: string) => {
        if (table === 'vehicles') {
          return {
            select: () => ({ eq: () => ({ single: () => Promise.resolve(vehicleResult) }) }),
          };
        }
        return {
          select: () => ({ eq: () => ({ order: () => Promise.resolve(maintenancesResult) }) }),
        };
      },
    };

    TestBed.configureTestingModule({
      providers: [
        FlotaDetalleFacade,
        { provide: SupabaseService, useValue: { client } },
        { provide: AuthFacade, useValue: { currentUser: () => currentUser } },
      ],
    });
    service = TestBed.inject(FlotaDetalleFacade);
  });

  it('S9: "por vencer" usa el mismo umbral del listado (30 días), no 14', async () => {
    vehicleResult.data = vehiculo([
      { type: 'soap', expiry_date: enDias(-1) },
      { type: 'technical_inspection', expiry_date: enDias(0) },
      { type: 'circulation_permit', expiry_date: enDias(20) },
      { type: 'insurance', expiry_date: enDias(31) },
    ]);

    await service.loadVehicleDetail(7);

    expect(service.scheduledMaintenances().map((s) => s.status)).toEqual([
      'overdue', // venció ayer
      'soon', // vence hoy: vigente hoy, por vencer
      'soon', // a 20 días: antes salía "ok" (umbral de 14)
      'ok', // a 31 días
    ]);
  });

  it('L12 (hotfix-079-b): un id inválido deja "Vehículo no encontrado", sin datos de otro vehículo', async () => {
    await service.loadVehicleDetail(7);
    expect(service.vehicle()).not.toBeNull();

    service.showVehicleNotFound();

    expect(service.vehicle()).toBeNull();
    expect(service.maintenances()).toEqual([]);
    expect(service.scheduledMaintenances()).toEqual([]);
    expect(service.error()).toBe('Vehículo no encontrado.');
    expect(service.isLoading()).toBe(false);
  });

  it('S14: si falla el historial se informa el error, no un historial vacío', async () => {
    maintenancesResult = { data: null, error: new Error('permission denied') };

    await service.loadVehicleDetail(7);

    expect(service.error()).toBeTruthy();
  });

  it('S14: un fallo de la Hoja de Ruta no ensucia el error de la página', async () => {
    await service.loadVehicleDetail(7);
    invoke.mockResolvedValue({ data: null, error: new Error('boom') });

    await expect(service.generateRouteSheetPdf(7)).resolves.toBeNull();

    expect(service.error()).toBeNull();
  });

  it('S15: los KPIs dicen lo que miden — costo promedio por servicio y kilometraje actual', async () => {
    maintenancesResult.data = [
      { id: 1, cost: 30000, status: 'completed', created_at: '2026-09-01T12:00:00Z' },
      { id: 2, cost: 50000, status: 'completed', created_at: '2026-10-01T12:00:00Z' },
      { id: 3, cost: null, status: 'completed', created_at: '2026-10-05T12:00:00Z' },
    ];

    await service.loadVehicleDetail(7);

    expect(service.maintenanceKpis()).toEqual({
      totalCount: 3,
      totalSpent: 80000,
      avgPerService: 26667,
      currentKm: 45200,
    });
  });

  describe('permisos por sede (spec 0051-b)', () => {
    const SEC_A = { role: 'secretaria', branchId: 1, canAccessBothBranches: false };
    const enSede = (branch_id: number, both_branches = false) => ({
      ...vehiculo([]),
      branch_id,
      both_branches,
    });

    it('la secretaria opera un vehículo de su sede', async () => {
      currentUser = SEC_A;
      vehicleResult.data = enSede(1);

      await service.loadVehicleDetail(7);

      expect(service.error()).toBeNull();
      expect(service.vehicle()?.canManage).toBe(true);
    });

    it('un "Ambas" lo ve pero no lo opera (sin grant)', async () => {
      currentUser = SEC_A;
      vehicleResult.data = enSede(2, true);

      await service.loadVehicleDetail(7);

      expect(service.vehicle()?.canManage).toBe(false);
    });

    it('AC2: un vehículo exclusivo de la otra sede no se carga, aunque llegue por URL', async () => {
      currentUser = SEC_A;
      vehicleResult.data = enSede(2);
      maintenancesResult.data = [{ id: 1, cost: 1000, created_at: '2026-10-01T12:00:00Z' }];

      await service.loadVehicleDetail(7);

      expect(service.vehicle()).toBeNull();
      expect(service.maintenances()).toEqual([]);
      expect(service.error()).toBe('Vehículo no encontrado.');
    });

    it('con grant multi-sede opera también los de la otra sede y los "Ambas"', async () => {
      currentUser = { ...SEC_A, canAccessBothBranches: true };
      vehicleResult.data = enSede(2, true);

      await service.loadVehicleDetail(7);

      expect(service.vehicle()?.canManage).toBe(true);
    });
  });
});
