import { TestBed } from '@angular/core/testing';
import { AsistenciaClaseBFacade } from './asistencia-clase-b.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { NotificationsFacade } from '@core/facades/notifications.facade';
import type {
  AlertaFaltaConsecutiva,
  ClasePracticaRow,
} from '@core/models/ui/asistencia-clase-b.model';

/** Builder Supabase encadenable y awaitable, con resultado por tabla. */
function makeSupabaseMock() {
  const results = new Map<string, { data: any; error: any }>();
  const builders = new Map<string, any>();

  function builder(table: string): any {
    const cached = builders.get(table);
    if (cached) return cached;

    const b: any = {
      select: vi.fn(() => b),
      eq: vi.fn(() => b),
      gte: vi.fn(() => b),
      lte: vi.fn(() => b),
      in: vi.fn(() => b),
      is: vi.fn(() => b),
      or: vi.fn(() => b),
      order: vi.fn(() => b),
      update: vi.fn(() => b),
      upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      single: () => Promise.resolve(results.get(`${table}:single`) ?? { data: null, error: null }),
      then: (resolve: any) => resolve(results.get(table) ?? { data: [], error: null }),
    };
    builders.set(table, b);
    return b;
  }

  const rpcResults = new Map<string, { data: any; error: any }>();

  return {
    client: {
      from: vi.fn((t: string) => builder(t)),
      rpc: vi.fn((fn: string) => Promise.resolve(rpcResults.get(fn) ?? { data: 0, error: null })),
    },
    setResult: (table: string, data: any, error: any = null) => results.set(table, { data, error }),
    setRpcResult: (fn: string, data: any, error: any = null) => rpcResults.set(fn, { data, error }),
    builderFor: (table: string) => builder(table),
  };
}

function makeRow(over: Partial<ClasePracticaRow> = {}): ClasePracticaRow {
  return {
    id: 1,
    enrollmentId: 10,
    studentId: 5,
    classNumber: 1,
    horaInicio: '09:00',
    horaInicioReal: null,
    horaFinReal: null,
    instructorId: 3,
    instructorName: 'Inst',
    alumnoName: 'Juan Pérez',
    status: 'pendiente',
    justificacion: null,
    branchId: 1,
    branchName: 'Chillán',
    scheduledAt: '2026-06-30T09:00:00',
    kmStart: null,
    vehiclePlate: null,
    vehicleBrand: null,
    vehicleModel: null,
    vehicleId: null,
    vehicleCurrentKm: null,
    ...over,
  };
}

function makeAlerta(over: Partial<AlertaFaltaConsecutiva> = {}): AlertaFaltaConsecutiva {
  return {
    studentId: 5,
    enrollmentId: 10,
    alumnoName: 'Juan Pérez',
    faltasConsecutivas: 2,
    nivel: 'warning',
    ultimaFechaFalta: '2026-07-28',
    horarioActivo: true,
    branchId: 1,
    branchName: 'Chillán',
    ...over,
  };
}

