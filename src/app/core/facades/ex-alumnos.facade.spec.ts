import { TestBed } from '@angular/core/testing';
import { ExAlumnosFacade } from './ex-alumnos.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { ToastService } from '@core/services/ui/toast.service';
import { downloadExcel } from '@core/utils/excel.utils';
import { downloadBlob } from '@core/utils/file-download.utils';

vi.mock('@core/utils/excel.utils', () => ({ downloadExcel: vi.fn() }));
vi.mock('@core/utils/file-download.utils', () => ({ downloadBlob: vi.fn() }));

describe('ExAlumnosFacade', () => {
  let facade: ExAlumnosFacade;
  let supabaseSpy: any;
  const toastSpy = { error: vi.fn(), success: vi.fn() };

  beforeEach(() => {
    supabaseSpy = { client: vi.fn() };

    (supabaseSpy as any).client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    };

    TestBed.configureTestingModule({
      providers: [
        ExAlumnosFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: AuthFacade, useValue: { currentUser: () => ({ role: 'admin' }) } },
        { provide: BranchFacade, useValue: { selectedBranchId: () => null } },
        {
          provide: ErrorSanitizerService,
          useValue: { sanitize: (e: Error) => ({ message: e.message }) },
        },
        { provide: ToastService, useValue: toastSpy },
      ],
    });

    facade = TestBed.inject(ExAlumnosFacade);
  });

  describe('exportEgresados — spec 0021-m', () => {
    const egresado = {
      id: 1,
      studentId: '10',
      nombre: 'Reyes Muñoz Camila',
      rut: '19.876.543-0',
      correo: 'camila@ejemplo.cl',
      nroExpediente: '0080',
      licencia: 'Clase B',
      licenseGroup: 'class_b' as const,
      anio: 2026,
      fechaEgreso: '2026-09-22',
      sede: 'Autoescuela Chillán',
      branchId: 1,
      nroCertificado: null,
      saldoPendiente: 45000,
    };
    let invoke: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      invoke = vi.fn().mockResolvedValue({ data: new Blob(['%PDF-']), error: null });
      supabaseSpy.client.functions = { invoke };
      vi.mocked(downloadExcel).mockClear();
      vi.mocked(downloadBlob).mockClear();
      toastSpy.error.mockClear();
    });

    it('Excel: descarga las filas recibidas sin llamar a ninguna Edge Function', async () => {
      await facade.exportEgresados('excel', [egresado]);

      expect(invoke).not.toHaveBeenCalled();
      expect(downloadExcel).toHaveBeenCalledTimes(1);
      const [sheet, headers, rows, filename] = vi.mocked(downloadExcel).mock.calls[0];
      expect(sheet).toBe('Ex-Alumnos B');
      expect(headers).toContain('Fecha de egreso');
      expect(rows).toHaveLength(1);
      expect(rows[0][0]).toBe('Reyes Muñoz Camila');
      expect(filename).toMatch(/^ex-alumnos-b_\d{4}-\d{2}-\d{2}$/);
    });

    it('PDF: envía a export-table-pdf la tabla ya armada y descarga el resultado', async () => {
      await facade.exportEgresados('pdf', [egresado, { ...egresado, id: 2 }]);

      expect(invoke).toHaveBeenCalledTimes(1);
      const [fn, options] = invoke.mock.calls[0];
      expect(fn).toBe('export-table-pdf');
      expect(options.body.title).toBe('Ex-Alumnos Clase B');
      expect(options.body.headers).toHaveLength(7);
      expect(options.body.columnWeights).toHaveLength(7);
      expect(options.body.rows).toHaveLength(2);
      expect(options.body.footer).toBe('Total: 2 egresados');
      const [blob, filename] = vi.mocked(downloadBlob).mock.calls[0];
      expect(blob.type).toBe('application/pdf');
      expect(filename).toMatch(/^ex-alumnos-b_\d{4}-\d{2}-\d{2}\.pdf$/);
    });

    it('PDF con un solo egresado: el pie va en singular', async () => {
      await facade.exportEgresados('pdf', [egresado]);

      expect(invoke.mock.calls[0][1].body.footer).toBe('Total: 1 egresado');
    });

    it('isExporting es true mientras se genera y vuelve a false al terminar', async () => {
      let resolve!: (v: unknown) => void;
      invoke.mockReturnValue(new Promise((r) => (resolve = r)));

      const pending = facade.exportEgresados('pdf', [egresado]);
      expect(facade.isExporting()).toBe(true);

      resolve({ data: new Blob(['%PDF-']), error: null });
      await pending;
      expect(facade.isExporting()).toBe(false);
    });

    it('una segunda exportación mientras hay una en curso se ignora', async () => {
      let resolve!: (v: unknown) => void;
      invoke.mockReturnValue(new Promise((r) => (resolve = r)));

      const first = facade.exportEgresados('pdf', [egresado]);
      await facade.exportEgresados('pdf', [egresado]);
      resolve({ data: new Blob(['%PDF-']), error: null });
      await first;

      expect(invoke).toHaveBeenCalledTimes(1);
    });

    it('si la función falla avisa el error, no descarga nada y deja el botón disponible', async () => {
      invoke.mockResolvedValue({ data: null, error: new Error('boom') });

      await facade.exportEgresados('pdf', [egresado]);

      expect(toastSpy.error).toHaveBeenCalledWith(
        'No se pudo exportar la lista. Inténtalo de nuevo.',
      );
      expect(downloadBlob).not.toHaveBeenCalled();
      expect(facade.isExporting()).toBe(false);
    });
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should have initial empty state', () => {
    expect(facade.egresados()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
    expect(facade.totalEgresados()).toBe(0);
  });

  it('separa egresados por grupo de licencia (AC11)', () => {
    const mk = (id: number, licenseGroup: 'class_b' | 'professional') => ({
      id,
      studentId: String(id),
      nombre: 'X',
      rut: '1-1',
      correo: 'x@x.cl',
      nroExpediente: null,
      licencia: licenseGroup === 'class_b' ? 'Clase B' : 'A4',
      licenseGroup,
      anio: 2026,
      sede: 'Sede',
      branchId: 1,
      nroCertificado: null,
      saldoPendiente: 0,
    });
    (facade as any)._egresados.set([mk(1, 'class_b'), mk(2, 'professional'), mk(3, 'class_b')]);

    expect(facade.egresadosClaseBList().map((e) => e.id)).toEqual([1, 3]);
    expect(facade.egresadosProfesionalList().map((e) => e.id)).toEqual([2]);
    expect(facade.egresadosClaseB()).toBe(2);
    expect(facade.egresadosProfesional()).toBe(1);
  });

  it('mapea studentId, correo y nroExpediente desde la query (AC-1)', async () => {
    const row = {
      id: 99,
      number: 'EXP-123',
      pending_balance: 0,
      completed_at: '2026-01-15T00:00:00Z',
      license_group: 'class_b',
      courses: { name: 'Clase B', code: 'B' },
      branches: { id: 7, name: 'Sede Central' },
      students: {
        id: 42,
        users: {
          first_names: 'Ana',
          paternal_last_name: 'Soto',
          maternal_last_name: null,
          rut: '11.111.111-1',
          email: 'ana@correo.cl',
        },
      },
    };
    (supabaseSpy as any).client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [row], error: null }),
          }),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    };

    await facade.loadEgresados();

    const egresado = facade.egresadosClaseBList()[0];
    expect(egresado.studentId).toBe('42');
    expect(egresado.correo).toBe('ana@correo.cl');
    expect(egresado.nroExpediente).toBe('EXP-123');
  });

  it('mapea branchId desde branches.id (fix-085-m)', async () => {
    const row = {
      id: 100,
      number: 'EXP-200',
      pending_balance: 0,
      completed_at: '2026-01-15T00:00:00Z',
      license_group: 'class_b',
      courses: { name: 'Clase B', code: 'B' },
      branches: { id: 3, name: 'Sede Norte' },
      students: {
        id: 55,
        users: {
          first_names: 'Luis',
          paternal_last_name: 'Pérez',
          maternal_last_name: null,
          rut: '22.222.222-2',
          email: 'luis@correo.cl',
        },
      },
    };
    (supabaseSpy as any).client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [row], error: null }),
          }),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    };

    await facade.loadEgresados();

    const egresado = facade.egresadosClaseBList()[0];
    expect(egresado.branchId).toBe(3);
  });

  it('mapea fechaEgreso con precisión de día, no solo el año (fix-147-b)', async () => {
    // La ventana de período compara fechas completas. Con solo `anio`, alguien que egresó en
    // diciembre quedaba fuera de la ventana de 12 meses por hasta 11 meses de error.
    const row = {
      id: 101,
      number: 'EXP-201',
      pending_balance: 0,
      completed_at: '2025-12-28T18:30:00Z',
      license_group: 'class_b',
      courses: { name: 'Clase B', code: 'B' },
      branches: { id: 1, name: 'Sede Centro' },
      students: {
        id: 56,
        users: {
          first_names: 'Ana',
          paternal_last_name: 'Soto',
          maternal_last_name: null,
          rut: '33.333.333-3',
          email: 'ana@correo.cl',
        },
      },
    };
    (supabaseSpy as any).client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [row], error: null }),
          }),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    };

    await facade.loadEgresados();

    const egresado = facade.egresadosClaseBList()[0];
    expect(egresado.fechaEgreso).toBe('2025-12-28');
    expect(egresado.anio).toBe(2025);
  });

  describe('fecha de egreso — fix-266-m', () => {
    function mockEgresados(rows: unknown[]) {
      const order = vi.fn().mockResolvedValue({ data: rows, error: null });
      const select = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ order }),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      });
      (supabaseSpy as any).client = { from: vi.fn().mockReturnValue({ select }) };
      return { order, select };
    }

    const row = {
      id: 102,
      number: 'EXP-202',
      pending_balance: 0,
      // Egresó el 2026-09-30; la matrícula se modificó por última vez en 2024 (y un pago
      // posterior al egreso la volvería a modificar): ninguna de las dos es la fecha de egreso.
      completed_at: '2026-09-30T15:00:00Z',
      updated_at: '2024-03-10T12:00:00Z',
      license_group: 'class_b',
      courses: { name: 'Clase B', code: 'B' },
      branches: { id: 1, name: 'Sede Centro' },
      students: {
        id: 57,
        users: {
          first_names: 'Eva',
          paternal_last_name: 'Rojas',
          maternal_last_name: null,
          rut: '44.444.444-4',
          email: 'eva@correo.cl',
        },
      },
    };

    it('el año y la fecha de egreso salen de completed_at, no de updated_at', async () => {
      mockEgresados([row]);

      await facade.loadEgresados();

      const egresado = facade.egresadosClaseBList()[0];
      expect(egresado.fechaEgreso).toBe('2026-09-30');
      expect(egresado.anio).toBe(2026);
    });

    it('el día y el año salen del mismo reloj (fix-297-m)', async () => {
      // Egreso de noche: en UTC ya es el día (y el año) siguiente al de Chile. Antes el año
      // salía en hora local y el día en UTC, y el filtro de período lo dejaba fuera de su año.
      mockEgresados([{ ...row, completed_at: '2026-01-01T02:30:00Z' }]);

      await facade.loadEgresados();

      const egresado = facade.egresadosClaseBList()[0];
      const local = new Date('2026-01-01T02:30:00Z');
      expect(egresado.anio).toBe(local.getFullYear());
      expect(egresado.fechaEgreso?.slice(0, 4)).toBe(String(local.getFullYear()));
      expect(Number(egresado.fechaEgreso?.slice(8, 10))).toBe(local.getDate());
    });

    it('pide completed_at y ordena por ella, del egreso más reciente al más antiguo', async () => {
      const { order, select } = mockEgresados([row]);

      await facade.loadEgresados();

      expect(select.mock.calls[0][0]).toMatch(/\bcompleted_at\b/);
      expect(order).toHaveBeenCalledWith('completed_at', { ascending: false });
    });
  });

  describe('error de carga — fix-287-m', () => {
    function mockEgresados(result: { data: unknown[] | null; error: Error | null }) {
      const select = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ order: vi.fn().mockResolvedValue(result) }),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      });
      (supabaseSpy as any).client = { from: vi.fn().mockReturnValue({ select }) };
    }

    const row = {
      id: 7,
      number: 'EXP-7',
      pending_balance: 0,
      completed_at: '2026-09-30T15:00:00Z',
      license_group: 'class_b',
      courses: { name: 'Clase B', code: 'B' },
      branches: { id: 1, name: 'Sede Centro' },
      students: {
        id: 70,
        status: 'active',
        users: {
          first_names: 'Eva',
          paternal_last_name: 'Rojas',
          maternal_last_name: null,
          rut: '44.444.444-4',
          email: 'eva@correo.cl',
        },
      },
    };

    it('si la consulta falla expone el error y deja de cargar', async () => {
      mockEgresados({ data: null, error: new Error('sin conexión') });

      await facade.loadEgresados();

      expect(facade.error()).toBe('sin conexión');
      expect(facade.isLoading()).toBe(false);
      expect(facade.egresadosClaseBList()).toEqual([]);
    });

    it('reintentar tras un fallo vuelve a cargar completo y limpia el error', async () => {
      mockEgresados({ data: null, error: new Error('sin conexión') });
      await facade.loadEgresados();

      mockEgresados({ data: [row], error: null });
      await facade.loadEgresados();

      expect(facade.error()).toBeNull();
      expect(facade.egresadosClaseBList().map((e) => e.id)).toEqual([7]);
    });
  });

  describe('alumnos archivados — fix-276-m', () => {
    function mockEgresados(rows: unknown[]) {
      const order = vi.fn().mockResolvedValue({ data: rows, error: null });
      const select = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ order }),
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      });
      (supabaseSpy as any).client = { from: vi.fn().mockReturnValue({ select }) };
      return { select };
    }

    const egresado = (id: number, studentStatus: string | null) => ({
      id,
      number: `EXP-${id}`,
      pending_balance: 0,
      completed_at: '2026-09-30T15:00:00Z',
      license_group: 'class_b',
      courses: { name: 'Clase B', code: 'B' },
      branches: { id: 1, name: 'Sede Centro' },
      students: {
        id: id + 1000,
        status: studentStatus,
        users: {
          first_names: 'Eva',
          paternal_last_name: 'Rojas',
          maternal_last_name: null,
          rut: '44.444.444-4',
          email: 'eva@correo.cl',
        },
      },
    });

    it('un egresado archivado no aparece en Ex-Alumnos: solo se ve en la Papelera', async () => {
      mockEgresados([egresado(1, 'active'), egresado(2, 'archived'), egresado(3, null)]);

      await facade.loadEgresados();

      expect(facade.egresadosClaseBList().map((e) => e.id)).toEqual([1, 3]);
      expect(facade.egresadosClaseB()).toBe(2);
    });

    it('la consulta pide students.status, sin el cual no se puede distinguir a los archivados', async () => {
      const { select } = mockEgresados([]);

      await facade.loadEgresados();

      expect(select.mock.calls[0][0]).toMatch(/students!inner \(\s*id,\s*status,/);
    });
  });

  it('mapea convalidatedLicense desde license_validations para egresados profesionales (fix-195)', async () => {
    const row = {
      id: 300,
      number: 'EXP-300',
      pending_balance: 0,
      completed_at: '2026-01-15T00:00:00Z',
      license_group: 'professional',
      courses: { name: 'Profesional A2', code: 'professional_a2' },
      branches: { id: 1, name: 'Sede Central' },
      students: {
        id: 77,
        users: {
          first_names: 'Rosa',
          paternal_last_name: 'Díaz',
          maternal_last_name: null,
          rut: '33.333.333-3',
          email: 'rosa@correo.cl',
        },
      },
    };
    (supabaseSpy as any).client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [row], error: null }),
          }),
          in: vi.fn().mockResolvedValue({
            data: [{ enrollment_id: 300, convalidated_license: 'A4' }],
            error: null,
          }),
        }),
      }),
    };

    await facade.loadEgresados();

    const egresado = facade.egresadosProfesionalList()[0];
    expect(egresado.convalidatedLicense).toBe('A4');
  });

  describe('loadStatistics — annualEgresadosTotal (fix-005-i, H-003)', () => {
    /** Builder Supabase encadenable: soporta select/eq/gte y es awaitable (thenable). */
    function makeChainMock(result: { data?: any; count?: number; error: any }) {
      const b: any = {
        select: vi.fn(() => b),
        eq: vi.fn(() => b),
        neq: vi.fn(() => b),
        gte: vi.fn(() => b),
        then: (resolve: any) => resolve(result),
      };
      return b;
    }

    it('filtra por license_group=class_b y por sede activa — mismo criterio que loadEgresadosList (antes: 2 vs 16)', async () => {
      const examsChain = makeChainMock({ data: [], error: null });
      const enrollmentsChain = makeChainMock({ count: 2, error: null });
      const surveysChain = makeChainMock({ count: 0, error: null });

      (supabaseSpy as any).client = {
        from: vi.fn((table: string) => {
          if (table === 'class_b_exam_scores') return examsChain;
          if (table === 'enrollments') return enrollmentsChain;
          if (table === 'student_surveys') return surveysChain;
          throw new Error(`tabla inesperada: ${table}`);
        }),
      };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          ExAlumnosFacade,
          { provide: SupabaseService, useValue: supabaseSpy },
          { provide: AuthFacade, useValue: { currentUser: () => ({ role: 'admin' }) } },
          { provide: BranchFacade, useValue: { selectedBranchId: () => 7 } },
          {
            provide: ErrorSanitizerService,
            useValue: { sanitize: (e: Error) => ({ message: e.message }) },
          },
          { provide: ToastService, useValue: toastSpy },
        ],
      });
      const scopedFacade = TestBed.inject(ExAlumnosFacade);

      // fix-195-b: loadStatistics aplica el resultado solo con un token vigente del guard.
      await (scopedFacade as any).loadStatistics((scopedFacade as any).egresadosGuard.next());

      expect(enrollmentsChain.eq).toHaveBeenCalledWith('status', 'completed');
      expect(enrollmentsChain.eq).toHaveBeenCalledWith('license_group', 'class_b');
      expect(enrollmentsChain.eq).toHaveBeenCalledWith('branch_id', 7);
      // fix-266-m: "egresados del año" se cuenta por fecha de egreso, no por última modificación.
      expect(enrollmentsChain.gte).toHaveBeenCalledWith('completed_at', expect.any(String));
      // fix-276-m: los egresados archivados tampoco cuentan en el total del año.
      expect(enrollmentsChain.neq).toHaveBeenCalledWith('students.status', 'archived');
      expect(scopedFacade.annualEgresadosTotal()).toBe(2);
    });
  });

  // fix-195-b (D06 de ASG-i-037): admin A → B → A rápido con la respuesta de B demorada. Antes la
  // respuesta vieja de B llegaba al final y dejaba la pantalla en "A" mostrando los egresados de B.
  describe('respuestas fuera de orden al cambiar de sede (fix-195-b, spec 0005-m)', () => {
    const egresado = (id: number, branchId: number) => ({
      id,
      number: String(id),
      pending_balance: 0,
      completed_at: '2026-05-01T12:00:00Z',
      license_group: 'class_b',
      courses: { name: 'Clase B', code: 'B' },
      branches: { id: branchId, name: `Sede ${branchId}` },
      students: {
        id,
        status: 'active',
        users: {
          first_names: 'N',
          paternal_last_name: 'P',
          maternal_last_name: null,
          rut: '1-9',
          email: null,
        },
      },
    });
    const LISTA: Record<number, unknown[]> = {
      1: [egresado(1, 1), egresado(2, 1), egresado(3, 1)],
      2: [egresado(10, 2)],
    };
    const CONTEO: Record<number, number> = { 1: 3, 2: 1 };

    let selected: number;
    let liberarB: () => void;
    let bRetenida: Promise<void>;

    /** Builder encadenable: resuelve según la sede filtrada; las consultas de la sede 2 esperan. */
    function builder(table: string) {
      const state: { branch?: number; head?: boolean } = {};
      const b: any = {
        select: (_cols: string, opts?: { head?: boolean }) => {
          state.head = !!opts?.head;
          return b;
        },
        eq: (col: string, val: unknown) => {
          if (col === 'branch_id') state.branch = val as number;
          return b;
        },
        neq: () => b,
        gte: () => b,
        in: () => b,
        order: () => b,
        then: async (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
          try {
            if (state.branch === 2) await bRetenida;
            if (table === 'enrollments' && state.head) {
              resolve({ count: CONTEO[state.branch!], error: null });
            } else if (table === 'enrollments') {
              resolve({ data: LISTA[state.branch!], error: null });
            } else {
              resolve({ data: [], count: 0, error: null });
            }
          } catch (e) {
            reject(e);
          }
        },
      };
      return b;
    }

    let racer: ExAlumnosFacade;

    beforeEach(() => {
      bRetenida = new Promise<void>((r) => (liberarB = r));
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          ExAlumnosFacade,
          { provide: SupabaseService, useValue: { client: { from: builder } } },
          { provide: AuthFacade, useValue: { currentUser: () => ({ role: 'admin' }) } },
          { provide: BranchFacade, useValue: { selectedBranchId: () => selected } },
          {
            provide: ErrorSanitizerService,
            useValue: { sanitize: (e: Error) => ({ message: e.message }) },
          },
          { provide: ToastService, useValue: toastSpy },
        ],
      });
      racer = TestBed.inject(ExAlumnosFacade);
    });

    it('primera visita A → B → A: queda con los datos de A aunque B responda al final', async () => {
      selected = 2;
      const cargaB = racer.loadEgresados();
      selected = 1;
      await racer.loadEgresados();
      liberarB();
      await cargaB;

      expect(racer.egresados().map((e) => e.branchId)).toEqual([1, 1, 1]);
      expect(racer.annualEgresadosTotal()).toBe(3);
      expect(racer.isLoading()).toBe(false);
    });

    it('A ya cargada → B (lenta) → A (refresco SWR): datos de A y sin skeleton colgado', async () => {
      selected = 1;
      await racer.loadEgresados(); // A inicial
      selected = 2;
      const cargaB = racer.loadEgresados(); // carga completa de B, retenida
      expect(racer.isLoading()).toBe(true);
      selected = 1;
      await racer.loadEgresados(); // vuelve a A: refresco silencioso
      await Promise.resolve();
      await new Promise((r) => setTimeout(r, 0));
      liberarB();
      await cargaB;

      expect(racer.egresados().map((e) => e.branchId)).toEqual([1, 1, 1]);
      expect(racer.annualEgresadosTotal()).toBe(3);
      expect(racer.isLoading()).toBe(false);
    });
  });
});
