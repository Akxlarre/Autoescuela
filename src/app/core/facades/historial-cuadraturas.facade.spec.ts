import { TestBed } from '@angular/core/testing';
import { HistorialCuadraturasFacade } from './historial-cuadraturas.facade';
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
    totalEgresos: 50_000,
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

    it('tipo="gasto_olvidado" inserta en expenses (con la fecha del cierre) y en cuadratura_adjustments', async () => {
      authFacadeSpy.currentUser.mockReturnValue({ dbId: 1, role: 'admin' });
      (facade as any)._cierreSeleccionado.set(
        mkCierre({ id: 1, fecha: '2026-07-15', branchId: 2 }),
      );

      const expensesInsert = vi.fn().mockReturnValue({
        select: () => ({
          single: () => Promise.resolve({ data: { id: 99 }, error: null }),
        }),
      });
      const adjustmentsInsert = vi.fn().mockResolvedValue({ error: null });

      supabaseSpy.client.from = vi.fn((table: string) => {
        if (table === 'expenses') return { insert: expensesInsert };
        if (table === 'cuadratura_adjustments') {
          return {
            insert: adjustmentsInsert,
            select: () => ({
              eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
            }),
          };
        }
        throw new Error(`unexpected table: ${table}`);
      });

      const ok = await facade.registrarAjuste(datosGasto);

      expect(ok).toBe(true);
      expect(expensesInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          date: '2026-07-15', // fecha del CIERRE, nunca la de hoy
          amount: 5000,
          category: 'combustible',
          vehicle_id: 7,
          branch_id: 2,
        }),
      );
      expect(adjustmentsInsert).toHaveBeenCalledWith(
        expect.objectContaining({ cuadratura_id: 1, tipo: 'gasto_olvidado', expense_id: 99 }),
      );
    });

    it('tipo="correccion_manual" NO inserta en expenses', async () => {
      authFacadeSpy.currentUser.mockReturnValue({ dbId: 1, role: 'admin' });
      (facade as any)._cierreSeleccionado.set(mkCierre({ id: 1 }));

      const expensesInsert = vi.fn();
      const adjustmentsInsert = vi.fn().mockResolvedValue({ error: null });

      supabaseSpy.client.from = vi.fn((table: string) => {
        if (table === 'expenses') return { insert: expensesInsert };
        if (table === 'cuadratura_adjustments') {
          return {
            insert: adjustmentsInsert,
            select: () => ({
              eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
            }),
          };
        }
        throw new Error(`unexpected table: ${table}`);
      });

      const ok = await facade.registrarAjuste(datosCorreccion);

      expect(ok).toBe(true);
      expect(expensesInsert).not.toHaveBeenCalled();
      expect(adjustmentsInsert).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: 'correccion_manual', expense_id: null }),
      );
    });
  });
});