describe('AsistenciaClaseBFacade', () => {
  let facade: AsistenciaClaseBFacade;
  let mock: ReturnType<typeof makeSupabaseMock>;
  let toast: any;
  let notifications: any;

  beforeEach(() => {
    mock = makeSupabaseMock();
    toast = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
    notifications = { notifyUsers: vi.fn().mockResolvedValue(undefined) };

    TestBed.configureTestingModule({
      providers: [
        AsistenciaClaseBFacade,
        { provide: SupabaseService, useValue: mock },
        { provide: ToastService, useValue: toast },
        { provide: AuthFacade, useValue: { currentUser: vi.fn().mockReturnValue({ dbId: 99 }) } },
        { provide: BranchFacade, useValue: { branches: vi.fn().mockReturnValue([]) } },
        { provide: NotificationsFacade, useValue: notifications },
      ],
    });

    facade = TestBed.inject(AsistenciaClaseBFacade);
  });

  it('estado inicial vacío', () => {
    expect(facade.clasesPracticas()).toEqual([]);
    expect(facade.kpis()).toBeNull();
    expect(facade.isLoading()).toBe(false);
  });

  it('initialize calcula KPIs (100% sin clases con alumno)', async () => {
    mock.setResult('class_b_sessions', []);
    mock.setResult('class_b_practice_attendance', []);
    await facade.initialize();
    const kpis = facade.kpis();
    expect(kpis).not.toBeNull();
    expect(kpis?.totalClasesHoy).toBe(0);
    expect(kpis?.tasaAsistencia).toBe(100);
  });

  it('fetchPracticas no incluye sesiones reserved de enrollments draft (fix-110)', async () => {
    mock.setResult('class_b_sessions', []);
    mock.setResult('class_b_practice_attendance', []);

    await facade.initialize();

    const sessionsBuilder = mock.builderFor('class_b_sessions');
    expect(sessionsBuilder.in).toHaveBeenCalledWith('status', [
      'scheduled',
      'in_progress',
      'completed',
      'no_show',
    ]);
    expect(sessionsBuilder.eq).toHaveBeenCalledWith('enrollments.status', 'active');
  });

  // fix-191-m — regresión: el reagendamiento masivo recicla la fila de class_b_sessions y
  // conserva la asistencia de la ocurrencia anterior, archivada. Sin filtrar por vigencia,
  // Asistencia B pintaba "Ausente" una clase que está agendada.
  it('mapea a pendiente una sesión scheduled cuya asistencia fue archivada por reagendamiento', async () => {
    mock.setResult('class_b_sessions', [
      {
        id: 77,
        enrollment_id: 10,
        scheduled_at: '2026-08-20T16:40:00',
        start_time: null,
        end_time: null,
        status: 'scheduled',
        instructor_id: 3,
        class_number: 3,
        km_start: null,
        vehicles: null,
        instructors: { id: 3, users: { first_names: 'Roberto', paternal_last_name: 'Soto' } },
        enrollments: {
          id: 10,
          branch_id: 1,
          branches: { name: 'Chillán' },
          students: { id: 5, users: { first_names: 'Alumna', paternal_last_name: 'Test' } },
        },
        // Falta de la ocurrencia ANTERIOR, ya archivada al reagendar.
        class_b_practice_attendance: [
          { status: 'absent', justification: null, archived_at: '2026-08-10T12:00:00Z' },
        ],
      },
    ]);
    mock.setResult('class_b_practice_attendance', []);

    await facade.initialize();

    expect(facade.clasesPracticas()[0].status).toBe('pendiente');
    expect(facade.kpis()?.inasistenciasHoy).toBe(0);
  });

  it('excluye asistencia archivada de las alertas de faltas consecutivas', async () => {
    mock.setResult('class_b_sessions', []);
    mock.setResult('class_b_practice_attendance', []);

    await facade.initialize();

    const attendanceBuilder = mock.builderFor('class_b_practice_attendance');
    expect(attendanceBuilder.is).toHaveBeenCalledWith('archived_at', null);
  });

  it('markAttendance marca ausente y actualiza el estado local + toast', async () => {
    (facade as any)._clasesPracticas.set([makeRow()]);
    mock.setResult('enrollments:single', { student_id: 5 });
    mock.setResult('class_b_sessions', [{ id: 1 }]); // fix-362-m: el update exige filas

    await facade.markAttendance(1, 'ausente');

    expect(facade.clasesPracticas()[0].status).toBe('ausente');
    expect(toast.success).toHaveBeenCalled();
  });

  it('markAttendance invoca la penalización RF-053 al marcar ausente', async () => {
    (facade as any)._clasesPracticas.set([makeRow()]);
    mock.setResult('enrollments:single', { student_id: 5 });
    mock.setResult('class_b_sessions', [{ id: 1 }]); // fix-362-m: el update exige filas
    mock.setRpcResult('apply_class_b_absence_penalty', 0);

    await facade.markAttendance(1, 'ausente');

    expect(mock.client.rpc).toHaveBeenCalledWith('apply_class_b_absence_penalty', {
      p_enrollment_id: 10,
    });
    expect(toast.warning).not.toHaveBeenCalled();
  });

  it('markAttendance avisa por toast cuando la penalización cancela clases futuras', async () => {
    (facade as any)._clasesPracticas.set([makeRow()]);
    mock.setResult('enrollments:single', { student_id: 5 });
    mock.setResult('class_b_sessions', [{ id: 1 }]); // fix-362-m: el update exige filas
    mock.setRpcResult('apply_class_b_absence_penalty', 3);

    await facade.markAttendance(1, 'ausente');

    expect(toast.warning).toHaveBeenCalledWith(
      'Agenda liberada por inasistencias',
      expect.stringContaining('3 clase(s) futura(s)'),
    );
  });

  describe('regla desactivada en la sede (spec 0048-b)', () => {
    function alertaPara(enrollmentId: number, faltasConsecutivas: number) {
      return {
        studentId: 5,
        enrollmentId,
        alumnoName: 'Ana',
        faltasConsecutivas,
        nivel: 'critico',
        ultimaFechaFalta: '2026-10-06',
        horarioActivo: true,
        branchId: 1,
      };
    }

    it('AC-E2: la RPC devuelve -1 y el alumno queda con 2 faltas consecutivas → aviso de que no se canceló', async () => {
      (facade as any)._clasesPracticas.set([makeRow()]);
      mock.setResult('enrollments:single', { student_id: 5 });
      mock.setResult('class_b_sessions', [{ id: 1 }]); // fix-362-m: el update exige filas
      mock.setRpcResult('apply_class_b_absence_penalty', -1);
      vi.spyOn(facade as any, 'refreshAlertasSilently').mockImplementation(async () =>
        (facade as any)._alertas.set([alertaPara(10, 2)]),
      );

      await facade.markAttendance(1, 'ausente');

      expect(toast.info).toHaveBeenCalledWith(
        'Agenda no cancelada',
        expect.stringContaining('desactivada'),
      );
      expect(toast.warning).not.toHaveBeenCalled();
    });

    it('AC-E2: la RPC devuelve -1 pero el alumno no tiene 2 faltas seguidas → sin aviso', async () => {
      (facade as any)._clasesPracticas.set([makeRow()]);
      mock.setResult('enrollments:single', { student_id: 5 });
      mock.setResult('class_b_sessions', [{ id: 1 }]); // fix-362-m: el update exige filas
      mock.setRpcResult('apply_class_b_absence_penalty', -1);
      vi.spyOn(facade as any, 'refreshAlertasSilently').mockImplementation(async () =>
        (facade as any)._alertas.set([alertaPara(10, 1)]),
      );

      await facade.markAttendance(1, 'ausente');

      expect(toast.info).not.toHaveBeenCalled();
    });
  });

  describe('fix-362-m: una escritura que falla no termina en toast de éxito', () => {
    const rlsError = { code: '42501', message: 'new row violates row-level security policy' };

    it('markAttendance: si el upsert de asistencia falla, avisa el error y no cambia la fila', async () => {
      (facade as any)._clasesPracticas.set([makeRow()]);
      mock.setResult('enrollments:single', { student_id: 5 });
      mock.setResult('class_b_sessions', [{ id: 1 }]);
      mock
        .builderFor('class_b_practice_attendance')
        .upsert.mockResolvedValueOnce({ data: null, error: rlsError });

      await facade.markAttendance(1, 'ausente');

      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('permisos'));
      expect(facade.clasesPracticas()[0].status).toBe('pendiente');
      expect(mock.client.rpc).not.toHaveBeenCalled();
    });

    it('markAttendance: si la RLS filtra la sesión (0 filas, sin error), tampoco da éxito', async () => {
      (facade as any)._clasesPracticas.set([makeRow()]);
      mock.setResult('enrollments:single', { student_id: 5 });
      mock.setResult('class_b_sessions', []);

      await facade.markAttendance(1, 'ausente');

      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalled();
      expect(facade.clasesPracticas()[0].status).toBe('pendiente');
    });

    it('markAttendance: si falla la RPC de penalización, avisa que no se pudo revisar', async () => {
      (facade as any)._clasesPracticas.set([makeRow()]);
      mock.setResult('enrollments:single', { student_id: 5 });
      mock.setResult('class_b_sessions', [{ id: 1 }]);
      mock.setRpcResult('apply_class_b_absence_penalty', null, { message: 'boom' });

      await facade.markAttendance(1, 'ausente');

      expect(toast.warning).toHaveBeenCalledWith(
        'No se pudo revisar la penalización',
        expect.stringContaining('Juan Pérez'),
      );
    });

    it('justifyAbsence: si no se actualizó ninguna fila, no dice "Justificación registrada"', async () => {
      (facade as any)._clasesPracticas.set([makeRow({ status: 'ausente' })]);
      mock.setResult('enrollments:single', { student_id: 5 });
      mock.setResult('class_b_practice_attendance', []);

      await facade.justifyAbsence(1, 'Licencia médica');

      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalled();
      expect(facade.clasesPracticas()[0].justificacion).toBeNull();
    });

    it('justifyAbsence: con la fila actualizada sí registra la justificación', async () => {
      (facade as any)._clasesPracticas.set([makeRow({ status: 'ausente' })]);
      mock.setResult('enrollments:single', { student_id: 5 });
      mock.setResult('class_b_practice_attendance', [{ id: 9 }]);

      await facade.justifyAbsence(1, 'Licencia médica');

      expect(toast.success).toHaveBeenCalledWith('Justificación registrada');
      expect(facade.clasesPracticas()[0].justificacion).toBe('Licencia médica');
    });

    const finishPayload = {
      sessionId: 1,
      studentId: 5,
      kmEnd: 12050,
      studentSignature: null,
      instructorSignature: null,
    };

    it('finishClass: vehículo de otra sede (RLS filtra el update) → aviso, no éxito', async () => {
      (facade as any)._clasesPracticas.set([makeRow({ status: 'en_curso', vehicleId: 7 })]);
      (facade as any)._selectedPractica.set(makeRow({ status: 'en_curso', vehicleId: 7 }));
      mock.setResult('vehicles', []);

      await facade.finishClass(finishPayload);

      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.warning).toHaveBeenCalledWith(
        'Clase finalizada, con datos sin guardar',
        expect.stringContaining('el kilometraje del vehículo'),
      );
      // La clase sí quedó finalizada: la fila local refleja eso.
      expect(facade.clasesPracticas()[0].status).toBe('presente');
    });

    it('finishClass: si falla la asistencia, también lo avisa', async () => {
      (facade as any)._clasesPracticas.set([makeRow({ status: 'en_curso', vehicleId: 7 })]);
      (facade as any)._selectedPractica.set(makeRow({ status: 'en_curso', vehicleId: 7 }));
      mock.setResult('vehicles', [{ id: 7 }]);
      mock
        .builderFor('class_b_practice_attendance')
        .upsert.mockResolvedValueOnce({ data: null, error: rlsError });

      await facade.finishClass(finishPayload);

      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.warning).toHaveBeenCalledWith(
        'Clase finalizada, con datos sin guardar',
        expect.stringContaining('la asistencia del alumno'),
      );
    });

    it('finishClass: con todo guardado mantiene el toast de éxito', async () => {
      (facade as any)._clasesPracticas.set([makeRow({ status: 'en_curso', vehicleId: 7 })]);
      (facade as any)._selectedPractica.set(makeRow({ status: 'en_curso', vehicleId: 7 }));
      mock.setResult('vehicles', [{ id: 7 }]);

      await facade.finishClass(finishPayload);

      expect(toast.warning).not.toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith(
        'Clase finalizada',
        'Evaluación y asistencia registradas.',
      );
    });
  });

  it('markAttendance guarda recorded_at con la hora actual (spec 0048-b AC4)', async () => {
    (facade as any)._clasesPracticas.set([makeRow()]);
    mock.setResult('enrollments:single', { student_id: 5 });
    mock.setResult('class_b_sessions', [{ id: 1 }]); // fix-362-m: el update exige filas
    mock.setRpcResult('apply_class_b_absence_penalty', 0);

    const before = Date.now();
    await facade.markAttendance(1, 'ausente');

    const upsert = mock.builderFor('class_b_practice_attendance').upsert;
    const payload = upsert.mock.calls[0][0];
    expect(new Date(payload.recorded_at).getTime()).toBeGreaterThanOrEqual(before);
  });

  it('markAttendance no invoca la penalización al marcar presente', async () => {
    (facade as any)._clasesPracticas.set([makeRow()]);
    mock.setResult('enrollments:single', { student_id: 5 });
    mock.setResult('class_b_sessions', [{ id: 1 }]); // fix-362-m: el update exige filas

    await facade.markAttendance(1, 'presente');

    expect(mock.client.rpc).not.toHaveBeenCalled();
  });

  it('selectPractica expone la fila seleccionada', () => {
    const row = makeRow({ id: 7 });
    facade.selectPractica(row);
    expect(facade.selectedPractica()?.id).toBe(7);
  });

  it('setBranchFilter no dispara error y permite recarga', () => {
    expect(() => facade.setBranchFilter(2)).not.toThrow();
  });

  // ── sendReminder (fix-093-b) ──────────────────────────────────────────────

  it('sendReminder crea la notificación con el users.id del alumno (no students.id)', async () => {
    (facade as any)._alertas.set([makeAlerta({ studentId: 5, enrollmentId: 10 })]);
    mock.setResult('students:single', { user_id: 77 });

    await facade.sendReminder(10);

    expect(notifications.notifyUsers).toHaveBeenCalledTimes(1);
    const [recipients, payload] = notifications.notifyUsers.mock.calls[0];
    // 77 = users.id resuelto vía students.user_id; 5 sería el students.id (bug clásico)
    expect(recipients).toEqual([77]);
    expect(payload.referenceType).toBe('class_b');
    expect(toast.success).toHaveBeenCalled();
  });

  it('sendReminder NO muestra toast de éxito si el envío falla', async () => {
    (facade as any)._alertas.set([makeAlerta()]);
    mock.setResult('students:single', { user_id: 77 });
    notifications.notifyUsers.mockRejectedValueOnce(new Error('RLS'));

    await facade.sendReminder(10);

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
  });

  it('sendReminder no notifica ni miente si el alumno no tiene user_id', async () => {
    (facade as any)._alertas.set([makeAlerta()]);
    mock.setResult('students:single', { user_id: null });

    await facade.sendReminder(10);

    expect(notifications.notifyUsers).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('sendReminder marca y limpia isSaving', async () => {
    (facade as any)._alertas.set([makeAlerta()]);
    mock.setResult('students:single', { user_id: 77 });

    let sawSavingDuringCall = false;
    notifications.notifyUsers.mockImplementationOnce(async () => {
      sawSavingDuringCall = facade.isSaving();
    });

    await facade.sendReminder(10);

    expect(sawSavingDuringCall).toBe(true);
    expect(facade.isSaving()).toBe(false);
  });

  it('sendReminder ignora un enrollmentId que no está entre las alertas', async () => {
    (facade as any)._alertas.set([makeAlerta({ enrollmentId: 10 })]);

    await facade.sendReminder(999);

    expect(notifications.notifyUsers).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
  });

  // ── startClass (spec 0001-i) ──────────────────────────────────────────────

  describe('startClass', () => {
    it('actualiza la sesión y muestra toast de éxito', async () => {
      mock.setResult('class_b_sessions', null, null);

      await facade.startClass(1, 12000);

      expect(toast.success).toHaveBeenCalledWith('Clase iniciada');
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('propaga el mensaje legible del trigger de exclusión mutua (P0001, spec 0001-i)', async () => {
      mock.setResult('class_b_sessions', null, {
        code: 'P0001',
        message: 'El instructor ya tiene una clase en curso. Debe cerrarla antes de iniciar otra.',
      });

      await expect(facade.startClass(1, 12000)).rejects.toThrow(
        'El instructor ya tiene una clase en curso. Debe cerrarla antes de iniciar otra.',
      );
      expect(toast.error).toHaveBeenCalledWith(
        'Error al iniciar la clase',
        'El instructor ya tiene una clase en curso. Debe cerrarla antes de iniciar otra.',
      );
    });
  });
});
