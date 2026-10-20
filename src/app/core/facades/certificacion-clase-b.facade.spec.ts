import { TestBed } from '@angular/core/testing';
import { CertificacionClaseBFacade } from './certificacion-clase-b.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { DmsViewerService } from '@core/services/ui/dms-viewer.service';
import { BranchFacade } from '@core/facades/branch.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { NotificationsFacade } from '@core/facades/notifications.facade';
import { CertificadoAutorizacionFacade } from '@core/facades/certificado-autorizacion.facade';
import type { CertificacionAlumnoRow } from '@core/models/ui/certificacion-clase-b.model';

// fix-463-m: el piloto se controla por test; por defecto el portal del alumno está habilitado.
const pilot = vi.hoisted(() => ({ alumnoBloqueado: false }));
vi.mock('@core/config/pilot-phase.config', () => ({
  isBlockedInPilot: (module: string) => module === 'alumno' && pilot.alumnoBloqueado,
}));

describe('CertificacionClaseBFacade', () => {
  let facade: CertificacionClaseBFacade;
  let supabaseSpy: any;
  let toastSpy: any;
  let dmsViewerSpy: any;
  let branchFacadeSpy: any;
  let authFacadeSpy: any;
  let notificationsSpy: any;
  let autorizacionSpy: any;

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
    // fix-466-m: el modal previo a emitir vive en CertificadoAutorizacionFacade (su propio spec).
    autorizacionSpy = {
      confirmarAvisos: vi.fn().mockResolvedValue(true),
      confirmarRegeneracion: vi.fn().mockResolvedValue(true),
      confirmarEnvioEmail: vi.fn().mockResolvedValue(true),
      autorizarDeuda: vi.fn().mockResolvedValue(false),
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
        { provide: CertificadoAutorizacionFacade, useValue: autorizacionSpy },
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

  // fix-195-b (D06 de ASG-i-037): A → B → A rápido con la respuesta de B demorada. Antes la
  // respuesta vieja llegaba al final y dejaba la pantalla en "A" con los pendientes de B.
  describe('respuestas fuera de orden al cambiar de sede (fix-195-b, spec 0005-m)', () => {
    let selected: number;
    let liberarB: () => void;

    const matricula = (id: number, branchId: number) => ({
      id,
      branch_id: branchId,
      certificate_b_pdf_url: null,
      courses: { name: 'Clase B', type: 'class_b', practical_hours: 12, is_reinforcement: false },
      students: {
        id,
        users: {
          first_names: 'N',
          paternal_last_name: 'P',
          maternal_last_name: null,
          rut: '1-9',
          email: '',
        },
      },
      certificates: [],
    });
    const MATRICULAS: Record<number, unknown[]> = {
      1: [matricula(1, 1), matricula(2, 1)],
      2: [matricula(10, 2)],
    };

    beforeEach(() => {
      const bRetenida = new Promise<void>((r) => (liberarB = r));
      branchFacadeSpy.selectedBranchId.mockImplementation(() => selected);
      supabaseSpy.client.from = vi.fn().mockImplementation((table: string) => {
        const state: { branch?: number } = {};
        const b: any = {
          select: () => b,
          in: () => b,
          order: () => b,
          limit: () => b,
          eq: (col: string, val: unknown) => {
            if (col === 'branch_id') state.branch = val as number;
            return b;
          },
          then: async (resolve: (v: unknown) => void) => {
            if (state.branch === 2) await bRetenida;
            const data = table === 'enrollments' ? MATRICULAS[state.branch!] : [];
            resolve({ data, error: null });
          },
        };
        return b;
      });
    });

    it('reload A → B → A: queda con los alumnos de A aunque B responda al final', async () => {
      selected = 1;
      await facade.initialize();
      selected = 2;
      const cargaB = facade.reload();
      selected = 1;
      await facade.reload();
      liberarB();
      await cargaB;

      expect(facade.alumnos().map((a) => a.enrollmentId)).toEqual([1, 2]);
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

    it('fix-262-m: cuenta clases cerradas (status=completed), nunca la nota de evaluación', async () => {
      const sessionsQuery = makeAwaitableQuery({
        data: Array.from({ length: 12 }, () => ({ enrollment_id: 3 })),
        error: null,
      });
      supabaseSpy.client.from = mockFromByTable({
        enrollments: makeAwaitableQuery({
          data: [
            {
              id: 3,
              branch_id: 1,
              certificate_b_pdf_url: null,
              courses: { name: 'Clase B', type: 'class_b', practical_hours: 9.0 },
              students: {
                id: 7,
                users: {
                  first_names: 'Eva',
                  paternal_last_name: 'Rojas',
                  maternal_last_name: '',
                  rut: '33333333-3',
                  email: 'eva@test.com',
                },
              },
              certificates: [],
            },
          ],
          error: null,
        }),
        v_student_progress_b: makeAwaitableQuery({ data: [], error: null }),
        class_b_sessions: sessionsQuery,
        certificate_issuance_log: makeAwaitableQuery({ data: [], error: null }),
      });

      await facade.initialize();

      expect(sessionsQuery.eq).toHaveBeenCalledWith('status', 'completed');
      expect(sessionsQuery.not).not.toHaveBeenCalled();
      expect(facade.alumnos()[0].clasesCompletadas).toBe(12);
    });
  });

  // fix-459-m: la secretaria ve lo mismo que el botón y la edge function consideran elegible.
  describe('fetchAlumnos — lista de la secretaria (fix-459-m)', () => {
    const enrollment = (id: number, extra: Record<string, unknown> = {}) => ({
      id,
      branch_id: 1,
      certificate_b_pdf_url: null,
      courses: { name: 'Clase B', type: 'class_b', practical_hours: 9.0 },
      students: {
        id: id * 10,
        users: {
          first_names: `N${id}`,
          paternal_last_name: `A${id}`,
          maternal_last_name: '',
          rut: `${id}-0`,
          email: '',
        },
      },
      certificates: [],
      ...extra,
    });

    function mockData(sessionsPerEnrollment: Record<number, number>) {
      const enrollmentsQuery = makeAwaitableQuery({
        data: [
          enrollment(1), // 12/12 → elegible
          enrollment(2), // 11/12 → no
          enrollment(3, {
            // 5/12 pero ya tiene certificado (generado por el admin con bypass)
            certificate_b_pdf_url: 'certificates/3/c.pdf',
            certificates: [
              { id: 30, folio: 7, status: 'issued', created_at: '2026-10-01T12:00:00Z' },
            ],
          }),
        ],
        error: null,
      });
      const sessions = Object.entries(sessionsPerEnrollment).flatMap(([id, n]) =>
        Array.from({ length: n }, () => ({ enrollment_id: Number(id) })),
      );
      supabaseSpy.client.from = mockFromByTable({
        enrollments: enrollmentsQuery,
        v_student_progress_b: makeAwaitableQuery({ data: [], error: null }),
        class_b_sessions: makeAwaitableQuery({ data: sessions, error: null }),
        certificate_issuance_log: makeAwaitableQuery({ data: [], error: null }),
      });
      return enrollmentsQuery;
    }

    const ids = () =>
      facade
        .alumnos()
        .map((a) => a.enrollmentId)
        .sort();

    it('secretaria: ve 12/12 y los que ya tienen certificado; no 11/12; no filtra por certificate_enabled', async () => {
      authFacadeSpy.currentUser.mockReturnValue({ role: 'secretary', branchId: 1 });
      const q = mockData({ 1: 12, 2: 11, 3: 5 });

      await facade.initialize();

      expect(ids()).toEqual([1, 3]);
      expect(q.eq).not.toHaveBeenCalledWith('certificate_enabled', true);
    });

    it('admin: ve todos, cumplan o no', async () => {
      mockData({ 1: 12, 2: 11, 3: 5 });

      await facade.initialize();

      expect(ids()).toEqual([1, 2, 3]);
    });
  });

  describe('generarCertificado()', () => {
    beforeEach(() => {
      (facade as any)._alumnos.set([makeAlumnoRow({ enrollmentId: 42 })]);
    });

    it('fix-466-m: con las clases completas pasa los datos al aviso (que no abre modal) y emite', async () => {
      await facade.generarCertificado(42);
      expect(autorizacionSpy.confirmarAvisos).toHaveBeenCalledWith({
        nombre: 'Juan López',
        practicasIncompletas: { completadas: 12, requeridas: 12 },
      });
      expect(supabaseSpy.client.functions.invoke).toHaveBeenCalledTimes(1);
    });

    it('fix-466-m: si el admin cancela el aviso de prácticas incompletas, no invoca', async () => {
      (facade as any)._alumnos.set([makeAlumnoRow({ enrollmentId: 42, clasesCompletadas: 9 })]);
      autorizacionSpy.confirmarAvisos.mockResolvedValueOnce(false);
      await facade.generarCertificado(42);
      expect(supabaseSpy.client.functions.invoke).not.toHaveBeenCalled();
    });

    it('invoca la Edge Function con el enrollment_id correcto y force=false por defecto', async () => {
      await facade.generarCertificado(42);
      expect(supabaseSpy.client.functions.invoke).toHaveBeenCalledWith(
        'generate-certificate-b-pdf',
        { body: { enrollment_id: 42, force: false } },
      );
    });

    it('fix-011-i/fix-466-m: admin con prácticas incompletas avisa en el modal y va con force', async () => {
      (facade as any)._alumnos.set([makeAlumnoRow({ enrollmentId: 42, clasesCompletadas: 9 })]);
      await facade.generarCertificado(42);
      expect(autorizacionSpy.confirmarAvisos).toHaveBeenCalledWith(
        expect.objectContaining({ practicasIncompletas: { completadas: 9, requeridas: 12 } }),
      );
      expect(supabaseSpy.client.functions.invoke).toHaveBeenCalledWith(
        'generate-certificate-b-pdf',
        { body: { enrollment_id: 42, force: true } },
      );
    });

    it('fix-466-m: la secretaria con prácticas incompletas no llega ni al modal', async () => {
      authFacadeSpy.currentUser.mockReturnValue({ role: 'secretary', branchId: 1 });
      (facade as any)._alumnos.set([makeAlumnoRow({ enrollmentId: 42, clasesCompletadas: 9 })]);
      await facade.generarCertificado(42);
      expect(autorizacionSpy.confirmarAvisos).not.toHaveBeenCalled();
      expect(supabaseSpy.client.functions.invoke).not.toHaveBeenCalled();
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

    /** Lo que devuelve functions.invoke() ante una respuesta no-2xx de la función real. */
    const rechazo = (status: number, body: unknown) => ({
      data: null,
      error: Object.assign(new Error('Edge Function returned a non-2xx status code'), {
        context: new Response(JSON.stringify(body), { status }),
      }),
    });

    it('fix-305-m: un rechazo de negocio (400) muestra el motivo que respondió la función', async () => {
      const motivo = 'El alumno no cumple el mínimo de clases prácticas completadas (11/12).';
      supabaseSpy.client.functions.invoke.mockResolvedValueOnce(rechazo(400, { error: motivo }));

      await facade.generarCertificado(42);

      expect(toastSpy.error).toHaveBeenCalledWith(motivo);
      expect(dmsViewerSpy.openByUrl).not.toHaveBeenCalled();
    });

    it('fix-305-m: un error interno (500) no muestra texto técnico', async () => {
      supabaseSpy.client.functions.invoke.mockResolvedValueOnce(
        rechazo(500, { error: 'Upload failed: new row violates row-level security policy' }),
      );

      await facade.generarCertificado(42);

      expect(toastSpy.error).toHaveBeenCalledWith('No se pudo generar el certificado');
    });

    it('limpia generatingId tras la llamada (éxito o error)', async () => {
      await facade.generarCertificado(42);
      expect(facade.generatingId()).toBeNull();
    });
  });

  // ── Spec 0010-i (AC8, AC-E5): certificado con deuda ───────────────────────
  // El modal con motivo y el registro de la habilitación se prueban en
  // certificado-autorizacion.facade.spec.ts; acá, el respaldo cuando la función rechaza.
  describe('certificado con deuda (spec 0010-i)', () => {
    const deuda = () => ({
      data: null,
      error: Object.assign(new Error('Edge Function returned a non-2xx status code'), {
        context: new Response(
          JSON.stringify({
            error: 'El alumno tiene un saldo pendiente de $180.000.',
            code: 'DEUDA_PENDIENTE',
          }),
          { status: 409 },
        ),
      }),
    });

    beforeEach(() => {
      (facade as any)._alumnos.set([makeAlumnoRow({ enrollmentId: 42 })]);
    });

    it('si la función rechaza por deuda y no se autoriza, no reintenta ni muestra error', async () => {
      supabaseSpy.client.functions.invoke.mockResolvedValueOnce(deuda());

      await facade.generarCertificado(42);

      expect(autorizacionSpy.autorizarDeuda).toHaveBeenCalledWith(
        42,
        'El alumno tiene un saldo pendiente de $180.000.',
      );
      expect(supabaseSpy.client.functions.invoke).toHaveBeenCalledTimes(1);
      expect(toastSpy.error).not.toHaveBeenCalled();
    });

    it('si se autoriza la deuda, reintenta y emite (AC8)', async () => {
      supabaseSpy.client.functions.invoke.mockResolvedValueOnce(deuda());
      autorizacionSpy.autorizarDeuda.mockResolvedValueOnce(true);

      await facade.generarCertificado(42);

      expect(supabaseSpy.client.functions.invoke).toHaveBeenCalledTimes(2);
      expect(toastSpy.success).toHaveBeenCalledWith('Certificado generado correctamente');
    });

    it('"Generar pendientes" salta a los alumnos con deuda y lo informa (AC-E5)', async () => {
      (facade as any)._alumnos.set([
        makeAlumnoRow({ enrollmentId: 1, nombre: 'Con deuda' }),
        makeAlumnoRow({ enrollmentId: 2, nombre: 'Al día' }),
      ]);
      supabaseSpy.client.functions.invoke
        .mockResolvedValueOnce(deuda())
        .mockResolvedValueOnce({ data: { pdfUrl: 'u', pdfPath: 'p' }, error: null });

      await facade.generarPendientes();

      expect(autorizacionSpy.autorizarDeuda).not.toHaveBeenCalled();
      expect(autorizacionSpy.confirmarAvisos).not.toHaveBeenCalled();
      expect(toastSpy.warning).toHaveBeenCalledWith(expect.stringContaining('1 con deuda'));
    });
  });

  describe('regenerarCertificado() (fix-464-m)', () => {
    it('si se cancela la confirmación, no invoca la generación', async () => {
      autorizacionSpy.confirmarRegeneracion.mockResolvedValueOnce(false);
      await facade.regenerarCertificado(42);
      expect(autorizacionSpy.confirmarRegeneracion).toHaveBeenCalled();
      expect(supabaseSpy.client.functions.invoke).not.toHaveBeenCalled();
    });

    it('admin: confirma, regenera con force y abre el visor', async () => {
      await facade.regenerarCertificado(42);
      expect(supabaseSpy.client.functions.invoke).toHaveBeenCalledWith(
        'generate-certificate-b-pdf',
        { body: { enrollment_id: 42, force: true } },
      );
      expect(dmsViewerSpy.openByUrl).toHaveBeenCalled();
    });

    it('secretaria: regenera sin force', async () => {
      authFacadeSpy.currentUser.mockReturnValue({ role: 'secretary', branchId: 1 });
      await facade.regenerarCertificado(42);
      expect(supabaseSpy.client.functions.invoke).toHaveBeenCalledWith(
        'generate-certificate-b-pdf',
        { body: { enrollment_id: 42, force: false } },
      );
    });
  });

  describe('enviarEmail() (fix-466-m)', () => {
    beforeEach(() => {
      (facade as any)._alumnos.set([
        makeAlumnoRow({ enrollmentId: 42, certificadoStatus: 'generado', emailEnviado: true }),
      ]);
    });

    it('confirma con un modal y, si se cancela, no envía', async () => {
      autorizacionSpy.confirmarEnvioEmail.mockResolvedValueOnce(false);
      await facade.enviarEmail(42);
      expect(autorizacionSpy.confirmarEnvioEmail).toHaveBeenCalledWith({
        nombre: 'Juan López',
        email: 'juan@test.com',
        yaEnviado: true,
      });
      expect(supabaseSpy.client.functions.invoke).not.toHaveBeenCalled();
    });

    it('al confirmar, invoca send-certificate-email', async () => {
      supabaseSpy.client.functions.invoke.mockResolvedValueOnce({
        data: { success: true, recipientEmail: 'juan@test.com' },
        error: null,
      });
      await facade.enviarEmail(42);
      expect(supabaseSpy.client.functions.invoke).toHaveBeenCalledWith('send-certificate-email', {
        body: { enrollment_id: 42 },
      });
    });

    it('hotfix-160-m: si la función rechaza, el toast muestra su motivo', async () => {
      supabaseSpy.client.functions.invoke.mockResolvedValueOnce({
        data: null,
        error: {
          context: new Response(JSON.stringify({ error: 'El alumno no tiene email registrado' }), {
            status: 400,
          }),
        },
      });
      await facade.enviarEmail(42);
      expect(toastSpy.error).toHaveBeenCalledWith('El alumno no tiene email registrado');
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

    it('fix-462-m: solo genera a los pendientes con todas las clases completadas', async () => {
      (facade as any)._alumnos.set([
        makeAlumnoRow({ enrollmentId: 1, clasesCompletadas: 12 }),
        makeAlumnoRow({ enrollmentId: 2, clasesCompletadas: 8 }),
        makeAlumnoRow({ enrollmentId: 3, certificadoStatus: 'generado' }),
      ]);
      expect(facade.pendientesElegibles().map((a) => a.enrollmentId)).toEqual([1]);

      await facade.generarPendientes();

      const invoke = supabaseSpy.client.functions.invoke;
      expect(invoke).toHaveBeenCalledTimes(1);
      expect(invoke).toHaveBeenCalledWith('generate-certificate-b-pdf', {
        body: { enrollment_id: 1 },
      });
    });
  });

  describe('notificaciones de certificado (Spec 0024, AC7)', () => {
    afterEach(() => {
      pilot.alumnoBloqueado = false;
    });

    it('fix-463-m: con el portal del alumno en piloto, generar no lo notifica', async () => {
      pilot.alumnoBloqueado = true;
      (facade as any)._alumnos.set([makeAlumnoRow({ enrollmentId: 42, studentId: 5 })]);
      supabaseSpy.client.from = mockFromByTable({
        students: {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { user_id: 900 }, error: null }),
            }),
          }),
        },
      });

      await facade.generarCertificado(42);
      await flushMicrotasks();

      expect(notificationsSpy.notifyUsers).not.toHaveBeenCalled();
    });

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

    it('fix-306-m: sin la lista cargada (generado desde la ficha) igual avisa al alumno', async () => {
      const single = (data: unknown) => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data, error: null }) }),
        }),
      });
      const enrollmentsHandler = single({ student_id: 5, courses: { name: 'Clase B' } });
      supabaseSpy.client.from = mockFromByTable({
        enrollments: enrollmentsHandler,
        students: single({ user_id: 900 }),
      });
      expect(facade.alumnos()).toEqual([]);

      await facade.generarCertificado(42, { nombre: 'Juan', completadas: 12, requeridas: 12 });
      await flushMicrotasks();
      await flushMicrotasks();

      expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith(
        [900],
        expect.objectContaining({
          referenceType: 'certificate',
          referenceId: 42,
          message: expect.stringContaining('Clase B'),
        }),
      );
    });

    it('fix-306-m: si no se puede resolver al alumno, la generación termina igual', async () => {
      supabaseSpy.client.from = mockFromByTable({
        enrollments: {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: null, error: new Error('rls') }),
            }),
          }),
        },
      });

      await expect(
        facade.generarCertificado(42, { nombre: 'Juan', completadas: 12, requeridas: 12 }),
      ).resolves.toBeUndefined();
      await flushMicrotasks();

      expect(notificationsSpy.notifyUsers).not.toHaveBeenCalled();
      expect(dmsViewerSpy.openByUrl).toHaveBeenCalledWith('https://pdf', 'Certificado Clase B');
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
