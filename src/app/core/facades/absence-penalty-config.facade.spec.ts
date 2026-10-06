import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AbsencePenaltyConfigFacade } from './absence-penalty-config.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';

/**
 * Spec 0048-b — AbsencePenaltyConfigFacade.
 * Lee/escribe `branch_absence_penalty_config`: si la penalización RF-053 cancela la agenda tras
 * 2 faltas consecutivas, por sede. El admin ve y edita todas; la secretaria ve solo la suya.
 */
describe('AbsencePenaltyConfigFacade', () => {
  let facade: AbsencePenaltyConfigFacade;
  let supabaseSpy: any;
  let currentUser: ReturnType<typeof signal<any>>;
  let toastSpy: any;

  const dbRows = [
    {
      branch_id: 1,
      auto_cancel_enabled: false,
      enabled_since: null,
      branches: { name: 'Chillán' },
    },
    {
      branch_id: 2,
      auto_cancel_enabled: true,
      enabled_since: '2026-10-06T12:00:00Z',
      branches: { name: 'San Carlos' },
    },
  ];

  /** `.from().select().order()` → `{ data, error }`. */
  function selectChain(data: any, error: any = null) {
    const order = vi.fn().mockResolvedValue({ data, error });
    const select = vi.fn().mockReturnValue({ order });
    return { from: vi.fn().mockReturnValue({ select }), _select: select };
  }

  /** `.from().update().eq().select().single()` → `{ data, error }`. */
  function updateChain(data: any, error: any = null) {
    const single = vi.fn().mockResolvedValue({ data, error });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    return { from: vi.fn().mockReturnValue({ update }), _update: update, _eq: eq };
  }

  beforeEach(() => {
    supabaseSpy = { client: {} };
    currentUser = signal<any>({ role: 'admin', branchId: null, dbId: 9 });
    toastSpy = { success: vi.fn(), error: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        AbsencePenaltyConfigFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: AuthFacade, useValue: { currentUser } },
        { provide: ToastService, useValue: toastSpy },
      ],
    });
    facade = TestBed.inject(AbsencePenaltyConfigFacade);
  });

  it('estado inicial: sin filas ni carga', () => {
    expect(facade.rows()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
    expect(facade.error()).toBeNull();
  });

  describe('load()', () => {
    it('lee la tabla con el nombre de la sede y la mapea al modelo de UI', async () => {
      const chain = selectChain(dbRows);
      supabaseSpy.client = chain;

      await facade.load();

      expect(chain.from).toHaveBeenCalledWith('branch_absence_penalty_config');
      expect(facade.rows()).toEqual([
        { branchId: 1, branchName: 'Chillán', enabled: false, enabledSince: null },
        {
          branchId: 2,
          branchName: 'San Carlos',
          enabled: true,
          enabledSince: '2026-10-06T12:00:00Z',
        },
      ]);
    });

    it('error de lectura → signal error + toast, sin filas', async () => {
      supabaseSpy.client = selectChain(null, { message: 'boom' });

      await facade.load();

      expect(facade.rows()).toEqual([]);
      expect(facade.error()).toBe('boom');
      expect(toastSpy.error).toHaveBeenCalled();
      expect(facade.isLoading()).toBe(false);
    });
  });

  describe('por rol (AC7)', () => {
    beforeEach(async () => {
      supabaseSpy.client = selectChain(dbRows);
      await facade.load();
    });

    it('admin: ve todas las sedes y puede editar', () => {
      expect(facade.rows().map((r) => r.branchId)).toEqual([1, 2]);
      expect(facade.canEdit()).toBe(true);
    });

    it('secretaria: ve solo su sede y no puede editar', () => {
      currentUser.set({ role: 'secretaria', branchId: 2, dbId: 5 });
      expect(facade.rows().map((r) => r.branchId)).toEqual([2]);
      expect(facade.canEdit()).toBe(false);
    });
  });

  describe('setEnabled()', () => {
    beforeEach(async () => {
      supabaseSpy.client = selectChain(dbRows);
      await facade.load();
    });

    it('activa la sede y toma enabled_since que fija el trigger', async () => {
      const chain = updateChain({
        branch_id: 1,
        auto_cancel_enabled: true,
        enabled_since: '2026-10-06T15:00:00Z',
        branches: { name: 'Chillán' },
      });
      supabaseSpy.client = chain;

      const ok = await facade.setEnabled(1, true);

      expect(ok).toBe(true);
      expect(chain._update).toHaveBeenCalledWith({ auto_cancel_enabled: true });
      expect(chain._eq).toHaveBeenCalledWith('branch_id', 1);
      expect(facade.rows()[0]).toEqual({
        branchId: 1,
        branchName: 'Chillán',
        enabled: true,
        enabledSince: '2026-10-06T15:00:00Z',
      });
      expect(toastSpy.success).toHaveBeenCalled();
      expect(facade.savingBranchId()).toBeNull();
    });

    it('error al guardar (p. ej. RLS) → false, toast de error y la fila no cambia', async () => {
      supabaseSpy.client = updateChain(null, { message: 'permission denied' });

      const ok = await facade.setEnabled(1, true);

      expect(ok).toBe(false);
      expect(facade.rows()[0].enabled).toBe(false);
      expect(toastSpy.error).toHaveBeenCalled();
      expect(facade.error()).toBe('permission denied');
    });

    it('la secretaria no llega a la BD', async () => {
      currentUser.set({ role: 'secretaria', branchId: 1, dbId: 5 });
      const chain = updateChain(null);
      supabaseSpy.client = chain;

      const ok = await facade.setEnabled(1, true);

      expect(ok).toBe(false);
      expect(chain.from).not.toHaveBeenCalled();
    });
  });
});
