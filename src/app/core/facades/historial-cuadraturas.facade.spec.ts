import { TestBed } from '@angular/core/testing';
import { HistorialCuadraturasFacade, mapCierreToHistorial } from './historial-cuadraturas.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';
import type { HistorialCierre } from '@core/models/ui/historial-cuadraturas.model';
import type { AjusteFormData } from '@core/models/ui/cuadratura-adjustment.model';

describe('HistorialCuadraturasFacade', () => {
  let facade: HistorialCuadraturasFacade;
  let supabaseSpy: any;
  let authFacadeSpy: any;
  let toastSpy: any;

  beforeEach(() => {
    supabaseSpy = { client: vi.fn() };
    authFacadeSpy = { currentUser: vi.fn() };
    toastSpy = { error: vi.fn(), success: vi.fn(), warning: vi.fn() };

    (supabaseSpy as any).client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        HistorialCuadraturasFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: AuthFacade, useValue: authFacadeSpy },
        { provide: ToastService, useValue: toastSpy },
      ],
    });

    facade = TestBed.inject(HistorialCuadraturasFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should have initial month and year', () => {
    const now = new Date();
    expect(facade.mesActual()).toBe(now.getMonth() + 1);
    expect(facade.anioActual()).toBe(now.getFullYear());
  });

  it('mesAnterior should decrement mesActual', () => {
    const initialMes = facade.mesActual();
    facade.mesAnterior();
    if (initialMes === 1) {
      expect(facade.mesActual()).toBe(12);
    } else {
      expect(facade.mesActual()).toBe(initialMes - 1);
    }
  });

  it('mesSiguiente should increment mesActual', () => {
    const initialMes = facade.mesActual();
    facade.mesSiguiente();
    if (initialMes === 12) {
      expect(facade.mesActual()).toBe(1);
    } else {
      expect(facade.mesActual()).toBe(initialMes + 1);
    }
  });

  // ─── spec 0002-i: ajustes de cuadratura ──────────────────────────────────

  const mkCierre = (overrides: Partial<HistorialCierre> = {}): HistorialCierre => ({
    id: 1,
    branchId: 2,
    fecha: '2026-07-15',
    closed: true,
    fondoInicial: 50_000,
    saldoSistema: 100_000,
    saldoFisico: 100_000,
    diferencia: 0,
    cajero: 'Ana Pérez',
    totalIngresos: 150_000,
    ingresosEfectivo: 120_000,
    totalEgresos: 50_000,
    cashExpenses: 50_000,
    nonCashExpenses: 0,
    estadoDiferencia: 'balanced',
    qtyBill20000: 0,
    qtyBill10000: 0,
    qtyBill5000: 0,
    qtyBill2000: 0,
    qtyBill1000: 0,
    qtyCoin500: 0,
    qtyCoin100: 0,
    qtyCoin50: 0,
    qtyCoin10: 0,
    notes: null,
    ...overrides,
  });

  const mkAdjustmentRow = (
    id: number,
    tipo: 'gasto_olvidado' | 'correccion_manual',
    createdAt: string,
  ) => ({
    id,
    cuadratura_id: 1,
    tipo,
    monto: tipo === 'gasto_olvidado' ? -5000 : 2000,
    motivo: tipo === 'gasto_olvidado' ? 'Combustible olvidado' : 'Corrección de conteo',
    expense_id: tipo === 'gasto_olvidado' ? 10 : null,
    registered_by: 1,
    created_at: createdAt,
    users: { first_names: 'Ana', paternal_last_name: 'Pérez' },
  });

  function mockAjustesFetch(rows: any[]): void {
    supabaseSpy.client.from = vi.fn((table: string) => {
      if (table === 'cuadratura_adjustments') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: rows, error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table in mock: ${table}`);
    });
  }

  describe('totalVigente', () => {
    it('sin ajustes es igual al arqueo original (saldoFisico)', async () => {
      mockAjustesFetch([]);
      await (facade as any).fetchAjustes(1);
      (facade as any)._cierreSeleccionado.set(mkCierre());
      expect(facade.totalVigente()).toBe(100_000);
    });

    it('suma ajustes positivos y negativos al original', async () => {
      mockAjustesFetch([
        mkAdjustmentRow(1, 'gasto_olvidado', '2026-08-01T10:00:00Z'), // -5000
        mkAdjustmentRow(2, 'correccion_manual', '2026-08-01T11:00:00Z'), // +2000
      ]);
      (facade as any)._cierreSeleccionado.set(mkCierre());
      await (facade as any).fetchAjustes(1);
      expect(facade.totalVigente()).toBe(100_000 - 5000 + 2000);
    });

    it('sin cierre seleccionado devuelve 0', () => {
      expect(facade.totalVigente()).toBe(0);
    });
  });

  describe('seleccionarCierre — reset de ajustes', () => {
    it('limpia ajustesCierre() del cierre anterior antes de cargar el nuevo', async () => {
      mockAjustesFetch([mkAdjustmentRow(1, 'gasto_olvidado', '2026-08-01T10:00:00Z')]);
      facade.seleccionarCierre(mkCierre({ id: 1 }));
      await Promise.resolve();
      await Promise.resolve();
      expect(facade.ajustesCierre().length).toBe(1);

      mockAjustesFetch([]);
      facade.seleccionarCierre(mkCierre({ id: 2 }));
      // Inmediatamente después de seleccionar, antes de que resuelva el fetch async,
      // ya no debe quedar el ajuste del cierre anterior.
      expect(facade.ajustesCierre().length).toBe(0);
    });

    it('seleccionar null limpia ajustesCierre() sin disparar fetch', () => {
      (facade as any)._ajustesCierre.set([
        mkAdjustmentRow(1, 'gasto_olvidado', '2026-08-01T10:00:00Z'),
      ]);
      facade.seleccionarCierre(null);
      expect(facade.ajustesCierre().length).toBe(0);
    });
  });

  describe('registrarAjuste', () => {
    const datosGasto: AjusteFormData = {
      tipo: 'gasto_olvidado',
      monto: -5000,
      motivo: 'Combustible olvidado',
      categoria: 'combustible',
      vehiculoId: 7,
    };

    const datosCorreccion: AjusteFormData = {
      tipo: 'correccion_manual',
      monto: 2000,
      motivo: 'Conteo mal hecho',
    };

    it('rechaza si no hay cierre seleccionado', async () => {
      authFacadeSpy.currentUser.mockReturnValue({ dbId: 1, role: 'admin' });
      const ok = await facade.registrarAjuste(datosCorreccion);
      expect(ok).toBe(false);
      expect(toastSpy.error).toHaveBeenCalled();
    });

    it('rechaza si el cierre seleccionado no está cerrado (AC-E1)', async () => {
      authFacadeSpy.currentUser.mockReturnValue({ dbId: 1, role: 'admin' });
      (facade as any)._cierreSeleccionado.set(mkCierre({ closed: false }));
      const ok = await facade.registrarAjuste(datosCorreccion);
      expect(ok).toBe(false);
      expect(toastSpy.error).toHaveBeenCalledWith(
        'Solo se pueden registrar ajustes sobre cuadraturas cerradas.',
      );
    });

    /**
     * fix-446-m: el gasto y el ajuste los crea la RPC `registrar_ajuste_cuadratura` en una sola
     * transacción (la fecha y la sede del gasto las toma del cierre en la BD). Antes eran dos
     * INSERT desde el navegador, y el candado de fix-445-m rechazaba el del gasto.
     */
    function mockRpc(result: { data: unknown; error: unknown }) {
      const rpc = vi.fn().mockResolvedValue(result);
      const tableWrite = vi.fn();
      supabaseSpy.client.rpc = rpc;
      supabaseSpy.client.from = vi.fn((table: string) => {
        if (table === 'cuadratura_adjustments') {
          return {
            insert: tableWrite,
            select: () => ({
              eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
            }),
          };
        }
        return { insert: tableWrite };
      });
      return { rpc, tableWrite };
    }

    it('fix-446-m: tipo="gasto_olvidado" va por la RPC, sin INSERT directo a expenses', async () => {
      authFacadeSpy.currentUser.mockReturnValue({ dbId: 1, role: 'admin' });
      (facade as any)._cierreSeleccionado.set(
        mkCierre({ id: 1, fecha: '2026-07-15', branchId: 2 }),
      );
      const { rpc, tableWrite } = mockRpc({ data: 55, error: null });

      const ok = await facade.registrarAjuste(datosGasto);

      expect(ok).toBe(true);
      expect(rpc).toHaveBeenCalledWith('registrar_ajuste_cuadratura', {
        p_cuadratura_id: 1,
        p_tipo: 'gasto_olvidado',
        p_monto: -5000,
        p_motivo: 'Combustible olvidado',
        p_categoria: 'combustible',
        p_vehiculo_id: 7,
      });
      expect(tableWrite).not.toHaveBeenCalled();
      expect(toastSpy.success).toHaveBeenCalled();
    });

    it('fix-446-m: tipo="correccion_manual" va por la RPC sin categoría ni vehículo', async () => {
      authFacadeSpy.currentUser.mockReturnValue({ dbId: 1, role: 'admin' });
      (facade as any)._cierreSeleccionado.set(mkCierre({ id: 1 }));
      const { rpc } = mockRpc({ data: 56, error: null });

      const ok = await facade.registrarAjuste(datosCorreccion);

      expect(ok).toBe(true);
      expect(rpc).toHaveBeenCalledWith('registrar_ajuste_cuadratura', {
        p_cuadratura_id: 1,
        p_tipo: 'correccion_manual',
        p_monto: 2000,
        p_motivo: 'Conteo mal hecho',
        p_categoria: null,
        p_vehiculo_id: null,
      });
    });

    it('fix-446-m: si la BD rechaza, muestra su mensaje y no dice "registrado"', async () => {
      authFacadeSpy.currentUser.mockReturnValue({ dbId: 1, role: 'admin' });
      (facade as any)._cierreSeleccionado.set(mkCierre({ id: 1 }));
      mockRpc({
        data: null,
        error: { code: 'P0001', message: 'CAJA_CERRADA', details: null, hint: null },
      });

      const ok = await facade.registrarAjuste(datosGasto);

      expect(ok).toBe(false);
      expect(toastSpy.success).not.toHaveBeenCalled();
      expect(toastSpy.error).toHaveBeenCalledWith(expect.stringContaining('ya está cerrada'));
    });
  });

  // ─── fix-226-m: fondo de apertura real + egreso efectivo vs no-efectivo ────

  describe('mapCierreToHistorial', () => {
    const baseRow: any = {
      id: 7,
      branch_id: 2,
      date: '2026-08-27',
      closed: true,
      balance: 15_000,
      arqueo_amount: 14_827,
      difference: -173,
      total_income: 0,
      total_expenses: 84_000,
      cash_amount: 0,
      users: { first_names: 'María', paternal_last_name: 'Torres' },
    };

    it('usa opening_amount real cuando viene, y null cuando falta', () => {
      expect(mapCierreToHistorial({ ...baseRow, opening_amount: 99_000 }).fondoInicial).toBe(
        99_000,
      );
      expect(mapCierreToHistorial({ ...baseRow, opening_amount: null }).fondoInicial).toBeNull();
      expect(mapCierreToHistorial({ ...baseRow }).fondoInicial).toBeNull();
    });

    it('usa cash_expenses persistido y deriva nonCashExpenses del total', () => {
      const ui = mapCierreToHistorial({
        ...baseRow,
        opening_amount: 50_000,
        cash_expenses: 34_000,
      });
      expect(ui.cashExpenses).toBe(34_000);
      expect(ui.nonCashExpenses).toBe(84_000 - 34_000);
    });

    it('cashExpenses cae al fallback derivado (opening + cash_amount − balance) cuando la columna es null', () => {
      // opening 50.000 + cash_amount 20.000 − balance 36.000 = 34.000 de egreso efectivo
      const ui = mapCierreToHistorial({
        ...baseRow,
        opening_amount: 50_000,
        cash_amount: 20_000,
        balance: 36_000,
        cash_expenses: null,
      });
      expect(ui.cashExpenses).toBe(34_000);
      expect(ui.nonCashExpenses).toBe(84_000 - 34_000);
    });

    it('el libro de conciliación cuadra: fondo + ingresosEfectivo − cashExpenses === saldoSistema', () => {
      const ui = mapCierreToHistorial({
        ...baseRow,
        opening_amount: 50_000,
        cash_amount: 20_000,
        balance: 36_000,
        cash_expenses: 34_000,
      });
      expect((ui.fondoInicial ?? 0) + ui.ingresosEfectivo - ui.cashExpenses).toBe(ui.saldoSistema);
    });
  });
});
