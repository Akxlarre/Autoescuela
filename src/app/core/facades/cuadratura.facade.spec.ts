import { TestBed } from '@angular/core/testing';
import {
  CuadraturaFacade,
  mapPaymentToIngreso,
  mapSingularSaleToIngreso,
  mapSpecialServiceSaleToIngreso,
} from './cuadratura.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPayments = [
  {
    id: 1,
    document_number: '10001',
    type: 'Clase B',
    cash_amount: 150_000,
    transfer_amount: 0,
    card_amount: 0,
    voucher_amount: 0,
    total_amount: 150_000,
    created_at: new Date().toISOString(),
  },
  {
    id: 2,
    document_number: '10002',
    type: 'SENCE',
    cash_amount: 0,
    transfer_amount: 0,
    card_amount: 0,
    voucher_amount: 15_000,
    total_amount: 15_000,
    created_at: new Date().toISOString(),
  },
];

const mockExpenses = [
  {
    id: 1,
    description: 'Insumos oficina',
    amount: 10_000,
    date: new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString(),
  },
];

const mockAdvances: unknown[] = [];

function buildSupabaseMock() {
  const makeSingle = (data: unknown) => ({
    data,
    error: null,
  });

  const makeList = (data: unknown[]) => ({
    data,
    error: null,
  });

  return {
    client: {
      from: (table: string) => ({
        select: () => ({
          gte: () => ({
            lte: () => ({
              order: () => Promise.resolve(makeList(table === 'payments' ? mockPayments : [])),
            }),
          }),
          eq: (col: string) => ({
            eq: () => ({
              eq: () => Promise.resolve(makeList([])),
              maybeSingle: () => Promise.resolve(makeSingle(null)),
            }),
            then: (cb: (r: { data: unknown[]; error: null }) => void) =>
              Promise.resolve(
                cb(
                  table === 'expenses'
                    ? makeList(mockExpenses)
                    : table === 'instructor_advances'
                      ? makeList(mockAdvances)
                      : makeList([]),
                ),
              ),
          }),
          maybeSingle: () => Promise.resolve(makeSingle(null)),
        }),
        insert: () => Promise.resolve({ data: null, error: null }),
      }),
    },
  };
}

describe('CuadraturaFacade', () => {
  let facade: CuadraturaFacade;

  const mockUser = {
    id: 'user-uuid',
    dbId: 1,
    name: 'Admin Test',
    initials: 'AT',
    role: 'admin' as const,
    branch_id: 1,
    firstLogin: false,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CuadraturaFacade,
        { provide: SupabaseService, useValue: buildSupabaseMock() },
        {
          provide: AuthFacade,
          useValue: { currentUser: () => mockUser },
        },
        {
          provide: ToastService,
          useValue: { success: vi.fn(), error: vi.fn() },
        },
      ],
    });

    facade = TestBed.inject(CuadraturaFacade);
  });

  // ── Estado inicial ──────────────────────────────────────────────────────────

  it('debe inicializar con fondoInicial = 0 (hotfix-002-i, sin asunción de $50.000)', () => {
    expect(facade.fondoInicial()).toBe(0);
  });

  it('debe inicializar con pagosHoy vacío', () => {
    expect(facade.pagosHoy()).toEqual([]);
  });

  it('debe inicializar con gastosHoy vacío', () => {
    expect(facade.gastosHoy()).toEqual([]);
  });

  it('debe inicializar cajaYaCerrada en false', () => {
    expect(facade.cajaYaCerrada()).toBe(false);
  });

  it('debe inicializar isLoading en false', () => {
    expect(facade.isLoading()).toBe(false);
  });

  // ── Computed: con datos vacíos ──────────────────────────────────────────────

  it('ingresosEfectivoHoy debe ser 0 sin pagos', () => {
    expect(facade.ingresosEfectivoHoy()).toBe(0);
  });

  it('totalIngresosHoy debe ser 0 sin pagos', () => {
    expect(facade.totalIngresosHoy()).toBe(0);
  });

  it('totalEgresosHoy debe ser 0 sin egresos', () => {
    expect(facade.totalEgresosHoy()).toBe(0);
  });

  it('saldoTeoricoEfectivo debe ser fondoInicial (0) cuando no hay movimientos', () => {
    expect(facade.saldoTeoricoEfectivo()).toBe(0);
  });

  // ── Computed: lógica de negocio ─────────────────────────────────────────────

  it('saldoTeoricoEfectivo = fondoInicial + efectivo - egresos', () => {
    // Simula datos cargados manualmente para testear los computed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (facade as any)._pagosHoy.set([
      {
        id: 1,
        nBoleta: '10001',
        glosa: 'Test',
        claseB: 150_000,
        claseA: 0,
        sence: 0,
        otros: 0,
        total: 150_000,
      },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (facade as any)._gastosHoy.set([
      { id: 1, tipo: 'expense', descripcion: 'Insumos', monto: 10_000 },
    ]);

    // saldo = 0 (fondoInicial) + 150.000 - 10.000 = 140.000
    expect(facade.saldoTeoricoEfectivo()).toBe(140_000);
  });

  it('otrosIngresosHoy suma claseA + otros correctamente', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (facade as any)._pagosHoy.set([
      {
        id: 1,
        nBoleta: null,
        glosa: 'T',
        claseB: 0,
        claseA: 30_000,
        sence: 0,
        otros: 20_000,
        total: 50_000,
      },
    ]);
    expect(facade.otrosIngresosHoy()).toBe(50_000);
  });

  // ── isSaving ───────────────────────────────────────────────────────────────

  it('isSaving debe inicializar en false', () => {
    expect(facade.isSaving()).toBe(false);
  });

  it('egresoTipoPreset debe inicializar en null', () => {
    expect(facade.egresoTipoPreset()).toBeNull();
  });
});

