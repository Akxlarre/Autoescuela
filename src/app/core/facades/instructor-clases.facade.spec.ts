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

      it('usa el rango horario de Chile (no UTC) para no perder clases nocturnas', async () => {
        const chain = makeThenableChain({ data: [], error: null });
        supabaseMock.client.from = vi.fn().mockReturnValue(chain);

        // 23:30 hora Chile del 6 de octubre: en UTC ya es el día 7.
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-10-07T02:30:00.000Z'));

        await facade.fetchTodayClasses();
        vi.useRealTimers();

        // Rango semiabierto del día 6 en Chile (UTC-3): [06 03:00Z, 07 03:00Z).
        expect(chain.gte).toHaveBeenCalledWith('scheduled_at', '2026-10-06T03:00:00.000Z');
        expect(chain.lt).toHaveBeenCalledWith('scheduled_at', '2026-10-07T03:00:00.000Z');
        // Regresión: NUNCA debe usar el límite crudo en UTC (`+00:00`), que corta
        // las clases de la noche cuando Chile todavía está en "hoy" pero UTC ya
        // avanzó a "mañana".
        expect(chain.gte).not.toHaveBeenCalledWith(
          'scheduled_at',
          expect.stringContaining('+00:00'),
        );
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
        expect(facade.detailLoading()).toBe(false);
        expect(facade.isLoading()).toBe(false);
      });

      it('mapea vehicleCurrentKm desde vehicles.current_km', async () => {
        const row = {
          id: 78,
          scheduled_at: '2026-07-28T11:00:00Z',
          duration_min: 45,
          status: 'scheduled',
          class_number: 4,
          enrollments: {
            id: 11,
            students: {
              id: 21,
              users: { id: 31, first_names: 'Luis', paternal_last_name: 'Rojas', rut: '2-8' },
            },
          },
          vehicles: {
            id: 1,
            license_plate: 'AB-CD-12',
            brand: 'Toyota',
            model: 'Yaris',
            current_km: 42000,
          },
        };
        supabaseMock.client.from = vi
          .fn()
          .mockReturnValue(makeThenableChain({ data: row, error: null }));

        await facade.loadClassDetail(78);

        expect(facade.selectedClass()?.vehicleCurrentKm).toBe(42000);
      });

      it('setea selectedClass en null si no hay data (sesión inexistente)', async () => {
        supabaseMock.client.from = vi
          .fn()
          .mockReturnValue(makeThenableChain({ data: null, error: null }));

        await facade.loadClassDetail(999);

        expect(facade.selectedClass()).toBeNull();
      });

      it('setea detailError() si Supabase falla sin pisar error() de la lista', async () => {
        supabaseMock.client.from = vi
          .fn()
          .mockReturnValue(makeThenableChain({ data: null, error: { message: 'db down' } }));

        await facade.loadClassDetail(1);

        expect(facade.detailError()).toBeTruthy();
        expect(facade.detailLoading()).toBe(false);
        expect(facade.error()).toBeNull();
      });

      it('mapea evaluation_checklist y los booleanos de firma (student_signature/instructor_signature) cuando la clase ya fue evaluada', async () => {
        const row = {
          id: 88,
          scheduled_at: '2026-07-28T11:00:00Z',
          duration_min: 45,
          status: 'completed',
          class_number: 4,
          evaluation_grade: 6,
          evaluation_checklist: [{ id: 'frenado', label: 'Frenado', checked: true }],
          notes: 'Buen desempeño',
          student_signature: true,
          instructor_signature: true,
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

        await facade.loadClassDetail(88);

        expect(facade.selectedClass()?.studentSigned).toBe(true);
        expect(facade.selectedClass()?.instructorSigned).toBe(true);
        expect(facade.selectedClass()?.evaluationChecklist).toEqual([
          { id: 'frenado', label: 'Frenado', checked: true },
        ]);
      });

      it('deja las firmas en false si la clase aún no se evalúa', async () => {
        const row = {
          id: 89,
          scheduled_at: '2026-07-28T11:00:00Z',
          duration_min: 45,
          status: 'scheduled',
          class_number: 4,
          evaluation_grade: null,
          evaluation_checklist: null,
          notes: null,
          student_signature: false,
          instructor_signature: false,
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

        await facade.loadClassDetail(89);

        expect(facade.selectedClass()?.studentSigned).toBe(false);
        expect(facade.selectedClass()?.instructorSigned).toBe(false);
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

      it('propaga el mensaje legible del trigger de exclusión mutua (P0001, spec 0001-i)', async () => {
        supabaseMock.client.from = vi.fn().mockReturnValue(
          makeThenableChain({
            error: {
              code: 'P0001',
              message:
                'El instructor ya tiene una clase en curso. Debe cerrarla antes de iniciar otra.',
            },
          }),
        );

        await expect(facade.startClass(5, 12000)).rejects.toThrow(
          'El instructor ya tiene una clase en curso. Debe cerrarla antes de iniciar otra.',
        );
      });

      it('spec 0010-i (AC6): clase 7 bloqueada por pago → manda al alumno a secretaría', async () => {
        supabaseMock.client.from = vi
          .fn()
          .mockReturnValue(
            makeThenableChain({ error: { code: 'P0001', message: 'PAGO_PENDIENTE_CLASE_7' } }),
          );

        await expect(facade.startClass(5, 12000)).rejects.toThrow(
          'Pago pendiente: el alumno debe pasar por secretaría.',
        );
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

      it('no escribe el km del vehículo: lo actualiza la BD al guardar km_end (fix-222-b)', async () => {
        const selectChain = makeThenableChain({
          data: { enrollment_id: 10, vehicle_id: 3, enrollments: { student_id: 40 } },
          error: null,
        });
        const updateSessionChain = makeThenableChain({ error: null });
        const upsertChain = makeThenableChain({ error: null });
        const refreshChain = makeThenableChain({ data: [], error: null });

        supabaseMock.client.from = vi
          .fn()
          .mockReturnValueOnce(selectChain) // select session
          .mockReturnValueOnce(updateSessionChain) // update status=completed (+ km_end)
          .mockReturnValueOnce(upsertChain) // upsert practice attendance
          .mockReturnValueOnce(refreshChain); // refreshSilently
        const toast = TestBed.inject(ToastService) as any;
        toast.warning = vi.fn();

        await facade.finishClass(5, 12500);

        // Antes (fix-189): UPDATE directo a vehicles.current_km, que podía fallar por permisos
        // (fix-362-m lo avisaba) o hacer retroceder el odómetro. Ahora lo hace un trigger.
        const tablas = (supabaseMock.client.from as any).mock.calls.map(([t]: [string]) => t);
        expect(tablas).not.toContain('vehicles');
        expect(updateSessionChain.update).toHaveBeenCalledWith(
          expect.objectContaining({ km_end: 12500 }),
        );
        expect(toast.warning).not.toHaveBeenCalled();
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

      it('persiste notes y firmas cuando se proveen', async () => {
        const selectChain = makeThenableChain({ data: null, error: null });
        const updateChain = makeThenableChain({ error: null });

        supabaseMock.client.from = vi
          .fn()
          .mockReturnValueOnce(selectChain) // select session
          .mockReturnValueOnce(updateChain) // update status=completed
          .mockReturnValueOnce(makeThenableChain({ data: [], error: null })); // refreshSilently

        supabaseMock.client.storage = {
          from: vi.fn().mockReturnValue({
            upload: vi
              .fn()
              .mockResolvedValue({ data: { path: 'sessions/5/signature.png' }, error: null }),
          }),
        };

        await facade.finishClass(5, 12500, {
          notes: 'Buen retorno, sin novedades',
          studentSignature: 'data:image/png;base64,AAA',
          instructorSignature: 'data:image/png;base64,BBB',
        });

        expect(updateChain.update).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'completed',
            km_end: 12500,
            notes: 'Buen retorno, sin novedades',
            student_signature: true,
            instructor_signature: true,
          }),
        );
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
            student_signature: false,
            instructor_signature: false,
          }),
        );
      });

      it('incrementa evaluationSavedTick tras guardar con éxito (fix-236-m)', async () => {
        const updateChain = makeThenableChain({ error: null });
        const refreshChain = makeThenableChain({ data: [], error: null });
        supabaseMock.client.from = vi
          .fn()
          .mockReturnValueOnce(updateChain)
          .mockReturnValueOnce(refreshChain);

        expect(facade.evaluationSavedTick()).toBe(0);

        await facade.saveEvaluation({
          sessionId: 5,
          grade: 6.5,
          checklist: ['freno'],
          observations: 'Bien',
          kmEnd: 13000,
          studentSignature: null,
          instructorSignature: null,
        } as any);

        expect(facade.evaluationSavedTick()).toBe(1);
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

      it('NO incrementa evaluationSavedTick si el guardado falla (fix-236-m)', async () => {
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

        expect(facade.evaluationSavedTick()).toBe(0);
      });
    });

    describe('openEvaluacionDrawer (fix-236-m)', () => {
      it('carga el detalle de la clase y abre el Drawer con InstructorEvaluacionComponent', async () => {
        supabaseMock.client.from = vi.fn().mockReturnValue(
          makeThenableChain({
            data: {
              id: 5,
              status: 'completed',
              class_number: 3,
              enrollments: {
                id: 10,
                number: 'M-1',
                students: {
                  id: 1,
                  users: { id: 2, first_names: 'Ana', paternal_last_name: 'Díaz' },
                },
              },
            },
            error: null,
          }),
        );
        const layoutDrawer = (facade as any).layoutDrawer;
        const openSpy = vi.spyOn(layoutDrawer, 'open');

        await facade.openEvaluacionDrawer(5);

        expect(facade.selectedClass()?.sessionId).toBe(5);
        expect(openSpy).toHaveBeenCalledOnce();
        expect(openSpy.mock.calls[0][1]).toBe('Evaluación Práctica');
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

    describe('Manejo explícito de errores de lectura (0060-b / DoD-F)', () => {
      it('Caso A: primera carga con error deja todayClasses vacío y error visible', async () => {
        supabaseMock.client.from = vi
          .fn()
          .mockReturnValue(makeThenableChain({ data: null, error: { message: 'db error' } }));

        await facade.initialize();

        expect(facade.todayClasses()).toEqual([]);
        expect(facade.upcomingDays()).toEqual([]);
        expect(facade.error()).toBe('No se pudieron cargar las clases del día.');
        expect(facade.isLoading()).toBe(false);
        expect((facade as any)._initialized).toBe(false);
      });

      it('Caso A: si fetchUpcomingDays falla en initialize, toda la carga falla', async () => {
        let callCount = 0;
        supabaseMock.client.from = vi.fn().mockImplementation(() => {
          callCount++;
          // Primera llamada (todayClasses) ok, segunda (upcomingDays) error
          if (callCount === 1) {
            return makeThenableChain({ data: [], error: null });
          }
          return makeThenableChain({ data: null, error: { message: 'upcoming error' } });
        });

        await facade.initialize();

        expect(facade.todayClasses()).toEqual([]);
        expect(facade.error()).toBe('No se pudieron cargar las clases del día.');
      });

      it('Caso B: refresco con error mantiene clases visibles y activa refreshFailed', async () => {
        // 1. Carga inicial exitosa
        supabaseMock.client.from = vi.fn().mockReturnValue(
          makeThenableChain({
            data: [
              {
                id: 1,
                scheduled_at: '2026-07-29T09:00:00Z',
                duration_min: 45,
                status: 'scheduled',
                class_number: 1,
                enrollments: {
                  id: 10,
                  students: { users: { first_names: 'Pedro', paternal_last_name: 'Gómez' } },
                },
              },
            ],
            error: null,
          }),
        );

        await facade.initialize();
        expect(facade.todayClasses().length).toBe(1);
        expect(facade.error()).toBeNull();
        expect(facade.refreshFailed()).toBe(false);

        // 2. Refresco con error
        supabaseMock.client.from = vi
          .fn()
          .mockReturnValue(
            makeThenableChain({ data: null, error: { message: 'temporary network failure' } }),
          );

        await facade.refreshSilently();

        // Clases visibles no se borran (Caso B)
        expect(facade.todayClasses().length).toBe(1);
        expect(facade.refreshFailed()).toBe(true);
        expect(facade.error()).toBeNull();
      });

      it('reintentar limpia el error y recarga', async () => {
        // 1. Falla inicial
        supabaseMock.client.from = vi
          .fn()
          .mockReturnValue(makeThenableChain({ data: null, error: { message: 'conn error' } }));

        await facade.initialize();
        expect(facade.error()).toBe('No se pudieron cargar las clases del día.');

        // 2. Reintento exitoso
        supabaseMock.client.from = vi
          .fn()
          .mockReturnValue(makeThenableChain({ data: [], error: null }));

        await facade.reintentar();
        expect(facade.error()).toBeNull();
        expect(facade.refreshFailed()).toBe(false);
      });

      it('Reintentar en caso B: con refreshFailed y datos visibles, un reintento que falla deja los datos intactos, isLoading nunca pasa a true y no aparece error() de caso A', async () => {
        supabaseMock.client.from = vi.fn().mockReturnValue(
          makeThenableChain({
            data: [
              {
                id: 1,
                scheduled_at: '2026-07-29T09:00:00Z',
                duration_min: 45,
                status: 'scheduled',
                class_number: 1,
                enrollments: {
                  id: 10,
                  students: { users: { first_names: 'Pedro', paternal_last_name: 'Gómez' } },
                },
              },
            ],
            error: null,
          }),
        );

        await facade.initialize();
        expect(facade.todayClasses().length).toBe(1);

        supabaseMock.client.from = vi
          .fn()
          .mockReturnValue(
            makeThenableChain({ data: null, error: { message: 'temporary network failure' } }),
          );
        await facade.refreshSilently();
        expect(facade.refreshFailed()).toBe(true);

        const observedLoading: boolean[] = [];
        supabaseMock.client.from = vi.fn().mockImplementation(() => {
          observedLoading.push(facade.isLoading());
          return makeThenableChain({ data: null, error: { message: 'retry failed' } });
        });

        await facade.reintentar();

        expect(observedLoading.length).toBeGreaterThan(0);
        expect(observedLoading.every((v) => v === false)).toBe(true);
        expect(facade.isLoading()).toBe(false);
        expect(facade.todayClasses().length).toBe(1);
        expect(facade.todayClasses()[0].studentName).toContain('Pedro');
        expect(facade.refreshFailed()).toBe(true);
        expect(facade.error()).toBeNull();
      });

      it('Reintentar en caso B: un reintento que funciona actualiza los datos y limpia refreshFailed', async () => {
        supabaseMock.client.from = vi.fn().mockReturnValue(
          makeThenableChain({
            data: [
              {
                id: 1,
                scheduled_at: '2026-07-29T09:00:00Z',
                duration_min: 45,
                status: 'scheduled',
                class_number: 1,
                enrollments: {
                  id: 10,
                  students: { users: { first_names: 'Pedro', paternal_last_name: 'Gómez' } },
                },
              },
            ],
            error: null,
          }),
        );

        await facade.initialize();

        supabaseMock.client.from = vi
          .fn()
          .mockReturnValue(
            makeThenableChain({ data: null, error: { message: 'temporary network failure' } }),
          );
        await facade.refreshSilently();
        expect(facade.refreshFailed()).toBe(true);

        const observedLoading: boolean[] = [];
        supabaseMock.client.from = vi.fn().mockImplementation(() => {
          observedLoading.push(facade.isLoading());
          return makeThenableChain({
            data: [
              {
                id: 1,
                scheduled_at: '2026-07-29T09:00:00Z',
                duration_min: 45,
                status: 'scheduled',
                class_number: 1,
                enrollments: {
                  id: 10,
                  students: { users: { first_names: 'Pedro', paternal_last_name: 'Gómez' } },
                },
              },
              {
                id: 2,
                scheduled_at: '2026-07-29T11:00:00Z',
                duration_min: 45,
                status: 'scheduled',
                class_number: 2,
                enrollments: {
                  id: 11,
                  students: { users: { first_names: 'Carla', paternal_last_name: 'Díaz' } },
                },
              },
            ],
            error: null,
          });
        });

        await facade.reintentar();

        expect(observedLoading.length).toBeGreaterThan(0);
        expect(observedLoading.every((v) => v === false)).toBe(true);
        expect(facade.isLoading()).toBe(false);
        expect(facade.todayClasses().length).toBe(2);
        expect(facade.refreshFailed()).toBe(false);
        expect(facade.error()).toBeNull();
      });

      it('loadClassDetail: limpia selectedClass al empezar y expone detailError ante fallo sin ensuciar la lista', async () => {
        (facade as any)._selectedClass.set({ sessionId: 99, studentName: 'Previo' } as any);
        expect(facade.selectedClass()).not.toBeNull();

        supabaseMock.client.from = vi
          .fn()
          .mockReturnValue(makeThenableChain({ data: null, error: { message: 'query failed' } }));

        await facade.loadClassDetail(5);

        expect(facade.selectedClass()).toBeNull();
        expect(facade.detailError()).toBe('No se pudo cargar el detalle de la clase.');
        expect(facade.error()).toBeNull();
      });

      it('loadClassDetail: request guard descarta respuesta vieja', async () => {
        let resolveFirst: any;
        const firstPromise = new Promise((resolve) => {
          resolveFirst = resolve;
        });

        const firstChain = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockImplementation(() => firstPromise),
        };

        const secondChain = makeThenableChain({
          data: {
            id: 2,
            status: 'scheduled',
            class_number: 2,
            scheduled_at: '2026-07-29T10:00:00Z',
            duration_min: 45,
            enrollments: {
              id: 20,
              students: { users: { first_names: 'Segundo', paternal_last_name: 'Alumno' } },
            },
          },
          error: null,
        });

        let callCount = 0;
        supabaseMock.client.from = vi.fn().mockImplementation(() => {
          callCount++;
          return callCount === 1 ? firstChain : secondChain;
        });

        const p1 = facade.loadClassDetail(1);
        const p2 = facade.loadClassDetail(2);

        await p2;
        expect(facade.selectedClass()?.sessionId).toBe(2);

        // Resuelve primera con error
        resolveFirst({ data: null, error: { message: 'stale error' } });
        await p1;

        // No pisa la segunda
        expect(facade.selectedClass()?.sessionId).toBe(2);
        expect(facade.detailError()).toBeNull();
      });

      it('Lección 5: un refresco que pide token nuevo no deja isLoading pegado en true', async () => {
        let resolveFirst: any;
        const firstPromise = new Promise((resolve) => {
          resolveFirst = resolve;
        });

        let first = true;
        supabaseMock.client.from = vi.fn().mockImplementation(() => {
          if (first) {
            first = false;
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              gte: vi.fn().mockReturnThis(),
              lt: vi.fn().mockReturnThis(),
              order: vi.fn().mockImplementation(() => firstPromise),
            };
          }
          return makeThenableChain({ data: [], error: null });
        });

        const pInit = facade.initialize();
        const pRefresh = facade.refreshSilently();
        resolveFirst({ data: [], error: null });

        await Promise.all([pInit, pRefresh]);

        expect(facade.isLoading()).toBe(false);
      });

      it('finishClass: fallo de lectura inicial de sesión lanza error', async () => {
        supabaseMock.client.from = vi
          .fn()
          .mockReturnValue(
            makeThenableChain({ data: null, error: { message: 'read session failed' } }),
          );

        await expect(facade.finishClass(5, 12000)).rejects.toBeTruthy();
      });

      it('finishClass: fallo en refreshSilently posterior NO hace fallar la mutación (Caso B)', async () => {
        let updateCalled = false;
        supabaseMock.client.from = vi.fn().mockImplementation((table: string) => {
          if (table === 'class_b_sessions') {
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockImplementation((col: string) => {
                if (col === 'id') {
                  return {
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { enrollment_id: 10, enrollments: { student_id: 5 } },
                      error: null,
                    }),
                    select: vi.fn().mockReturnThis(),
                    gte: vi.fn().mockReturnThis(),
                    lt: vi.fn().mockReturnThis(),
                    order: vi
                      .fn()
                      .mockResolvedValue({ data: null, error: { message: 'refresh error' } }),
                  };
                }
                return createChainMock();
              }),
              update: vi.fn().mockImplementation(() => {
                updateCalled = true;
                return {
                  eq: vi.fn().mockResolvedValue({ data: null, error: null }),
                };
              }),
            };
          }
          if (table === 'class_b_practice_attendance') {
            return {
              upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
            };
          }
          return createChainMock();
        });

        // La finalización debe tener éxito aunque el refresco falle
        await expect(facade.finishClass(5, 12000)).resolves.toBeUndefined();
        expect(updateCalled).toBe(true);
        expect(facade.refreshFailed()).toBe(true);
      });

      it('saveEvaluation y startClass: fallo en refreshSilently posterior NO hace fallar la mutación (Caso B)', async () => {
        supabaseMock.client.from = vi.fn().mockImplementation(() => ({
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lt: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: null, error: { message: 'refresh error' } }),
          order: vi.fn().mockResolvedValue({ data: null, error: { message: 'refresh error' } }),
        }));

        await expect(facade.startClass(5, 12000)).resolves.toBeUndefined();
        expect(facade.refreshFailed()).toBe(true);

        await expect(
          facade.saveEvaluation({
            sessionId: 5,
            grade: 6,
            checklist: [],
            observations: 'Ok',
            kmEnd: 12050,
            studentSignature: null,
            instructorSignature: null,
          } as any),
        ).resolves.toBeUndefined();
        expect(facade.evaluationSavedTick()).toBe(1);
        expect(facade.refreshFailed()).toBe(true);
      });
    });
  });
});
