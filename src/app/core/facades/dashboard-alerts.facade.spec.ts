import { TestBed } from '@angular/core/testing';
import { DashboardAlertsFacade } from './dashboard-alerts.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { ToastService } from '@core/services/ui/toast.service';

// El piloto se controla desde el test: por defecto las vistas de Clase Profesional están
// habilitadas, para que los tests de sus alertas describan el comportamiento sin recorte.
const pilot = vi.hoisted(() => ({ profesionalBloqueado: false }));
vi.mock('@core/config/pilot-phase.config', () => ({
  isBlockedInPilot: (module: string) =>
    module === 'clase-profesional-recorte' && pilot.profesionalBloqueado,
}));

describe('DashboardAlertsFacade', () => {
  let facade: DashboardAlertsFacade;
  let fromSpy: ReturnType<typeof vi.fn>;
  let confirmSpy: ReturnType<typeof vi.fn>;
  let toast: { success: any; error: any; info: any; warning: any };

  /**
   * Builds a query chain that resolves with the provided result.
   * Supports all chainable methods used by the facade.
   */
  const buildChain = (result: { data?: unknown; count?: number | null; error?: unknown }) => {
    // fix-428-m: las alertas de saldo leen filas (alumnos distintos), no un conteo. Un mock que
    // solo declara `count: N` entrega N filas de alumnos distintos, para que los tests escritos
    // con conteos sigan diciendo lo mismo.
    const filas =
      result.data === undefined && result.count
        ? Array.from({ length: result.count }, (_, i) => ({ id: i + 1, student_id: i + 1 }))
        : result.data;
    const resolved = Promise.resolve({ ...result, data: filas });
    const chain: any = {};
    const ret = vi.fn().mockReturnValue(chain);
    chain.select = ret;
    chain.update = ret;
    chain.eq = ret;
    chain.lt = ret;
    chain.gt = ret;
    chain.gte = ret;
    chain.lte = ret;
    chain.is = ret;
    chain.not = ret;
    chain.or = ret;
    chain.in = ret;
    chain.limit = ret;
    chain.order = ret;
    chain.then = (resolve: any, reject: any) => resolved.then(resolve, reject);
    return chain;
  };

  beforeEach(() => {
    fromSpy = vi.fn();
    confirmSpy = vi.fn().mockResolvedValue(true);
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };

    const supabaseMock = {
      client: { from: fromSpy },
    } as unknown as SupabaseService;

    const authMock = {
      whenReady: Promise.resolve(),
      currentUser: vi.fn().mockReturnValue({ dbId: 1 }),
    } as unknown as AuthFacade;

    const branchMock = {
      selectedBranchId: vi.fn().mockReturnValue(null),
    } as unknown as BranchFacade;

    TestBed.configureTestingModule({
      providers: [
        DashboardAlertsFacade,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: AuthFacade, useValue: authMock },
        { provide: BranchFacade, useValue: branchMock },
        { provide: ConfirmModalService, useValue: { confirm: confirmSpy } },
        { provide: ToastService, useValue: toast },
      ],
    });

    facade = TestBed.inject(DashboardAlertsFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should start with empty alerts', () => {
    expect(facade.activeAlerts()).toEqual([]);
    expect(facade.alertCount()).toBe(0);
  });

  // ── Helper: builds a "clean" mock where all tables return empty ──────────────
  const buildCleanMock = (fromFn: ReturnType<typeof vi.fn>) => {
    fromFn.mockImplementation((table: string) => {
      if (table === 'alert_config') return buildChain({ data: [] });
      // Una sede, con la caja cerrada (fix-423-m: la alerta revisa sede por sede).
      if (table === 'branches') return buildChain({ data: [{ id: 1, name: 'Sede Uno' }] });
      if (table === 'cash_closings') return buildChain({ data: [{ branch_id: 1 }] });
      return buildChain({ data: [], count: 0 });
    });
  };

  describe('loadAlerts (SWR wrapper)', () => {
    it('should produce alerts for expired documents and pending payments', async () => {
      // Per-table call counters to differentiate parallel queries
      const callCounters: Record<string, number> = {};

      fromSpy.mockImplementation((table: string) => {
        callCounters[table] = (callCounters[table] ?? 0) + 1;
        const n = callCounters[table];

        if (table === 'alert_config')
          return buildChain({ data: [{ alert_type: 'document_expiry', advance_days: 30 }] });

        if (table === 'vehicle_documents')
          return n === 1 ? buildChain({ count: 3 }) : buildChain({ count: 2 });

        if (table === 'enrollments')
          // call 1 = checkPendingPayments, subsequent = checkTwelfthClassCompleted / checkOldDebts
          return n === 1 ? buildChain({ count: 5 }) : buildChain({ count: 0 });

        if (table === 'class_b_sessions') return buildChain({ data: [] });
        if (table === 'cash_closings') return buildChain({ count: 1 }); // closed — no F-3 alert

        return buildChain({ data: null, count: 0 });
      });

      await facade.loadAlerts();

      // 3 docs alerts (expired + expiring) + 1 pending payment
      expect(facade.activeAlerts().length).toBe(3);
      expect(facade.alertCount()).toBe(3);
      expect(facade.isLoading()).toBe(false);

      const severities = facade.activeAlerts().map((a) => a.severity);
      expect(severities).toContain('error');
      expect(severities).toContain('warning');
    });

    it('documentos con sede elegida incluyen los vehículos de ambas sedes (hotfix-156-m)', async () => {
      (TestBed.inject(AuthFacade).currentUser as any).mockReturnValue({ dbId: 1, role: 'admin' });
      (TestBed.inject(BranchFacade).selectedBranchId as any).mockReturnValue(2);
      const docChains: any[] = [];
      fromSpy.mockImplementation((table: string) => {
        if (table === 'cash_closings') return buildChain({ count: 1 });
        const chain = buildChain({ data: [], count: 0 });
        if (table === 'vehicle_documents') {
          // buildChain comparte un solo vi.fn entre métodos: espías propios para or/eq.
          chain.or = vi.fn(() => chain);
          chain.eq = vi.fn(() => chain);
          docChains.push(chain);
        }
        return chain;
      });

      await facade.loadAlerts();

      expect(docChains).toHaveLength(2);
      for (const chain of docChains) {
        expect(chain.or).toHaveBeenCalledWith('branch_id.eq.2,both_branches.eq.true', {
          referencedTable: 'vehicles',
        });
        expect(chain.eq).not.toHaveBeenCalledWith('vehicles.branch_id', 2);
      }
    });

    it('should produce no alerts when everything is clean', async () => {
      buildCleanMock(fromSpy);

      await facade.loadAlerts();

      expect(facade.activeAlerts()).toEqual([]);
      expect(facade.alertCount()).toBe(0);
    });

    it('should set error when query fails', async () => {
      fromSpy.mockImplementation(() => {
        throw new Error('DB down');
      });

      await facade.loadAlerts();

      expect(facade.error()).toBe('Error al cargar alertas');
      expect(facade.isLoading()).toBe(false);
    });
  });

  // ── fix-416-m: una alerta de una vista bloqueada no se muestra ───────────────
  describe('alertas de vistas bloqueadas en el piloto (fix-416-m)', () => {
    afterEach(() => (pilot.profesionalBloqueado = false));

    const TABLAS_PROFESIONAL = [
      'professional_pre_registrations',
      'v_professional_attendance',
      'professional_module_grades',
    ];
    /** Todo con datos: cada revisión de Clase Profesional generaría su alerta. */
    const conDatosEnTodo = () => {
      const consultadas: string[] = [];
      fromSpy.mockImplementation((table: string) => {
        consultadas.push(table);
        if (table === 'cash_closings') return buildChain({ count: 1 });
        if (TABLAS_PROFESIONAL.includes(table)) return buildChain({ count: 3 });
        if (table === 'enrollments') return buildChain({ count: 2 });
        return buildChain({ data: [], count: 0 });
      });
      return consultadas;
    };
    const esProfesional = (id: string) =>
      /pre-registration|psych|professional|failed-modules|draft-grades/.test(id);

    it('con el recorte bloqueado no consulta ni muestra las alertas de Clase Profesional', async () => {
      pilot.profesionalBloqueado = true;
      (TestBed.inject(AuthFacade).currentUser as any).mockReturnValue({ dbId: 1, role: 'admin' });
      const consultadas = conDatosEnTodo();

      await facade.loadAlerts();

      expect(consultadas.filter((t) => TABLAS_PROFESIONAL.includes(t))).toEqual([]);
      expect(facade.activeAlerts().filter((a) => esProfesional(a.id))).toEqual([]);
      // Las demás siguen: pagos pendientes, por ejemplo.
      expect(facade.activeAlerts().some((a) => a.id === 'alert-pending-payments')).toBe(true);
      expect(facade.loadProblem()).toBeNull();
    });

    it('con el recorte habilitado se muestran', async () => {
      (TestBed.inject(AuthFacade).currentUser as any).mockReturnValue({ dbId: 1, role: 'admin' });
      conDatosEnTodo();

      await facade.loadAlerts();

      expect(facade.activeAlerts().filter((a) => esProfesional(a.id)).length).toBe(7);
    });
  });

  // ── fix-410-m: cada alerta cuenta dentro de su curso y de su sede ────────────
  describe('alcance de las alertas (fix-410-m)', () => {
    /** Llamadas a los filtros de una cadena (todos los métodos comparten el mismo spy). */
    const filtros = (chain: any) => chain.eq.mock.calls as unknown[][];
    const sede = (branchId: number | null) =>
      (TestBed.inject(BranchFacade).selectedBranchId as any).mockReturnValue(branchId);
    const comoAdmin = () =>
      (TestBed.inject(AuthFacade).currentUser as any).mockReturnValue({ dbId: 1, role: 'admin' });

    it('"listos para certificar" cuenta solo matrículas Clase B', async () => {
      const chains: any[] = [];
      fromSpy.mockImplementation((table: string) => {
        const chain = buildChain(table === 'cash_closings' ? { count: 1 } : { data: [], count: 0 });
        if (table === 'enrollments') chains.push(chain);
        return chain;
      });

      await facade.loadAlerts();

      // Una de las consultas a enrollments es la de certificados: debe acotar el curso.
      const certificados = chains.find((c) =>
        filtros(c).some(([column]) => column === 'certificate_enabled'),
      );
      expect(filtros(certificados)).toContainEqual(['license_group', 'class_b']);
    });

    it('asistencia Profesional: con una sede elegida cuenta solo las matrículas de esa sede', async () => {
      comoAdmin();
      sede(1);
      const cruces: any[] = [];
      fromSpy.mockImplementation((table: string) => {
        if (table === 'cash_closings') return buildChain({ count: 1 });
        if (table === 'v_professional_attendance')
          return buildChain({ data: [{ enrollment_id: 10 }, { enrollment_id: 11 }] });
        const chain = buildChain({ data: [], count: 0 });
        if (table === 'enrollments') cruces.push(chain);
        return chain;
      });

      await facade.loadAlerts();

      // Los ids de la vista se cruzan contra enrollments de la sede; ninguno es de la sede 1.
      const cruce = cruces.find((c) =>
        filtros(c).some(([column, value]) => column === 'id' && Array.isArray(value)),
      );
      expect(filtros(cruce)).toContainEqual(['id', [10, 11]]);
      expect(filtros(cruce)).toContainEqual(['branch_id', 1]);
      expect(
        facade.activeAlerts().find((a) => a.id === 'alert-professional-attendance-red'),
      ).toBeUndefined();
    });

    it('asistencia Profesional: con "Todas" cuenta todas, sin cruce', async () => {
      comoAdmin();
      sede(null);
      fromSpy.mockImplementation((table: string) => {
        if (table === 'cash_closings') return buildChain({ count: 1 });
        if (table === 'v_professional_attendance') return buildChain({ count: 6 });
        return buildChain({ data: [], count: 0 });
      });

      await facade.loadAlerts();

      expect(
        facade.activeAlerts().find((a) => a.id === 'alert-professional-attendance-red')?.count,
      ).toBe(6);
    });

    it('"instructores sin liquidar": con una sede elegida filtra por la sede del instructor', async () => {
      comoAdmin();
      sede(2);
      let horas: any;
      fromSpy.mockImplementation((table: string) => {
        if (table === 'cash_closings') return buildChain({ count: 1 });
        const chain = buildChain({ data: [], count: 0 });
        if (table === 'instructor_monthly_hours') horas = chain;
        return chain;
      });

      await facade.loadAlerts();

      expect(filtros(horas)).toContainEqual(['instructors.users.branch_id', 2]);
    });
  });

  // ── fix-409-m: lo guardado es de quien lo cargó ─────────────────────────────
  describe('cambio de usuario (fix-409-m)', () => {
    const conPagosPendientes = (count: number) => {
      const callCounters: Record<string, number> = {};
      fromSpy.mockImplementation((table: string) => {
        callCounters[table] = (callCounters[table] ?? 0) + 1;
        if (table === 'alert_config') return buildChain({ data: [] });
        if (table === 'cash_closings') return buildChain({ count: 1 });
        if (table === 'enrollments')
          return callCounters[table] % 4 === 1 ? buildChain({ count }) : buildChain({ count: 0 });
        return buildChain({ data: [], count: 0 });
      });
    };
    const usuario = (id: string) =>
      (TestBed.inject(AuthFacade).currentUser as any).mockReturnValue({ id, dbId: 1 });

    it('otro usuario no ve las alertas del anterior mientras cargan las suyas', async () => {
      usuario('uid-1');
      conPagosPendientes(5);
      await facade.initialize();
      expect(facade.activeAlerts().map((a) => a.id)).toEqual(['alert-pending-payments']);

      usuario('uid-2');
      const carga = facade.initialize();

      expect(facade.activeAlerts()).toEqual([]);
      expect(facade.isLoading()).toBe(true);
      await carga;
      expect(facade.isLoading()).toBe(false);
    });

    it('el mismo usuario que vuelve sigue viendo sus alertas al instante', async () => {
      usuario('uid-1');
      conPagosPendientes(5);
      await facade.initialize();

      void facade.initialize();

      expect(facade.activeAlerts().map((a) => a.id)).toEqual(['alert-pending-payments']);
      expect(facade.isLoading()).toBe(false);
    });
  });

  // ── fix-405-m: una consulta fallida no es "0 resultados" ─────────────────────
  describe('errores de consulta (fix-405-m)', () => {
    const fallo = { data: null, count: null, error: { message: 'Failed to fetch' } };

    it('si fallan todas las consultas, no hay alertas inventadas y la carga queda en error', async () => {
      fromSpy.mockImplementation(() => buildChain(fallo));

      await facade.loadAlerts();

      // Antes: "Caja sin cerrar" aparecía porque no se pudo contar el cierre.
      expect(facade.activeAlerts()).toEqual([]);
      expect(facade.error()).toBe('Error al cargar alertas');
      expect(facade.loadProblem()).toBe('No se pudieron revisar las alertas.');
    });

    it('si falla solo una revisión, muestra las demás y avisa que la lista está incompleta', async () => {
      const callCounters: Record<string, number> = {};
      fromSpy.mockImplementation((table: string) => {
        callCounters[table] = (callCounters[table] ?? 0) + 1;
        if (table === 'alert_config') return buildChain({ data: [] });
        if (table === 'cash_closings') return buildChain(fallo);
        if (table === 'enrollments')
          return callCounters[table] === 1 ? buildChain({ count: 5 }) : buildChain({ count: 0 });
        return buildChain({ data: [], count: 0 });
      });

      await facade.loadAlerts();

      expect(facade.activeAlerts().map((a) => a.id)).toEqual(['alert-pending-payments']);
      expect(facade.error()).toBeNull();
      expect(facade.loadProblem()).toBe('No se pudieron revisar todas las alertas.');
    });

    it('con todas las revisiones respondidas no hay aviso', async () => {
      buildCleanMock(fromSpy);

      await facade.loadAlerts();

      expect(facade.loadProblem()).toBeNull();
    });
  });

  // ── fix-404-m: cambio de sede seguido ───────────────────────────────────────
  describe('cargas fuera de orden (fix-404-m)', () => {
    const alerta = (id: string) => ({
      id,
      title: id,
      description: '',
      severity: 'warning' as const,
    });

    /**
     * Deja todas las consultas en vacío salvo "pagos pendientes", que responde cuando el test
     * lo decide: una promesa por carga, en el orden en que se pidieron.
     */
    function controlarCargas() {
      const cargas: { resolve: (v: unknown) => void; reject: (e: unknown) => void }[] = [];
      const proto = Object.getPrototypeOf(facade);
      for (const name of Object.getOwnPropertyNames(proto).filter((n) => n.startsWith('check'))) {
        vi.spyOn(facade as any, name).mockResolvedValue([]);
      }
      vi.spyOn(facade as any, 'checkPendingPayments').mockImplementation(
        () => new Promise((resolve, reject) => cargas.push({ resolve, reject })),
      );
      return cargas;
    }

    it('quedan las alertas de la última carga pedida aunque la primera responda después', async () => {
      const cargas = controlarCargas();

      const vieja = facade.initialize();
      const vigente = facade.initialize();

      cargas[1].resolve([alerta('sede-nueva')]);
      await vigente;
      cargas[0].resolve([alerta('sede-anterior')]);
      await vieja;

      expect(facade.activeAlerts().map((a) => a.id)).toEqual(['sede-nueva']);
    });

    it('una carga vieja que termina primero no apaga isLoading ni deja sus alertas', async () => {
      const cargas = controlarCargas();

      const vieja = facade.initialize();
      const vigente = facade.initialize();

      cargas[0].resolve([alerta('sede-anterior')]);
      await vieja;
      expect(facade.isLoading()).toBe(true);
      expect(facade.activeAlerts()).toEqual([]);

      cargas[1].resolve([alerta('sede-nueva')]);
      await vigente;
      expect(facade.isLoading()).toBe(false);
      expect(facade.activeAlerts().map((a) => a.id)).toEqual(['sede-nueva']);
    });

    it('el fallo de la carga vigente se avisa; el de una vieja, no', async () => {
      const cargas = controlarCargas();

      const vieja = facade.initialize();
      const vigente = facade.initialize();

      cargas[0].reject(new Error('vieja'));
      await vieja;
      expect(facade.loadProblem()).toBeNull();

      // Falla una sola revisión de la carga vigente: lista incompleta (fix-405-m).
      cargas[1].reject(new Error('vigente'));
      await vigente;
      expect(facade.loadProblem()).toBe('No se pudieron revisar todas las alertas.');
      expect(facade.isLoading()).toBe(false);
    });
  });

  // ── B-1: Sixth class with pending debt ──────────────────────────────────────
  describe('B-1: checkSixthClassWithDebt', () => {
    it('should generate a warning alert when students at 6th class have pending balance', async () => {
      const callCounters: Record<string, number> = {};
      fromSpy.mockImplementation((table: string) => {
        callCounters[table] = (callCounters[table] ?? 0) + 1;

        if (table === 'alert_config') return buildChain({ data: [] });
        if (table === 'vehicle_documents') return buildChain({ count: 0 });
        if (table === 'cash_closings') return buildChain({ count: 1 });
        if (table === 'enrollments') return buildChain({ count: 0 });

        if (table === 'class_b_sessions') {
          const n = callCounters[table];
          if (n === 1) {
            // checkSixthClassWithDebt — 2 distinct enrollments at class 6 with debt
            return buildChain({
              data: [
                { enrollment_id: 101, enrollments: { pending_balance: 150000, branch_id: 1 } },
                { enrollment_id: 102, enrollments: { pending_balance: 120000, branch_id: 1 } },
              ],
            });
          }
          // checkOverdueSecondInstallment — no data
          return buildChain({ data: [] });
        }

        return buildChain({ data: [], count: 0 });
      });

      await facade.loadAlerts();

      const b1 = facade.activeAlerts().find((a) => a.id === 'alert-sixth-class-debt');
      expect(b1).toBeDefined();
      expect(b1?.severity).toBe('warning');
      expect(b1?.count).toBe(2);
    });

    it('should not generate B-1 alert when no students have debt at 6th class', async () => {
      buildCleanMock(fromSpy);

      await facade.loadAlerts();

      expect(facade.activeAlerts().find((a) => a.id === 'alert-sixth-class-debt')).toBeUndefined();
    });

    it('should deduplicate enrollment_id when multiple sessions match', async () => {
      const callCounters: Record<string, number> = {};
      fromSpy.mockImplementation((table: string) => {
        callCounters[table] = (callCounters[table] ?? 0) + 1;

        if (table === 'alert_config') return buildChain({ data: [] });
        if (table === 'vehicle_documents') return buildChain({ count: 0 });
        if (table === 'cash_closings') return buildChain({ count: 1 });
        if (table === 'enrollments') return buildChain({ count: 0 });

        if (table === 'class_b_sessions') {
          if (callCounters[table] === 1) {
            // Same enrollment_id twice (shouldn't count twice)
            return buildChain({
              data: [
                { enrollment_id: 200, enrollments: { pending_balance: 100, branch_id: 1 } },
                { enrollment_id: 200, enrollments: { pending_balance: 100, branch_id: 1 } },
              ],
            });
          }
          return buildChain({ data: [] });
        }

        return buildChain({ data: [], count: 0 });
      });

      await facade.loadAlerts();

      const b1 = facade.activeAlerts().find((a) => a.id === 'alert-sixth-class-debt');
      expect(b1?.count).toBe(1);
    });
  });

  // ── B-2: Twelfth class — certificate pending ─────────────────────────────────
  describe('B-2: checkTwelfthClassCompleted', () => {
    it('should generate a success alert when students need their certificate generated', async () => {
      const callCounters: Record<string, number> = {};
      fromSpy.mockImplementation((table: string) => {
        callCounters[table] = (callCounters[table] ?? 0) + 1;

        if (table === 'alert_config') return buildChain({ data: [] });
        if (table === 'vehicle_documents') return buildChain({ count: 0 });
        if (table === 'class_b_sessions') return buildChain({ data: [] });
        if (table === 'cash_closings') return buildChain({ count: 1 });

        if (table === 'enrollments') {
          const n = callCounters[table];
          // call 1 = checkPendingPayments, call 2 = checkTwelfthClassCompleted (3 pending certs)
          return n === 2 ? buildChain({ count: 3 }) : buildChain({ count: 0 });
        }

        return buildChain({ data: [], count: 0 });
      });

      await facade.loadAlerts();

      const b2 = facade.activeAlerts().find((a) => a.id === 'alert-twelfth-class-cert-pending');
      expect(b2).toBeDefined();
      expect(b2?.severity).toBe('success');
      expect(b2?.count).toBe(3);
    });

    it('should not generate B-2 alert when all certificates are generated', async () => {
      buildCleanMock(fromSpy);

      await facade.loadAlerts();

      expect(
        facade.activeAlerts().find((a) => a.id === 'alert-twelfth-class-cert-pending'),
      ).toBeUndefined();
    });
  });

  // ── B-3: Consecutive absences ─────────────────────────────────────────────────
  describe('B-3: checkConsecutiveAbsences', () => {
    /** Una inasistencia vigente tal como la devuelve la query (fix-364-m). */
    const absence = (enrollmentId: number, classNumber: number) => ({
      class_b_sessions: {
        enrollment_id: enrollmentId,
        class_number: classNumber,
        status: 'no_show',
        enrollments: { branch_id: 1, status: 'active' },
      },
    });

    const mockAbsences = (rows: unknown[]) => {
      fromSpy.mockImplementation((table: string) => {
        if (table === 'alert_config') return buildChain({ data: [] });
        if (table === 'cash_closings') return buildChain({ count: 1 });
        if (table === 'class_b_practice_attendance') return buildChain({ data: rows });
        return buildChain({ data: [], count: 0 });
      });
    };

    it('alerta con acción cuando hay inasistencias en dos clases seguidas', async () => {
      mockAbsences([
        absence(301, 3),
        absence(301, 4),
        absence(302, 7),
        absence(302, 8),
        absence(303, 5), // una sola falta — excluida
      ]);

      await facade.loadAlerts();

      const b3 = facade.activeAlerts().find((a) => a.id === 'alert-consecutive-absences');
      expect(b3).toBeDefined();
      expect(b3?.severity).toBe('error');
      expect(b3?.count).toBe(2);
      expect(b3?.action?.type).toBe('clear-schedule');
      expect(b3?.action?.enrollmentIds).toEqual([301, 302]);
    });

    it('se arma con inasistencias registradas, no con clases agendadas de hora pasada (fix-364-m)', async () => {
      // Dos clases 'scheduled' de esta mañana que nadie inició: antes disparaban la alerta.
      fromSpy.mockImplementation((table: string) => {
        if (table === 'alert_config') return buildChain({ data: [] });
        if (table === 'cash_closings') return buildChain({ count: 1 });
        if (table === 'class_b_sessions')
          return buildChain({
            data: [
              { enrollment_id: 301, enrollments: { branch_id: 1 } },
              { enrollment_id: 301, enrollments: { branch_id: 1 } },
            ],
          });
        return buildChain({ data: [], count: 0 });
      });

      await facade.loadAlerts();

      expect(fromSpy).toHaveBeenCalledWith('class_b_practice_attendance');
      expect(
        facade.activeAlerts().find((a) => a.id === 'alert-consecutive-absences'),
      ).toBeUndefined();
    });

    it('no alerta sin inasistencias', async () => {
      buildCleanMock(fromSpy);

      await facade.loadAlerts();

      expect(
        facade.activeAlerts().find((a) => a.id === 'alert-consecutive-absences'),
      ).toBeUndefined();
    });

    it('fix-391-m: "Borrar horarios" deja fuera a los alumnos cuyo par ya fue penalizado', async () => {
      const penalized = (enrollmentId: number, classNumber: number) => ({
        recorded_at: '2026-10-07T12:00:00Z',
        class_b_sessions: {
          enrollment_id: enrollmentId,
          class_number: classNumber,
          status: 'no_show',
          enrollments: {
            branch_id: 1,
            status: 'active',
            absence_penalty_applied_at: '2026-10-08T00:00:00Z',
          },
        },
      });
      mockAbsences([penalized(301, 3), penalized(301, 4), absence(302, 7), absence(302, 8)]);

      await facade.loadAlerts();

      const b3 = facade.activeAlerts().find((a) => a.id === 'alert-consecutive-absences');
      expect(b3?.count).toBe(2);
      expect(b3?.action?.enrollmentIds).toEqual([302]);
    });

    it('fix-391-m: si todos los pares ya fueron penalizados, la alerta no ofrece acción', async () => {
      const penalized = (classNumber: number) => ({
        recorded_at: '2026-10-07T12:00:00Z',
        class_b_sessions: {
          enrollment_id: 301,
          class_number: classNumber,
          status: 'no_show',
          enrollments: {
            branch_id: 1,
            status: 'active',
            absence_penalty_applied_at: '2026-10-08T00:00:00Z',
          },
        },
      });
      mockAbsences([penalized(3), penalized(4)]);

      await facade.loadAlerts();

      const b3 = facade.activeAlerts().find((a) => a.id === 'alert-consecutive-absences');
      expect(b3?.count).toBe(1);
      expect(b3?.action).toBeUndefined();
    });

    it('no alerta con dos faltas que no son seguidas', async () => {
      mockAbsences([absence(401, 2), absence(401, 7), absence(402, 1)]);

      await facade.loadAlerts();

      expect(
        facade.activeAlerts().find((a) => a.id === 'alert-consecutive-absences'),
      ).toBeUndefined();
    });
  });

  // ── F-3: Cash not closed ──────────────────────────────────────────────────────
  describe('F-3: checkUnclosedCash', () => {
    it('should generate an error alert when cash has not been closed today', async () => {
      const callCounters: Record<string, number> = {};
      fromSpy.mockImplementation((table: string) => {
        callCounters[table] = (callCounters[table] ?? 0) + 1;

        if (table === 'alert_config') return buildChain({ data: [] });
        if (table === 'vehicle_documents') return buildChain({ count: 0 });
        if (table === 'enrollments') return buildChain({ count: 0 });
        if (table === 'class_b_sessions') return buildChain({ data: [] });
        if (table === 'branches') return buildChain({ data: [{ id: 1, name: 'Sede Uno' }] });
        if (table === 'cash_closings') return buildChain({ data: [] }); // NOT closed

        return buildChain({ data: [], count: 0 });
      });

      await facade.loadAlerts();

      const f3 = facade.activeAlerts().find((a) => a.id === 'alert-cash-not-closed');
      expect(f3).toBeDefined();
      expect(f3?.severity).toBe('error');
      expect(f3?.action?.type).toBe('navigate');
    });

    it('should not generate F-3 alert when cash is already closed', async () => {
      buildCleanMock(fromSpy); // buildCleanMock returns count: 1 for cash_closings

      await facade.loadAlerts();

      expect(facade.activeAlerts().find((a) => a.id === 'alert-cash-not-closed')).toBeUndefined();
    });

    describe('dice qué sede falta por cerrar (fix-423-m)', () => {
      const SEDES = [
        { id: 1, name: 'Autoescuela Chillán' },
        { id: 2, name: 'Conductores Chillán' },
      ];
      const conCierres = (cerradas: number[]) =>
        fromSpy.mockImplementation((table: string) => {
          if (table === 'branches') return buildChain({ data: SEDES });
          if (table === 'cash_closings')
            return buildChain({ data: cerradas.map((branch_id) => ({ branch_id })) });
          if (table === 'alert_config') return buildChain({ data: [] });
          return buildChain({ data: [], count: 0 });
        });
      const alertaCaja = () => facade.activeAlerts().find((a) => a.id === 'alert-cash-not-closed');

      it('con "Todas" y una sede cerrada, nombra la que falta', async () => {
        conCierres([1]);
        await facade.loadAlerts();

        expect(alertaCaja()?.title).toBe('Caja sin cerrar: Conductores Chillán');
      });

      it('con "Todas" y ninguna cerrada, dice que faltan ambas', async () => {
        conCierres([]);
        await facade.loadAlerts();

        expect(alertaCaja()?.title).toBe('Caja sin cerrar en ambas sedes');
      });

      it('con las dos cerradas no hay alerta', async () => {
        conCierres([1, 2]);
        await facade.loadAlerts();

        expect(alertaCaja()).toBeUndefined();
      });

      it('con una sede elegida, nombra esa sede', async () => {
        (TestBed.inject(AuthFacade).currentUser as any).mockReturnValue({ dbId: 1, role: 'admin' });
        (TestBed.inject(BranchFacade).selectedBranchId as any).mockReturnValue(1);
        fromSpy.mockImplementation((table: string) => {
          if (table === 'branches') return buildChain({ data: [SEDES[0]] });
          if (table === 'cash_closings') return buildChain({ data: [] });
          if (table === 'alert_config') return buildChain({ data: [] });
          return buildChain({ data: [], count: 0 });
        });
        await facade.loadAlerts();

        expect(alertaCaja()?.title).toBe('Caja sin cerrar: Autoescuela Chillán');
      });
    });
  });

  // ── fix-428-m: el saldo pendiente con el mismo criterio que la cartera ───────
  describe('saldo pendiente con el criterio de la cartera (fix-428-m)', () => {
    /** Chain que anota cada filtro aplicado sobre `enrollments`. */
    const enrollmentsQueries: Array<Array<[string, unknown[]]>> = [];
    const chainConFiltros = (data: unknown[]) => {
      const llamadas: Array<[string, unknown[]]> = [];
      enrollmentsQueries.push(llamadas);
      const chain: any = buildChain({ data });
      for (const m of ['select', 'eq', 'not', 'gt', 'lt', 'in', 'is', 'or']) {
        chain[m] = vi.fn((...args: unknown[]) => {
          llamadas.push([m, args]);
          return chain;
        });
      }
      return chain;
    };

    const montar = (filasPorLlamada: (n: number) => unknown[]) => {
      enrollmentsQueries.length = 0;
      let n = 0;
      fromSpy.mockImplementation((table: string) => {
        if (table === 'enrollments') return chainConFiltros(filasPorLlamada(++n));
        if (table === 'alert_config') return buildChain({ data: [] });
        return buildChain({ data: [], count: 0 });
      });
    };
    const consultaCon = (filtro: string) =>
      enrollmentsQueries.find(
        (q) =>
          q.some(([m, a]) => m === 'gt' && a[0] === 'pending_balance') &&
          q.some(([m]) => m === filtro),
      );

    it('cuenta alumnos distintos, no matrículas', async () => {
      // Todas las consultas de matrículas devuelven 3 matrículas de 2 alumnos.
      montar(() => [{ student_id: 7 }, { student_id: 7 }, { student_id: 9 }]);
      await facade.loadAlerts();

      const alerta = facade.activeAlerts().find((a) => a.id === 'alert-pending-payments');
      expect(alerta?.title).toBe('2 alumnos con saldo pendiente');
      expect(alerta?.count).toBe(2);
      const vieja = facade.activeAlerts().find((a) => a.id === 'alert-old-debts');
      expect(vieja?.title).toBe('2 alumnos con saldo de una matrícula de más de 60 días');
    });

    it('incluye egresados y retirados: excluye solo borradores, canceladas y pagos abandonados', async () => {
      montar(() => []);
      await facade.loadAlerts();

      const deudas = enrollmentsQueries.filter((q) =>
        q.some(([m, a]) => m === 'gt' && a[0] === 'pending_balance'),
      );
      expect(deudas).toHaveLength(2);
      for (const q of deudas) {
        expect(q).toContainEqual(['not', ['status', 'in', '(draft,cancelled,pending_payment)']]);
        expect(q).toContainEqual(['eq', ['license_group', 'class_b']]);
        expect(q.some(([m, a]) => m === 'eq' && a[0] === 'status')).toBe(false);
      }
      expect(consultaCon('lt')).toBeDefined(); // la de más de 60 días
    });
  });

  // ── F-4: Old debts (> 60 days) ───────────────────────────────────────────────
  describe('F-4: checkOldDebts', () => {
    it('should generate a warning alert when students have debt older than 60 days', async () => {
      const callCounters: Record<string, number> = {};
      fromSpy.mockImplementation((table: string) => {
        callCounters[table] = (callCounters[table] ?? 0) + 1;

        if (table === 'alert_config') return buildChain({ data: [] });
        if (table === 'vehicle_documents') return buildChain({ count: 0 });
        if (table === 'class_b_sessions') return buildChain({ data: [] });
        if (table === 'cash_closings') return buildChain({ count: 1 });

        if (table === 'enrollments') {
          const n = callCounters[table];
          // call 3 = checkOldDebts — 4 students with old debt
          return n === 3 ? buildChain({ count: 4 }) : buildChain({ count: 0 });
        }

        return buildChain({ data: [], count: 0 });
      });

      await facade.loadAlerts();

      const f4 = facade.activeAlerts().find((a) => a.id === 'alert-old-debts');
      expect(f4).toBeDefined();
      expect(f4?.severity).toBe('warning');
      expect(f4?.count).toBe(4);
    });

    it('should not generate F-4 alert when no old debts exist', async () => {
      buildCleanMock(fromSpy);

      await facade.loadAlerts();

      expect(facade.activeAlerts().find((a) => a.id === 'alert-old-debts')).toBeUndefined();
    });
  });

  // ── Phase 3 — F-1: Recent payments ───────────────────────────────────────────
  describe('F-1: checkRecentPayments', () => {
    it('should generate a success alert when payments were registered today', async () => {
      fromSpy.mockImplementation((table: string) => {
        if (table === 'alert_config') return buildChain({ data: [] });
        if (table === 'vehicle_documents') return buildChain({ count: 0 });
        if (table === 'enrollments') return buildChain({ count: 0 });
        if (table === 'class_b_sessions') return buildChain({ data: [] });
        if (table === 'cash_closings') return buildChain({ count: 1 });
        if (table === 'payments') return buildChain({ count: 5 });
        return buildChain({ data: [], count: 0 });
      });

      await facade.loadAlerts();

      const f1 = facade.activeAlerts().find((a) => a.id === 'alert-recent-payments');
      expect(f1).toBeDefined();
      expect(f1?.severity).toBe('success');
      expect(f1?.count).toBe(5);
    });

    it('should not generate F-1 alert when no payments today', async () => {
      buildCleanMock(fromSpy);
      await facade.loadAlerts();
      expect(facade.activeAlerts().find((a) => a.id === 'alert-recent-payments')).toBeUndefined();
    });
  });

  // ── Phase 3 — F-2: Overdue second installment ────────────────────────────────
  describe('F-2: checkOverdueSecondInstallment', () => {
    /** Arma el mock y devuelve la cadena de la consulta F-2 (2ª a class_b_sessions). */
    const mockF2 = (rows: unknown[]) => {
      const f2Chain = buildChain({ data: rows });
      const callCounters: Record<string, number> = {};
      fromSpy.mockImplementation((table: string) => {
        callCounters[table] = (callCounters[table] ?? 0) + 1;

        if (table === 'alert_config') return buildChain({ data: [] });
        if (table === 'vehicle_documents') return buildChain({ count: 0 });
        if (table === 'enrollments') return buildChain({ count: 0 });
        if (table === 'cash_closings') return buildChain({ count: 1 });

        if (table === 'class_b_sessions') {
          return callCounters[table] === 1 ? buildChain({ data: [] }) /* B-1 */ : f2Chain;
        }

        return buildChain({ data: [], count: 0 });
      });
      return f2Chain;
    };

    it('avisa de las matrículas con saldo que ya tomaron una clase 7+, una vez cada una (fix-402-m)', async () => {
      // 501 con modalidad total, 502 con abono y dos clases 7+ tomadas.
      mockF2([
        { enrollment_id: 501, enrollments: { pending_balance: 100000, branch_id: 1 } },
        { enrollment_id: 502, enrollments: { pending_balance: 90000, branch_id: 1 } },
        { enrollment_id: 502, enrollments: { pending_balance: 90000, branch_id: 1 } },
      ]);

      await facade.loadAlerts();

      const f2 = facade.activeAlerts().find((a) => a.id === 'alert-overdue-second-installment');
      expect(f2).toBeDefined();
      expect(f2?.severity).toBe('warning');
      expect(f2?.count).toBe(2); // deduplicated: 501, 502
    });

    it('pide solo clases 7+ ya tomadas y no filtra por modalidad de pago (fix-402-m)', async () => {
      const f2Chain = mockF2([]);

      await facade.loadAlerts();

      // Todos los métodos de la cadena comparten el mismo spy.
      const filtros = f2Chain.eq.mock.calls as unknown[][];
      expect(filtros).toContainEqual(['status', ['in_progress', 'completed']]);
      expect(filtros).toContainEqual(['class_number', 6]);
      expect(filtros).toContainEqual(['enrollments.pending_balance', 0]);
      expect(filtros).toContainEqual(['enrollments.status', 'active']);
      // 'deposit' nunca existió (DG-004) y la segunda cuota ya no depende de la modalidad (0010-i).
      expect(filtros.some(([column]) => column === 'enrollments.payment_mode')).toBe(false);
    });

    it('should not generate F-2 when no overdue second installments exist', async () => {
      buildCleanMock(fromSpy);
      await facade.loadAlerts();
      expect(
        facade.activeAlerts().find((a) => a.id === 'alert-overdue-second-installment'),
      ).toBeUndefined();
    });
  });

  // ── Phase 3 — F-5: Pending instructor payments ───────────────────────────────
  describe('F-5: checkPendingInstructorPayments', () => {
    describe('revisa el mes anterior (fix-417-m)', () => {
      afterEach(() => vi.useRealTimers());

      /** Corre la carga en la fecha dada y devuelve los períodos consultados y la alerta. */
      const enFecha = async (instante: string) => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(instante));
        const cadenas: Record<string, any> = {};
        fromSpy.mockImplementation((table: string) => {
          if (table === 'cash_closings') return buildChain({ count: 1 });
          if (table === 'instructor_monthly_hours')
            return (cadenas[table] = buildChain({ data: [{ instructor_id: 10 }] }));
          if (table === 'instructor_monthly_payments')
            return (cadenas[table] = buildChain({ data: [] }));
          return buildChain({ data: [], count: 0 });
        });
        await facade.loadAlerts();
        const periodo = (table: string) =>
          (cadenas[table].eq.mock.calls as unknown[][]).find(([c]) => c === 'period')?.[1];
        return {
          horas: periodo('instructor_monthly_hours'),
          pagos: periodo('instructor_monthly_payments'),
          alerta: facade.activeAlerts().find((a) => a.id === 'alert-pending-instructor-payments'),
        };
      };

      it('el 14 de octubre revisa septiembre y lo dice en el texto', async () => {
        // 12:00 hora Chile del 14 de octubre de 2026.
        const { horas, pagos, alerta } = await enFecha('2026-10-14T15:00:00.000Z');

        expect(horas).toBe('2026-09');
        expect(pagos).toBe('2026-09');
        expect(alerta?.description).toBe('Tienen horas de septiembre de 2026 sin liquidación');
      });

      it('en enero revisa diciembre del año anterior', async () => {
        const { horas, pagos } = await enFecha('2027-01-05T15:00:00.000Z');

        expect(horas).toBe('2026-12');
        expect(pagos).toBe('2026-12');
      });

      it('el día 1 a las 23:30 hora Chile sigue siendo el mes que empieza, no el siguiente', async () => {
        // 23:30 del 1 de noviembre en Chile = 02:30 UTC del día 2.
        const { horas } = await enFecha('2026-11-02T02:30:00.000Z');

        expect(horas).toBe('2026-10');
      });
    });

    it('should generate a warning when instructors have hours but no payment for this period', async () => {
      fromSpy.mockImplementation((table: string) => {
        if (table === 'alert_config') return buildChain({ data: [] });
        if (table === 'vehicle_documents') return buildChain({ count: 0 });
        if (table === 'enrollments') return buildChain({ count: 0 });
        if (table === 'class_b_sessions') return buildChain({ data: [] });
        if (table === 'cash_closings') return buildChain({ count: 1 });
        if (table === 'payments') return buildChain({ count: 0 });
        if (table === 'instructor_monthly_hours')
          return buildChain({
            data: [{ instructor_id: 10 }, { instructor_id: 11 }, { instructor_id: 12 }],
          });
        if (table === 'instructor_monthly_payments')
          return buildChain({ data: [{ instructor_id: 10 }] }); // only one paid
        return buildChain({ data: [], count: 0 });
      });

      await facade.loadAlerts();

      const f5 = facade.activeAlerts().find((a) => a.id === 'alert-pending-instructor-payments');
      expect(f5).toBeDefined();
      expect(f5?.severity).toBe('warning');
      expect(f5?.count).toBe(2); // instructors 11 and 12 unpaid
    });

    it('should not generate F-5 when all instructors with hours are already paid', async () => {
      fromSpy.mockImplementation((table: string) => {
        if (table === 'alert_config') return buildChain({ data: [] });
        if (table === 'vehicle_documents') return buildChain({ count: 0 });
        if (table === 'enrollments') return buildChain({ count: 0 });
        if (table === 'class_b_sessions') return buildChain({ data: [] });
        if (table === 'cash_closings') return buildChain({ count: 1 });
        if (table === 'payments') return buildChain({ count: 0 });
        if (table === 'instructor_monthly_hours')
          return buildChain({ data: [{ instructor_id: 20 }] });
        if (table === 'instructor_monthly_payments')
          return buildChain({ data: [{ instructor_id: 20 }] }); // all paid
        return buildChain({ data: [], count: 0 });
      });

      await facade.loadAlerts();

      expect(
        facade.activeAlerts().find((a) => a.id === 'alert-pending-instructor-payments'),
      ).toBeUndefined();
    });

    it('should not generate F-5 when no instructor has hours for this period', async () => {
      buildCleanMock(fromSpy); // instructor_monthly_hours returns [] → early return
      await facade.loadAlerts();
      expect(
        facade.activeAlerts().find((a) => a.id === 'alert-pending-instructor-payments'),
      ).toBeUndefined();
    });
  });

  // ── Phase 3 — P-1: New pre-registrations ─────────────────────────────────────
  describe('P-1: checkNewPreRegistrations', () => {
    it('should generate an info alert for pending_review pre-registrations', async () => {
      const callCounters: Record<string, number> = {};
      fromSpy.mockImplementation((table: string) => {
        callCounters[table] = (callCounters[table] ?? 0) + 1;

        if (table === 'alert_config') return buildChain({ data: [] });
        if (table === 'vehicle_documents') return buildChain({ count: 0 });
        if (table === 'enrollments') return buildChain({ count: 0 });
        if (table === 'class_b_sessions') return buildChain({ data: [] });
        if (table === 'cash_closings') return buildChain({ count: 1 });

        if (table === 'professional_pre_registrations') {
          const n = callCounters[table];
          if (n === 1) return buildChain({ count: 4 }); // P-1: 4 pending
          return buildChain({ count: 0 }); // P-2, P-3: empty
        }

        return buildChain({ data: [], count: 0 });
      });

      await facade.loadAlerts();

      const p1 = facade.activeAlerts().find((a) => a.id === 'alert-new-pre-registrations');
      expect(p1).toBeDefined();
      expect(p1?.severity).toBe('info');
      expect(p1?.count).toBe(4);
    });

    it('should not generate P-1 when no pending pre-registrations', async () => {
      buildCleanMock(fromSpy);
      await facade.loadAlerts();
      expect(
        facade.activeAlerts().find((a) => a.id === 'alert-new-pre-registrations'),
      ).toBeUndefined();
    });
  });

  // ── Phase 3 — P-2: Psych test pending evaluation ─────────────────────────────
  describe('P-2: checkPendingPsychEvaluation', () => {
    it('should generate a warning for completed psych tests awaiting evaluation', async () => {
      const callCounters: Record<string, number> = {};
      fromSpy.mockImplementation((table: string) => {
        callCounters[table] = (callCounters[table] ?? 0) + 1;

        if (table === 'alert_config') return buildChain({ data: [] });
        if (table === 'vehicle_documents') return buildChain({ count: 0 });
        if (table === 'enrollments') return buildChain({ count: 0 });
        if (table === 'class_b_sessions') return buildChain({ data: [] });
        if (table === 'cash_closings') return buildChain({ count: 1 });

        if (table === 'professional_pre_registrations') {
          const n = callCounters[table];
          if (n === 1) return buildChain({ count: 0 }); // P-1: empty
          if (n === 2) return buildChain({ count: 3 }); // P-2: 3 pending evaluation
          return buildChain({ count: 0 }); // P-3: empty
        }

        return buildChain({ data: [], count: 0 });
      });

      await facade.loadAlerts();

      const p2 = facade.activeAlerts().find((a) => a.id === 'alert-pending-psych-evaluation');
      expect(p2).toBeDefined();
      expect(p2?.severity).toBe('warning');
      expect(p2?.count).toBe(3);
    });

    it('should not generate P-2 when no pending psych evaluations', async () => {
      buildCleanMock(fromSpy);
      await facade.loadAlerts();
      expect(
        facade.activeAlerts().find((a) => a.id === 'alert-pending-psych-evaluation'),
      ).toBeUndefined();
    });
  });

  // ── Phase 3 — P-3: Expiring pre-registrations ────────────────────────────────
  describe('P-3: checkExpiringPreRegistrations', () => {
    it('should generate a warning for pre-registrations expiring in the next 7 days', async () => {
      const callCounters: Record<string, number> = {};
      fromSpy.mockImplementation((table: string) => {
        callCounters[table] = (callCounters[table] ?? 0) + 1;

        if (table === 'alert_config') return buildChain({ data: [] });
        if (table === 'vehicle_documents') return buildChain({ count: 0 });
        if (table === 'enrollments') return buildChain({ count: 0 });
        if (table === 'class_b_sessions') return buildChain({ data: [] });
        if (table === 'cash_closings') return buildChain({ count: 1 });

        if (table === 'professional_pre_registrations') {
          const n = callCounters[table];
          if (n === 1) return buildChain({ count: 0 }); // P-1
          if (n === 2) return buildChain({ count: 0 }); // P-2
          return buildChain({ count: 2 }); // P-3: 2 expiring soon
        }

        return buildChain({ data: [], count: 0 });
      });

      await facade.loadAlerts();

      const p3 = facade.activeAlerts().find((a) => a.id === 'alert-expiring-pre-registrations');
      expect(p3).toBeDefined();
      expect(p3?.severity).toBe('warning');
      expect(p3?.count).toBe(2);
    });

    it('should not generate P-3 when no pre-registrations are expiring', async () => {
      buildCleanMock(fromSpy);
      await facade.loadAlerts();
      expect(
        facade.activeAlerts().find((a) => a.id === 'alert-expiring-pre-registrations'),
      ).toBeUndefined();
    });

    it('should not generate P-3 when expires_at column returns an error', async () => {
      const callCounters: Record<string, number> = {};
      fromSpy.mockImplementation((table: string) => {
        callCounters[table] = (callCounters[table] ?? 0) + 1;

        if (table === 'alert_config') return buildChain({ data: [] });
        if (table === 'vehicle_documents') return buildChain({ count: 0 });
        if (table === 'enrollments') return buildChain({ count: 0 });
        if (table === 'class_b_sessions') return buildChain({ data: [] });
        if (table === 'cash_closings') return buildChain({ count: 1 });

        if (table === 'professional_pre_registrations') {
          const n = callCounters[table];
          if (n === 1) return buildChain({ count: 0 }); // P-1
          if (n === 2) return buildChain({ count: 0 }); // P-2
          // P-3: expires_at column doesn't exist → DB error
          return buildChain({
            count: null,
            error: { code: '42703', message: 'column "expires_at" does not exist' },
          });
        }

        return buildChain({ data: [], count: 0 });
      });

      await facade.loadAlerts();

      expect(
        facade.activeAlerts().find((a) => a.id === 'alert-expiring-pre-registrations'),
      ).toBeUndefined();
    });
  });

  // ── Phase 3 — R-1: Professional attendance red ───────────────────────────────
  describe('R-1: checkRedAttendance', () => {
    it('should generate an error alert for students with critical (red) attendance', async () => {
      // Admin en "Todas las sedes": se cuenta la vista completa (fix-410-m).
      (TestBed.inject(AuthFacade).currentUser as any).mockReturnValue({ dbId: 1, role: 'admin' });
      fromSpy.mockImplementation((table: string) => {
        if (table === 'alert_config') return buildChain({ data: [] });
        if (table === 'vehicle_documents') return buildChain({ count: 0 });
        if (table === 'enrollments') return buildChain({ count: 0 });
        if (table === 'class_b_sessions') return buildChain({ data: [] });
        if (table === 'cash_closings') return buildChain({ count: 1 });
        if (table === 'v_professional_attendance') return buildChain({ count: 3 });
        return buildChain({ data: [], count: 0 });
      });

      await facade.loadAlerts();

      const r1 = facade.activeAlerts().find((a) => a.id === 'alert-professional-attendance-red');
      expect(r1).toBeDefined();
      expect(r1?.severity).toBe('error');
      expect(r1?.count).toBe(3);
    });

    it('should not generate R-1 when no students have red attendance', async () => {
      buildCleanMock(fromSpy);
      await facade.loadAlerts();
      expect(
        facade.activeAlerts().find((a) => a.id === 'alert-professional-attendance-red'),
      ).toBeUndefined();
    });
  });

  // ── Phase 3 — R-2: Professional attendance yellow ────────────────────────────
  describe('R-2: checkYellowAttendance', () => {
    it('should generate a warning for students with at-risk (yellow) attendance', async () => {
      // Admin en "Todas las sedes": se cuenta la vista completa (fix-410-m).
      (TestBed.inject(AuthFacade).currentUser as any).mockReturnValue({ dbId: 1, role: 'admin' });
      const callCounters: Record<string, number> = {};
      fromSpy.mockImplementation((table: string) => {
        callCounters[table] = (callCounters[table] ?? 0) + 1;

        if (table === 'alert_config') return buildChain({ data: [] });
        if (table === 'vehicle_documents') return buildChain({ count: 0 });
        if (table === 'enrollments') return buildChain({ count: 0 });
        if (table === 'class_b_sessions') return buildChain({ data: [] });
        if (table === 'cash_closings') return buildChain({ count: 1 });

        if (table === 'v_professional_attendance') {
          const n = callCounters[table];
          if (n === 1) return buildChain({ count: 0 }); // R-1: no red
          return buildChain({ count: 6 }); // R-2: 6 yellow
        }

        return buildChain({ data: [], count: 0 });
      });

      await facade.loadAlerts();

      const r2 = facade.activeAlerts().find((a) => a.id === 'alert-professional-attendance-yellow');
      expect(r2).toBeDefined();
      expect(r2?.severity).toBe('warning');
      expect(r2?.count).toBe(6);
    });

    it('should not generate R-2 when no students have yellow attendance', async () => {
      buildCleanMock(fromSpy);
      await facade.loadAlerts();
      expect(
        facade.activeAlerts().find((a) => a.id === 'alert-professional-attendance-yellow'),
      ).toBeUndefined();
    });
  });

  // ── Phase 3 — R-3: Failed professional modules ───────────────────────────────
  describe('R-3: checkFailedModules', () => {
    it('should generate a warning for confirmed grades below 75', async () => {
      const callCounters: Record<string, number> = {};
      fromSpy.mockImplementation((table: string) => {
        callCounters[table] = (callCounters[table] ?? 0) + 1;

        if (table === 'alert_config') return buildChain({ data: [] });
        if (table === 'vehicle_documents') return buildChain({ count: 0 });
        if (table === 'enrollments') return buildChain({ count: 0 });
        if (table === 'class_b_sessions') return buildChain({ data: [] });
        if (table === 'cash_closings') return buildChain({ count: 1 });

        if (table === 'professional_module_grades') {
          const n = callCounters[table];
          if (n === 1) return buildChain({ count: 7 }); // R-3: 7 failed confirmed grades
          return buildChain({ count: 0 }); // R-6
        }

        return buildChain({ data: [], count: 0 });
      });

      await facade.loadAlerts();

      const r3 = facade.activeAlerts().find((a) => a.id === 'alert-failed-modules');
      expect(r3).toBeDefined();
      expect(r3?.severity).toBe('warning');
      expect(r3?.count).toBe(7);
    });

    it('should not generate R-3 when no confirmed failed modules', async () => {
      buildCleanMock(fromSpy);
      await facade.loadAlerts();
      expect(facade.activeAlerts().find((a) => a.id === 'alert-failed-modules')).toBeUndefined();
    });
  });

  // ── Phase 3 — R-6: Draft grades not confirmed ────────────────────────────────
  describe('R-6: checkDraftGrades', () => {
    it('should generate a warning for module grades still in draft state', async () => {
      const callCounters: Record<string, number> = {};
      fromSpy.mockImplementation((table: string) => {
        callCounters[table] = (callCounters[table] ?? 0) + 1;

        if (table === 'alert_config') return buildChain({ data: [] });
        if (table === 'vehicle_documents') return buildChain({ count: 0 });
        if (table === 'enrollments') return buildChain({ count: 0 });
        if (table === 'class_b_sessions') return buildChain({ data: [] });
        if (table === 'cash_closings') return buildChain({ count: 1 });

        if (table === 'professional_module_grades') {
          const n = callCounters[table];
          if (n === 1) return buildChain({ count: 0 }); // R-3
          return buildChain({ count: 5 }); // R-6: 5 draft grades
        }

        return buildChain({ data: [], count: 0 });
      });

      await facade.loadAlerts();

      const r6 = facade.activeAlerts().find((a) => a.id === 'alert-draft-grades');
      expect(r6).toBeDefined();
      expect(r6?.severity).toBe('warning');
      expect(r6?.count).toBe(5);
    });

    it('should not generate R-6 when no draft grades exist', async () => {
      buildCleanMock(fromSpy);
      await facade.loadAlerts();
      expect(facade.activeAlerts().find((a) => a.id === 'alert-draft-grades')).toBeUndefined();
    });
  });

  // ── clearSchedules (fix-364-m) ───────────────────────────────────────────────
  describe('clearSchedules', () => {
    const futureSession = (id: number, enrollmentId: number, first: string, last: string) => ({
      id,
      enrollment_id: enrollmentId,
      enrollments: { students: { users: { first_names: first, paternal_last_name: last } } },
    });

    const SESSIONS = [
      futureSession(1, 301, 'Juan', 'Pérez'),
      futureSession(2, 301, 'Juan', 'Pérez'),
      futureSession(3, 302, 'Ana', 'Soto'),
    ];

    /** 1ª llamada = búsqueda de clases futuras; 2ª = cancelación. */
    const mockLookupThenUpdate = (lookup: object, update: object = { data: [], error: null }) => {
      const chains = [buildChain(lookup), buildChain(update)];
      let call = 0;
      fromSpy.mockImplementation(() => chains[Math.min(call++, chains.length - 1)]);
      return chains;
    };

    it('busca solo clases agendadas futuras de las matrículas de la alerta', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-07T15:00:00.000Z'));
      try {
        const [lookup] = mockLookupThenUpdate({ data: [], error: null });

        await facade.clearSchedules([301, 302]);

        expect(lookup.in).toHaveBeenCalledWith('enrollment_id', [301, 302]);
        expect(lookup.eq).toHaveBeenCalledWith('status', 'scheduled');
        expect(lookup.gt).toHaveBeenCalledWith('scheduled_at', '2026-10-07T15:00:00.000Z');
      } finally {
        vi.useRealTimers();
      }
    });

    it('pide confirmación diciendo cuántas clases y de qué alumnos', async () => {
      confirmSpy.mockResolvedValue(false);
      mockLookupThenUpdate({ data: SESSIONS, error: null });

      await facade.clearSchedules([301, 302]);

      const config = confirmSpy.mock.calls[0][0];
      expect(config.severity).toBe('danger');
      expect(config.message).toContain('Se cancelarán 3 clases futuras de 2 alumnos');
      expect(config.message).toContain('Juan Pérez: 2 clases');
      expect(config.message).toContain('Ana Soto: 1 clase');
    });

    it('si el usuario no confirma, no cancela nada', async () => {
      confirmSpy.mockResolvedValue(false);
      const [, update] = mockLookupThenUpdate({ data: SESSIONS, error: null });

      const result = await facade.clearSchedules([301, 302]);

      expect(result).toBe(false);
      expect(fromSpy).toHaveBeenCalledTimes(1);
      expect(update.update).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('fix-391-m: al cancelar registra la penalización de las matrículas afectadas', async () => {
      const chains = [
        buildChain({ data: SESSIONS, error: null }),
        buildChain({ data: [{ id: 1 }, { id: 2 }, { id: 3 }], error: null }),
        buildChain({ data: [{ id: 301 }, { id: 302 }], error: null }),
      ];
      let call = 0;
      fromSpy.mockImplementation(() => chains[Math.min(call++, chains.length - 1)]);

      await facade.clearSchedules([301, 302]);

      expect(fromSpy).toHaveBeenNthCalledWith(3, 'enrollments');
      expect(chains[2].update).toHaveBeenCalledWith({
        absence_penalty_applied_at: expect.any(String),
      });
      expect(chains[2].in).toHaveBeenCalledWith('id', [301, 302]);
      expect(toast.warning).not.toHaveBeenCalled();
    });

    it('al confirmar cancela por id, deja cancelled_at y avisa el resultado', async () => {
      const [, update] = mockLookupThenUpdate(
        { data: SESSIONS, error: null },
        { data: [{ id: 1 }, { id: 2 }, { id: 3 }], error: null },
      );

      const result = await facade.clearSchedules([301, 302]);

      expect(result).toBe(true);
      expect(update.update).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'cancelled', cancelled_at: expect.any(String) }),
      );
      expect(update.in).toHaveBeenCalledWith('id', [1, 2, 3]);
      expect(update.eq).toHaveBeenCalledWith('status', 'scheduled');
      expect(toast.success).toHaveBeenCalledWith(
        'Horarios borrados',
        'Se cancelaron 3 clases de 2 alumnos.',
      );
    });

    it('sin clases futuras avisa y no pide confirmación', async () => {
      mockLookupThenUpdate({ data: [], error: null });

      const result = await facade.clearSchedules([301]);

      expect(result).toBe(false);
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(toast.info).toHaveBeenCalled();
    });

    it('si la cancelación falla avisa el error y no da éxito', async () => {
      mockLookupThenUpdate(
        { data: SESSIONS, error: null },
        { data: null, error: { message: 'RLS violation', code: '42501' } },
      );

      const result = await facade.clearSchedules([301, 302]);

      expect(result).toBe(false);
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalled();
    });

    it('si la RLS filtra todas las clases (0 filas, sin error) tampoco da éxito', async () => {
      mockLookupThenUpdate({ data: SESSIONS, error: null }, { data: [], error: null });

      const result = await facade.clearSchedules([301, 302]);

      expect(result).toBe(false);
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalled();
    });

    it('sin matrículas no consulta nada', async () => {
      const result = await facade.clearSchedules([]);

      expect(result).toBe(false);
      expect(fromSpy).not.toHaveBeenCalled();
    });
  });

  // ── dismissAlert ─────────────────────────────────────────────────────────────
  describe('dismissAlert', () => {
    it('should immediately remove the alert from activeAlerts', async () => {
      buildCleanMock(fromSpy);
      const callCounters: Record<string, number> = {};
      fromSpy.mockImplementation((table: string) => {
        callCounters[table] = (callCounters[table] ?? 0) + 1;
        if (table === 'alert_config') return buildChain({ data: [] });
        if (table === 'branches') return buildChain({ data: [{ id: 1, name: 'Sede Uno' }] });
        if (table === 'cash_closings') return buildChain({ data: [] }); // not closed → F-3 alert
        return buildChain({ data: [], count: 0 });
      });

      await facade.loadAlerts();
      expect(facade.activeAlerts().some((a) => a.id === 'alert-cash-not-closed')).toBe(true);

      facade.dismissAlert('alert-cash-not-closed');
      expect(facade.activeAlerts().some((a) => a.id === 'alert-cash-not-closed')).toBe(false);
    });
  });

  // ── fix-415-m: descartar recuerda quién descartó y cuántos casos había ──────
  describe('descartar una alerta (fix-415-m)', () => {
    beforeEach(() => localStorage.removeItem('ds_snoozed_alerts'));
    afterEach(() => localStorage.removeItem('ds_snoozed_alerts'));

    const conPagosPendientes = (count: number) => {
      const callCounters: Record<string, number> = {};
      fromSpy.mockImplementation((table: string) => {
        callCounters[table] = (callCounters[table] ?? 0) + 1;
        if (table === 'alert_config') return buildChain({ data: [] });
        if (table === 'cash_closings') return buildChain({ count: 1 });
        if (table === 'enrollments')
          return callCounters[table] % 4 === 1 ? buildChain({ count }) : buildChain({ count: 0 });
        return buildChain({ data: [], count: 0 });
      });
    };
    const usuario = (id: string) =>
      (TestBed.inject(AuthFacade).currentUser as any).mockReturnValue({ id, dbId: 1 });
    const visibles = () => facade.activeAlerts().map((a) => a.id);

    it('sigue oculta al recargar con los mismos casos, y vuelve si hay más', async () => {
      usuario('uid-1');
      conPagosPendientes(5);
      await facade.loadAlerts();
      facade.dismissAlert('alert-pending-payments');

      // Una revisita refresca en segundo plano: se espera ese refresco directamente.
      const refrescar = () => (facade as any).refreshSilently() as Promise<void>;

      conPagosPendientes(5);
      await refrescar();
      expect(visibles()).toEqual([]);

      conPagosPendientes(6);
      await refrescar();
      expect(visibles()).toEqual(['alert-pending-payments']);
    });

    it('otro usuario en el mismo navegador la sigue viendo', async () => {
      usuario('uid-1');
      conPagosPendientes(5);
      await facade.loadAlerts();
      facade.dismissAlert('alert-pending-payments');

      usuario('uid-2');
      conPagosPendientes(5);
      await facade.loadAlerts();

      expect(visibles()).toEqual(['alert-pending-payments']);
    });

    it('un descarte guardado con el formato anterior no oculta nada', async () => {
      localStorage.setItem('ds_snoozed_alerts', '{"alert-pending-payments":' + Date.now() + '}');
      usuario('uid-1');
      conPagosPendientes(5);

      await facade.loadAlerts();

      expect(visibles()).toEqual(['alert-pending-payments']);
    });
  });
});