// ─── fix-006-i: registrarEgreso con tipo "combustible" ────────────────────────

describe('CuadraturaFacade.registrarEgreso — combustible (fix-006-i)', () => {
  let facade: CuadraturaFacade;
  let insertSpy: ReturnType<typeof vi.fn>;

  const mockUser = {
    id: 'user-uuid',
    dbId: 1,
    name: 'Admin Test',
    initials: 'AT',
    role: 'admin' as const,
    branch_id: 1,
    firstLogin: false,
  };

  beforeEach(() => {
    insertSpy = vi.fn().mockResolvedValue({ data: null, error: null });

    TestBed.configureTestingModule({
      providers: [
        CuadraturaFacade,
        {
          provide: SupabaseService,
          useValue: {
            client: {
              from: (table: string) => ({
                select: () => ({
                  gte: () => ({ lte: () => ({ order: () => Promise.resolve({ data: [] }) }) }),
                }),
                insert: (payload: unknown) => insertSpy(table, payload),
              }),
            },
          },
        },
        { provide: AuthFacade, useValue: { currentUser: () => mockUser } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });

    facade = TestBed.inject(CuadraturaFacade);
  });

  it('inserta en expenses con category="combustible" cuando tipo es "combustible"', async () => {
    await facade.registrarEgreso({
      tipo: 'combustible',
      monto: 25_000,
      descripcion: 'Camioneta ABC-123',
    });

    expect(insertSpy).toHaveBeenCalledWith(
      'expenses',
      expect.objectContaining({ category: 'combustible', amount: 25_000 }),
    );
  });

  it('inserta en expenses con category=null cuando tipo es "gasto" (sin cambio de comportamiento previo)', async () => {
    await facade.registrarEgreso({ tipo: 'gasto', monto: 10_000, descripcion: 'Insumos' });

    expect(insertSpy).toHaveBeenCalledWith(
      'expenses',
      expect.objectContaining({ category: null, amount: 10_000 }),
    );
  });

  it('inserta en instructor_advances (sin category) cuando tipo es "anticipo"', async () => {
    await facade.registrarEgreso({ tipo: 'anticipo', monto: 15_000, descripcion: 'Anticipo Juan' });

    expect(insertSpy).toHaveBeenCalledWith(
      'instructor_advances',
      expect.objectContaining({ amount: 15_000, reason: 'Anticipo Juan' }),
    );
    const [, payload] = insertSpy.mock.calls[0];
    expect((payload as Record<string, unknown>)['category']).toBeUndefined();
  });
});

// ─── Regresión H-023: glosa traducida, no código crudo ────────────────────────

describe('mapPaymentToIngreso', () => {
  const basePayment = {
    id: 1,
    enrollment_id: 42,
    document_number: '10003',
    cash_amount: 90_000,
    transfer_amount: 0,
    card_amount: 0,
    voucher_amount: 0,
    total_amount: 90_000,
  };

  it('traduce type "enrollment" a "Matrícula" en glosa (H-023)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = mapPaymentToIngreso({ ...basePayment, type: 'enrollment' } as any);
    expect(row.glosa).toBe('Matrícula');
  });

  it('traduce type "online" a "Online" en glosa (H-023)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = mapPaymentToIngreso({ ...basePayment, type: 'online' } as any);
    expect(row.glosa).toBe('Online');
  });

  it('cae al placeholder "—" si type es null', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const row = mapPaymentToIngreso({ ...basePayment, type: null } as any);
    expect(row.glosa).toBe('—');
  });
});

