import { TestBed } from '@angular/core/testing';
import { DashboardAlertsFacade } from './dashboard-alerts.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { ToastService } from '@core/services/ui/toast.service';

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
    const resolved = Promise.resolve(result);
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
      if (table === 'cash_closings') return buildChain({ count: 1 }); // caja cerrada
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
        if (table === 'cash_closings') return buildChain({ count: 0 }); // NOT closed

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
    it('should generate a warning when deposit-mode students have sessions past class 6 with unpaid balance', async () => {
      const callCounters: Record<string, number> = {};
      fromSpy.mockImplementation((table: string) => {
        callCounters[table] = (callCounters[table] ?? 0) + 1;

        if (table === 'alert_config') return buildChain({ data: [] });
        if (table === 'vehicle_documents') return buildChain({ count: 0 });
        if (table === 'enrollments') return buildChain({ count: 0 });
        if (table === 'cash_closings') return buildChain({ count: 1 });

        if (table === 'class_b_sessions') {
          const n = callCounters[table];
          if (n === 1) return buildChain({ data: [] }); // B-1
          // F-2: 2 deposit students with sessions beyond class 6 (501 duplicated)
          return buildChain({
            data: [
              {
                enrollment_id: 501,
                enrollments: { payment_mode: 'deposit', pending_balance: 100000, branch_id: 1 },
              },
              {
                enrollment_id: 502,
                enrollments: { payment_mode: 'deposit', pending_balance: 90000, branch_id: 1 },
              },
              {
                enrollment_id: 502,
                enrollments: { payment_mode: 'deposit', pending_balance: 90000, branch_id: 1 },
              },
            ],
          });
        }

        return buildChain({ data: [], count: 0 });
      });

      await facade.loadAlerts();

      const f2 = facade.activeAlerts().find((a) => a.id === 'alert-overdue-second-installment');
      expect(f2).toBeDefined();
      expect(f2?.severity).toBe('warning');
      expect(f2?.count).toBe(2); // deduplicated: 501, 502
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
        if (table === 'cash_closings') return buildChain({ count: 0 }); // not closed → F-3 alert
        return buildChain({ data: [], count: 0 });
      });

      await facade.loadAlerts();
      expect(facade.activeAlerts().some((a) => a.id === 'alert-cash-not-closed')).toBe(true);

      facade.dismissAlert('alert-cash-not-closed');
      expect(facade.activeAlerts().some((a) => a.id === 'alert-cash-not-closed')).toBe(false);
    });
  });
});
