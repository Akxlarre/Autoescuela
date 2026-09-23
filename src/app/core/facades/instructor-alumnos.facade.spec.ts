import { TestBed } from '@angular/core/testing';
import { InstructorAlumnosFacade } from './instructor-alumnos.facade';
import { InstructorProfileFacade } from './instructor-profile.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';

describe('InstructorAlumnosFacade', () => {
  let facade: InstructorAlumnosFacade;
  let supabaseMock: any;
  let profileMock: any;

  function createChainMock(resolvedValue: any = { data: [], error: null }) {
    const chain: any = {};
    const methods = [
      'select',
      'eq',
      'in',
      'gte',
      'lte',
      'order',
      'limit',
      'maybeSingle',
      'insert',
      'not',
    ];
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.order = vi.fn().mockResolvedValue(resolvedValue);
    chain.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
    chain.in = vi.fn().mockReturnValue(chain);
    chain.lte = vi.fn().mockResolvedValue(resolvedValue);
    return chain;
  }

  beforeEach(() => {
    const chain = createChainMock();
    supabaseMock = {
      client: {
        from: vi.fn().mockReturnValue(chain),
      },
    };

    profileMock = {
      getInstructorId: vi.fn().mockResolvedValue(1),
      instructorId: vi.fn().mockReturnValue(1),
    };

    TestBed.configureTestingModule({
      providers: [
        InstructorAlumnosFacade,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: InstructorProfileFacade, useValue: profileMock },
        {
          provide: ToastService,
          useValue: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
        },
      ],
    });

    facade = TestBed.inject(InstructorAlumnosFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should initialize with empty state', () => {
    expect(facade.students()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
    expect(facade.error()).toBeNull();
  });

  it('fetchStudents should first query class_b_sessions for instructor enrollment IDs', async () => {
    await facade.fetchStudents();
    const firstCall = supabaseMock.client.from.mock.calls[0];
    expect(firstCall[0]).toBe('class_b_sessions');
  });

  it('fetchStudents should set empty when instructor has no sessions', async () => {
    await facade.fetchStudents();
    expect(facade.students()).toEqual([]);
  });

  // ── fix-170-b ──────────────────────────────────────────────────────────────
  //
  // La Ficha Técnica del instructor son las 12 clases prácticas de Clase B. Antes
  // resolvía la matrícula con `order('id', desc).limit(1)` sin filtrar por tipo de
  // curso, así que en un alumno con Clase B Y Profesional agarraba la de id mayor —
  // la de Profesional, que no tiene clases B— y pintaba las 12 en blanco.
  //
  // Se afirma sobre los filtros que se le piden a PostgREST, no sobre las filas
  // devueltas: el bug estaba en la consulta, no en el mapeo.
  describe('loadStudentDetail — matrícula de la Ficha Técnica (fix-170-b)', () => {
    /** Registra los filtros aplicados a cada tabla consultada. */
    function mockConFiltros() {
      const filtros: Record<string, string[]> = {};
      const from = vi.fn().mockImplementation((tabla: string) => {
        filtros[tabla] = filtros[tabla] ?? [];
        const chain: any = {};
        for (const m of ['select', 'eq', 'in', 'gte', 'lte', 'limit', 'not']) {
          chain[m] = vi.fn().mockImplementation((...args: unknown[]) => {
            if (m === 'eq') filtros[tabla].push(`eq:${String(args[0])}=${String(args[1])}`);
            return chain;
          });
        }
        chain.order = vi.fn().mockResolvedValue({ data: [], error: null });
        chain.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        return chain;
      });
      return { from, filtros };
    }

    it('pide la matrícula filtrando por curso de tipo class_b', async () => {
      const { from, filtros } = mockConFiltros();
      supabaseMock.client.from = from;

      await facade.loadStudentDetail(84);

      expect(filtros['enrollments']).toBeDefined();
      expect(filtros['enrollments'].some((f) => /courses.*type.*class_b/.test(f))).toBe(true);
    });

    it('sigue acotando al alumno pedido', async () => {
      const { from, filtros } = mockConFiltros();
      supabaseMock.client.from = from;

      await facade.loadStudentDetail(84);

      expect(filtros['enrollments']).toContain('eq:student_id=84');
    });
  });
});
