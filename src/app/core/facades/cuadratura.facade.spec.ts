import { TestBed } from '@angular/core/testing';
import { CuadraturaFacade } from './cuadratura.facade';
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

  it('debe inicializar con fondoInicial = 50.000', () => {
    expect(facade.fondoInicial()).toBe(50_000);
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

  it('saldoTeoricoEfectivo debe ser fondoInicial cuando no hay movimientos', () => {
    expect(facade.saldoTeoricoEfectivo()).toBe(50_000);
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

    // saldo = 50.000 + 150.000 - 10.000 = 190.000
    expect(facade.saldoTeoricoEfectivo()).toBe(190_000);
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
});
