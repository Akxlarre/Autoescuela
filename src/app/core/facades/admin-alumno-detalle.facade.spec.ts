import { TestBed } from '@angular/core/testing';
import { AdminAlumnoDetalleFacade } from './admin-alumno-detalle.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { DmsViewerService } from '@core/services/ui/dms-viewer.service';

describe('AdminAlumnoDetalleFacade', () => {
  let facade: AdminAlumnoDetalleFacade;
  let supabaseSpy: any;
  let invokeSpy: any;
  let dmsViewerSpy: any;

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
    };

    dmsViewerSpy = { openByUrl: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        AdminAlumnoDetalleFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: ToastService, useValue: { error: vi.fn(), success: vi.fn() } },
        { provide: DmsViewerService, useValue: dmsViewerSpy },
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

  it('porcentajeTeoricas should return 0 initially', () => {
    expect(facade.porcentajeTeoricas()).toBe(0);
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

      const inasistencias = facade.inasistenciasClaseB();
      expect(inasistencias).toHaveLength(2);

      const noJustificada = inasistencias.find((i) => i.id === 2);
      expect(noJustificada?.justificada).toBe(false);
      expect(noJustificada?.instructor).toBe('Ana López');

      const justificada = inasistencias.find((i) => i.id === 3);
      expect(justificada?.justificada).toBe(true);
      expect(justificada?.justificacion).toBe('Certificado médico');
    });
  });
});