// ─── fix-016 AC3: cobros de cursos singulares en la cuadratura ────────────────

describe('mapSingularSaleToIngreso', () => {
  const base = {
    id: 44,
    amount_paid: 200_000,
    courseName: 'Operador de Grúa',
    studentName: 'Pedro Rojas',
  };

  it('efectivo va al bucket de caja (claseB) y marca source singular', () => {
    const row = mapSingularSaleToIngreso({ ...base, payment_method: 'efectivo' });
    expect(row.source).toBe('singular');
    expect(row.claseB).toBe(200_000);
    expect(row.claseA).toBe(0);
    expect(row.otros).toBe(0);
    expect(row.total).toBe(200_000);
    expect(row.enrollmentId).toBeNull();
    expect(row.glosa).toContain('Operador de Grúa');
    expect(row.glosa).toContain('Pedro Rojas');
  });

  it('transferencia va a claseA y tarjeta a otros', () => {
    expect(mapSingularSaleToIngreso({ ...base, payment_method: 'transferencia' }).claseA).toBe(
      200_000,
    );
    expect(mapSingularSaleToIngreso({ ...base, payment_method: 'tarjeta' }).otros).toBe(200_000);
  });

  it('método desconocido o nulo cae a efectivo (caja)', () => {
    const row = mapSingularSaleToIngreso({ ...base, payment_method: null });
    expect(row.claseB).toBe(200_000);
  });

  it('amount_paid nulo no rompe el total', () => {
    const row = mapSingularSaleToIngreso({
      ...base,
      amount_paid: null,
      payment_method: 'efectivo',
    });
    expect(row.total).toBe(0);
    expect(row.claseB).toBe(0);
  });
});

// ─── fix-024-i: ventas de Servicios Especiales en Caja Diaria ─────────────────

describe('mapSpecialServiceSaleToIngreso', () => {
  const base = {
    id: 7,
    price: 40_000,
    serviceName: 'Psicotécnico',
    clientName: 'María López',
  };

  it('marca source special_service y bucket "efectivo" (sin método de pago en la tabla)', () => {
    const row = mapSpecialServiceSaleToIngreso(base);
    expect(row.source).toBe('special_service');
    expect(row.claseB).toBe(40_000);
    expect(row.claseA).toBe(0);
    expect(row.otros).toBe(0);
    expect(row.sence).toBe(0);
    expect(row.total).toBe(40_000);
    expect(row.enrollmentId).toBeNull();
  });

  it('glosa incluye el nombre del servicio y del cliente', () => {
    const row = mapSpecialServiceSaleToIngreso(base);
    expect(row.glosa).toContain('Psicotécnico');
    expect(row.glosa).toContain('María López');
  });

  it('serviceName nulo cae a un placeholder legible', () => {
    const row = mapSpecialServiceSaleToIngreso({ ...base, serviceName: null });
    expect(row.glosa).toContain('Servicio especial');
  });
});
