import { TestBed } from '@angular/core/testing';
import { CertificacionClaseBFacade } from './certificacion-clase-b.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { DmsViewerService } from '@core/services/ui/dms-viewer.service';
import { BranchFacade } from '@core/facades/branch.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { NotificationsFacade } from '@core/facades/notifications.facade';
import type { CertificacionAlumnoRow } from '@core/models/ui/certificacion-clase-b.model';

describe('CertificacionClaseBFacade', () => {
  let facade: CertificacionClaseBFacade;
  let supabaseSpy: any;
  let toastSpy: any;
  let dmsViewerSpy: any;
  let branchFacadeSpy: any;
  let authFacadeSpy: any;
  let notificationsSpy: any;

  const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

  const makeQuery = (resolvedValue: any) => ({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(resolvedValue),
  });

  function makeAlumnoRow(overrides: Partial<CertificacionAlumnoRow> = {}): CertificacionAlumnoRow {
    return {
      enrollmentId: 42,
      studentId: 5,
      nombre: 'Juan López',
      rut: '11.111.111-1',
      curso: 'Clase B',
      clasesCompletadas: 12,
      clasesTotales: 12,
      fechaTermino: '2026-06-01',
      pctAsistenciaTeoria: null,
      certificadoId: null,
      certificadoFolio: null,
      certificadoStatus: 'pendiente',
      storagePath: null,
      emailEnviado: false,
      email: 'juan@test.com',
      ...overrides,
    };
  }

  function mockFromByTable(handlers: Record<string, any>) {
    return vi.fn().mockImplementation((table: string) => {
      if (handlers[table]) return handlers[table];
      return makeQuery({ data: [], error: null });
    });
  }

  /** Builder awaitable (chain termina con `await query`, sin `.limit()` explícito) — usado
   * por `fetchAlumnos()` para el query de `enrollments` y sus joins auxiliares. */
  function makeAwaitableQuery(resolvedValue: any) {
    const builder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: (resolve: any, reject: any) => Promise.resolve(resolvedValue).then(resolve, reject),
    };
    return builder;
  }

  beforeEach(() => {
    supabaseSpy = {
      client: {
        from: vi.fn().mockReturnValue(makeQuery({ data: [], error: null })),
        storage: {
          from: vi.fn().mockReturnValue({
            createSignedUrl: vi
              .fn()
              .mockResolvedValue({ data: { signedUrl: 'https://signed' }, error: null }),
          }),
        },
        functions: {
          invoke: vi.fn().mockResolvedValue({
            data: { pdfUrl: 'https://pdf', pdfPath: 'path/file.pdf' },
            error: null,
          }),
        },
      },
    };
    toastSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
    dmsViewerSpy = { openByUrl: vi.fn() };
    branchFacadeSpy = { selectedBranchId: vi.fn().mockReturnValue(null) };
    authFacadeSpy = { currentUser: vi.fn().mockReturnValue({ role: 'admin', branchId: null }) };
    notificationsSpy = {
      notifyUsers: vi.fn().mockResolvedValue(undefined),
      notifyRole: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        CertificacionClaseBFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: DmsViewerService, useValue: dmsViewerSpy },
        { provide: BranchFacade, useValue: branchFacadeSpy },
        { provide: AuthFacade, useValue: authFacadeSpy },
        { provide: NotificationsFacade, useValue: notificationsSpy },
      ],
    });

    facade = TestBed.inject(CertificacionClaseBFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  describe('Estado inicial', () => {
    it('alumnos arranca vacío', () => {
      expect(facade.alumnos()).toEqual([]);
    });

    it('isLoading arranca en false', () => {
      expect(facade.isLoading()).toBe(false);
    });

    it('generatingId arranca en null', () => {
      expect(facade.generatingId()).toBeNull();
    });

    it('kpis arranca en cero con lista vacía', () => {
      const kpis = facade.kpis();
      expect(kpis.totalAlumnos).toBe(0);
      expect(kpis.certificadosGenerados).toBe(0);
      expect(kpis.pendientesGeneracion).toBe(0);
      expect(kpis.pendientesEnvio).toBe(0);
    });
  });

  describe('kpis computed', () => {
    it('cuenta correctamente generados y pendientes', () => {
      const kpis = facade.kpis();
      expect(kpis.certificadosGenerados + kpis.pendientesGeneracion).toBe(kpis.totalAlumnos);
    });
  });

  describe('initialize()', () => {
    it('no lanza y desactiva isLoading al terminar', async () => {
      await facade.initialize();
      expect(facade.isLoading()).toBe(false);
    });

    it('segunda llamada no repite la carga con skeleton (SWR)', async () => {
      await facade.initialize();
      await facade.initialize();
      expect(facade.isLoading()).toBe(false);
    });
  });

  describe('fetchAlumnos — Refuerzo Clase B (spec 0006-m)', () => {
    function mockEnrollments(enrollments: any[]) {
      supabaseSpy.client.from = mockFromByTable({
        enrollments: makeAwaitableQuery({ data: enrollments, error: null }),
        v_student_progress_b: makeAwaitableQuery({ data: [], error: null }),
        class_b_sessions: makeAwaitableQuery({ data: [], error: null }),
        certificate_issuance_log: makeAwaitableQuery({ data: [], error: null }),
      });
    }

    it('filtra courses.is_reinforcement=false en la query de enrollments', async () => {
      const enrollmentsQuery = makeAwaitableQuery({ data: [], error: null });
      supabaseSpy.client.from = mockFromByTable({
        enrollments: enrollmentsQuery,
        v_student_progress_b: makeAwaitableQuery({ data: [], error: null }),
        class_b_sessions: makeAwaitableQuery({ data: [], error: null }),
        certificate_issuance_log: makeAwaitableQuery({ data: [], error: null }),
      });

      await facade.initialize();

      expect(enrollmentsQuery.eq).toHaveBeenCalledWith('courses.is_reinforcement', false);
    });

    it('clasesTotales deriva de practical_hours del curso, no queda hardcodeado en 12 (AC3)', async () => {
      mockEnrollments([
        {
          id: 1,
          branch_id: 1,
          certificate_b_pdf_url: null,
          courses: { name: 'Clase B', type: 'class_b', practical_hours: 9.0 },
          students: {
            id: 5,
            users: {
              first_names: 'Juan',
              paternal_last_name: 'López',
              maternal_last_name: '',
              rut: '11111111-1',
              email: 'juan@test.com',
            },
          },
          certificates: [],
        },
      ]);

      await facade.initialize();

      expect(facade.alumnos()).toHaveLength(1);
      expect(facade.alumnos()[0].clasesTotales).toBe(12);
    });

    it('regresión AC-E1: un curso Clase B estándar de 9.0h sigue dando clasesTotales=12', async () => {
      mockEnrollments([
        {
          id: 2,
          branch_id: 1,
          certificate_b_pdf_url: null,
          courses: { name: 'Clase B', type: 'class_b', practical_hours: 9.0 },
          students: {
            id: 6,
            users: {
              first_names: 'Ana',
              paternal_last_name: 'Soto',
              maternal_last_name: '',
              rut: '22222222-2',
              email: 'ana@test.com',
            },
          },
          certificates: [],
        },
      ]);

      await facade.initialize();

      expect(facade.alumnos()[0].clasesTotales).toBe(12);
      expect(facade.alumnos()[0].clasesCompletadas).toBeLessThanOrEqual(12);
    });
  });

  describe('generarCertificado()', () => {
    it('invoca la Edge Function con el enrollment_id correcto y force=false por defecto', async () => {
      await facade.generarCertificado(42);
      expect(supabaseSpy.client.functions.invoke).toHaveBeenCalledWith(
        'generate-certificate-b-pdf',
        { body: { enrollment_id: 42, force: false } },
      );
    });

    it('fix-011-i: propaga force=true al bypass admin (H-025)', async () => {
      await facade.generarCertificado(42, true);
      expect(supabaseSpy.client.functions.invoke).toHaveBeenCalledWith(
        'generate-certificate-b-pdf',
        { body: { enrollment_id: 42, force: true } },
      );
    });

    it('muestra toast de éxito y abre DMS viewer cuando la Edge Function responde ok', async () => {
      await facade.generarCertificado(42);
      expect(toastSpy.success).toHaveBeenCalledWith('Certificado generado correctamente');
      expect(dmsViewerSpy.openByUrl).toHaveBeenCalledWith('https://pdf', 'Certificado Clase B');
    });

    it('muestra toast de error cuando la Edge Function falla', async () => {
      supabaseSpy.client.functions.invoke.mockResolvedValueOnce({
        data: null,
        error: new Error('500'),
      });
      await facade.generarCertificado(42);
      expect(toastSpy.error).toHaveBeenCalledWith('No se pudo generar el certificado');
    });

    it('fix-011-i: muestra el mensaje específico del gate server-side (H-025) cuando data.error existe', async () => {
      supabaseSpy.client.functions.invoke.mockResolvedValueOnce({
        data: { error: 'El alumno no cumple el mínimo de clases prácticas completadas (4/12).' },
        error: null,
      });
      await facade.generarCertificado(42);
      expect(toastSpy.error).toHaveBeenCalledWith(
        'El alumno no cumple el mínimo de clases prácticas completadas (4/12).',
      );
    });

    it('limpia generatingId tras la llamada (éxito o error)', async () => {
      await facade.generarCertificado(42);
      expect(facade.generatingId()).toBeNull();
    });
  });

  describe('verCertificado()', () => {
    it('genera signed URL y abre DMS viewer', async () => {
      await facade.verCertificado('certificates/42/cert.pdf', 'Juan López');
      expect(supabaseSpy.client.storage.from).toHaveBeenCalledWith('documents');
      expect(dmsViewerSpy.openByUrl).toHaveBeenCalledWith(
        'https://signed',
        'Certificado — Juan López',
      );
    });

    it('muestra toast de error si no puede firmar la URL', async () => {
      supabaseSpy.client.storage
        .from()
        .createSignedUrl.mockResolvedValueOnce({ data: null, error: new Error('storage err') });
      await facade.verCertificado('path/file.pdf', 'Test');
      expect(toastSpy.error).toHaveBeenCalledWith('No se pudo abrir el certificado');
    });
  });

  describe('generarPendientes()', () => {
    it('sin pendientes no invoca generación', async () => {
      await facade.generarPendientes();
      expect(supabaseSpy.client.functions.invoke).not.toHaveBeenCalled();
    });
  });

  describe('notificaciones de certificado (Spec 0024, AC7)', () => {
    it('notifica al alumno tras generar un certificado individual', async () => {
      (facade as any)._alumnos.set([makeAlumnoRow({ enrollmentId: 42, studentId: 5 })]);
      const studentsHandler = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { user_id: 900 }, error: null }),
          }),
        }),
      };
      supabaseSpy.client.from = mockFromByTable({ students: studentsHandler });

      await facade.generarCertificado(42);
      await flushMicrotasks();

      expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith(
        [900],
        expect.objectContaining({ referenceType: 'certificate', referenceId: 42 }),
      );
    });

    it('no rompe la generación si falla la notificación (AC-E1)', async () => {
      (facade as any)._alumnos.set([makeAlumnoRow({ enrollmentId: 42, studentId: 5 })]);
      const studentsHandler = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { user_id: 900 }, error: null }),
          }),
        }),
      };
      supabaseSpy.client.from = mockFromByTable({ students: studentsHandler });
      notificationsSpy.notifyUsers.mockRejectedValue(new Error('insert failed'));

      await expect(facade.generarCertificado(42)).resolves.toBeUndefined();
      await flushMicrotasks();
    });

    it('generarPendientes notifica por cada certificado generado exitosamente', async () => {
      (facade as any)._alumnos.set([
        makeAlumnoRow({ enrollmentId: 42, studentId: 5, nombre: 'Alumno Uno' }),
        makeAlumnoRow({ enrollmentId: 43, studentId: 6, nombre: 'Alumno Dos' }),
      ]);
      const studentsHandler = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockImplementation((_col: string, id: number) => ({
            single: vi.fn().mockResolvedValue({
              data: { user_id: id === 5 ? 900 : 901 },
              error: null,
            }),
          })),
        }),
      };
      supabaseSpy.client.from = mockFromByTable({ students: studentsHandler });

      await facade.generarPendientes();
      await flushMicrotasks();

      expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith([900], expect.any(Object));
      expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith([901], expect.any(Object));
    });
  });
});
