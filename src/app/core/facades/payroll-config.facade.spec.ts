import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { PayrollConfigFacade, PAYROLL_RATE_FALLBACK } from './payroll-config.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';

/**
 * Spec 0014-m — PayrollConfigFacade.
 * Lee/escribe `branch_payroll_config`: tarifa CLP por hora equivalente de
 * instructor, global por sede. NO branch-scoped (trae todas las sedes para
 * editarlas). Consumida por LiquidacionesFacade y el drawer de Ajustes.
 */
describe('PayrollConfigFacade', () => {
  let facade: PayrollConfigFacade;
  let supabaseSpy: any;
  let authFacadeSpy: any;
  let toastSpy: any;

  const mockRows = [
    { branch_id: 1, amount_per_hour: 5000, updated_at: '2026-09-01T00:00:00Z', updated_by: null },
    { branch_id: 2, amount_per_hour: 6500, updated_at: '2026-09-02T00:00:00Z', updated_by: 3 },
  ];

  /** Mock encadenable de `.from(table).select()` que resuelve `{ data, error }`. */
  function buildSelectChain(data: any, error: any = null) {
    const terminal = Promise.resolve({ data, error });
    const selectSpy = vi.fn().mockReturnValue({ then: terminal.then.bind(terminal) });
    return {
      from: vi.fn().mockReturnValue({ select: selectSpy }),
      _selectSpy: selectSpy,
    };
  }

  /** Mock de `.from(table).upsert(record, opts)` que resuelve `{ error }`. */
  function buildUpsertChain(error: any = null) {
    const upsertSpy = vi.fn().mockResolvedValue({ error });
    return { from: vi.fn().mockReturnValue({ upsert: upsertSpy }), _upsertSpy: upsertSpy };
  }

  beforeEach(() => {
    supabaseSpy = { client: {} };
    authFacadeSpy = {
      currentUser: signal<{ role: string; dbId: number | null } | null>({
        role: 'admin',
        dbId: 9,
      }),
    };
    toastSpy = { success: vi.fn(), error: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        PayrollConfigFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: AuthFacade, useValue: authFacadeSpy },
        { provide: ToastService, useValue: toastSpy },
      ],
    });

    facade = TestBed.inject(PayrollConfigFacade);
  });

  it('estado inicial: sin filas, flags en false', () => {
    expect(facade.config()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
    expect(facade.isSaving()).toBe(false);
    expect(facade.error()).toBeNull();
  });

  describe('load()', () => {
    it('AC2: puebla configByBranch() con un Map branch_id -> fila', async () => {
      const chain = buildSelectChain(mockRows);
      supabaseSpy.client = chain;

      await facade.load();

      expect(chain.from).toHaveBeenCalledWith('branch_payroll_config');
      const map = facade.configByBranch();
      expect(map.get(1)?.amount_per_hour).toBe(5000);
      expect(map.get(2)?.amount_per_hour).toBe(6500);
      expect(facade.isLoading()).toBe(false);
      expect(facade.error()).toBeNull();
    });

    it('AC3/AC4: rateForBranch() devuelve la tarifa de esa sede', async () => {
      supabaseSpy.client = buildSelectChain(mockRows);
      await facade.load();

      expect(facade.rateForBranch(1)).toBe(5000);
      expect(facade.rateForBranch(2)).toBe(6500);
    });

    it('AC-E1: rateForBranch() de una sede sin fila usa el fallback', async () => {
      supabaseSpy.client = buildSelectChain(mockRows);
      await facade.load();

      expect(facade.rateForBranch(99)).toBe(PAYROLL_RATE_FALLBACK);
      expect(facade.rateForBranch(null)).toBe(PAYROLL_RATE_FALLBACK);
    });

    it('rateForBranch() usa el fallback si aún no se cargó nada', () => {
      expect(facade.rateForBranch(1)).toBe(PAYROLL_RATE_FALLBACK);
    });

    it('en error: setea error, deja config vacía, dispara toast', async () => {
      supabaseSpy.client = buildSelectChain(null, { message: 'PG down' });

      await facade.load();

      expect(facade.config()).toEqual([]);
      expect(facade.error()).toBe('PG down');
      expect(toastSpy.error).toHaveBeenCalled();
      expect(facade.isLoading()).toBe(false);
    });

    it('SWR: segunda llamada NO vuelve a prender isLoading', async () => {
      supabaseSpy.client = buildSelectChain(mockRows);

      await facade.load();
      expect(facade.isLoading()).toBe(false);

      const p = facade.load();
      expect(facade.isLoading()).toBe(false);
      await p;
    });

    it('primera carga prende isLoading antes de resolver', async () => {
      let resolveQuery!: (v: any) => void;
      const pending = new Promise((r) => (resolveQuery = r));
      supabaseSpy.client = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ then: pending.then.bind(pending) }),
        }),
      };

      const p = facade.load();
      expect(facade.isLoading()).toBe(true);
      resolveQuery({ data: mockRows, error: null });
      await p;
      expect(facade.isLoading()).toBe(false);
    });
  });

  describe('updateRate(branchId, amountPerHour)', () => {
    beforeEach(async () => {
      supabaseSpy.client = buildSelectChain(mockRows);
      await facade.load();
    });

    it('AC2: upsert con branch_id, amount_per_hour y updated_by del usuario', async () => {
      const chain = buildUpsertChain();
      supabaseSpy.client = chain;

      const ok = await facade.updateRate(1, 7000);

      expect(ok).toBe(true);
      expect(chain.from).toHaveBeenCalledWith('branch_payroll_config');
      expect(chain._upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ branch_id: 1, amount_per_hour: 7000, updated_by: 9 }),
        expect.objectContaining({ onConflict: 'branch_id' }),
      );
      // refleja el cambio en memoria sin re-fetch
      expect(facade.rateForBranch(1)).toBe(7000);
      expect(facade.rateForBranch(2)).toBe(6500);
      expect(toastSpy.success).toHaveBeenCalled();
    });

    it('AC2: crea la fila en memoria si la sede no la tenía', async () => {
      supabaseSpy.client = buildUpsertChain();

      const ok = await facade.updateRate(5, 8000);

      expect(ok).toBe(true);
      expect(facade.rateForBranch(5)).toBe(8000);
    });

    it('en error: devuelve false, NO muta el estado, dispara toast', async () => {
      supabaseSpy.client = buildUpsertChain({ message: 'RLS denied' });

      const ok = await facade.updateRate(1, 7000);

      expect(ok).toBe(false);
      expect(facade.rateForBranch(1)).toBe(5000);
      expect(toastSpy.error).toHaveBeenCalled();
    });

    it('isSaving se apaga al terminar (éxito o error)', async () => {
      supabaseSpy.client = buildUpsertChain();
      await facade.updateRate(1, 7000);
      expect(facade.isSaving()).toBe(false);

      supabaseSpy.client = buildUpsertChain({ message: 'x' });
      await facade.updateRate(1, 7000);
      expect(facade.isSaving()).toBe(false);
    });
  });
});
