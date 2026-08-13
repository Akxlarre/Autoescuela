import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { EnrollmentFacade } from './enrollment.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { DmsViewerService } from '@core/services/ui/dms-viewer.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { EnrollmentDocumentsFacade } from '@core/facades/enrollment-documents.facade';
import { EnrollmentPaymentFacade } from '@core/facades/enrollment-payment.facade';
import { NotificationsFacade } from '@core/facades/notifications.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { AgendaSettingsService } from '@core/services/ui/agenda-settings.service';

// ── Mock Supabase client ──

function createMockQueryBuilder(responseData: any = null, responseError: any = null) {
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    like: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: responseData, error: responseError }),
    maybeSingle: vi.fn().mockResolvedValue({ data: responseData, error: responseError }),
    // Make builder directly awaitable (for patterns like: await supabase.from(...).select(...).eq(...))
    then: (resolve: any, reject: any) =>
      Promise.resolve({ data: responseData, error: responseError }).then(resolve, reject),
  };
  return builder;
}

function createMockSupabaseService() {
  let channelCallback: (() => void) | null = null;

  const mockChannel = {
    on: vi.fn().mockImplementation((_event: string, _opts: any, cb: () => void) => {
      channelCallback = cb;
      return mockChannel;
    }),
    subscribe: vi.fn().mockReturnThis(),
  };

  const mockBuilder = createMockQueryBuilder();

  return {
    client: {
      from: vi.fn().mockReturnValue(mockBuilder),
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ error: null }),
          createSignedUrl: vi.fn().mockResolvedValue({
            data: { signedUrl: 'https://example.com/signed/file.pdf' },
            error: null,
          }),
        }),
      },
      functions: {
        invoke: vi
          .fn()
          .mockResolvedValue({ data: { pdfUrl: 'https://example.com/contract.pdf' }, error: null }),
      },
      channel: vi.fn().mockReturnValue(mockChannel),
      removeChannel: vi.fn(),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    },
    _mockBuilder: mockBuilder,
    _mockChannel: mockChannel,
    _getChannelCallback: () => channelCallback,
  };
}

function createMockService(methods: string[]) {
  const mock: any = {};
  methods.forEach((m) => (mock[m] = vi.fn()));
  return mock;
}

