import { TestBed } from '@angular/core/testing';
import { AdminAlumnoDetalleFacade } from './admin-alumno-detalle.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { DmsViewerService } from '@core/services/ui/dms-viewer.service';
import { NotificationsFacade } from '@core/facades/notifications.facade';
import { AgendaSettingsService } from '@core/services/ui/agenda-settings.service';

describe('AdminAlumnoDetalleFacade', () => {
  let facade: AdminAlumnoDetalleFacade;
  let supabaseSpy: any;
  let invokeSpy: any;
  let dmsViewerSpy: any;
  let toastSpy: any;
  let notificationsSpy: any;

  beforeEach(() => {
    invokeSpy = vi.fn().mockResolvedValue({
      data: { pdfUrl: 'https://signed/url', pdfPath: 'student-licenses/1/Carnet.pdf' },
      error: null,
    });

    supabaseSpy = { client: vi.fn() };
    (supabaseSpy as any).client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
      functions: { invoke: invokeSpy },
      storage: {
        from: vi.fn().mockReturnValue({
          createSignedUrl: vi.fn().mockResolvedValue({
            data: { signedUrl: 'https://signed/contrato.pdf' },
            error: null,
          }),
        }),
      },
    };

    dmsViewerSpy = { openByUrl: vi.fn() };
    toastSpy = { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() };
    notificationsSpy = {
      notifyUsers: vi.fn().mockResolvedValue(undefined),
      notifyRole: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        AdminAlumnoDetalleFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: DmsViewerService, useValue: dmsViewerSpy },
        { provide: NotificationsFacade, useValue: notificationsSpy },
      ],
    });

    facade = TestBed.inject(AdminAlumnoDetalleFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should have initial empty state', () => {
    expect(facade.alumno()).toBeNull();
    expect(facade.inasistencias()).toEqual([]);
    expect(facade.inasistenciasClaseB()).toEqual([]);
    expect(facade.clasesPracticas()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
  });

  it('porcentajePracticas should return 0 initially', () => {
    expect(facade.porcentajePracticas()).toBe(0);
  });

  describe('generarCarnet', () => {
    it("variant 'initial' invoca la Edge Function con variant=initial y setea el path inicial", async () => {
      await facade.generarCarnet(1, 'initial');

      expect(invokeSpy).toHaveBeenCalledWith('generate-student-license-pdf', {
        body: { enrollment_id: 1, variant: 'initial' },
      });
      expect(facade.licenseInitialPath()).toBe('student-licenses/1/Carnet.pdf');
      expect(facade.licenseFullPath()).toBeNull();
      expect(dmsViewerSpy.openByUrl).toHaveBeenCalled();
    });

    it("variant 'full' invoca con variant=full y setea sólo el path completo", async () => {
      await facade.generarCarnet(7, 'full');

      expect(invokeSpy).toHaveBeenCalledWith('generate-student-license-pdf', {
        body: { enrollment_id: 7, variant: 'full' },
      });
      expect(facade.licenseFullPath()).toBe('student-licenses/1/Carnet.pdf');
      expect(facade.licenseInitialPath()).toBeNull();
    });

    it('default es initial cuando no se pasa variant', async () => {
      await facade.generarCarnet(3);
      expect(invokeSpy).toHaveBeenCalledWith('generate-student-license-pdf', {
        body: { enrollment_id: 3, variant: 'initial' },
      });
    });
  });

  describe('verContrato', () => {
    it('setea isViewingContrato en true durante la carga y en false al terminar (éxito)', async () => {
      expect(facade.isViewingContrato()).toBe(false);

      const promise = facade.verContrato('contracts/1/Contrato.pdf');
      expect(facade.isViewingContrato()).toBe(true);

      await promise;

      expect(facade.isViewingContrato()).toBe(false);
      expect(dmsViewerSpy.openByUrl).toHaveBeenCalledWith(
        'https://signed/contrato.pdf',
        'Contrato del Alumno',
      );
    });

    it('vuelve a poner isViewingContrato en false si la signed URL falla', async () => {
      (supabaseSpy.client.storage.from as any).mockReturnValueOnce({
        createSignedUrl: vi.fn().mockResolvedValue({ data: null, error: new Error('boom') }),
      });

      await facade.verContrato('contracts/1/Contrato.pdf');

      expect(facade.isViewingContrato()).toBe(false);
      expect(toastSpy.error).toHaveBeenCalled();
      expect(dmsViewerSpy.openByUrl).not.toHaveBeenCalled();
    });
  });

  describe('reprogramarClase — notificaciones (Spec 0024, AC5)', () => {
    const basePayload = {
      sessionId: 55,
      enrollmentId: 7,
      claseNumero: 3,
      instructorId: 100,
      scheduledAt: '2026-07-10T14:00:00Z',
    };

    const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

    function mockFromByTable(handlers: Record<string, any>) {
      return vi.fn().mockImplementation((table: string) => {
        if (handlers[table]) return handlers[table];
        return {
          select: vi.fn().mockReturnValue({
            eq: vi
              .fn()
              .mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: null }) }),
          }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      });
    }

    beforeEach(() => {
      (facade as any)._alumno.set({ userId: 42, nombre: 'Ana Alumna' });
      (facade as any)._slotVehicleMap.set(basePayload.scheduledAt, 9);
    });

    it('notifica al alumno y al instructor cuando el instructor no cambia', async () => {
      const classBSessionsHandler = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { instructor_id: 100 }, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      };
      const instructorsHandler = {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [{ id: 100, user_id: 200 }], error: null }),
        }),
      };
      supabaseSpy.client.from = mockFromByTable({
        class_b_sessions: classBSessionsHandler,
        instructors: instructorsHandler,
      });

      await facade.reprogramarClase(basePayload);
      await flushMicrotasks();

      expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith(
        [42],
        expect.objectContaining({ referenceType: 'class_b', referenceId: 55 }),
      );
      expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith(
        [200],
        expect.objectContaining({ referenceType: 'class_b', referenceId: 55 }),
      );
      expect(notificationsSpy.notifyUsers).toHaveBeenCalledTimes(2);
    });

    it('notifica también al instructor anterior cuando el instructor cambia', async () => {
      const classBSessionsHandler = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { instructor_id: 999 }, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      };
      const instructorsHandler = {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [
              { id: 100, user_id: 200 },
              { id: 999, user_id: 777 },
            ],
            error: null,
          }),
        }),
      };
      supabaseSpy.client.from = mockFromByTable({
        class_b_sessions: classBSessionsHandler,
        instructors: instructorsHandler,
      });

      await facade.reprogramarClase(basePayload);
      await flushMicrotasks();

      expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith([42], expect.any(Object));
      expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith([200], expect.any(Object));
      expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith([777], expect.any(Object));
      expect(notificationsSpy.notifyUsers).toHaveBeenCalledTimes(3);
    });

    it('no rompe la reprogramación si falla la notificación (AC-E1)', async () => {
      const classBSessionsHandler = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { instructor_id: 100 }, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      };
      supabaseSpy.client.from = mockFromByTable({ class_b_sessions: classBSessionsHandler });
      notificationsSpy.notifyUsers.mockRejectedValue(new Error('insert failed'));

      await expect(facade.reprogramarClase(basePayload)).resolves.toBeUndefined();
      await flushMicrotasks();
    });

    it('crea la sesión (sin sessionId) y notifica sin buscar instructor anterior', async () => {
      const insertPayload = { ...basePayload, sessionId: null };
      const classBSessionsHandler = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
      const instructorsHandler = {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [{ id: 100, user_id: 200 }], error: null }),
        }),
      };
      supabaseSpy.client.from = mockFromByTable({
        class_b_sessions: classBSessionsHandler,
        instructors: instructorsHandler,
      });

      await facade.reprogramarClase(insertPayload);
      await flushMicrotasks();

      expect(classBSessionsHandler.insert).toHaveBeenCalled();
      expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith([42], expect.any(Object));
      expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith([200], expect.any(Object));
      expect(notificationsSpy.notifyUsers).toHaveBeenCalledTimes(2);
    });
  });

  describe('justificarInasistenciaClaseB', () => {
    it('actualiza la fila a excused con el motivo y muestra un toast de éxito', async () => {
      const eqSpy = vi.fn().mockResolvedValue({ error: null });
      const updateSpy = vi.fn().mockReturnValue({ eq: eqSpy });
      supabaseSpy.client.from = vi.fn().mockReturnValue({ update: updateSpy });
      const toast = TestBed.inject(ToastService) as any;

      await facade.justificarInasistenciaClaseB(42, 'Certificado médico');

      expect(supabaseSpy.client.from).toHaveBeenCalledWith('class_b_practice_attendance');
      expect(updateSpy).toHaveBeenCalledWith({
        status: 'excused',
        justification: 'Certificado médico',
      });
      expect(eqSpy).toHaveBeenCalledWith('id', 42);
      expect(toast.success).toHaveBeenCalled();
    });

    it('muestra un toast de error si la actualización falla', async () => {
      const eqSpy = vi.fn().mockResolvedValue({ error: new Error('boom') });
      supabaseSpy.client.from = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({ eq: eqSpy }),
      });
      const toast = TestBed.inject(ToastService) as any;

      await facade.justificarInasistenciaClaseB(1, 'motivo');

      expect(toast.error).toHaveBeenCalled();
    });
  });

  describe('actualizarPerfilAlumno', () => {
    it('invoca la Edge Function update-student-profile con el email actual y el nuevo', async () => {
      (facade as any)._alumno.set({
        id: 1,
        userId: 55,
        enrollmentId: null,
        enrollments: [],
        nombre: 'Juan Pérez',
        firstName: 'Juan',
        paternalLastName: 'Pérez',
        maternalLastName: 'Soto',
        rut: '11.111.111-1',
        matricula: '',
        curso: '',
        email: 'viejo@example.com',
        telefono: '',
        fechaIngreso: '',
        estado: '',
        licenseGroup: 'class_b',
        totalPagado: 0,
        saldoPendiente: 0,
      });

      const invokeFn = vi.fn().mockResolvedValue({ data: { success: true }, error: null });
      supabaseSpy.client.functions = { invoke: invokeFn };

      await facade.actualizarPerfilAlumno(55, {
        first_names: 'Juan',
        paternal_last_name: 'Pérez',
        maternal_last_name: 'Soto',
        email: 'Nuevo@Example.com',
        phone: '+56911111111',
      });

      expect(invokeFn).toHaveBeenCalledWith('update-student-profile', {
        body: {
          userId: 55,
          firstNames: 'Juan',
          paternalLastName: 'Pérez',
          maternalLastName: 'Soto',
          phone: '+56911111111',
          email: 'nuevo@example.com',
          currentEmail: 'viejo@example.com',
        },
      });
    });

    it('propaga el error (ej. email duplicado en Auth) sin tragárselo', async () => {
      const invokeFn = vi.fn().mockResolvedValue({
        data: null,
        error: new Error('Ya existe un usuario con ese correo electrónico'),
      });
      supabaseSpy.client.functions = { invoke: invokeFn };

      await expect(
        facade.actualizarPerfilAlumno(55, {
          first_names: 'Juan',
          paternal_last_name: 'Pérez',
          maternal_last_name: 'Soto',
          email: 'duplicado@example.com',
          phone: '',
        }),
      ).rejects.toThrow('Ya existe un usuario con ese correo electrónico');
    });
  });

  describe('fetchClassBProgress (vía initialize) — RF-053', () => {
    /** Builder Supabase encadenable y awaitable, con resultado configurable por tabla. */
    function makeFlexibleSupabaseMock() {
      const results = new Map<string, { data: any; error: any }>();
      const singleResults = new Map<string, { data: any; error: any }>();
      const builders = new Map<string, any>();

      function getBuilder(table: string): any {
        if (builders.has(table)) return builders.get(table);
        const b: any = {
          select: vi.fn(() => b),
          eq: vi.fn(() => b),
          in: vi.fn(() => b),
          order: vi.fn(() => b),
          update: vi.fn(() => b),
          insert: vi.fn(() => b),
          single: () => Promise.resolve(singleResults.get(table) ?? { data: null, error: null }),
          then: (resolve: any) => resolve(results.get(table) ?? { data: [], error: null }),
        };
        builders.set(table, b);
        return b;
      }

      const channelStub: any = {
        on: vi.fn(() => channelStub),
        subscribe: vi.fn(() => channelStub),
      };

      return {
        client: {
          from: vi.fn((t: string) => getBuilder(t)),
          functions: { invoke: vi.fn() },
          channel: vi.fn(() => channelStub),
          removeChannel: vi.fn(),
        },
        setResult: (table: string, data: any, error: any = null) =>
          results.set(table, { data, error }),
        setSingleResult: (table: string, data: any, error: any = null) =>
          singleResults.set(table, { data, error }),
      };
    }

    it('deriva ausente=true para sesiones no_show y separa justificadas de no justificadas', async () => {
      const mock = makeFlexibleSupabaseMock();

      mock.setSingleResult('students', {
        id: 42,
        status: 'active',
        created_at: '2026-01-01',
        users: {
          id: 7,
          rut: '11.111.111-1',
          first_names: 'Juan',
          paternal_last_name: 'Pérez',
          maternal_last_name: 'Soto',
          email: 'juan@example.com',
          phone: '123456789',
        },
        enrollments: [
          {
            id: 100,
            number: '2026-0001',
            created_at: '2026-01-02',
            total_paid: 0,
            pending_balance: 0,
            license_group: 'class_b',
            promotion_course_id: null,
            registration_channel: 'in_person',
            certificate_b_pdf_url: null,
            certificate_professional_pdf_url: null,
            license_initial_url: null,
            license_full_url: null,
            courses: { name: 'Clase B' },
            digital_contracts: null,
            status: 'active',
          },
        ],
      });

      mock.setResult('class_b_practice_attendance', [
        {
          id: 1,
          status: 'present',
          justification: null,
          recorded_at: '2026-06-01',
          class_b_sessions: {
            id: 501,
            enrollment_id: 100,
            class_number: 1,
            scheduled_at: '2026-06-01T09:00:00',
            instructors: null,
          },
        },
        {
          id: 2,
          status: 'absent',
          justification: null,
          recorded_at: '2026-06-02',
          class_b_sessions: {
            id: 502,
            enrollment_id: 100,
            class_number: 2,
            scheduled_at: '2026-06-02T09:00:00',
            instructors: { users: { first_names: 'Ana', paternal_last_name: 'López' } },
          },
        },
        {
          id: 3,
          status: 'excused',
          justification: 'Certificado médico',
          recorded_at: '2026-06-03',
          class_b_sessions: {
            id: 503,
            enrollment_id: 100,
            class_number: 3,
            scheduled_at: '2026-06-03T09:00:00',
            instructors: null,
          },
        },
      ]);

      mock.setResult('class_b_sessions', [
        {
          id: 501,
          class_number: 1,
          scheduled_at: '2026-06-01T09:00:00',
          status: 'completed',
          student_signature: true,
          instructor_signature: true,
          km_start: null,
          km_end: null,
          instructors: null,
        },
        {
          id: 502,
          class_number: 2,
          scheduled_at: '2026-06-02T09:00:00',
          status: 'no_show',
          student_signature: false,
          instructor_signature: false,
          km_start: null,
          km_end: null,
          instructors: null,
        },
        {
          id: 503,
          class_number: 3,
          scheduled_at: '2026-06-03T09:00:00',
          status: 'no_show',
          student_signature: false,
          instructor_signature: false,
          km_start: null,
          km_end: null,
          instructors: null,
        },
      ]);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AdminAlumnoDetalleFacade,
          { provide: SupabaseService, useValue: mock },
          { provide: ToastService, useValue: { error: vi.fn(), success: vi.fn() } },
          { provide: DmsViewerService, useValue: dmsViewerSpy },
          { provide: NotificationsFacade, useValue: notificationsSpy },
        ],
      });
      facade = TestBed.inject(AdminAlumnoDetalleFacade);

      await facade.initialize(42);

      const clase1 = facade.clasesPracticas().find((c) => c.numero === 1);
      const clase2 = facade.clasesPracticas().find((c) => c.numero === 2);
      const clase3 = facade.clasesPracticas().find((c) => c.numero === 3);
      expect(clase1?.completada).toBe(true);
      expect(clase1?.ausente).toBe(false);
      expect(clase2?.ausente).toBe(true);
      expect(clase2?.completada).toBe(false);
      expect(clase3?.ausente).toBe(true);

      // La grilla debe reflejar la justificación sin perder el color rojo (ausente=true
      // se mantiene): clase 2 sigue sin justificar, clase 3 ya fue perdonada.
      expect(clase2?.justificada).toBe(false);
      expect(clase2?.justificacion).toBeNull();
      expect(clase3?.justificada).toBe(true);
      expect(clase3?.justificacion).toBe('Certificado médico');

      const inasistencias = facade.inasistenciasClaseB();
      expect(inasistencias).toHaveLength(2);

      const noJustificada = inasistencias.find((i) => i.id === 2);
      expect(noJustificada?.justificada).toBe(false);
      expect(noJustificada?.instructor).toBe('Ana López');
      // Ambas sesiones (502, 503) siguen en 'no_show' → ninguna fue reagendada aún.
      expect(noJustificada?.reagendada).toBe(false);

      const justificada = inasistencias.find((i) => i.id === 3);
      expect(justificada?.justificada).toBe(true);
      expect(justificada?.justificacion).toBe('Certificado médico');
      expect(justificada?.reagendada).toBe(false);
    });

    it('soft archive (RF-053): marca reagendada=true cuando la sesión ya no está en no_show, sin perder el historial de inasistencia', async () => {
      const mock = makeFlexibleSupabaseMock();

      mock.setSingleResult('students', {
        id: 42,
        status: 'active',
        created_at: '2026-01-01',
        users: {
          id: 7,
          rut: '11.111.111-1',
          first_names: 'Juan',
          paternal_last_name: 'Pérez',
          maternal_last_name: 'Soto',
          email: 'juan@example.com',
          phone: '123456789',
        },
        enrollments: [
          {
            id: 100,
            number: '2026-0001',
            created_at: '2026-01-02',
            total_paid: 0,
            pending_balance: 0,
            license_group: 'class_b',
            promotion_course_id: null,
            registration_channel: 'in_person',
            certificate_b_pdf_url: null,
            certificate_professional_pdf_url: null,
            license_initial_url: null,
            license_full_url: null,
            courses: { name: 'Clase B' },
            digital_contracts: null,
            status: 'active',
          },
        ],
      });

      // La sesión 502 fue reciclada por el flujo de reagendar: su class_b_sessions.status
      // ya no es 'no_show' (volvió a 'scheduled' con nueva fecha), pero el registro de
      // asistencia original (id 2, status 'absent') se conserva — ya no se borra.
      mock.setResult('class_b_practice_attendance', [
        {
          id: 2,
          status: 'absent',
          justification: null,
          recorded_at: '2026-06-02',
          class_b_sessions: {
            id: 502,
            enrollment_id: 100,
            class_number: 2,
            scheduled_at: '2026-07-10T09:00:00',
            status: 'scheduled',
            instructors: null,
          },
        },
      ]);

      mock.setResult('class_b_sessions', [
        {
          id: 502,
          class_number: 2,
          scheduled_at: '2026-07-10T09:00:00',
          status: 'scheduled',
          student_signature: false,
          instructor_signature: false,
          km_start: null,
          km_end: null,
          instructors: null,
        },
      ]);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AdminAlumnoDetalleFacade,
          { provide: SupabaseService, useValue: mock },
          { provide: ToastService, useValue: { error: vi.fn(), success: vi.fn() } },
          { provide: DmsViewerService, useValue: dmsViewerSpy },
          { provide: NotificationsFacade, useValue: notificationsSpy },
        ],
      });
      facade = TestBed.inject(AdminAlumnoDetalleFacade);

      await facade.initialize(42);

      // Vista principal: la grilla ya la muestra "limpia" (no ausente) porque
      // class_b_sessions.status volvió a 'scheduled'.
      const clase2 = facade.clasesPracticas().find((c) => c.numero === 2);
      expect(clase2?.ausente).toBe(false);

      // Vista de historial: el registro sigue apareciendo, ahora con reagendada=true.
      const inasistencias = facade.inasistenciasClaseB();
      expect(inasistencias).toHaveLength(1);
      expect(inasistencias[0].reagendada).toBe(true);
      expect(inasistencias[0].justificada).toBe(false);
    });

    it('cuenta canceladas + no_show y habilita puedeReagendarPenalizacion', async () => {
      const mock = makeFlexibleSupabaseMock();

      mock.setSingleResult('students', {
        id: 42,
        status: 'active',
        created_at: '2026-01-01',
        users: {
          id: 7,
          rut: '11.111.111-1',
          first_names: 'Juan',
          paternal_last_name: 'Pérez',
          maternal_last_name: 'Soto',
          email: 'juan@example.com',
          phone: '123456789',
        },
        enrollments: [
          {
            id: 100,
            number: '2026-0001',
            created_at: '2026-01-02',
            total_paid: 0,
            pending_balance: 0,
            license_group: 'class_b',
            promotion_course_id: null,
            registration_channel: 'in_person',
            certificate_b_pdf_url: null,
            certificate_professional_pdf_url: null,
            license_initial_url: null,
            license_full_url: null,
            courses: { name: 'Clase B' },
            digital_contracts: null,
            status: 'active',
          },
        ],
      });

      mock.setResult('class_b_sessions', [
        {
          id: 601,
          class_number: 11,
          status: 'cancelled',
          student_signature: false,
          instructor_signature: false,
        },
        {
          id: 602,
          class_number: 12,
          status: 'cancelled',
          student_signature: false,
          instructor_signature: false,
        },
        {
          id: 603,
          class_number: 10,
          status: 'completed',
          student_signature: true,
          instructor_signature: true,
        },
        {
          id: 604,
          class_number: 9,
          status: 'no_show',
          student_signature: false,
          instructor_signature: false,
        },
      ]);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AdminAlumnoDetalleFacade,
          { provide: SupabaseService, useValue: mock },
          { provide: ToastService, useValue: { error: vi.fn(), success: vi.fn() } },
          { provide: DmsViewerService, useValue: dmsViewerSpy },
          { provide: NotificationsFacade, useValue: notificationsSpy },
        ],
      });
      facade = TestBed.inject(AdminAlumnoDetalleFacade);

      await facade.initialize(42);

      // RF-053: el alumno debe reagendar tanto las canceladas (2, perdidas por la
      // penalización) como las no_show (1, la inasistencia que la gatilló) para
      // completar su curso de 12 — el conteo suma ambas, no solo 'cancelled'.
      expect(facade.clasesPendientesReagendarCount()).toBe(3);
      expect(facade.puedeReagendarPenalizacion()).toBe(true);

      // Lista que alimenta el checklist del drawer: ordenada por class_number,
      // trae el origen exacto de cada una (determina update-in-place vs insert).
      const pendientes = facade.clasesPendientesReagendar();
      expect(pendientes.map((p) => p.claseNumero)).toEqual([9, 11, 12]);
      expect(pendientes.find((p) => p.claseNumero === 9)).toMatchObject({
        sessionId: 604,
        origen: 'no_show',
      });
      expect(pendientes.find((p) => p.claseNumero === 11)).toMatchObject({
        sessionId: 601,
        origen: 'cancelled',
      });

      // Bug real detectado en producción: una sesión 'cancelled' conserva su
      // scheduled_at, así que sin el flag `cancelada` caía en el bucket "azul"
      // (agendada) de la grilla en vez de mostrarse como penalización.
      const clase9 = facade.clasesPracticas().find((c) => c.numero === 9);
      const clase10 = facade.clasesPracticas().find((c) => c.numero === 10);
      const clase11 = facade.clasesPracticas().find((c) => c.numero === 11);
      const clase12 = facade.clasesPracticas().find((c) => c.numero === 12);
      expect(clase9?.ausente).toBe(true);
      expect(clase10?.cancelada).toBe(false);
      expect(clase10?.completada).toBe(true);
      expect(clase11?.cancelada).toBe(true);
      expect(clase11?.ausente).toBe(false);
      expect(clase12?.cancelada).toBe(true);

      // Sin fila en class_b_practice_attendance para la 604 → no justificada.
      expect(pendientes.find((p) => p.claseNumero === 9)?.justificada).toBe(false);
    });

    it('propaga justificada=true al checklist cuando la inasistencia no_show ya fue perdonada', async () => {
      const mock = makeFlexibleSupabaseMock();

      mock.setSingleResult('students', {
        id: 42,
        status: 'active',
        created_at: '2026-01-01',
        users: {
          id: 7,
          rut: '11.111.111-1',
          first_names: 'Juan',
          paternal_last_name: 'Pérez',
          maternal_last_name: 'Soto',
          email: 'juan@example.com',
          phone: '123456789',
        },
        enrollments: [
          {
            id: 100,
            number: '2026-0001',
            created_at: '2026-01-02',
            total_paid: 0,
            pending_balance: 0,
            license_group: 'class_b',
            promotion_course_id: null,
            registration_channel: 'in_person',
            certificate_b_pdf_url: null,
            certificate_professional_pdf_url: null,
            license_initial_url: null,
            license_full_url: null,
            courses: { name: 'Clase B' },
            digital_contracts: null,
            status: 'active',
          },
        ],
      });

      mock.setResult('class_b_sessions', [
        {
          id: 604,
          class_number: 9,
          status: 'no_show',
          student_signature: false,
          instructor_signature: false,
        },
      ]);
      mock.setResult('class_b_practice_attendance', [
        {
          id: 1,
          status: 'excused',
          justification: 'Certificado médico',
          recorded_at: '2026-06-01',
          class_b_sessions: { id: 604, enrollment_id: 100, class_number: 9 },
        },
      ]);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AdminAlumnoDetalleFacade,
          { provide: SupabaseService, useValue: mock },
          { provide: ToastService, useValue: { error: vi.fn(), success: vi.fn() } },
          { provide: DmsViewerService, useValue: dmsViewerSpy },
          { provide: NotificationsFacade, useValue: notificationsSpy },
        ],
      });
      facade = TestBed.inject(AdminAlumnoDetalleFacade);

      await facade.initialize(42);

      const pendiente = facade.clasesPendientesReagendar().find((p) => p.claseNumero === 9);
      expect(pendiente?.origen).toBe('no_show');
      expect(pendiente?.justificada).toBe(true);
    });
  });

  describe('setReagendarSeleccion — RF-053', () => {
    it('guarda la selección del Paso 1 y limpia el grid/vehicle map previos', () => {
      (facade as any)._scheduleGrid.set({ week: {}, timeRows: [], slots: [] });
      (facade as any)._slotVehicleMap = new Map([['2026-07-10T09:00:00', 1]]);

      facade.setReagendarSeleccion([{ sessionId: 501, claseNumero: 9, origen: 'no_show' }]);

      expect(facade.reagendarSeleccion()).toEqual([
        { sessionId: 501, claseNumero: 9, origen: 'no_show' },
      ]);
      expect(facade.scheduleGrid()).toBeNull();
      expect((facade as any)._slotVehicleMap.size).toBe(0);
    });
  });

  describe('reagendarClasesPenalizadas — RF-053', () => {
    it('recicla in-place tanto las sesiones no_show como las cancelled de la selección (nunca inserta filas nuevas, sin borrar su historial de asistencia)', async () => {
      const updateEqSpy = vi.fn().mockResolvedValue({ error: null });
      const updateSpy = vi.fn().mockReturnValue({ eq: updateEqSpy });
      const insertSpy = vi.fn();

      const fromSpy = vi.fn().mockReturnValue({ update: updateSpy, insert: insertSpy });
      supabaseSpy.client.from = fromSpy;

      // El Paso 1 marcó 1 no_show (clase #9) + 1 cancelled (clase #11).
      facade.setReagendarSeleccion([
        { sessionId: 501, claseNumero: 9, origen: 'no_show' },
        { sessionId: 601, claseNumero: 11, origen: 'cancelled' },
      ]);

      (facade as any)._slotVehicleMap = new Map([
        ['2026-07-10T09:00:00', 55],
        ['2026-07-13T10:00:00', 55],
      ]);

      await facade.reagendarClasesPenalizadas({
        enrollmentId: 100,
        instructorId: 9,
        // Deliberadamente desordenado — el método debe ordenar cronológicamente.
        selectedSlotIds: ['2026-07-13T10:00:00', '2026-07-10T09:00:00'],
      });

      // 1. Recicla la sesión no_show #501 (clase #9): mismo id, primer slot cronológico.
      expect(updateSpy).toHaveBeenCalledWith({
        instructor_id: 9,
        vehicle_id: 55,
        scheduled_at: '2026-07-10T09:00:00',
        status: 'scheduled',
        start_time: null,
        end_time: null,
      });
      expect(updateEqSpy).toHaveBeenCalledWith('id', 501);

      // 2. Recicla la sesión cancelled #601 (clase #11): mismo id, segundo slot cronológico.
      expect(updateSpy).toHaveBeenCalledWith({
        instructor_id: 9,
        vehicle_id: 55,
        scheduled_at: '2026-07-13T10:00:00',
        status: 'scheduled',
        start_time: null,
        end_time: null,
      });
      expect(updateEqSpy).toHaveBeenCalledWith('id', 601);

      // 3. Soft archive (RF-053): NUNCA se borra class_b_practice_attendance — el
      // historial de la inasistencia original se conserva para auditoría. La grilla
      // se ve "limpia" (azul) porque deriva su color de class_b_sessions.status.
      expect(fromSpy).not.toHaveBeenCalledWith('class_b_practice_attendance');

      // 4. Nunca inserta una fila nueva — el class_number de la matrícula no cambia.
      expect(insertSpy).not.toHaveBeenCalled();

      // 5. Limpia la selección transitoria tras guardar.
      expect(facade.reagendarSeleccion()).toEqual([]);
    });

    it('no hace ninguna llamada si no hay selección guardada (Paso 1 vacío)', async () => {
      const fromSpy = vi.fn();
      supabaseSpy.client.from = fromSpy;
      facade.setReagendarSeleccion([]);

      await facade.reagendarClasesPenalizadas({
        enrollmentId: 100,
        instructorId: 9,
        selectedSlotIds: ['2026-07-10T09:00:00'],
      });

      expect(fromSpy).not.toHaveBeenCalled();
    });

    it('lanza un error si no encuentra el vehículo del slot en el mapa', async () => {
      supabaseSpy.client.from = vi.fn();
      facade.setReagendarSeleccion([{ sessionId: 501, claseNumero: 9, origen: 'no_show' }]);
      (facade as any)._slotVehicleMap = new Map();

      await expect(
        facade.reagendarClasesPenalizadas({
          enrollmentId: 100,
          instructorId: 9,
          selectedSlotIds: ['2026-07-10T09:00:00'],
        }),
      ).rejects.toThrow('No se pudo determinar el vehículo');
    });

    it('lanza un error si la cantidad de horarios elegidos no coincide con la selección', async () => {
      supabaseSpy.client.from = vi.fn();
      facade.setReagendarSeleccion([
        { sessionId: 501, claseNumero: 9, origen: 'no_show' },
        { sessionId: 601, claseNumero: 11, origen: 'cancelled' },
      ]);
      (facade as any)._slotVehicleMap = new Map([['2026-07-10T09:00:00', 55]]);

      await expect(
        facade.reagendarClasesPenalizadas({
          enrollmentId: 100,
          instructorId: 9,
          selectedSlotIds: ['2026-07-10T09:00:00'],
        }),
      ).rejects.toThrow('La cantidad de horarios elegidos no coincide con la selección.');
    });
  });

  describe('loadScheduleGrid — límite dinámico de reagendamiento', () => {
    /** Fuerza esta suite a que el límite superior venga del AgendaSettingsService mockeado. */
    function setupWithAgendaLimit(maxVisibleDateIso: string) {
      const builder: any = {
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        lte: vi.fn(() => builder),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
      const mock = {
        client: {
          from: vi.fn(() => builder),
          functions: { invoke: vi.fn() },
        },
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AdminAlumnoDetalleFacade,
          { provide: SupabaseService, useValue: mock },
          { provide: ToastService, useValue: toastSpy },
          { provide: DmsViewerService, useValue: dmsViewerSpy },
          { provide: NotificationsFacade, useValue: notificationsSpy },
          {
            provide: AgendaSettingsService,
            useValue: { maxVisibleDateIso: vi.fn().mockReturnValue(maxVisibleDateIso) },
          },
        ],
      });
      facade = TestBed.inject(AdminAlumnoDetalleFacade);

      return builder;
    }

    it('recorta la disponibilidad al límite dinámico de AgendaSettingsService, no a un mes fijo', async () => {
      const builder = setupWithAgendaLimit('2026-09-20');

      await facade.loadScheduleGrid(9);

      expect(builder.lte).toHaveBeenCalledWith('slot_start', '2026-09-20T23:59:59');
    });

    it('re-deriva el límite en cada llamada — no queda pegado al primer valor leído', async () => {
      const builder = setupWithAgendaLimit('2026-05-14');
      await facade.loadScheduleGrid(9);
      expect(builder.lte).toHaveBeenLastCalledWith('slot_start', '2026-05-14T23:59:59');
    });
  });
});
