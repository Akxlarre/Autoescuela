import { TestBed } from '@angular/core/testing';
import { InstructorClasesFacade } from './instructor-clases.facade';
import { InstructorProfileFacade } from './instructor-profile.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';

describe('InstructorClasesFacade', () => {
  let facade: InstructorClasesFacade;
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
      'update',
      'insert',
      'upsert',
    ];
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.order = vi.fn().mockResolvedValue(resolvedValue);
    chain.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
    chain.eq = vi.fn().mockReturnValue(chain);
    // For update().eq() terminal
    chain.lte = vi.fn().mockResolvedValue(resolvedValue);
    return chain;
  }

  beforeEach(() => {
    const chain = createChainMock();
    // Make update/upsert return chain for .eq() chaining, terminal resolves
    chain.update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    });
    chain.upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    chain.maybeSingle = vi.fn().mockResolvedValue({
      data: { enrollment_id: 10, enrollments: { student_id: 5 } },
      error: null,
    });

    supabaseMock = {
      client: {
        from: vi.fn().mockReturnValue(chain),
        channel: vi.fn().mockReturnValue({
          on: vi.fn().mockReturnThis(),
          subscribe: vi.fn().mockReturnThis(),
        }),
        removeChannel: vi.fn(),
      },
    };

    profileMock = {
      getInstructorId: vi.fn().mockResolvedValue(1),
      instructorId: vi.fn().mockReturnValue(1),
      instructorData: vi.fn().mockReturnValue({ user_id: 99 }),
    };

    TestBed.configureTestingModule({
      providers: [
        InstructorClasesFacade,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: InstructorProfileFacade, useValue: profileMock },
        {
          provide: ToastService,
          useValue: { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() },
        },
      ],
    });

    facade = TestBed.inject(InstructorClasesFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should initialize with default state', () => {
    expect(facade.todayClasses()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
  });

  it('startClass should complete without throwing (mock mode)', async () => {
    // useMock por defecto es false desde fix-001-i — forzamos el modo mock
    // explícitamente para seguir cubriendo esa rama (se conserva para demos/QA).
    (facade as any).useMock = true;
    vi.useFakeTimers();
    const promise = facade.startClass(1, 50000);
    await vi.advanceTimersByTimeAsync(1000);
    await promise;
    vi.useRealTimers();
    // No supabase calls expected in mock mode
    expect(supabaseMock.client.from).not.toHaveBeenCalled();
  });

  it('finishClass should complete without throwing (mock mode)', async () => {
    (facade as any).useMock = true;
    vi.useFakeTimers();
    const promise = facade.finishClass(1, 50100);
    await vi.advanceTimersByTimeAsync(1000);
    await promise;
    vi.useRealTimers();
    // No supabase calls expected in mock mode
    expect(supabaseMock.client.from).not.toHaveBeenCalled();
  });

  // ── Rama real (useMock=false) — ASG-010 / fix-001-i: cobertura previa a
  // activar el flag por defecto. `useMock` es `private readonly`, pero eso
  // solo bloquea reasignación en tiempo de compilación — `(facade as any)`
  // la sortea a propósito para poder testear la rama real sin tocar aún el
  // valor por defecto en producción. ──
  describe('modo real (useMock=false)', () => {
    /** Chain thenable: cualquier método builder devuelve el mismo objeto (encadenable),
     * y awaitear el resultado de CUALQUIER punto de la cadena resuelve `result`. */
    function makeThenableChain(result: { data?: any; error?: any } = { data: [], error: null }) {
      const chain: any = {
        select: vi.fn(() => chain),
        eq: vi.fn(() => chain),
        in: vi.fn(() => chain),
        gte: vi.fn(() => chain),
        lte: vi.fn(() => chain),
        lt: vi.fn(() => chain),
        order: vi.fn(() => chain),
        update: vi.fn(() => chain),
        maybeSingle: vi.fn(() => Promise.resolve(result)),
        upsert: vi.fn(() => Promise.resolve(result)),
        then: (resolve: any, reject: any) => Promise.resolve(result).then(resolve, reject),
      };
      return chain;
    }

    beforeEach(() => {
      (facade as any).useMock = false;
    });

    describe('fetchTodayClasses', () => {
      it('mapea las filas de Supabase a InstructorClassRow', async () => {
        const row = {
          id: 55,
          scheduled_at: '2026-07-28T09:00:00Z',
          start_time: null,
          end_time: null,
          duration_min: 45,
          status: 'scheduled',
          class_number: 3,
          km_start: null,
          km_end: null,
          evaluation_grade: null,
          notes: null,
          enrollments: {
            id: 10,
            students: {
              id: 20,
              users: { id: 30, first_names: 'Ana', paternal_last_name: 'Soto', rut: '1-9' },
            },
          },
          vehicles: { id: 1, license_plate: 'AB-CD-12', brand: 'Toyota', model: 'Yaris' },
        };
        supabaseMock.client.from = vi
          .fn()
          .mockReturnValue(makeThenableChain({ data: [row], error: null }));

        await facade.fetchTodayClasses();

        expect(supabaseMock.client.from).toHaveBeenCalledWith('class_b_sessions');
        expect(facade.todayClasses()).toHaveLength(1);
        expect(facade.todayClasses()[0]).toMatchObject({
          sessionId: 55,
          studentName: 'Ana Soto',
          studentRut: '1-9',
          vehiclePlate: 'AB-CD-12',
          statusLabel: 'Agendada',
        });
        expect(facade.error()).toBeNull();
      });

      it('setea error() legible si Supabase falla, sin lanzar', async () => {
        supabaseMock.client.from = vi
          .fn()
          .mockReturnValue(
            makeThenableChain({ data: null, error: { message: 'boom', code: '500' } }),
          );

        await expect(facade.fetchTodayClasses()).resolves.toBeUndefined();

        expect(facade.error()).toBeTruthy();
        expect(facade.todayClasses()).toEqual([]);
      });

      it('no consulta nada si no hay instructorId resuelto', async () => {
        profileMock.getInstructorId.mockResolvedValueOnce(null);
        supabaseMock.client.from = vi.fn();

        await facade.fetchTodayClasses();

        expect(supabaseMock.client.from).not.toHaveBeenCalled();
      });
    });

    describe('loadClassDetail', () => {
      it('setea selectedClass con la fila mapeada cuando existe', async () => {
        const row = {
          id: 77,
          scheduled_at: '2026-07-28T11:00:00Z',
          duration_min: 45,
          status: 'in_progress',
          class_number: 4,
          enrollments: {
            id: 11,
            students: {
              id: 21,
              users: { id: 31, first_names: 'Luis', paternal_last_name: 'Rojas', rut: '2-8' },
            },
          },
          vehicles: null,
        };
        supabaseMock.client.from = vi
          .fn()
          .mockReturnValue(makeThenableChain({ data: row, error: null }));

        await facade.loadClassDetail(77);

        expect(facade.selectedClass()?.sessionId).toBe(77);
        expect(facade.selectedClass()?.studentName).toBe('Luis Rojas');
        expect(facade.isLoading()).toBe(false);
      });

      it('setea selectedClass en null si no hay data (sesión inexistente)', async () => {
        supabaseMock.client.from = vi
          .fn()
          .mockReturnValue(makeThenableChain({ data: null, error: null }));

        await facade.loadClassDetail(999);

        expect(facade.selectedClass()).toBeNull();
      });

      it('setea error() si Supabase falla', async () => {
        supabaseMock.client.from = vi
          .fn()
          .mockReturnValue(makeThenableChain({ data: null, error: { message: 'db down' } }));

        await facade.loadClassDetail(1);

        expect(facade.error()).toBeTruthy();
        expect(facade.isLoading()).toBe(false);
      });
    });

    describe('startClass', () => {
      it('actualiza la sesión en Supabase y refresca la lista', async () => {
        const updateChain = makeThenableChain({ error: null });
        const refreshChain = makeThenableChain({ data: [], error: null });
        supabaseMock.client.from = vi
          .fn()
          .mockReturnValueOnce(updateChain) // update().eq()
          .mockReturnValueOnce(refreshChain); // refreshSilently → fetchTodayClasses

        await facade.startClass(5, 12000);

        expect(updateChain.update).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'in_progress', km_start: 12000 }),
        );
        expect(updateChain.eq).toHaveBeenCalledWith('id', 5);
      });

      it('propaga el error si Supabase falla, sin actualizar el estado', async () => {
        supabaseMock.client.from = vi
          .fn()
          .mockReturnValue(makeThenableChain({ error: { message: 'update failed' } }));

        await expect(facade.startClass(5, 12000)).rejects.toBeTruthy();
      });
    });

    describe('finishClass', () => {
      it('actualiza la sesión, registra asistencia práctica y refresca', async () => {
        const selectChain = makeThenableChain({
          data: { enrollment_id: 10, enrollments: { student_id: 40 } },
          error: null,
        });
        const updateChain = makeThenableChain({ error: null });
        const upsertChain = makeThenableChain({ error: null });
        const refreshChain = makeThenableChain({ data: [], error: null });

        supabaseMock.client.from = vi
          .fn()
          .mockReturnValueOnce(selectChain) // select session
          .mockReturnValueOnce(updateChain) // update status=completed
          .mockReturnValueOnce(upsertChain) // upsert practice attendance
          .mockReturnValueOnce(refreshChain); // refreshSilently

        await facade.finishClass(5, 12500);

        expect(updateChain.update).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'completed', km_end: 12500 }),
        );
        expect(upsertChain.upsert).toHaveBeenCalledWith(
          expect.objectContaining({ class_b_session_id: 5, student_id: 40, status: 'present' }),
          { onConflict: 'class_b_session_id,student_id' },
        );
      });

      it('propaga el error si la actualización de la sesión falla', async () => {
        const selectChain = makeThenableChain({ data: null, error: null });
        const updateChain = makeThenableChain({ error: { message: 'update failed' } });
        supabaseMock.client.from = vi
          .fn()
          .mockReturnValueOnce(selectChain)
          .mockReturnValueOnce(updateChain);

        await expect(facade.finishClass(5, 12500)).rejects.toBeTruthy();
      });
    });

    describe('saveEvaluation', () => {
      it('actualiza evaluación sin firmas y refresca', async () => {
        const updateChain = makeThenableChain({ error: null });
        const refreshChain = makeThenableChain({ data: [], error: null });
        supabaseMock.client.from = vi
          .fn()
          .mockReturnValueOnce(updateChain)
          .mockReturnValueOnce(refreshChain);

        await facade.saveEvaluation({
          sessionId: 5,
          grade: 6.5,
          checklist: ['freno'],
          observations: 'Bien',
          kmEnd: 13000,
          studentSignature: null,
          instructorSignature: null,
        } as any);

        expect(updateChain.update).toHaveBeenCalledWith(
          expect.objectContaining({
            evaluation_grade: 6.5,
            status: 'completed',
            student_signature_url: null,
            instructor_signature_url: null,
          }),
        );
      });

      it('propaga el error si Supabase falla al guardar', async () => {
        supabaseMock.client.from = vi
          .fn()
          .mockReturnValue(makeThenableChain({ error: { message: 'save failed' } }));

        await expect(
          facade.saveEvaluation({
            sessionId: 5,
            grade: 6.5,
            checklist: [],
            observations: '',
            kmEnd: 13000,
            studentSignature: null,
            instructorSignature: null,
          } as any),
        ).rejects.toBeTruthy();
      });
    });

    describe('fetchUpcomingDays', () => {
      it('agrupa sesiones futuras por fecha, máximo 3 días', async () => {
        supabaseMock.client.from = vi.fn().mockReturnValue(
          makeThenableChain({
            data: [
              { id: 1, scheduled_at: '2026-07-29T09:00:00Z' },
              { id: 2, scheduled_at: '2026-07-29T11:00:00Z' },
              { id: 3, scheduled_at: '2026-07-30T09:00:00Z' },
            ],
            error: null,
          }),
        );

        await facade.fetchUpcomingDays();

        expect(facade.upcomingDays()).toHaveLength(2);
        expect(facade.upcomingDays()[0]).toMatchObject({ fecha: '2026-07-29', cantidad: 2 });
        expect(facade.upcomingDays()[1]).toMatchObject({ fecha: '2026-07-30', cantidad: 1 });
      });

      it('no lanza si Supabase falla (solo loguea)', async () => {
        supabaseMock.client.from = vi
          .fn()
          .mockReturnValue(makeThenableChain({ data: null, error: { message: 'boom' } }));

        await expect(facade.fetchUpcomingDays()).resolves.toBeUndefined();
      });

      it('no consulta nada si no hay instructorId resuelto', async () => {
        profileMock.getInstructorId.mockResolvedValueOnce(null);
        supabaseMock.client.from = vi.fn();

        await facade.fetchUpcomingDays();

        expect(supabaseMock.client.from).not.toHaveBeenCalled();
      });
    });
  });
});
