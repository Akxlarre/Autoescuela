import { TestBed } from '@angular/core/testing';
import { AuditoriaFacade } from './auditoria.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { AuthFacade } from './auth.facade';

describe('AuditoriaFacade', () => {
  let facade: AuditoriaFacade;
  let supabaseSpy: any;
  let toastSpy: any;

  beforeEach(() => {
    supabaseSpy = { client: vi.fn() };
    toastSpy = { error: vi.fn(), success: vi.fn() };

    (supabaseSpy as any).client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              range: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
            }),
            not: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 }),
          }),
        }),
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        AuditoriaFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: AuthFacade, useValue: { currentUser: vi.fn().mockReturnValue(null) } },
      ],
    });

    facade = TestBed.inject(AuditoriaFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should have initial empty state', () => {
    expect(facade.logs()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
    expect(facade.currentPage()).toBe(1);
  });

  it('setPage should update currentPage signal', () => {
    facade.setPage(2);
    expect(facade.currentPage()).toBe(2);
  });

  it('clearFilters should reset filters', () => {
    facade.setFilters({ accion: 'INSERT' });
    facade.clearFilters();
    expect(facade.filters().accion).toBeNull();
  });

  // fix-206-b (S18 de ASG-i-034): las 3 tablas que ahora se auditan tienen módulo propio.
  describe('módulos de las tablas auditadas en fix-206-b', () => {
    function chainableQuery(): any {
      const q: any = {};
      for (const m of ['select', 'eq', 'order', 'range', 'gte', 'lte', 'lt', 'in', 'not']) {
        q[m] = vi.fn().mockReturnValue(q);
      }
      q.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null, count: 0 });
      return q;
    }

    it.each([
      ['Instructores', ['instructors', 'vehicle_assignments']],
      ['Liquidaciones', ['branch_payroll_config']],
    ])('filtrar por "%s" consulta %j', async (modulo, entities) => {
      const q = chainableQuery();
      supabaseSpy.client.from = vi.fn().mockReturnValue(q);
      facade.setFilters({ modulo });
      await facade.initialize();
      expect(q.in).toHaveBeenCalledWith('entity', entities);
    });

    it('el filtro de fechas usa días de Chile como rango semiabierto (spec 0024-m)', async () => {
      const q = chainableQuery();
      supabaseSpy.client.from = vi.fn().mockReturnValue(q);
      facade.setFilters({ fechaDesde: '2026-10-01', fechaHasta: '2026-10-06' });
      await facade.initialize();
      // Octubre: Chile en UTC-3. Hasta = inicio del día siguiente, exclusivo.
      expect(q.gte).toHaveBeenCalledWith('created_at', '2026-10-01T03:00:00.000Z');
      expect(q.lt).toHaveBeenCalledWith('created_at', '2026-10-07T03:00:00.000Z');
    });
  });

  // fix-069-i: Auditoría deja de mostrar solo secretarias. Filtro "Quién".
  describe('filtro Quién (fix-069-i)', () => {
    function chainableQuery(rows: unknown[] = []): any {
      const q: any = {};
      for (const m of ['select', 'eq', 'order', 'range', 'gte', 'lt', 'in', 'not', 'is']) {
        q[m] = vi.fn().mockReturnValue(q);
      }
      q.then = (resolve: (v: unknown) => unknown) =>
        resolve({ data: rows, error: null, count: rows.length });
      return q;
    }

    it('por defecto muestra todos: no exige usuario ni filtra por rol', async () => {
      const q = chainableQuery();
      supabaseSpy.client.from = vi.fn().mockReturnValue(q);
      await facade.initialize();

      const auditSelect = q.select.mock.calls.find((c: string[]) => c[0].includes('action'))[0];
      expect(auditSelect).not.toContain('users!inner');
      expect(q.eq).not.toHaveBeenCalledWith('users.roles.name', expect.anything());
    });

    it('Administradores filtra por el rol admin', async () => {
      const q = chainableQuery();
      supabaseSpy.client.from = vi.fn().mockReturnValue(q);
      facade.setFilters({ quien: 'admin' });
      await facade.initialize();

      expect(q.eq).toHaveBeenCalledWith('users.roles.name', 'admin');
      // Sin !inner en roles, el filtro solo vacía el rol anidado y la fila de la secretaria sigue
      // apareciendo (visto en el navegador).
      const auditSelect = q.select.mock.calls.find((c: string[]) => c[0].includes('action'))[0];
      expect(auditSelect).toContain('users!inner');
      expect(auditSelect).toContain('roles!inner');
    });

    it('Sistema trae solo las filas sin usuario', async () => {
      const q = chainableQuery();
      supabaseSpy.client.from = vi.fn().mockReturnValue(q);
      facade.setFilters({ quien: 'sistema' });
      await facade.initialize();

      expect(q.is).toHaveBeenCalledWith('user_id', null);
    });

    it('una fila sin usuario se muestra como Sistema', async () => {
      const q = chainableQuery([
        {
          id: 1,
          action: 'UPDATE',
          entity: 'enrollments',
          detail: 'x',
          ip: null,
          created_at: '2026-10-24T06:00:00Z',
          users: null,
        },
      ]);
      supabaseSpy.client.from = vi.fn().mockReturnValue(q);
      await facade.initialize();

      expect(facade.logs()[0].usuarioNombre).toBe('Sistema');
      expect(facade.logs()[0].usuarioRol).toBe('Sistema');
    });
  });
});