describe('EnrollmentFacade', () => {
  let facade: EnrollmentFacade;
  let mockSupabase: ReturnType<typeof createMockSupabaseService>;
  let mockConfirm: any;
  let mockViewer: any;
  let mockAuth: any;
  let mockDocs: any;
  let mockPayment: any;
  let mockNotifications: any;
  let mockToast: any;
  let mockAgendaSettings: any;

  beforeEach(() => {
    mockSupabase = createMockSupabaseService();
    mockConfirm = createMockService(['confirm']);
    mockViewer = createMockService(['openByUrl']);
    mockAuth = { whenReady: Promise.resolve(), currentUser: vi.fn() };
    mockDocs = createMockService(['reset']);
    mockPayment = createMockService(['reset']);
    mockNotifications = {
      notifyUsers: vi.fn().mockResolvedValue(undefined),
      notifyRole: vi.fn().mockResolvedValue(undefined),
    };
    mockToast = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
    mockAgendaSettings = { maxVisibleDateIso: vi.fn().mockReturnValue('2026-06-16') };

    TestBed.configureTestingModule({
      providers: [
        EnrollmentFacade,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: ConfirmModalService, useValue: mockConfirm },
        { provide: DmsViewerService, useValue: mockViewer },
        { provide: AuthFacade, useValue: mockAuth },
        { provide: EnrollmentDocumentsFacade, useValue: mockDocs },
        { provide: EnrollmentPaymentFacade, useValue: mockPayment },
        { provide: NotificationsFacade, useValue: mockNotifications },
        { provide: ToastService, useValue: mockToast },
        { provide: AgendaSettingsService, useValue: mockAgendaSettings },
      ],
    });

    facade = TestBed.inject(EnrollmentFacade);
  });

  afterEach(() => {
    facade.reset();
    vi.restoreAllMocks();
  });

  // ── Initialization ──

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should initialize with step 1', () => {
    expect(facade.currentStep()).toBe(1);
  });

  it('should initialize with null personal data', () => {
    expect(facade.personalData()).toBeNull();
  });

  it('should initialize with empty sence options', () => {
    expect(facade.senceOptions()).toEqual([]);
  });

  it('should initialize with no loading state', () => {
    expect(facade.isLoading()).toBe(false);
    expect(facade.isSubmitting()).toBe(false);
  });

  it('should initialize with no error', () => {
    expect(facade.error()).toBeNull();
  });

  it('should initialize with null enrollment status', () => {
    expect(facade.enrollmentStatus()).toBeNull();
    expect(facade.enrollmentNumber()).toBeNull();
    expect(facade.docsComplete()).toBe(false);
    expect(facade.contractAccepted()).toBe(false);
  });

  it('should have 6 steps configured', () => {
    expect(facade.steps().length).toBe(6);
    expect(facade.steps()[0].status).toBe('active');
    expect(facade.steps()[1].status).toBe('pending');
  });

  // ── Wizard Navigation ──

  describe('Wizard Navigation', () => {
    it('should navigate to a specific step', () => {
      facade.goToStep(3);
      expect(facade.currentStep()).toBe(3);
    });

    it('should update step status when navigating', () => {
      facade.goToStep(2);
      expect(facade.steps().find((s) => s.step === 2)?.status).toBe('active');
    });

    it('should go back one step', () => {
      facade.goToStep(3);
      facade.goBack();
      expect(facade.currentStep()).toBe(2);
    });

    it('should not go back from step 1', () => {
      facade.goBack();
      expect(facade.currentStep()).toBe(1);
    });
  });

  // ── Reset ──

  describe('Reset', () => {
    it('should reset all state to initial values', () => {
      facade.goToStep(3);
      facade.reset();

      expect(facade.currentStep()).toBe(1);
      expect(facade.personalData()).toBeNull();
      expect(facade.enrollmentStatus()).toBeNull();
      expect(facade.senceOptions()).toEqual([]);
      expect(facade.instructors()).toEqual([]);
      expect(facade.selectedSlotIds()).toEqual([]);
      expect(facade.paymentMode()).toBeNull();
      expect(facade.error()).toBeNull();
      expect(facade.isLoading()).toBe(false);
    });
  });

  // ── Slot Selection ──

  describe('Slot Selection', () => {
    it('should toggle slot selection on', () => {
      facade.toggleSlot('2026-03-10T09:00');
      expect(facade.selectedSlotIds()).toContain('2026-03-10T09:00');
    });

    it('should toggle slot selection off', () => {
      facade.toggleSlot('2026-03-10T09:00');
      facade.toggleSlot('2026-03-10T09:00');
      expect(facade.selectedSlotIds()).not.toContain('2026-03-10T09:00');
    });

    it('should accumulate multiple slot selections', () => {
      facade.toggleSlot('2026-03-10T09:00');
      facade.toggleSlot('2026-03-10T10:00');
      expect(facade.selectedSlotIds().length).toBe(2);
    });
  });

  // ── Payment Mode ──

  describe('Payment Mode', () => {
    it('should set payment mode to total', () => {
      facade.setPaymentMode('total');
      expect(facade.paymentMode()).toBe('total');
    });

    it('should set payment mode to partial', () => {
      facade.setPaymentMode('partial');
      expect(facade.paymentMode()).toBe('partial');
    });
  });

  // ── Promotion Selection ──

  describe('Promotion Selection', () => {
    it('should select a promotion course', () => {
      facade.selectPromotion(42);
      expect(facade.selectedPromotionCourseId()).toBe(42);
    });
  });

  // ── Matrícula tardía (0002-m, AC4/AC5) ──

  describe('saveAssignment — gate de matrícula tardía (Profesional)', () => {
    const TODAY = '2026-08-10';

    function setupProfessional(promotionStartDate: string) {
      (facade as any)._draft.set({ enrollmentId: 42, studentId: 1, userId: 1 });
      (facade as any)._personalData.set({
        courseCategory: 'professional',
        courseType: 'a2',
      });
      (facade as any)._promotionGroups.set([
        {
          label: 'A2',
          options: [
            {
              id: 99,
              label: 'Promo 99',
              code: '99',
              courseCode: 'A2',
              enrolledCount: 0,
              maxCapacity: 25,
              status: 'open',
              startDate: promotionStartDate,
            },
          ],
        },
      ]);
      facade.selectPromotion(99);
    }

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('promoción iniciada hace ≤ 3 días → no llama confirm(), persiste directo', async () => {
      setupProfessional('2026-08-07'); // 3 días desde TODAY

      const saved = await facade.saveAssignment();

      expect(mockConfirm.confirm).not.toHaveBeenCalled();
      expect(saved).toBe(true);
    });

    it('exactamente 3 días (límite inclusive) → no llama confirm()', async () => {
      setupProfessional('2026-08-07');

      const saved = await facade.saveAssignment();

      expect(mockConfirm.confirm).not.toHaveBeenCalled();
      expect(saved).toBe(true);
    });

    it('promoción iniciada hace > 3 días, usuario confirma → llama confirm(), luego persiste', async () => {
      setupProfessional('2026-08-06'); // 4 días desde TODAY
      mockConfirm.confirm.mockResolvedValue(true);

      const saved = await facade.saveAssignment();

      expect(mockConfirm.confirm).toHaveBeenCalledTimes(1);
      expect(saved).toBe(true);
    });

    it('promoción iniciada hace > 3 días, usuario cancela → llama confirm(), NO persiste, retorna false', async () => {
      setupProfessional('2026-08-06'); // 4 días desde TODAY
      mockConfirm.confirm.mockResolvedValue(false);

      const saved = await facade.saveAssignment();

      expect(mockConfirm.confirm).toHaveBeenCalledTimes(1);
      expect(saved).toBe(false);
      expect(mockSupabase.client.from).not.toHaveBeenCalledWith('enrollments');
    });
  });

  // ── Error Handling ──

  describe('Error Handling', () => {
    it('should clear error', () => {
      facade.clearError();
      expect(facade.error()).toBeNull();
    });
  });

  // ── UI Wrappers ──

  describe('UI Wrappers', () => {
    it('should call confirmModal.confirm on confirm', async () => {
      const config = { title: 'Test', message: 'Msg' };
      mockConfirm.confirm.mockResolvedValue(true);
      const result = await facade.confirm(config);
      expect(mockConfirm.confirm).toHaveBeenCalledWith(config);
      expect(result).toBe(true);
    });

    it('should call dmsViewer.openByUrl on openDocument', () => {
      facade.openDocument('http://test.com', 'File');
      expect(mockViewer.openByUrl).toHaveBeenCalledWith('http://test.com', 'File');
    });

    it('should use default filename in openDocument if not provided', () => {
      facade.openDocument('http://test.com');
      expect(mockViewer.openByUrl).toHaveBeenCalledWith('http://test.com', 'Documento');
    });
  });

  // ── Student Summary (Computed) ──

  describe('Student Summary', () => {
    it('should return null when no personal data', () => {
      expect(facade.studentSummary()).toBeNull();
    });
  });

  // ── Sidebar Summary (Computed) ──

  describe('Sidebar Summary', () => {
    it('should return empty requirements when no data', () => {
      const summary = facade.sidebarSummary();
      expect(summary.course).toBeNull();
      expect(summary.requirements.length).toBe(5);
      expect(summary.requirements[0].fulfilled).toBe(false);
    });
  });

  // ── canAdvance (Computed) ──

  describe('canAdvance', () => {
    it('should not allow advance from step 1 without personal data', () => {
      expect(facade.canAdvance()).toBe(false);
    });

    it('step 4 (contrato) requires contract_accepted = true', () => {
      facade.goToStep(4);
      // Sin enrollment en BD → contract_accepted es undefined → false
      expect(facade.canAdvance()).toBe(false);
    });

    it('step 5 (pago) always returns true — payment facade controls canAdvance externally', () => {
      facade.goToStep(5);
      expect(facade.canAdvance()).toBe(true);
    });
  });

  // ── Load Courses ──

  describe('loadCourses', () => {
    it('should call supabase to load courses', async () => {
      const mockCourses = [
        { id: 1, name: 'Clase B', license_class: 'B', active: true, branch_id: 1 },
      ];

      // loadCourses chains .order() mid-chain then does `await query` at the end —
      // so order must return `this` and the builder must be awaitable via `then`.
      const builder = createMockQueryBuilder(mockCourses, null);
      mockSupabase.client.from = vi.fn().mockReturnValue(builder);

      await facade.loadCourses(1);

      expect(mockSupabase.client.from).toHaveBeenCalledWith('courses');
    });

    it('should set error on failure', async () => {
      const builder = createMockQueryBuilder(null, { message: 'Connection failed' });
      mockSupabase.client.from = vi.fn().mockReturnValue(builder);

      await facade.loadCourses(1);

      expect(facade.error()).toContain('Error al cargar cursos');
    });
  });

  // ── courseOptions() / mapCourseToOption() — spec 0006-m ──

  describe('courseOptions — mapeo de Refuerzo Clase B', () => {
    it('mapea is_reinforcement=true a type=class_b_reinforcement', async () => {
      const mockCourses = [
        {
          id: 5,
          code: 'refuerzo_b_1',
          name: 'Refuerzo Clase B',
          license_class: 'B',
          branch_id: 1,
          practical_hours: 4.5,
          base_price: 90000,
          active: true,
          is_reinforcement: true,
        },
      ];
      const builder = createMockQueryBuilder(mockCourses, null);
      mockSupabase.client.from = vi.fn().mockReturnValue(builder);

      await facade.loadCourses(1);

      const options = facade.courseOptions();
      expect(options).toHaveLength(1);
      expect(options[0].type).toBe('class_b_reinforcement');
      expect(options[0].category).toBe('non-professional');
    });

    it('no confunde Clase B estándar con Refuerzo ni SENCE en la misma sede (AC-E1)', async () => {
      const mockCourses = [
        {
          id: 1,
          code: 'class_b',
          name: 'Clase B',
          license_class: 'B',
          branch_id: 1,
          practical_hours: 9.0,
          base_price: 180000,
          active: true,
          is_reinforcement: false,
        },
        {
          id: 4,
          code: 'class_b_sence',
          name: 'Clase B SENCE',
          license_class: 'B',
          branch_id: 1,
          practical_hours: 9.0,
          base_price: 180000,
          active: true,
          is_reinforcement: false,
        },
        {
          id: 5,
          code: 'refuerzo_b_1',
          name: 'Refuerzo Clase B',
          license_class: 'B',
          branch_id: 1,
          practical_hours: 4.5,
          base_price: 90000,
          active: true,
          is_reinforcement: true,
        },
      ];
      const builder = createMockQueryBuilder(mockCourses, null);
      mockSupabase.client.from = vi.fn().mockReturnValue(builder);

      await facade.loadCourses(1);

      const options = facade.courseOptions();
      expect(options).toHaveLength(3);
      const types = options.map((o) => o.type).sort();
      expect(types).toEqual(['class_b', 'class_b_reinforcement', 'class_b_sence']);
    });
  });

  // ── Find User by RUT ──

  describe('findUserByRut', () => {
    it('should return null when user not found', async () => {
      const builder = createMockQueryBuilder(null);
      mockSupabase.client.from = vi.fn().mockReturnValue(builder);

      const result = await facade.findUserByRut('12345678-9');
      expect(result).toBeNull();
    });
  });

  // ── Re-matrícula: precarga de datos (fix-020) ──

  describe('prefillFromStudent', () => {
    it('devuelve null cuando el RUT no existe', async () => {
      vi.spyOn(facade, 'findUserByRut').mockResolvedValue(null);
      const result = await facade.prefillFromStudent('12345678-9');
      expect(result).toBeNull();
    });

    it('mapea los datos del alumno encontrado a campos del Paso 1', async () => {
      vi.spyOn(facade, 'findUserByRut').mockResolvedValue({
        studentId: 7,
        firstNames: 'Ana',
        paternalLastName: 'Pérez',
        maternalLastName: 'Soto',
        email: 'ana@example.com',
        phone: '987654321',
        birthDate: '1990-05-10',
        gender: 'F',
        address: 'Calle 1',
        currentLicense: 'B',
        licenseDate: '2015-01-01',
      });

      const result = await facade.prefillFromStudent('12345678-9');

      expect(result).toEqual({
        firstNames: 'Ana',
        paternalLastName: 'Pérez',
        maternalLastName: 'Soto',
        email: 'ana@example.com',
        phone: '987654321',
        birthDate: '1990-05-10',
        gender: 'F',
        address: 'Calle 1',
        currentLicense: 'B',
        licenseDate: '2015-01-01',
      });
    });

    it('no incluye rut ni selección de curso (decisión nueva del operador)', async () => {
      vi.spyOn(facade, 'findUserByRut').mockResolvedValue({
        studentId: 7,
        firstNames: 'Ana',
        paternalLastName: 'Pérez',
        maternalLastName: '',
        email: 'ana@example.com',
        phone: '',
        birthDate: null,
        gender: null,
        address: null,
        currentLicense: null,
        licenseDate: null,
      });

      const result = await facade.prefillFromStudent('12345678-9');

      expect(result).not.toHaveProperty('rut');
      expect(result).not.toHaveProperty('courseType');
      expect(result).not.toHaveProperty('courseCategory');
      // Campos nulos de BD normalizados a string vacío donde el modelo lo exige.
      expect(result?.birthDate).toBe('');
      expect(result?.gender).toBe('');
      expect(result?.address).toBe('');
    });
  });

  // ── Re-matrícula: guard de duplicados (fix-020) ──

  describe('evaluateCourseReenrollment', () => {
    function mockEnrollmentsQuery(rows: any[]) {
      const neqCalls: [string, unknown][] = [];
      const builder: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockImplementation((col: string, val: unknown) => {
          neqCalls.push([col, val]);
          return builder;
        }),
        then: (resolve: any, reject: any) =>
          Promise.resolve({ data: rows, error: null }).then(resolve, reject),
      };
      mockSupabase.client.from = vi.fn().mockReturnValue(builder);
      return { neqCalls };
    }

    it('block cuando hay una matrícula viva (active) en el curso', async () => {
      mockEnrollmentsQuery([{ id: 1, status: 'active' }]);
      const verdict = await (facade as any).evaluateCourseReenrollment(5, 'B');
      expect(verdict).toBe('block');
    });

    it('confirm cuando solo hay matrículas históricas (completed)', async () => {
      mockEnrollmentsQuery([{ id: 1, status: 'completed' }]);
      const verdict = await (facade as any).evaluateCourseReenrollment(5, 'B');
      expect(verdict).toBe('confirm');
    });

    it('allow cuando no hay matrículas previas en el curso', async () => {
      mockEnrollmentsQuery([]);
      const verdict = await (facade as any).evaluateCourseReenrollment(5, 'B');
      expect(verdict).toBe('allow');
    });

    it('excluye los drafts de la query (los maneja el flujo de reanudación)', async () => {
      const { neqCalls } = mockEnrollmentsQuery([]);
      await (facade as any).evaluateCourseReenrollment(5, 'B');
      expect(neqCalls).toContainEqual(['status', 'draft']);
    });

    it('excluye la matrícula actual en edición para no verse como duplicado', async () => {
      (facade as any)._draft.set({ enrollmentId: 99, studentId: 5, userId: 7 });
      const { neqCalls } = mockEnrollmentsQuery([]);
      await (facade as any).evaluateCourseReenrollment(5, 'B');
      expect(neqCalls).toContainEqual(['id', 99]);
    });

    it('no añade filtro de id cuando no hay matrícula en edición', async () => {
      const { neqCalls } = mockEnrollmentsQuery([]);
      await (facade as any).evaluateCourseReenrollment(5, 'B');
      expect(neqCalls.some(([col]) => col === 'id')).toBe(false);
    });
  });

  // ── Generate Contract ──

  describe('generateContract', () => {
    it('should return null when no draft enrollment', async () => {
      const result = await facade.generateContract();
      expect(result).toBeNull();
    });
  });

  // ── Confirm Enrollment ──

  describe('confirmEnrollment', () => {
    it('should return null when no draft enrollment', async () => {
      const result = await facade.confirmEnrollment();
      expect(result).toBeNull();
    });

    it('notifies the student and the admins after a successful confirmation (AC6)', async () => {
      (facade as any)._draft.set({ enrollmentId: 10, studentId: 20, userId: 30 });
      (facade as any)._enrollment.set({ course_id: 1 });
      mockSupabase.client.rpc = vi.fn().mockResolvedValue({ data: '2026-0001', error: null });

      const result = await facade.confirmEnrollment();

      expect(result).toBe('2026-0001');
      expect(mockNotifications.notifyUsers).toHaveBeenCalledWith(
        [30],
        expect.objectContaining({ referenceType: 'enrollment', referenceId: 20 }),
      );
      expect(mockNotifications.notifyRole).toHaveBeenCalledWith(
        'admin',
        null,
        expect.objectContaining({ referenceType: 'enrollment', referenceId: 20 }),
      );
    });

    it('does not break the confirmation flow when the notification insert fails (AC-E1)', async () => {
      (facade as any)._draft.set({ enrollmentId: 10, studentId: 20, userId: 30 });
      (facade as any)._enrollment.set({ course_id: 1 });
      mockSupabase.client.rpc = vi.fn().mockResolvedValue({ data: '2026-0001', error: null });
      mockNotifications.notifyUsers.mockRejectedValue(new Error('insert failed'));
      mockNotifications.notifyRole.mockRejectedValue(new Error('insert failed'));

      const result = await facade.confirmEnrollment();

      expect(result).toBe('2026-0001');
    });

    it('does not notify when the draft has no userId', async () => {
      (facade as any)._draft.set({ enrollmentId: 10, studentId: 20, userId: null });
      (facade as any)._enrollment.set({ course_id: 1 });
      mockSupabase.client.rpc = vi.fn().mockResolvedValue({ data: '2026-0001', error: null });

      await facade.confirmEnrollment();

      expect(mockNotifications.notifyUsers).not.toHaveBeenCalled();
      expect(mockNotifications.notifyRole).not.toHaveBeenCalled();
    });

    // fix-157-m: functions.invoke() no rechaza la promesa en respuestas no-2xx, así que un
    // .catch() a secas nunca se enteraba de que activate-student-account falló.
    it('avisa por toast si activate-student-account falla (ej. email con formato inválido)', async () => {
      (facade as any)._draft.set({ enrollmentId: 10, studentId: 20, userId: 30 });
      (facade as any)._enrollment.set({ course_id: 1 });
      (facade as any)._personalData.set({
        firstNames: 'Pedro',
        paternalLastName: 'Morales',
        email: 'pedro@invalido.cl|',
      });
      mockSupabase.client.rpc = vi.fn().mockResolvedValue({ data: '2026-0001', error: null });
      mockSupabase.client.functions.invoke = vi.fn().mockResolvedValue({
        data: null,
        error: new Error('Unable to validate email address: invalid format'),
      });

      await facade.confirmEnrollment();
      await Promise.resolve(); // deja correr el .then() del invoke fire-and-forget

      expect(mockToast.warning).toHaveBeenCalled();
    });

    // fix-114-m (ASG-b-063): re-entrada rechazada a nivel de dominio, no solo de UI
    it('rechaza una re-entrada concurrente (doble submit) mientras ya hay una confirmación en curso', async () => {
      (facade as any)._draft.set({ enrollmentId: 10, studentId: 20, userId: 30 });
      (facade as any)._enrollment.set({ course_id: 1 });
      mockSupabase.client.rpc = vi.fn().mockResolvedValue({ data: '2026-0001', error: null });

      const [first, second] = await Promise.all([
        facade.confirmEnrollment(),
        facade.confirmEnrollment(),
      ]);

      expect([first, second]).toContain(null);
      expect(mockSupabase.client.rpc).toHaveBeenCalledTimes(1);
    });
  });

  describe('confirmWithPayment', () => {
    beforeEach(() => {
      mockPayment.pricing = vi.fn().mockReturnValue({ isDeposit: false });
      mockPayment.paymentMethod = vi.fn().mockReturnValue('cash');
      mockPayment.totalToPay = vi.fn().mockReturnValue(100000);
      mockPayment.selectedDiscountId = vi.fn().mockReturnValue(null);
      mockPayment.discount = vi.fn().mockReturnValue({ amount: 0 });
    });

    it('should return null when no draft enrollment', async () => {
      const result = await facade.confirmWithPayment();
      expect(result).toBeNull();
    });

    it('notifies the student and the admins after a successful confirmation (AC6)', async () => {
      (facade as any)._draft.set({ enrollmentId: 10, studentId: 20, userId: 30 });
      mockSupabase.client.rpc = vi.fn().mockResolvedValue({ data: '2026-0002', error: null });

      const result = await facade.confirmWithPayment();

      expect(result).toBe('2026-0002');
      expect(mockNotifications.notifyUsers).toHaveBeenCalledWith(
        [30],
        expect.objectContaining({ referenceType: 'enrollment', referenceId: 20 }),
      );
      expect(mockNotifications.notifyRole).toHaveBeenCalledWith(
        'admin',
        null,
        expect.objectContaining({ referenceType: 'enrollment', referenceId: 20 }),
      );
    });

    it('does not break the confirmation flow when the notification insert fails (AC-E1)', async () => {
      (facade as any)._draft.set({ enrollmentId: 10, studentId: 20, userId: 30 });
      mockSupabase.client.rpc = vi.fn().mockResolvedValue({ data: '2026-0002', error: null });
      mockNotifications.notifyUsers.mockRejectedValue(new Error('insert failed'));

      const result = await facade.confirmWithPayment();

      expect(result).toBe('2026-0002');
    });

    // fix-114-m (ASG-b-063): re-entrada rechazada a nivel de dominio, no solo de UI
    it('rechaza una re-entrada concurrente (doble submit) mientras ya hay una confirmación en curso', async () => {
      (facade as any)._draft.set({ enrollmentId: 10, studentId: 20, userId: 30 });
      mockSupabase.client.rpc = vi.fn().mockResolvedValue({ data: '2026-0002', error: null });

      const [first, second] = await Promise.all([
        facade.confirmWithPayment(),
        facade.confirmWithPayment(),
      ]);

      expect([first, second]).toContain(null);
      expect(mockSupabase.client.rpc).toHaveBeenCalledTimes(1);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // REALTIME — Schedule subscription tests
  // ══════════════════════════════════════════════════════════════════════════════

  describe('Realtime Schedule Subscription', () => {
    const INSTRUCTOR_ID = 5;

    const mockSlots = [
      {
        instructor_id: INSTRUCTOR_ID,
        vehicle_id: 1,
        slot_start: '2026-03-16T09:00:00-03:00',
        slot_end: '2026-03-16T09:45:00-03:00',
        slot_status: 'available',
      },
      {
        instructor_id: INSTRUCTOR_ID,
        vehicle_id: 1,
        slot_start: '2026-03-16T09:45:00-03:00',
        slot_end: '2026-03-16T10:30:00-03:00',
        slot_status: 'available',
      },
    ];

    function setupScheduleQuery(data: any[] = mockSlots, error: any = null) {
      const builder = createMockQueryBuilder();
      builder.order = vi.fn().mockResolvedValue({ data, error });
      mockSupabase.client.from = vi.fn().mockReturnValue(builder);
    }

    it('should filter available slots by the AgendaSettingsService dynamic limit, not a hardcoded date', async () => {
      const builder = createMockQueryBuilder();
      builder.order = vi.fn().mockResolvedValue({ data: mockSlots, error: null });
      mockSupabase.client.from = vi.fn().mockReturnValue(builder);
      mockAgendaSettings.maxVisibleDateIso.mockReturnValue('2026-09-20');

      await facade.loadScheduleGrid(INSTRUCTOR_ID);

      expect(builder.lte).toHaveBeenCalledWith('slot_start', '2026-09-20T23:59:59');
    });

    it('should re-derive the upper bound from AgendaSettingsService on every call (no cached/stale limit)', async () => {
      const builder = createMockQueryBuilder();
      builder.order = vi.fn().mockResolvedValue({ data: mockSlots, error: null });
      mockSupabase.client.from = vi.fn().mockReturnValue(builder);

      mockAgendaSettings.maxVisibleDateIso.mockReturnValue('2026-05-14');
      await facade.loadScheduleGrid(INSTRUCTOR_ID);
      expect(builder.lte).toHaveBeenLastCalledWith('slot_start', '2026-05-14T23:59:59');

      mockAgendaSettings.maxVisibleDateIso.mockReturnValue('2026-11-14');
      await facade.loadScheduleGrid(INSTRUCTOR_ID);
      expect(builder.lte).toHaveBeenLastCalledWith('slot_start', '2026-11-14T23:59:59');
    });

    it('should create a realtime channel when loadScheduleGrid is called', async () => {
      setupScheduleQuery();

      await facade.loadScheduleGrid(INSTRUCTOR_ID);

      expect(mockSupabase.client.channel).toHaveBeenCalledWith(
        `schedule-instructor-${INSTRUCTOR_ID}`,
      );
      expect(mockSupabase._mockChannel.on).toHaveBeenCalledWith(
        'postgres_changes',
        expect.objectContaining({
          event: '*',
          schema: 'public',
          table: 'class_b_sessions',
          filter: `instructor_id=eq.${INSTRUCTOR_ID}`,
        }),
        expect.any(Function),
      );
      expect(mockSupabase._mockChannel.subscribe).toHaveBeenCalled();
    });

    it('should remove previous channel when switching instructor', async () => {
      setupScheduleQuery();

      await facade.loadScheduleGrid(INSTRUCTOR_ID);
      await facade.loadScheduleGrid(INSTRUCTOR_ID + 1);

      expect(mockSupabase.client.removeChannel).toHaveBeenCalledTimes(1);
      expect(mockSupabase.client.channel).toHaveBeenCalledWith(
        `schedule-instructor-${INSTRUCTOR_ID + 1}`,
      );
    });

    it('should unsubscribe from channel on reset', async () => {
      setupScheduleQuery();

      await facade.loadScheduleGrid(INSTRUCTOR_ID);
      facade.reset();

      expect(mockSupabase.client.removeChannel).toHaveBeenCalled();
    });

    it('should debounce realtime events and re-query the view', async () => {
      vi.useFakeTimers();
      setupScheduleQuery();

      await facade.loadScheduleGrid(INSTRUCTOR_ID);

      // Simulate realtime event
      const callback = mockSupabase._getChannelCallback();
      expect(callback).not.toBeNull();

      // Reset mock to track re-query
      mockSupabase.client.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockSlots, error: null }),
      });

      // Fire 3 rapid events — should debounce to 1 re-query
      callback!();
      callback!();
      callback!();

      // Before debounce period: no re-query
      expect(mockSupabase.client.from).not.toHaveBeenCalled();

      // After debounce period
      await vi.advanceTimersByTimeAsync(350);

      expect(mockSupabase.client.from).toHaveBeenCalledTimes(1);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('v_class_b_schedule_availability');

      vi.useRealTimers();
    });

    it('puebla vehicleDocWarning por slot desde vehicle_documents (fix-165-m)', async () => {
      const slotsData = [
        {
          instructor_id: INSTRUCTOR_ID,
          vehicle_id: 10,
          slot_start: '2026-03-16T09:00:00-03:00',
          slot_end: '2026-03-16T09:45:00-03:00',
          slot_status: 'available',
        },
        {
          instructor_id: INSTRUCTOR_ID,
          vehicle_id: 20,
          slot_start: '2026-03-16T09:45:00-03:00',
          slot_end: '2026-03-16T10:30:00-03:00',
          slot_status: 'available',
        },
      ];
      const docsData = [
        { vehicle_id: 10, type: 'soap', expiry_date: '2020-01-01', status: null }, // expired
        { vehicle_id: 20, type: 'soap', expiry_date: '2099-01-01', status: null }, // valid
      ];

      mockSupabase.client.from = vi.fn((table: string) => {
        if (table === 'vehicle_documents') return createMockQueryBuilder(docsData, null);
        const builder = createMockQueryBuilder();
        builder.order = vi.fn().mockResolvedValue({ data: slotsData, error: null });
        return builder;
      });

      await facade.loadScheduleGrid(INSTRUCTOR_ID);

      const slots = facade.scheduleGrid()?.slots ?? [];
      expect(slots.find((s) => s.id === '2026-03-16T09:00:00-03:00')?.vehicleDocWarning).toEqual({
        expiredDocs: ['SOAP'],
        expiringSoonDocs: [],
      });
      expect(slots.find((s) => s.id === '2026-03-16T09:45:00-03:00')?.vehicleDocWarning).toBeNull();
    });

    it('should auto-deselect slots that become occupied after realtime update', async () => {
      vi.useFakeTimers();
      setupScheduleQuery();

      await facade.loadScheduleGrid(INSTRUCTOR_ID);

      // Select a slot
      facade.toggleSlot('2026-03-16T09:00:00-03:00');
      expect(facade.selectedSlotIds()).toContain('2026-03-16T09:00:00-03:00');

      // Simulate the slot becoming occupied in the re-query
      const occupiedSlots = mockSlots.map((s) =>
        s.slot_start === '2026-03-16T09:00:00-03:00' ? { ...s, slot_status: 'occupied' } : s,
      );

      mockSupabase.client.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: occupiedSlots, error: null }),
      });

      // Fire realtime event
      const callback = mockSupabase._getChannelCallback();
      callback!();

      await vi.advanceTimersByTimeAsync(350);

      // The selected slot should be auto-deselected
      expect(facade.selectedSlotIds()).not.toContain('2026-03-16T09:00:00-03:00');

      vi.useRealTimers();
    });

    it('should NOT auto-deselect slots that the current draft itself just reserved via saveAssignment', async () => {
      vi.useFakeTimers();
      setupScheduleQuery();

      await facade.loadScheduleGrid(INSTRUCTOR_ID);

      facade.toggleSlot('2026-03-16T09:00:00-03:00');
      facade.toggleSlot('2026-03-16T09:45:00-03:00');

      (facade as any)._draft.set({ enrollmentId: 42, studentId: 1, userId: 1 });
      (facade as any)._personalData.set({
        courseCategory: 'non-professional',
        courseType: 'class_b',
      });

      const saved = await facade.saveAssignment();
      expect(saved).toBe(true);

      // La vista ahora reporta esos mismos slots como 'occupied' porque el propio
      // draft acaba de reservarlos en class_b_sessions.
      const ownReservationsNowOccupied = mockSlots.map((s) => ({ ...s, slot_status: 'occupied' }));
      mockSupabase.client.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: ownReservationsNowOccupied, error: null }),
      });

      const callback = mockSupabase._getChannelCallback();
      callback!();
      await vi.advanceTimersByTimeAsync(350);

      expect(facade.selectedSlotIds()).toContain('2026-03-16T09:00:00-03:00');
      expect(facade.selectedSlotIds()).toContain('2026-03-16T09:45:00-03:00');
      expect(
        facade.scheduleGrid()?.slots.find((s) => s.id === '2026-03-16T09:00:00-03:00')?.status,
      ).toBe('available');

      vi.useRealTimers();
    });
  });

  describe('saveAssignment — Refuerzo Clase B (spec 0006-m, regresión visual real)', () => {
    it('courseType=class_b_reinforcement SÍ inserta en class_b_sessions (no se salta el bloque isClassB)', async () => {
      const builder = createMockQueryBuilder({ vehicle_id: 9 }, null);
      mockSupabase.client.from = vi.fn().mockReturnValue(builder);

      (facade as any)._draft.set({ enrollmentId: 42, studentId: 1, userId: 1 });
      (facade as any)._personalData.set({
        courseCategory: 'non-professional',
        courseType: 'class_b_reinforcement',
      });
      (facade as any)._selectedInstructorId.set(7);
      (facade as any)._selectedSlotIds.set([
        '2026-03-16T09:00:00-03:00',
        '2026-03-16T09:45:00-03:00',
      ]);

      const saved = await facade.saveAssignment();

      expect(saved).toBe(true);
      expect(mockSupabase.client.from).toHaveBeenCalledWith('class_b_sessions');
      expect(facade.error()).toBeNull();
    });
  });
});
