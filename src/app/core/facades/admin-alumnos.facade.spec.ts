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

  // ─── Fase 1 (T1.1): Base de Alumnos acotada a Clase B ──────────────────────
  describe('Clase B filtering (AC1, AC-E1)', () => {
    /** Reemplaza el resultado de la query de students con `data`. */
    function mockStudents(data: any[]): void {
      const builder: any = {
        select: vi.fn(() => builder),
        neq: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        order: vi.fn(() => Promise.resolve({ data, error: null })),
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
        expires_at: null,
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
});
