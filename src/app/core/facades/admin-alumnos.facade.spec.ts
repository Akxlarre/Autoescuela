import { TestBed } from '@angular/core/testing';
import { AdminAlumnosFacade } from './admin-alumnos.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { BranchFacade } from '@core/facades/branch.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';

describe('AdminAlumnosFacade', () => {
  let facade: AdminAlumnosFacade;
  let supabaseSpy: any;
  let branchFacadeSpy: any;
  let authFacadeSpy: any;

  beforeEach(() => {
    branchFacadeSpy = { selectedBranchId: vi.fn().mockReturnValue(null) };
    // Default: admin con "Todas las escuelas" → sin filtro de sede (comportamiento previo).
    authFacadeSpy = { currentUser: vi.fn().mockReturnValue({ role: 'admin', branchId: null }) };

    supabaseSpy = {
      client: {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            neq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
        // Realtime: setupRealtime() encadena .channel().on().on().subscribe()
        channel: vi.fn().mockReturnValue({
          on: vi.fn().mockReturnThis(),
          subscribe: vi.fn(),
        }),
        removeChannel: vi.fn(),
      },
    };

    TestBed.configureTestingModule({
      providers: [
        AdminAlumnosFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: BranchFacade, useValue: branchFacadeSpy },
        { provide: AuthFacade, useValue: authFacadeSpy },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        {
          provide: ErrorSanitizerService,
          useValue: { sanitize: (e: Error) => ({ message: e.message }) },
        },
      ],
    });

    facade = TestBed.inject(AdminAlumnosFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should have initial empty state', () => {
    expect(facade.alumnos()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
    expect(facade.error()).toBeNull();
  });

  it('clearError should reset error', () => {
    (facade as any)._error.set('error');
    facade.clearError();
    expect(facade.error()).toBeNull();
  });

  describe('prepararArchivado — fix-277-m', () => {
    /**
     * Respuestas por tabla. `class_b_sessions` se consulta dos veces: el conteo de historial
     * (sin filtro de estado) y el de clases futuras (con `.gte('scheduled_at', …)`).
     */
    function mockArchivado(opts: {
      enrollmentIds: number[];
      payments?: number;
      sessions?: number;
      futureSessions?: number;
    }): { futureFilter: ReturnType<typeof vi.fn> } {
      const futureFilter = vi.fn();
      supabaseSpy.client.from = vi.fn((table: string) => {
        let isFutureQuery = false;
        const builder: any = {
          select: vi.fn(() => builder),
          eq: vi.fn((...args: unknown[]) => {
            futureFilter(...args);
            return builder;
          }),
          neq: vi.fn(() => builder),
          in: vi.fn(() => builder),
          gte: vi.fn(() => {
            isFutureQuery = true;
            return builder;
          }),
          then: (resolve: (value: unknown) => void) => {
            if (table === 'enrollments') {
              return resolve({ data: opts.enrollmentIds.map((id) => ({ id })), error: null });
            }
            if (table === 'payments') return resolve({ count: opts.payments ?? 0, error: null });
            return resolve({
              count: isFutureQuery ? (opts.futureSessions ?? 0) : (opts.sessions ?? 0),
              error: null,
            });
          },
        };
        return builder;
      });
      return { futureFilter };
    }

    function toastSpy(): { error: ReturnType<typeof vi.fn> } {
      return TestBed.inject(ToastService) as unknown as { error: ReturnType<typeof vi.fn> };
    }

    it('con clases futuras no permite archivar y avisa cuántas son', async () => {
      const { futureFilter } = mockArchivado({
        enrollmentIds: [10],
        sessions: 5,
        futureSessions: 2,
      });

      const result = await facade.prepararArchivado(1);

      expect(result).toEqual({ permitido: false, hasHistory: true });
      expect(futureFilter).toHaveBeenCalledWith('status', 'scheduled');
      expect(toastSpy().error).toHaveBeenCalledWith(
        'No se puede archivar',
        'Tiene 2 clases agendadas. Cancélalas o reagéndalas antes de archivar al alumno.',
      );
    });

    it('sin clases futuras permite archivar e informa si hay historial', async () => {
      mockArchivado({ enrollmentIds: [10], payments: 1, sessions: 3, futureSessions: 0 });

      const result = await facade.prepararArchivado(1);

      expect(result).toEqual({ permitido: true, hasHistory: true });
      expect(toastSpy().error).not.toHaveBeenCalled();
    });

    it('un alumno sin matrículas se puede archivar, sin historial', async () => {
      mockArchivado({ enrollmentIds: [] });

      const result = await facade.prepararArchivado(1);

      expect(result).toEqual({ permitido: true, hasHistory: false });
    });
  });

  describe('filtros de la lista — fix-275-m', () => {
    const SIN_FILTROS = { search: '', curso: '', estado: '', expediente: '', sort: null };

    it('parten vacíos y sin orden elegido', () => {
      expect(facade.listFilters()).toEqual(SIN_FILTROS);
    });

    it('guarda los filtros y el orden para que la lista los recupere al volver a la pantalla', () => {
      const filters = {
        search: 'reyes',
        curso: 'Clase B',
        estado: 'Activo',
        expediente: '',
        sort: { field: 'fechaIngreso', direction: 'desc' } as const,
      };

      facade.setListFilters(filters);

      expect(facade.listFilters()).toEqual(filters);
    });

    it('resetListFilters los vacía (hotfix-126-m: entrada a la lista que no viene de una ficha)', () => {
      facade.setListFilters({
        search: 'reyes',
        curso: '',
        estado: 'Activo',
        expediente: '',
        sort: { field: 'rut', direction: 'asc' },
      });

      facade.resetListFilters();

      expect(facade.listFilters()).toEqual(SIN_FILTROS);
    });
  });

  describe('leaveTrashView — hotfix-112-m', () => {
    it('apaga la vista Papelera sin consultar la BD, y la próxima entrada recarga la lista activa', async () => {
      await facade.setTrashView(true);
      expect(facade.trashView()).toBe(true);
      const from = supabaseSpy.client.from as ReturnType<typeof vi.fn>;
      from.mockClear();

      facade.leaveTrashView();

      expect(facade.trashView()).toBe(false);
      expect(from).not.toHaveBeenCalled();

      // Al volver a la pantalla no se reutiliza la caché de archivados: carga completa.
      await facade.initialize();
      expect(from).toHaveBeenCalledWith('students');
      const neq = from.mock.results[0].value.select.mock.results[0].value.neq;
      expect(neq).toHaveBeenCalledWith('status', 'archived');
    });

    it('fuera de la Papelera no hace nada (no invalida la caché de la lista activa)', async () => {
      await facade.initialize();
      const from = supabaseSpy.client.from as ReturnType<typeof vi.fn>;

      facade.leaveTrashView();

      expect(facade.trashView()).toBe(false);
      expect((facade as any)._initialized).toBe(true);
      expect(from).toHaveBeenCalledTimes(1);
    });
  });

  // ─── fix-035-i: deriveExpediente() debe reconocer la clave de foto vigente ───
  describe('deriveExpediente() — detección de foto (fix-035-i)', () => {
    it('marca foto=true cuando el documento tiene type "id_photo" (clave actual del wizard)', () => {
      const expediente = (facade as any).deriveExpediente([
        { type: 'id_photo', status: 'uploaded' },
      ]);
      expect(expediente.foto).toBe(true);
    });

    it('marca foto=true cuando el documento tiene type "foto_carnet" (clave legacy)', () => {
      const expediente = (facade as any).deriveExpediente([
        { type: 'foto_carnet', status: 'uploaded' },
      ]);
      expect(expediente.foto).toBe(true);
    });

    it('marca foto=false cuando no hay ningún documento de foto', () => {
      const expediente = (facade as any).deriveExpediente([
        { type: 'cedula_identidad', status: 'uploaded' },
      ]);
      expect(expediente.foto).toBe(false);
    });
  });

  // ─── Spec 0005-m: guard de requestId contra respuestas stale ──────────────
  describe('Request guard — respuestas stale (AC1, AC-E1, AC-E2)', () => {
    function makeDeferred<T>(): {
      promise: Promise<T>;
      resolve: (value: T) => void;
      reject: (reason?: unknown) => void;
    } {
      let resolve!: (value: T) => void;
      let reject!: (reason?: unknown) => void;
      const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    }

    /** Cada llamada sucesiva a `.order()` consume la siguiente promesa de la lista. */
    function mockStudentsSequence(promises: Promise<unknown>[]): void {
      let callIndex = 0;
      const builder: any = {
        select: vi.fn(() => builder),
        neq: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        in: vi.fn(() => builder),
        not: vi.fn(() => builder),
        order: vi.fn(() => promises[callIndex++]),
      };
      supabaseSpy.client.from = vi.fn(() => builder);
    }

    function makeMinimalStudent(id: number, rut: string): any {
      return {
        id,
        status: 'active',
        address: 'x',
        users: {
          id: 1,
          rut,
          first_names: 'N',
          paternal_last_name: 'A',
          maternal_last_name: 'S',
          email: 'a@a.cl',
          phone: null,
          branch_id: 1,
        },
        enrollments: [],
        standalone_course_enrollments: [],
      };
    }

    it('AC1/AC-E1: solo aplica el resultado de la fetch MÁS RECIENTE disparada, aunque la vieja resuelva después', async () => {
      const dOld = makeDeferred<{ data: any[]; error: null }>();
      const dNew = makeDeferred<{ data: any[]; error: null }>();
      mockStudentsSequence([dOld.promise, dNew.promise]);

      const oldCall = facade.initialize(); // fetch #1 (vieja) — dispara primero
      const newCall = facade.initialize(); // fetch #2 (vigente) — dispara segundo, antes de que la vieja resuelva

      // Orden de llegada invertido a propósito: la vigente resuelve primero.
      dNew.resolve({ data: [makeMinimalStudent(200, '200-0')], error: null });
      await newCall;
      dOld.resolve({ data: [makeMinimalStudent(100, '100-0')], error: null });
      await oldCall;

      expect(facade.alumnos().map((a) => a.id)).toEqual(['200']);
    });

    it('AC-E1: con 3+ disparos rápidos, solo el último disparado se aplica sin importar el orden de llegada', async () => {
      const d1 = makeDeferred<{ data: any[]; error: null }>();
      const d2 = makeDeferred<{ data: any[]; error: null }>();
      const d3 = makeDeferred<{ data: any[]; error: null }>();
      mockStudentsSequence([d1.promise, d2.promise, d3.promise]);

      const call1 = facade.initialize();
      const call2 = facade.initialize();
      const call3 = facade.initialize();

      // Llega primero la del medio, después la última (vigente), y al final la primera.
      d2.resolve({ data: [makeMinimalStudent(2, '2-0')], error: null });
      await call2;
      d3.resolve({ data: [makeMinimalStudent(3, '3-0')], error: null });
      await call3;
      d1.resolve({ data: [makeMinimalStudent(1, '1-0')], error: null });
      await call1;

      expect(facade.alumnos().map((a) => a.id)).toEqual(['3']);
    });

    it('AC-E2: si la fetch vigente falla, el error se setea igual — el guard no enmascara errores reales', async () => {
      const dOld = makeDeferred<{ data: any[]; error: null }>();
      const dNew = makeDeferred<{ data: any[]; error: null }>();
      mockStudentsSequence([dOld.promise, dNew.promise]);

      const oldCall = facade.initialize();
      const newCall = facade.initialize();

      dOld.resolve({ data: [makeMinimalStudent(100, '100-0')], error: null });
      await oldCall;
      dNew.reject(new Error('network fail'));
      await newCall.catch(() => {});

      expect(facade.error()).toBe('Error al cargar alumnos');
    });

    it('AC-E3: refreshSilently() (post-acción) también respeta el guard si se solapa con initialize()', async () => {
      const dOld = makeDeferred<{ data: any[]; error: null }>();
      const dNew = makeDeferred<{ data: any[]; error: null }>();
      mockStudentsSequence([dOld.promise, dNew.promise]);

      const oldCall = facade.initialize(); // fetch #1 — carga inicial
      // fetch #2 — simula un refresh post-acción (ej. restaurarAlumno()) disparado antes de
      // que la carga inicial resuelva; refreshSilently() no espera `_initialized`.
      const newCall = (facade as any).refreshSilently();

      dNew.resolve({ data: [makeMinimalStudent(200, '200-0')], error: null });
      await newCall;
      dOld.resolve({ data: [makeMinimalStudent(100, '100-0')], error: null });
      await oldCall;

      expect(facade.alumnos().map((a) => a.id)).toEqual(['200']);
    });
  });

  // ─── Fase 1 (T1.1): Base de Alumnos acotada a Clase B ──────────────────────
  describe('Clase B filtering (AC1, AC-E1)', () => {
    /** Reemplaza el resultado de la query de students con `data`. */
    function mockStudents(data: any[]): void {
      const builder: any = {
        select: vi.fn(() => builder),
        neq: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        order: vi.fn(() => Promise.resolve({ data, error: null })),
        // fix-012-i: fetchCursoCompletoPendienteEgresoSet() consulta class_b_sessions/
        // certificates/certificate_issuance_log en cadenas terminadas en .in()/.not() —
        // sin .order() al final. Resuelven "vacío" (builder sin `data` es awaited a sí
        // mismo, `sessions`/`certs` quedan undefined → [] por los `?? []` del facade).
        in: vi.fn(() => builder),
        not: vi.fn(() => builder),
      };
      supabaseSpy.client.from = vi.fn(() => builder);
    }

    function makeUser(over: Record<string, unknown> = {}): any {
      return {
        id: 1,
        rut: '1-1',
        first_names: 'Nombre',
        paternal_last_name: 'Apellido',
        maternal_last_name: 'Segundo',
        email: 'a@a.cl',
        phone: null,
        branch_id: 1,
        ...over,
      };
    }

    function makeEnrollment(over: Record<string, unknown> = {}): any {
      return {
        id: 1,
        number: '0001',
        status: 'active',
        payment_status: 'paid',
        pending_balance: 0,
        total_paid: 100,
        docs_complete: true,
        created_at: '2026-01-01T00:00:00Z',
        license_group: 'class_b',
        courses: { id: 1, name: 'Clase B' },
        student_documents: [],
        ...over,
      };
    }

    function makeStudent(over: Record<string, unknown> = {}): any {
      return {
        id: 1,
        status: 'active',
        address: 'x',
        users: makeUser(),
        enrollments: [makeEnrollment()],
        standalone_course_enrollments: [],
        ...over,
      };
    }

    it('excluye alumnos exclusivamente profesionales de la lista B', async () => {
      mockStudents([
        makeStudent({
          id: 10,
          users: makeUser({ rut: '10-0' }),
          enrollments: [
            makeEnrollment({
              license_group: 'professional',
              courses: { id: 2, name: 'Profesional A2' },
            }),
          ],
        }),
        makeStudent({
          id: 11,
          users: makeUser({ rut: '11-1' }),
          enrollments: [makeEnrollment({ license_group: 'class_b' })],
        }),
      ]);

      await facade.initialize();

      const ids = facade.alumnos().map((a) => a.id);
      expect(ids).toContain('11');
      expect(ids).not.toContain('10');
    });

    it('para un alumno B + Profesional, elige el enrollment representativo DENTRO de B (no global)', async () => {
      mockStudents([
        makeStudent({
          id: 20,
          enrollments: [
            makeEnrollment({
              id: 100,
              license_group: 'class_b',
              created_at: '2026-01-01T00:00:00Z',
              number: '0005',
              pending_balance: 50,
              courses: { id: 1, name: 'Clase B' },
            }),
            // Más reciente, pero profesional → NO debe representar la fila
            makeEnrollment({
              id: 200,
              license_group: 'professional',
              created_at: '2026-06-01T00:00:00Z',
              number: 'P-1',
              pending_balance: 999,
              courses: { id: 2, name: 'Profesional A4' },
            }),
          ],
        }),
      ]);

      await facade.initialize();

      const row = facade.alumnos()[0];
      expect(row.cursos.map((c) => c.nombre)).toEqual(['Clase B']);
      expect(row.cursos.every((c) => c.licenseGroup === 'class_b')).toBe(true);
      expect(row.pago_por_pagar).toBe(50);
      expect(row.nroExpedientes).toEqual(['0005']);
    });

    it('mantiene a los alumnos exclusivamente de Clase B (regresión)', async () => {
      mockStudents([
        makeStudent({ id: 30, enrollments: [makeEnrollment({ license_group: 'class_b' })] }),
      ]);

      await facade.initialize();

      expect(facade.alumnos().length).toBe(1);
      expect(facade.alumnos()[0].id).toBe('30');
    });

    it('sucursal (fix-064) mapea desde users.branches.name, no desde branch_id', async () => {
      mockStudents([
        makeStudent({
          id: 40,
          users: makeUser({ branch_id: 2, branches: { name: 'Conductores Chillán' } }),
        }),
      ]);

      await facade.initialize();

      expect(facade.alumnos()[0].sucursal).toBe('Conductores Chillán');
    });

    it('sucursal (fix-064) cae a "—" si no hay branches asociado', async () => {
      mockStudents([makeStudent({ id: 41, users: makeUser({ branch_id: null, branches: null }) })]);

      await facade.initialize();

      expect(facade.alumnos()[0].sucursal).toBe('—');
    });

    it('excluye alumnos cuya única matrícula Clase B está en estado draft (fix-066)', async () => {
      mockStudents([
        makeStudent({
          id: 50,
          users: makeUser({ rut: '50-0' }),
          enrollments: [makeEnrollment({ status: 'draft', license_group: 'class_b' })],
        }),
        makeStudent({
          id: 51,
          users: makeUser({ rut: '51-1' }),
          enrollments: [makeEnrollment({ status: 'active', license_group: 'class_b' })],
        }),
      ]);

      await facade.initialize();

      const ids = facade.alumnos().map((a) => a.id);
      expect(ids).not.toContain('50');
      expect(ids).toContain('51');
    });

    it('excluye alumnos Finalizados (enrollment completed) — ya son Ex-Alumnos (fix-084)', async () => {
      mockStudents([
        makeStudent({
          id: 60,
          users: makeUser({ rut: '60-0' }),
          enrollments: [makeEnrollment({ status: 'completed', license_group: 'class_b' })],
        }),
        makeStudent({
          id: 61,
          users: makeUser({ rut: '61-1' }),
          enrollments: [makeEnrollment({ status: 'active', license_group: 'class_b' })],
        }),
      ]);

      await facade.initialize();

      const ids = facade.alumnos().map((a) => a.id);
      expect(ids).not.toContain('60');
      expect(ids).toContain('61');
    });

    describe('Papelera — fix-276-m', () => {
      it('muestra a un egresado archivado: en la lista activa los Finalizados siguen fuera', async () => {
        const egresado = makeStudent({
          id: 90,
          status: 'archived',
          enrollments: [makeEnrollment({ status: 'completed' })],
        });
        mockStudents([egresado]);

        await facade.initialize();
        expect(facade.alumnos()).toEqual([]);

        await facade.setTrashView(true);

        expect(facade.alumnos().map((a) => a.id)).toEqual(['90']);
        expect(facade.alumnos()[0].status).toBe('Finalizado');
      });
    });

    describe('fecha de ingreso — hotfix-123-m', () => {
      it('es la fecha de la matrícula que representa la fila, en dd-mm-aaaa', async () => {
        mockStudents([
          makeStudent({
            id: 80,
            enrollments: [makeEnrollment({ created_at: '2026-09-22T15:00:00Z' })],
          }),
        ]);

        await facade.initialize();

        expect(facade.alumnos()[0].fechaIngreso).toBe('22-09-2026');
      });

      it('expone también la fecha sin formatear, para ordenar la lista (spec 0020-m)', async () => {
        mockStudents([
          makeStudent({
            id: 82,
            enrollments: [makeEnrollment({ created_at: '2026-09-22T15:00:00Z' })],
          }),
        ]);

        await facade.initialize();

        expect(facade.alumnos()[0].fechaIngresoIso).toBe('2026-09-22T15:00:00Z');
      });

      it('usa el día en hora local, no el del ISO en UTC', async () => {
        // 23:30 hora local: recortar el ISO daría el día siguiente en zonas al oeste de UTC.
        const local = new Date(2026, 8, 22, 23, 30);
        mockStudents([
          makeStudent({
            id: 81,
            enrollments: [makeEnrollment({ created_at: local.toISOString() })],
          }),
        ]);

        await facade.initialize();

        expect(facade.alumnos()[0].fechaIngreso).toBe('22-09-2026');
      });
    });

    describe('saldo de todas las matrículas B — fix-270-m', () => {
      it('suma la deuda de una matrícula B antigua aunque la más reciente esté al día', async () => {
        mockStudents([
          makeStudent({
            id: 70,
            enrollments: [
              makeEnrollment({
                id: 700,
                created_at: '2025-01-01T00:00:00Z',
                payment_status: 'partial',
                pending_balance: 90000,
                total_paid: 60000,
              }),
              makeEnrollment({
                id: 701,
                created_at: '2026-06-01T00:00:00Z',
                pending_balance: 0,
                total_paid: 80000,
                courses: { id: 3, name: 'Refuerzo Clase B' },
              }),
            ],
          }),
        ]);

        await facade.initialize();

        const row = facade.alumnos()[0];
        expect(row.pago_por_pagar).toBe(90000);
        expect(row.pago_total).toBe(140000);
        expect(facade.conDeuda()).toBe(1);
        // La fila la sigue representando la matrícula más reciente.
        expect(row.enrollmentId).toBe(701);
      });

      it('no suma matrículas Profesional ni incompletas (borrador, cancelada, pago online abandonado)', async () => {
        mockStudents([
          makeStudent({
            id: 71,
            enrollments: [
              makeEnrollment({ id: 710, pending_balance: 0, total_paid: 100 }),
              makeEnrollment({ id: 711, license_group: 'professional', pending_balance: 500 }),
              makeEnrollment({ id: 712, status: 'draft', pending_balance: 500 }),
              makeEnrollment({ id: 713, status: 'cancelled', pending_balance: 500 }),
              makeEnrollment({ id: 714, status: 'pending_payment', pending_balance: 500 }),
            ],
          }),
        ]);

        await facade.initialize();

        expect(facade.alumnos()[0].pago_por_pagar).toBe(0);
        expect(facade.alumnos()[0].pago_total).toBe(100);
        expect(facade.conDeuda()).toBe(0);
      });

      it('trata un saldo nulo como 0', async () => {
        mockStudents([
          makeStudent({
            id: 72,
            enrollments: [
              makeEnrollment({ id: 720, pending_balance: null }),
              makeEnrollment({ id: 721, created_at: '2025-01-01T00:00:00Z', pending_balance: 30 }),
            ],
          }),
        ]);

        await facade.initialize();

        expect(facade.alumnos()[0].pago_por_pagar).toBe(30);
      });
    });

    describe('cursoCompletoPendienteEgreso — fix-012-i', () => {
      let sessionsBuilder: any;

      /** Mock por tabla: students devuelve `data`, el resto según lo indicado. */
      function mockStudentsAndCertData(
        students: any[],
        opts: { sessions?: any[]; certs?: any[]; logs?: any[] } = {},
      ): void {
        const studentsBuilder: any = {
          select: vi.fn(() => studentsBuilder),
          neq: vi.fn(() => studentsBuilder),
          order: vi.fn(() => Promise.resolve({ data: students, error: null })),
        };
        sessionsBuilder = {
          select: vi.fn(() => sessionsBuilder),
          in: vi.fn(() => sessionsBuilder),
          not: vi.fn(() => sessionsBuilder),
          eq: vi.fn(() => Promise.resolve({ data: opts.sessions ?? [], error: null })),
        };
        const certsBuilder: any = {
          select: vi.fn(() => certsBuilder),
          in: vi.fn(() => certsBuilder),
          eq: vi.fn(() => Promise.resolve({ data: opts.certs ?? [], error: null })),
        };
        const logsBuilder: any = {
          select: vi.fn(() => logsBuilder),
          in: vi.fn(() => logsBuilder),
          eq: vi.fn(() => Promise.resolve({ data: opts.logs ?? [], error: null })),
        };
        supabaseSpy.client.from = vi.fn((table: string) => {
          if (table === 'students') return studentsBuilder;
          if (table === 'class_b_sessions') return sessionsBuilder;
          if (table === 'certificates') return certsBuilder;
          if (table === 'certificate_issuance_log') return logsBuilder;
          throw new Error(`tabla inesperada: ${table}`);
        });
      }

      it('fix-262-m: cuenta clases cerradas (status=completed), nunca la nota de evaluación', async () => {
        mockStudentsAndCertData([
          makeStudent({
            id: 73,
            users: makeUser({ rut: '73-3' }),
            enrollments: [makeEnrollment({ id: 504, status: 'active' })],
          }),
        ]);

        await facade.initialize();

        expect(sessionsBuilder.eq).toHaveBeenCalledWith('status', 'completed');
        expect(sessionsBuilder.not).not.toHaveBeenCalled();
      });

      it('marca true cuando hay 12 clases cerradas + certificado + email enviado', async () => {
        mockStudentsAndCertData(
          [
            makeStudent({
              id: 70,
              users: makeUser({ rut: '70-0' }),
              enrollments: [makeEnrollment({ id: 501, status: 'active' })],
            }),
          ],
          {
            sessions: Array.from({ length: 12 }, () => ({ enrollment_id: 501 })),
            certs: [{ id: 900, enrollment_id: 501 }],
            logs: [{ certificate_id: 900 }],
          },
        );

        await facade.initialize();

        expect(facade.alumnos()[0].cursoCompletoPendienteEgreso).toBe(true);
      });

      it('marca false si tiene 12 prácticas pero el certificado no fue enviado', async () => {
        mockStudentsAndCertData(
          [
            makeStudent({
              id: 71,
              users: makeUser({ rut: '71-1' }),
              enrollments: [makeEnrollment({ id: 502, status: 'active' })],
            }),
          ],
          {
            sessions: Array.from({ length: 12 }, () => ({ enrollment_id: 502 })),
            certs: [{ id: 901, enrollment_id: 502 }],
            logs: [], // sin action='email_sent'
          },
        );

        await facade.initialize();

        expect(facade.alumnos()[0].cursoCompletoPendienteEgreso).toBe(false);
      });

      it('marca false si todavía no completa las 12 prácticas', async () => {
        mockStudentsAndCertData(
          [
            makeStudent({
              id: 72,
              users: makeUser({ rut: '72-2' }),
              enrollments: [makeEnrollment({ id: 503, status: 'active' })],
            }),
          ],
          {
            sessions: Array.from({ length: 5 }, () => ({ enrollment_id: 503 })),
          },
        );

        await facade.initialize();

        expect(facade.alumnos()[0].cursoCompletoPendienteEgreso).toBe(false);
      });
    });
  });

  // ─── fix-027: aislamiento por sede de la secretaria ────────────────────────
  describe('aislamiento por sede (fix-027, AC-F27-1/3)', () => {
    /** Builder que captura las llamadas a `.eq(...)` (el filtro de sede). */
    function mockStudentsCapturingEq(): { eq: any } {
      const eq = vi.fn(() => builder);
      const builder: any = {
        select: vi.fn(() => builder),
        neq: vi.fn(() => builder),
        eq,
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      };
      supabaseSpy.client.from = vi.fn(() => builder);
      return { eq };
    }

    it('secretaria: filtra por su branchId aunque el selector (admin) sea null', async () => {
      authFacadeSpy.currentUser.mockReturnValue({ role: 'secretaria', branchId: 1 });
      branchFacadeSpy.selectedBranchId.mockReturnValue(null);
      const { eq } = mockStudentsCapturingEq();

      await facade.initialize();

      expect(eq).toHaveBeenCalledWith('users.branch_id', 1);
    });

    it('secretaria sin sede (misconfig): filtra por sentinel → ninguna fila, NUNCA todas', async () => {
      authFacadeSpy.currentUser.mockReturnValue({ role: 'secretaria', branchId: null });
      branchFacadeSpy.selectedBranchId.mockReturnValue(null);
      const { eq } = mockStudentsCapturingEq();

      await facade.initialize();

      expect(eq).toHaveBeenCalledWith('users.branch_id', -1);
    });

    it('admin con "Todas las escuelas" (null): NO aplica filtro de sede', async () => {
      authFacadeSpy.currentUser.mockReturnValue({ role: 'admin', branchId: null });
      branchFacadeSpy.selectedBranchId.mockReturnValue(null);
      const { eq } = mockStudentsCapturingEq();

      await facade.initialize();

      expect(eq).not.toHaveBeenCalled();
    });
  });

  // ─── spec 0017 (T2.4): grant multi-sede de la secretaria ───────────────────
  describe('showSedeColumn — fix-269-m', () => {
    // currentUser / selectedBranchId son mocks, no signals: se fijan antes de la primera lectura.
    const secretariaConGrant = { role: 'secretaria', branchId: 1, canAccessBothBranches: true };

    it('admin con "Todas las sedes" → muestra la columna', () => {
      branchFacadeSpy.selectedBranchId.mockReturnValue(null);
      expect(facade.showSedeColumn()).toBe(true);
    });

    it('admin con una sede elegida → no la muestra', () => {
      branchFacadeSpy.selectedBranchId.mockReturnValue(2);
      expect(facade.showSedeColumn()).toBe(false);
    });

    it('secretaria con grant y "Todas las sedes" → muestra la columna', () => {
      authFacadeSpy.currentUser.mockReturnValue(secretariaConGrant);
      branchFacadeSpy.selectedBranchId.mockReturnValue(null);
      expect(facade.showSedeColumn()).toBe(true);
    });

    it('secretaria con grant y una sede elegida → no la muestra', () => {
      authFacadeSpy.currentUser.mockReturnValue(secretariaConGrant);
      branchFacadeSpy.selectedBranchId.mockReturnValue(2);
      expect(facade.showSedeColumn()).toBe(false);
    });

    it('secretaria sin grant → nunca, aunque el selector esté en null', () => {
      authFacadeSpy.currentUser.mockReturnValue({ role: 'secretaria', branchId: 1 });
      branchFacadeSpy.selectedBranchId.mockReturnValue(null);
      expect(facade.showSedeColumn()).toBe(false);
    });
  });

  describe('grant multi-sede (spec 0017, AC1/AC2)', () => {
    function mockStudentsCapturingEq(): { eq: any } {
      const eq = vi.fn(() => builder);
      const builder: any = {
        select: vi.fn(() => builder),
        neq: vi.fn(() => builder),
        eq,
        order: vi.fn(() => Promise.resolve({ data: [], error: null })),
      };
      supabaseSpy.client.from = vi.fn(() => builder);
      return { eq };
    }

    it('secretaria con grant: respeta el selector (sede elegida), no su sede propia', async () => {
      authFacadeSpy.currentUser.mockReturnValue({
        role: 'secretaria',
        branchId: 1,
        canAccessBothBranches: true,
      });
      branchFacadeSpy.selectedBranchId.mockReturnValue(2);
      const { eq } = mockStudentsCapturingEq();

      await facade.initialize();

      expect(eq).toHaveBeenCalledWith('users.branch_id', 2);
    });

    it('secretaria con grant + "Todas" (null): NO aplica filtro de sede (como admin)', async () => {
      authFacadeSpy.currentUser.mockReturnValue({
        role: 'secretaria',
        branchId: 1,
        canAccessBothBranches: true,
      });
      branchFacadeSpy.selectedBranchId.mockReturnValue(null);
      const { eq } = mockStudentsCapturingEq();

      await facade.initialize();

      expect(eq).not.toHaveBeenCalled();
    });
  });
});
