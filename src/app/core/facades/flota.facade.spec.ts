import { TestBed } from '@angular/core/testing';
import { FlotaFacade } from './flota.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from './auth.facade';
import { BranchFacade } from './branch.facade';
import { ToastService } from '@core/services/ui/toast.service';

const toastMock = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

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
        { provide: BranchFacade, useValue: { selectedBranchId: vi.fn().mockReturnValue(null) } },
        { provide: ToastService, useValue: toastMock },
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

// ─── fix-153-m: upsertVehicleDocument() / getDocumentSignedUrl() ─────────────
describe('FlotaFacade — upsertVehicleDocument (fix-153-m)', () => {
  let service: FlotaFacade;
  let upsertMock: ReturnType<typeof vi.fn>;
  let uploadMock: ReturnType<typeof vi.fn>;
  let createSignedUrlMock: ReturnType<typeof vi.fn>;
  let fromMock: ReturnType<typeof vi.fn>;

  function makeSupabaseMock() {
    upsertMock = vi.fn().mockResolvedValue({ error: null });
    uploadMock = vi.fn().mockResolvedValue({ error: null });
    createSignedUrlMock = vi
      .fn()
      .mockResolvedValue({ data: { signedUrl: 'https://signed.example/doc.pdf' }, error: null });

    fromMock = vi.fn((table: string) => {
      if (table === 'vehicle_documents') {
        return { upsert: upsertMock };
      }
      // vehicles / expenses (usados por refreshSilently -> fetchVehiclesData)
      const builder: any = {
        select: vi.fn(() => builder),
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        eq: vi.fn(() => builder),
        not: vi.fn(() => builder),
        gte: vi.fn(() => Promise.resolve({ data: [], error: null })),
      };
      return builder;
    });

    return {
      client: {
        from: fromMock,
        storage: {
          from: vi.fn(() => ({ upload: uploadMock, createSignedUrl: createSignedUrlMock })),
        },
      },
    };
  }

  beforeEach(() => {
    toastMock.success.mockClear();
    toastMock.error.mockClear();
    TestBed.configureTestingModule({
      providers: [
        FlotaFacade,
        { provide: SupabaseService, useValue: makeSupabaseMock() },
        { provide: AuthFacade, useValue: { currentUser: vi.fn().mockReturnValue(null) } },
        { provide: BranchFacade, useValue: { selectedBranchId: vi.fn().mockReturnValue(null) } },
        { provide: ToastService, useValue: toastMock },
      ],
    });
    service = TestBed.inject(FlotaFacade);
  });

  it('sin archivo: hace upsert con el filePath existente y status calculado desde expiryDate', async () => {
    const farFutureDate = '2099-01-01';
    await service.upsertVehicleDocument({
      vehicleId: 7,
      type: 'soap',
      expiryDate: farFutureDate,
      file: null,
      existingFilePath: 'vehicle-docs/7/old.pdf',
    });

    expect(uploadMock).not.toHaveBeenCalled();
    expect(upsertMock).toHaveBeenCalledWith(
      {
        vehicle_id: 7,
        type: 'soap',
        expiry_date: farFutureDate,
        file_url: 'vehicle-docs/7/old.pdf',
        status: 'valid',
      },
      { onConflict: 'vehicle_id,type' },
    );
    expect(toastMock.success).toHaveBeenCalled();
  });

  it('con archivo: sube al bucket "documents" primero y usa el path nuevo en el upsert', async () => {
    const file = new File(['contenido'], 'soap.pdf', { type: 'application/pdf' });
    await service.upsertVehicleDocument({
      vehicleId: 7,
      type: 'soap',
      expiryDate: '2099-01-01',
      file,
      existingFilePath: null,
    });

    expect(uploadMock).toHaveBeenCalledTimes(1);
    const [uploadedPath, uploadedFile] = uploadMock.mock.calls[0];
    expect(uploadedPath).toMatch(/^vehicle-docs\/7\/\d+_soap\.pdf$/);
    expect(uploadedFile).toBe(file);

    const upsertPayload = upsertMock.mock.calls[0][0];
    expect(upsertPayload.file_url).toBe(uploadedPath);
  });

  it('calcula status="expired" cuando expiryDate ya pasó', async () => {
    await service.upsertVehicleDocument({
      vehicleId: 7,
      type: 'soap',
      expiryDate: '2000-01-01',
      file: null,
      existingFilePath: null,
    });

    expect(upsertMock.mock.calls[0][0].status).toBe('expired');
  });

  it('propaga el error y NO muestra toast de éxito si el upsert falla', async () => {
    upsertMock.mockResolvedValueOnce({ error: new Error('constraint violation') });

    await expect(
      service.upsertVehicleDocument({
        vehicleId: 7,
        type: 'soap',
        expiryDate: '2099-01-01',
        file: null,
        existingFilePath: null,
      }),
    ).rejects.toThrow('constraint violation');
    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it('getDocumentSignedUrl devuelve la signed URL del bucket "documents"', async () => {
    const url = await service.getDocumentSignedUrl('vehicle-docs/7/soap.pdf');
    expect(url).toBe('https://signed.example/doc.pdf');
    expect(createSignedUrlMock).toHaveBeenCalledWith('vehicle-docs/7/soap.pdf', 3600);
  });

  it('getDocumentSignedUrl devuelve null si Supabase Storage responde con error', async () => {
    createSignedUrlMock.mockResolvedValueOnce({ data: null, error: new Error('not found') });
    const url = await service.getDocumentSignedUrl('vehicle-docs/7/missing.pdf');
    expect(url).toBeNull();
  });
});

// ─── fix-154-m: createVehicle() devuelve el id creado (para el staging de docs) ───────────────
describe('FlotaFacade — createVehicle devuelve el id (fix-154-m)', () => {
  let service: FlotaFacade;
  let insertMock: ReturnType<typeof vi.fn>;
  let singleMock: ReturnType<typeof vi.fn>;

  function makeSupabaseMock() {
    singleMock = vi.fn().mockResolvedValue({ data: { id: 42 }, error: null });
    const selectAfterInsert = vi.fn(() => ({ single: singleMock }));
    insertMock = vi.fn(() => ({ select: selectAfterInsert }));

    const fromMock = vi.fn((table: string) => {
      if (table === 'vehicles') {
        return {
          insert: insertMock,
          select: vi.fn(() => ({ order: vi.fn(() => Promise.resolve({ data: [], error: null })) })),
        };
      }
      const builder: any = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        not: vi.fn(() => builder),
        gte: vi.fn(() => Promise.resolve({ data: [], error: null })),
      };
      return builder;
    });

    return { client: { from: fromMock } };
  }

  beforeEach(() => {
    toastMock.success.mockClear();
    TestBed.configureTestingModule({
      providers: [
        FlotaFacade,
        { provide: SupabaseService, useValue: makeSupabaseMock() },
        { provide: AuthFacade, useValue: { currentUser: vi.fn().mockReturnValue(null) } },
        { provide: BranchFacade, useValue: { selectedBranchId: vi.fn().mockReturnValue(null) } },
        { provide: ToastService, useValue: toastMock },
      ],
    });
    service = TestBed.inject(FlotaFacade);
  });

  it('devuelve el id del vehículo insertado', async () => {
    const id = await service.createVehicle({ license_plate: 'AB1234' });
    expect(id).toBe(42);
    expect(insertMock).toHaveBeenCalledWith({ license_plate: 'AB1234' });
    expect(toastMock.success).toHaveBeenCalled();
  });

  it('propaga el error si el insert falla', async () => {
    singleMock.mockResolvedValueOnce({ data: null, error: new Error('insert failed') });
    await expect(service.createVehicle({ license_plate: 'AB1234' })).rejects.toThrow(
      'insert failed',
    );
  });
});

// ─── spec 0005-m: guard de requestId contra respuestas stale ─────────────────
describe('FlotaFacade — request guard (spec 0005-m, AC1, AC4, AC-E1)', () => {
  /**
   * fetchVehiclesData() hace 2 queries SECUENCIALES (no en paralelo): `vehicles` primero,
   * `expenses` (combustible) después. Solo controlamos la resolución de `vehicles` — es la
   * única que alimenta `_vehicles.set()`. `expenses` se resuelve sola de inmediato con datos
   * vacíos, no afecta el resultado que estamos probando.
   */
  function makeRaceableVehiclesMock() {
    let vehiclesCallIndex = -1;
    const deferreds: { promise: Promise<any>; resolve: (v: any) => void }[] = [];

    function deferredFor(i: number) {
      if (!deferreds[i]) {
        let resolve!: (v: any) => void;
        const promise = new Promise((res) => {
          resolve = res;
        });
        deferreds[i] = { promise, resolve };
      }
      return deferreds[i];
    }

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'vehicles') {
          vehiclesCallIndex++;
          const idx = vehiclesCallIndex;
          const builder: any = {
            select: vi.fn(() => builder),
            order: vi.fn(() => builder),
            or: vi.fn(() => builder),
            then: (resolve: any, reject: any) => deferredFor(idx).promise.then(resolve, reject),
          };
          return builder;
        }
        const builder: any = {
          select: vi.fn(() => builder),
          eq: vi.fn(() => builder),
          not: vi.fn(() => builder),
          gte: vi.fn(() => builder),
          then: (resolve: any) => resolve({ data: [], error: null }),
        };
        return builder;
      }),
      channel: vi.fn().mockReturnValue({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() }),
      removeChannel: vi.fn(),
    };

    return {
      client,
      resolveVehicles: (i: number, rows: any[]) =>
        deferredFor(i).resolve({ data: rows, error: null }),
      resolveVehiclesWithError: (i: number, err: any) =>
        deferredFor(i).resolve({ data: null, error: err }),
    };
  }

  function makeVehicleRow(id: number, plate: string): any {
    return {
      id,
      license_plate: plate,
      brand: 'Nissan',
      model: 'Versa',
      year: 2024,
      status: 'available',
      current_km: 0,
      last_maintenance: null,
      branch_id: 1,
      both_branches: false,
      vehicle_assignments: [],
      vehicle_documents: [],
    };
  }

  it('AC1/AC-E1: solo aplica el resultado de la fetch MÁS RECIENTE, aunque la vieja resuelva después', async () => {
    const mock = makeRaceableVehiclesMock();

    TestBed.configureTestingModule({
      providers: [
        FlotaFacade,
        { provide: SupabaseService, useValue: mock },
        { provide: AuthFacade, useValue: { currentUser: vi.fn(() => ({ role: 'admin' })) } },
        { provide: BranchFacade, useValue: { selectedBranchId: vi.fn(() => null) } },
        { provide: ToastService, useValue: toastMock },
      ],
    });
    const facade = TestBed.inject(FlotaFacade);

    const oldCall = facade.initialize(); // vehicles call #0 (vieja)
    const newCall = facade.initialize(); // vehicles call #1 (vigente) — dispara antes de que la vieja resuelva

    // Orden de llegada invertido: la vigente resuelve primero.
    mock.resolveVehicles(1, [makeVehicleRow(200, 'NEW-01')]);
    await newCall;
    mock.resolveVehicles(0, [makeVehicleRow(100, 'OLD-01')]);
    await oldCall;

    expect(facade.vehicles().map((v) => v.id)).toEqual([200]);
  });

  it('AC-E2: si la fetch vigente falla, el error se setea igual — el guard no enmascara errores reales', async () => {
    const mock = makeRaceableVehiclesMock();

    TestBed.configureTestingModule({
      providers: [
        FlotaFacade,
        { provide: SupabaseService, useValue: mock },
        { provide: AuthFacade, useValue: { currentUser: vi.fn(() => ({ role: 'admin' })) } },
        { provide: BranchFacade, useValue: { selectedBranchId: vi.fn(() => null) } },
        { provide: ToastService, useValue: toastMock },
      ],
    });
    const facade = TestBed.inject(FlotaFacade);

    const oldCall = facade.initialize(); // vehicles call #0 (vieja)
    const newCall = facade.initialize(); // vehicles call #1 (vigente)

    mock.resolveVehicles(0, [makeVehicleRow(100, 'OLD-01')]);
    await oldCall;
    mock.resolveVehiclesWithError(1, new Error('network fail'));
    await newCall;

    expect(facade.error()).toBe('Error al cargar la flota vehicular.');
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
        { provide: ToastService, useValue: toastMock },
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
        { provide: ToastService, useValue: toastMock },
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
        { provide: ToastService, useValue: toastMock },
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
        { provide: ToastService, useValue: toastMock },
      ],
    });
    const flotaFacade = TestBed.inject(FlotaFacade);

    await flotaFacade.initialize();

    const rows = flotaFacade.vehicles();
    expect(rows.find((v) => v.id === 1)?.combustibleMes).toBe(25_000);
    expect(rows.find((v) => v.id === 2)?.combustibleMes).toBe(0);
  });
});
