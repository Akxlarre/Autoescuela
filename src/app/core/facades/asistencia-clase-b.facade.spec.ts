import { TestBed } from '@angular/core/testing';
import { AsistenciaClaseBFacade } from './asistencia-clase-b.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { NotificationsFacade } from '@core/facades/notifications.facade';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
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
      lt: vi.fn(() => b),
      gt: vi.fn(() => b),
      in: vi.fn(() => b),
      is: vi.fn(() => b),
      or: vi.fn(() => b),
      order: vi.fn(() => b),
      update: vi.fn(() => b),
      upsert: vi.fn(() => Promise.resolve({ data: null, error: null })),
      single: () => Promise.resolve(results.get(`${table}:single`) ?? { data: null, error: null }),
      maybeSingle: () =>
        Promise.resolve(results.get(`${table}:maybeSingle`) ?? { data: null, error: null }),
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
    setResult: (table: string, data: any, error: any = null, count?: number) =>
      results.set(table, { data, error, count } as any),
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
  let confirmModal: { confirm: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    confirmModal = { confirm: vi.fn().mockResolvedValue(true) };
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
        { provide: ConfirmModalService, useValue: confirmModal },
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

  describe('fix-386-m: datos y fecha de otro alcance', () => {
    it('con otra sede no reutiliza lo que hay en memoria: vacía y carga con skeleton', async () => {
      facade.setBranchFilter(null);
      await facade.initialize();
      (facade as any)._clasesPracticas.set([makeRow({ id: 1, branchId: 2 })]);
      (facade as any)._alertas.set([makeAlerta({ branchId: 2 })]);

      facade.setBranchFilter(1);
      const pending = facade.initialize();

      expect(facade.clasesPracticas()).toEqual([]);
      expect(facade.alertas()).toEqual([]);
      expect(facade.isLoading()).toBe(true);
      await pending;
      expect(facade.isLoading()).toBe(false);
    });

    it('con la misma sede la re-entrada no muestra skeleton (SWR)', async () => {
      facade.setBranchFilter(1);
      await facade.initialize();
      (facade as any)._clasesPracticas.set([makeRow({ id: 1 })]);

      const pending = facade.initialize();

      expect(facade.isLoading()).toBe(false);
      expect(facade.clasesPracticas()).toHaveLength(1);
      await pending;
    });

    it('enterToday devuelve la fecha a hoy y obliga a cargar de nuevo', async () => {
      vi.useFakeTimers();
      // 23:30 hora Chile del 6 de octubre: en UTC ya es el día 7.
      vi.setSystemTime(new Date('2026-10-07T02:30:00.000Z'));
      await facade.setDate('2026-10-01');
      (facade as any)._clasesPracticas.set([makeRow({ id: 1 })]);

      facade.enterToday();
      const pending = facade.initialize();
      vi.useRealTimers();

      expect(facade.selectedDate()).toBe('2026-10-06');
      expect(facade.clasesPracticas()).toEqual([]);
      expect(facade.isLoading()).toBe(true);
      await pending;
    });

    it('enterToday no descarta lo cargado si la fecha ya era hoy', async () => {
      await facade.initialize();
      (facade as any)._clasesPracticas.set([makeRow({ id: 1 })]);

      facade.enterToday();
      const pending = facade.initialize();

      expect(facade.isLoading()).toBe(false);
      expect(facade.clasesPracticas()).toHaveLength(1);
      await pending;
    });

    it('una respuesta vieja que llega tarde no pisa a la más nueva', async () => {
      let resolveOld: (rows: ClasePracticaRow[]) => void = () => undefined;
      const fetchPracticas = vi
        .spyOn(facade as any, 'fetchPracticas')
        .mockImplementationOnce(() => new Promise((resolve) => (resolveOld = resolve)))
        .mockResolvedValueOnce([makeRow({ id: 2, alumnoName: 'Nueva' })]);
      vi.spyOn(facade as any, 'fetchAlertas').mockResolvedValue([]);

      const old = (facade as any).fetchData();
      await (facade as any).fetchData();
      resolveOld([makeRow({ id: 1, alumnoName: 'Vieja' })]);
      await old;

      expect(fetchPracticas).toHaveBeenCalledTimes(2);
      expect(facade.clasesPracticas().map((r) => r.alumnoName)).toEqual(['Nueva']);
    });
  });

  it('fix-373-m: la tasa solo considera clases registradas (las pendientes no cuentan)', () => {
    (facade as any).computeKpis(
      [
        makeRow({ id: 1, status: 'presente' }),
        makeRow({ id: 2, status: 'pendiente' }),
        makeRow({ id: 3, status: 'pendiente' }),
        makeRow({ id: 4, status: 'ausente' }),
      ],
      [],
    );
    expect(facade.kpis()?.tasaAsistencia).toBe(50);
    (facade as any).computeKpis([makeRow({ status: 'pendiente' })], []);
    expect(facade.kpis()?.tasaAsistencia).toBe(100);
  });

  it('fix-369-m: la tabla del día filtra la matrícula en la BD (!inner) y ordena por hora agendada', async () => {
    mock.setResult('class_b_sessions', []);
    await facade.initialize();
    const b = mock.builderFor('class_b_sessions');
    const selects = b.select.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(selects.some((s: string) => s.includes('enrollments!inner('))).toBe(true);
    const orders = b.order.mock.calls.map((c: unknown[]) => c[0]);
    expect(orders).toContain('scheduled_at');
    expect(orders).not.toContain('start_time');
  });

  it('fetchPracticas consulta el día de Chile como rango semiabierto a las 23:30 (spec 0024-m)', async () => {
    mock.setResult('class_b_sessions', []);
    mock.setResult('class_b_practice_attendance', []);
    // 23:30 hora Chile del 6 de octubre: en UTC ya es el día 7.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T02:30:00.000Z'));
    facade.setDate('2026-10-06');

    await facade.initialize();
    vi.useRealTimers();

    const sessionsBuilder = mock.builderFor('class_b_sessions');
    expect(sessionsBuilder.gte).toHaveBeenCalledWith('scheduled_at', '2026-10-06T03:00:00.000Z');
    expect(sessionsBuilder.lt).toHaveBeenCalledWith('scheduled_at', '2026-10-07T03:00:00.000Z');
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

  describe('fix-365-m: horarioActivo sale de las clases futuras, no de la clase de la falta', () => {
    const falta = {
      id: 1,
      student_id: 5,
      status: 'absent',
      recorded_at: '2026-10-01T15:00:00.000Z',
      class_b_sessions: {
        id: 100,
        enrollment_id: 10,
        status: 'no_show',
        scheduled_at: '2026-10-01T12:00:00.000Z',
        enrollments: {
          id: 10,
          branch_id: 1,
          status: 'active',
          students: { id: 5, users: { first_names: 'Juan', paternal_last_name: 'Pérez' } },
        },
      },
    };

    it('horario eliminado (solo canceladas futuras) → sigue en false tras recargar', async () => {
      mock.setResult('class_b_practice_attendance', [falta, { ...falta, id: 2 }]);
      mock.setResult('class_b_sessions', [
        { enrollment_id: 10, status: 'cancelled' },
        { enrollment_id: 10, status: 'cancelled' },
      ]);

      await facade.initialize();

      expect(facade.alertas()[0].horarioActivo).toBe(false);
      const b = mock.builderFor('class_b_sessions');
      expect(b.in).toHaveBeenCalledWith('enrollment_id', [10]);
      expect(b.in).toHaveBeenCalledWith('status', ['scheduled', 'cancelled']);
      expect(b.gt).toHaveBeenCalledWith('scheduled_at', expect.any(String));
    });

    it('con clases futuras agendadas → horario activo', async () => {
      mock.setResult('class_b_practice_attendance', [falta]);
      mock.setResult('class_b_sessions', [
        { enrollment_id: 10, status: 'cancelled' },
        { enrollment_id: 10, status: 'scheduled' },
      ]);

      await facade.initialize();

      expect(facade.alertas()[0].horarioActivo).toBe(true);
    });

    it('sin clases futuras → horario activo (no hay nada que reactivar)', async () => {
      mock.setResult('class_b_practice_attendance', [falta]);
      mock.setResult('class_b_sessions', []);

      await facade.initialize();

      expect(facade.alertas()[0].horarioActivo).toBe(true);
    });
  });

  describe('fix-379-m: la alerta roja exige faltas seguidas, como el Dashboard y la RPC', () => {
    const falta = (id: number, classNumber: number, scheduledAt: string, recordedAt: string) => ({
      id,
      student_id: 5,
      status: 'absent',
      recorded_at: recordedAt,
      class_b_sessions: {
        id: 100 + id,
        enrollment_id: 10,
        class_number: classNumber,
        status: 'no_show',
        scheduled_at: scheduledAt,
        enrollments: {
          id: 10,
          branch_id: 1,
          status: 'active',
          students: { id: 5, users: { first_names: 'Juan', paternal_last_name: 'Pérez' } },
        },
      },
    });

    it('faltas 2 y 5 (no seguidas) → amarilla, aunque sean 2', async () => {
      mock.setResult('class_b_practice_attendance', [
        falta(1, 5, '2026-10-08T10:00:00.000Z', '2026-10-12T20:00:00.000Z'),
        falta(2, 2, '2026-10-02T10:00:00.000Z', '2026-10-12T20:00:00.000Z'),
      ]);
      mock.setResult('class_b_sessions', []);

      await facade.initialize();

      expect(facade.alertas()[0]).toMatchObject({ faltasConsecutivas: 2, nivel: 'warning' });
    });

    it('faltas 3 y 4 (seguidas) → roja', async () => {
      mock.setResult('class_b_practice_attendance', [
        falta(1, 4, '2026-10-09T10:00:00.000Z', '2026-10-12T20:00:00.000Z'),
        falta(2, 3, '2026-10-07T10:00:00.000Z', '2026-10-12T20:00:00.000Z'),
      ]);
      mock.setResult('class_b_sessions', []);

      await facade.initialize();

      expect(facade.alertas()[0].nivel).toBe('danger');
      const selects = mock
        .builderFor('class_b_practice_attendance')
        .select.mock.calls.map((c: unknown[]) => String(c[0]));
      expect(selects.some((s: string) => s.includes('class_number'))).toBe(true);
    });

    it('la última falta es la fecha de la clase, no la del registro', async () => {
      mock.setResult('class_b_practice_attendance', [
        falta(1, 3, '2026-10-07T10:00:00.000Z', '2026-10-12T20:00:00.000Z'),
        falta(2, 4, '2026-10-09T10:00:00.000Z', '2026-10-11T20:00:00.000Z'),
      ]);
      mock.setResult('class_b_sessions', []);

      await facade.initialize();

      expect(facade.alertas()[0].ultimaFechaFalta).toBe('2026-10-09T10:00:00.000Z');
    });

    it('justifyAbsence recalcula las alertas sin recargar', async () => {
      (facade as any)._clasesPracticas.set([makeRow({ status: 'ausente' })]);
      mock.setResult('enrollments:single', { student_id: 5 });
      mock.setResult('class_b_practice_attendance', [
        { id: 9, recorded_at: '2026-10-09T13:00:00.000Z' },
      ]);
      const refresh = vi
        .spyOn(facade as any, 'refreshAlertasSilently')
        .mockResolvedValue(undefined);

      await facade.justifyAbsence(1, 'Licencia médica');

      expect(refresh).toHaveBeenCalled();
    });

    it('justificar una falta que ya canceló clases avisa que siguen canceladas (G05)', async () => {
      (facade as any)._clasesPracticas.set([makeRow({ status: 'ausente' })]);
      mock.setResult('enrollments:single', { student_id: 5 });
      mock.setResult('class_b_practice_attendance', [
        { id: 9, recorded_at: '2026-10-09T13:00:00.000Z' },
      ]);
      mock.setResult('class_b_sessions', [], null, 8);
      vi.spyOn(facade as any, 'refreshAlertasSilently').mockResolvedValue(undefined);

      await facade.justifyAbsence(1, 'Licencia médica');

      expect(toast.success).toHaveBeenCalledWith('Justificación registrada');
      expect(toast.warning).toHaveBeenCalledWith(
        'Las clases canceladas no vuelven solas',
        expect.stringContaining('8 clase(s)'),
      );
    });

    it('justificar una falta sin cancelaciones posteriores no avisa nada más', async () => {
      (facade as any)._clasesPracticas.set([makeRow({ status: 'ausente' })]);
      mock.setResult('enrollments:single', { student_id: 5 });
      mock.setResult('class_b_practice_attendance', [
        { id: 9, recorded_at: '2026-10-09T13:00:00.000Z' },
      ]);
      mock.setResult('class_b_sessions', [], null, 0);
      vi.spyOn(facade as any, 'refreshAlertasSilently').mockResolvedValue(undefined);

      await facade.justifyAbsence(1, 'Licencia médica');

      expect(toast.warning).not.toHaveBeenCalled();
    });
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
        // fix-379-m: el riesgo lo dice el nivel (faltas seguidas), no el conteo.
        nivel: faltasConsecutivas >= 2 ? 'danger' : 'warning',
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

    it('fix-371-m: markAttendance no registra ausente una clase cuya hora no llegó', async () => {
      const enUnaHora = new Date(Date.now() + 3_600_000).toISOString();
      (facade as any)._clasesPracticas.set([makeRow({ scheduledAt: enUnaHora })]);
      await facade.markAttendance(1, 'ausente');
      expect(mock.builderFor('class_b_practice_attendance').upsert).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith(
        'La clase todavía no empieza',
        'La inasistencia se registra después de la hora agendada.',
      );
      expect(facade.clasesPracticas()[0].status).toBe('pendiente');
    });

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
      expect(mock.builderFor('class_b_practice_attendance').upsert).not.toHaveBeenCalled();
    });

    it('fix-388-m: si la asistencia falla, la sesión vuelve a quedar pendiente', async () => {
      (facade as any)._clasesPracticas.set([makeRow()]);
      mock.setResult('enrollments:single', { student_id: 5 });
      mock.setResult('class_b_sessions', [{ id: 1 }]);
      mock
        .builderFor('class_b_practice_attendance')
        .upsert.mockResolvedValueOnce({ data: null, error: rlsError });

      await facade.markAttendance(1, 'ausente');

      const updates = mock
        .builderFor('class_b_sessions')
        .update.mock.calls.map((c: unknown[]) => (c[0] as { status: string }).status);
      expect(updates).toEqual(['no_show', 'scheduled']);
      expect(toast.warning).not.toHaveBeenCalled();
    });

    it('fix-388-m: si tampoco se pudo devolver a pendiente, lo avisa', async () => {
      (facade as any)._clasesPracticas.set([makeRow()]);
      mock.setResult('enrollments:single', { student_id: 5 });
      const b = mock.builderFor('class_b_sessions');
      // 1ª lectura = el cambio a ausente (1 fila); 2ª = la reversión, que falla.
      const original = b.then;
      let reads = 0;
      b.then = (resolve: any) =>
        resolve(
          reads++ === 0 ? { data: [{ id: 1 }], error: null } : { data: null, error: rlsError },
        );
      mock
        .builderFor('class_b_practice_attendance')
        .upsert.mockResolvedValueOnce({ data: null, error: rlsError });

      await facade.markAttendance(1, 'ausente');
      b.then = original;

      expect(toast.warning).toHaveBeenCalledWith(
        'La clase quedó como ausente sin su registro',
        expect.stringContaining('avisa al administrador'),
      );
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('permisos'));
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
      mock.setResult('class_b_sessions', [{ id: 1 }]);
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
      mock.setResult('class_b_sessions', [{ id: 1 }]);
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
      mock.setResult('class_b_sessions', [{ id: 1 }]);
      mock.setResult('vehicles', [{ id: 7 }]);

      await facade.finishClass(finishPayload);

      expect(toast.warning).not.toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith('Clase finalizada', 'Asistencia registrada.');
    });
  });

  describe('fix-364-m: acciones sobre el horario', () => {
    const NOW = '2026-10-07T15:00:00.000Z';

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(NOW));
      (facade as any)._alertas.set([makeAlerta({ nivel: 'danger', horarioActivo: false })]);
    });

    afterEach(() => vi.useRealTimers());

    /** Respuestas sucesivas de class_b_sessions: 1ª = búsqueda, 2ª = escritura. */
    const mockSessionResponses = (...responses: Array<{ data: any; error: any }>) => {
      let call = 0;
      mock.builderFor('class_b_sessions').then = (resolve: any) =>
        resolve(responses[Math.min(call++, responses.length - 1)]);
    };

    it('reactivateSchedule busca solo las clases canceladas futuras', async () => {
      mock.setResult('class_b_sessions', []);

      await facade.reactivateSchedule(10);

      const b = mock.builderFor('class_b_sessions');
      expect(b.eq).toHaveBeenCalledWith('enrollment_id', 10);
      expect(b.eq).toHaveBeenCalledWith('status', 'cancelled');
      expect(b.gt).toHaveBeenCalledWith('scheduled_at', NOW);
    });

    it('reactivateSchedule sin clases futuras avisa y no reactiva nada', async () => {
      mock.setResult('class_b_sessions', []);

      await facade.reactivateSchedule(10);

      expect(confirmModal.confirm).not.toHaveBeenCalled();
      expect(mock.builderFor('class_b_sessions').update).not.toHaveBeenCalled();
      expect(toast.info).toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
      expect(facade.alertas()[0].horarioActivo).toBe(false);
    });

    it('reactivateSchedule pide confirmación con la cantidad y el alumno', async () => {
      confirmModal.confirm.mockResolvedValue(false);
      mock.setResult('class_b_sessions', [{ id: 7 }, { id: 8 }]);

      await facade.reactivateSchedule(10);

      const config = confirmModal.confirm.mock.calls[0][0];
      expect(config.message).toContain('2 clases futuras');
      expect(config.message).toContain('Juan Pérez');
      expect(mock.builderFor('class_b_sessions').update).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    });

    it('reactivateSchedule al confirmar reactiva por id y marca el horario activo', async () => {
      mock.setResult('class_b_sessions', [{ id: 7 }, { id: 8 }]);

      await facade.reactivateSchedule(10);

      const b = mock.builderFor('class_b_sessions');
      expect(b.update).toHaveBeenCalledWith({ status: 'scheduled', cancelled_at: null });
      expect(b.in).toHaveBeenCalledWith('id', [7, 8]);
      expect(toast.success).toHaveBeenCalledWith('Horario reactivado');
      expect(facade.alertas()[0].horarioActivo).toBe(true);
      expect(facade.savingAlertaId()).toBeNull();
    });

    it('reactivateSchedule muestra el mensaje del trigger si un horario ya está ocupado', async () => {
      const mensaje = 'El instructor ya tiene una clase agendada que se solapa con este horario.';
      mockSessionResponses(
        { data: [{ id: 7 }], error: null },
        { data: null, error: { code: 'P0001', message: mensaje } },
      );

      await facade.reactivateSchedule(10);

      expect(toast.error).toHaveBeenCalledWith('No se pudo reactivar el horario', mensaje);
      expect(toast.success).not.toHaveBeenCalled();
      expect(facade.alertas()[0].horarioActivo).toBe(false);
    });

    it('removeSchedule cancela solo clases agendadas futuras', async () => {
      (facade as any)._alertas.set([makeAlerta({ nivel: 'danger', horarioActivo: true })]);
      mock.setResult('class_b_sessions', [{ id: 7 }]);

      await facade.removeSchedule(10);

      const b = mock.builderFor('class_b_sessions');
      expect(confirmModal.confirm).toHaveBeenCalled();
      expect(b.eq).toHaveBeenCalledWith('status', 'scheduled');
      expect(b.gt).toHaveBeenCalledWith('scheduled_at', NOW);
      expect(toast.success).toHaveBeenCalledWith('Horario eliminado');
      expect(facade.alertas()[0].horarioActivo).toBe(false);
    });

    it('removeSchedule sin clases futuras no dice "Horario eliminado"', async () => {
      (facade as any)._alertas.set([makeAlerta({ nivel: 'danger', horarioActivo: true })]);
      mock.setResult('class_b_sessions', []);

      await facade.removeSchedule(10);

      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.info).toHaveBeenCalled();
      expect(facade.alertas()[0].horarioActivo).toBe(true);
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

  it('fix-380-m: el recordatorio habla de faltas sin justificar y concuerda en número', async () => {
    (facade as any)._alertas.set([makeAlerta({ faltasConsecutivas: 1 })]);
    mock.setResult('students:single', { user_id: 77 });
    await facade.sendReminder(10);
    expect(notifications.notifyUsers.mock.calls[0][1].message).toContain(
      'Registramos 1 falta sin justificar',
    );

    (facade as any)._alertas.set([makeAlerta({ faltasConsecutivas: 2 })]);
    await facade.sendReminder(10);
    expect(notifications.notifyUsers.mock.calls[1][1].message).toContain(
      'Registramos 2 faltas sin justificar',
    );
  });

  it('fix-380-m: en el piloto (portal Alumno bloqueado) los recordatorios no se ofrecen', () => {
    expect(facade.recordatoriosHabilitados).toBe(false);
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

  describe('fix-374-m: markAttendance sin la clase en la tabla del día (desde el Dashboard)', () => {
    it('lee la clase de la BD y registra la falta', async () => {
      (facade as any)._clasesPracticas.set([]);
      mock.setResult('class_b_sessions:maybeSingle', {
        enrollment_id: 10,
        scheduled_at: '2026-06-30T13:00:00.000Z',
      });
      mock.setResult('enrollments:single', { student_id: 5 });
      mock.setResult('class_b_sessions', [{ id: 77 }]);

      const ok = await facade.markAttendance(77, 'ausente');

      expect(ok).toBe(true);
      expect(mock.builderFor('class_b_practice_attendance').upsert).toHaveBeenCalledWith(
        expect.objectContaining({ class_b_session_id: 77, student_id: 5, status: 'absent' }),
        expect.anything(),
      );
    });

    it('si la clase no existe, no escribe y devuelve false', async () => {
      (facade as any)._clasesPracticas.set([]);
      expect(await facade.markAttendance(77, 'ausente')).toBe(false);
      expect(mock.builderFor('class_b_practice_attendance').upsert).not.toHaveBeenCalled();
    });
  });

  describe('fix-377-m: undoAbsence', () => {
    beforeEach(() => {
      (facade as any)._clasesPracticas.set([makeRow({ id: 1, status: 'ausente' })]);
    });

    it('archiva la falta y devuelve la clase a scheduled', async () => {
      mock.setResult('class_b_practice_attendance:maybeSingle', {
        id: 900,
        status: 'absent',
        recorded_at: '2026-06-30T15:00:00.000Z',
      });
      mock.setResult('class_b_practice_attendance', [{ id: 900 }]);
      mock.setResult('class_b_sessions', [{ id: 1 }]);

      expect(await facade.undoAbsence(1)).toBe(true);

      const att = mock.builderFor('class_b_practice_attendance');
      expect(att.update).toHaveBeenCalledWith({ archived_at: expect.any(String) });
      const ses = mock.builderFor('class_b_sessions');
      expect(ses.update).toHaveBeenCalledWith({ status: 'scheduled' });
      expect(ses.eq).toHaveBeenCalledWith('status', 'no_show');
      expect(toast.success).toHaveBeenCalledWith(
        'Inasistencia deshecha',
        'La clase quedó pendiente.',
      );
    });

    it('si la falta ya canceló clases por penalización, lo avisa (no vuelven solas)', async () => {
      mock.setResult('class_b_practice_attendance:maybeSingle', {
        id: 900,
        status: 'absent',
        recorded_at: '2026-06-30T15:00:00.000Z',
      });
      mock.setResult('class_b_practice_attendance', [{ id: 900 }]);
      mock.setResult('class_b_sessions', [{ id: 1 }], null, 8);

      expect(await facade.undoAbsence(1)).toBe(true);
      expect(mock.builderFor('class_b_sessions').gte).toHaveBeenCalledWith(
        'cancelled_at',
        '2026-06-30T15:00:00.000Z',
      );
      expect(toast.warning).toHaveBeenCalledWith(
        'Clases canceladas por la penalización',
        expect.stringContaining('8 clase(s)'),
      );
    });

    it('una falta justificada no se deshace', async () => {
      mock.setResult('class_b_practice_attendance:maybeSingle', {
        id: 900,
        status: 'excused',
        recorded_at: '2026-06-30T15:00:00.000Z',
      });
      expect(await facade.undoAbsence(1)).toBe(false);
      expect(mock.builderFor('class_b_practice_attendance').update).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith(
        'No se puede deshacer',
        'La inasistencia está justificada.',
      );
    });

    it('sin confirmar no hace nada', async () => {
      confirmModal.confirm.mockResolvedValueOnce(false);
      expect(await facade.undoAbsence(1)).toBe(false);
      expect(mock.builderFor('class_b_practice_attendance').update).not.toHaveBeenCalled();
    });
  });

  describe('fix-378-m: cancelStart', () => {
    it('vuelve la clase en curso a scheduled sin hora ni km de inicio', async () => {
      (facade as any)._clasesPracticas.set([makeRow({ id: 1, status: 'en_curso' })]);
      mock.setResult('class_b_sessions', [{ id: 1 }]);

      expect(await facade.cancelStart(1)).toBe(true);

      const ses = mock.builderFor('class_b_sessions');
      expect(ses.update).toHaveBeenCalledWith({
        status: 'scheduled',
        start_time: null,
        km_start: null,
      });
      expect(ses.eq).toHaveBeenCalledWith('status', 'in_progress');
      expect(toast.success).toHaveBeenCalledWith('Inicio cancelado', 'La clase quedó pendiente.');
    });

    it('si la clase ya no está en curso (0 filas), avisa el error', async () => {
      (facade as any)._clasesPracticas.set([makeRow({ id: 1, status: 'en_curso' })]);
      mock.setResult('class_b_sessions', []);
      expect(await facade.cancelStart(1)).toBe(false);
      expect(toast.error).toHaveBeenCalled();
    });
  });

  describe('fix-388-m: la clase ya no está en el estado que se veía', () => {
    const finishPayload = {
      sessionId: 1,
      studentId: 5,
      kmEnd: 12050,
      studentSignature: null,
      instructorSignature: null,
    };

    /** El UPDATE condicionado no toca filas y la clase está en `actual`. */
    function sessionIs(actual: string): void {
      mock.setResult('class_b_sessions', []);
      mock.setResult('class_b_sessions:maybeSingle', { status: actual });
    }

    it('startClass filtra por estado pendiente', async () => {
      mock.setResult('class_b_sessions', [{ id: 1 }]);
      await facade.startClass(1, 12000);
      expect(mock.builderFor('class_b_sessions').eq).toHaveBeenCalledWith('status', 'scheduled');
    });

    it('startClass sobre una clase que otra persona ya inició: avisa, no dice "iniciada" y recarga', async () => {
      (facade as any)._clasesPracticas.set([makeRow()]);
      sessionIs('in_progress');
      const refresh = vi.spyOn(facade as any, 'refreshSilently').mockResolvedValue(undefined);

      await expect(facade.startClass(1, 12000)).rejects.toThrow('ya fue iniciada');

      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.warning).toHaveBeenCalledWith(
        'La clase cambió',
        expect.stringContaining('ya fue iniciada'),
      );
      expect(refresh).toHaveBeenCalled();
      expect(facade.clasesPracticas()[0].status).toBe('pendiente');
    });

    it('startClass sobre una clase con inasistencia manda a deshacerla', async () => {
      sessionIs('no_show');
      vi.spyOn(facade as any, 'refreshSilently').mockResolvedValue(undefined);
      await expect(facade.startClass(1, 12000)).rejects.toThrow('deshaz la inasistencia');
    });

    it('marcar ausente una clase en curso no escribe la asistencia', async () => {
      (facade as any)._clasesPracticas.set([makeRow()]);
      mock.setResult('enrollments:single', { student_id: 5 });
      sessionIs('in_progress');
      vi.spyOn(facade as any, 'refreshSilently').mockResolvedValue(undefined);

      expect(await facade.markAttendance(1, 'ausente')).toBe(false);

      expect(mock.builderFor('class_b_practice_attendance').upsert).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
      expect(toast.warning).toHaveBeenCalledWith(
        'La clase cambió',
        expect.stringContaining('Cancelar inicio'),
      );
      expect(mock.client.rpc).not.toHaveBeenCalled();
    });

    it('marcar ausente una clase que ya está ausente no es un error', async () => {
      (facade as any)._clasesPracticas.set([makeRow()]);
      mock.setResult('enrollments:single', { student_id: 5 });
      sessionIs('no_show');
      const refresh = vi.spyOn(facade as any, 'refreshSilently').mockResolvedValue(undefined);

      expect(await facade.markAttendance(1, 'ausente')).toBe(true);

      expect(mock.builderFor('class_b_practice_attendance').upsert).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
      expect(toast.info).toHaveBeenCalledWith('La inasistencia ya estaba registrada');
      expect(refresh).toHaveBeenCalled();
    });

    it('finishClass filtra por estado en curso', async () => {
      (facade as any)._selectedPractica.set(makeRow({ status: 'en_curso' }));
      mock.setResult('class_b_sessions', [{ id: 1 }]);
      await facade.finishClass(finishPayload);
      expect(mock.builderFor('class_b_sessions').eq).toHaveBeenCalledWith('status', 'in_progress');
    });

    it('finishClass sobre una clase que ya no está en curso no toca vehículo ni asistencia', async () => {
      (facade as any)._clasesPracticas.set([makeRow({ status: 'en_curso', vehicleId: 7 })]);
      (facade as any)._selectedPractica.set(makeRow({ status: 'en_curso', vehicleId: 7 }));
      sessionIs('scheduled');
      vi.spyOn(facade as any, 'refreshSilently').mockResolvedValue(undefined);

      await expect(facade.finishClass(finishPayload)).rejects.toThrow('volvió a quedar pendiente');

      expect(mock.client.from).not.toHaveBeenCalledWith('vehicles');
      expect(mock.builderFor('class_b_practice_attendance').upsert).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
      expect(facade.clasesPracticas()[0].status).toBe('en_curso');
    });
  });

  describe('startClass', () => {
    it('actualiza la sesión y muestra toast de éxito', async () => {
      mock.setResult('class_b_sessions', [{ id: 1 }], null);

      await facade.startClass(1, 12000);

      expect(toast.success).toHaveBeenCalledWith('Clase iniciada');
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('fix-370-m: guarda la hora de Chile y recarga la tabla (vehículo y KPIs desde la BD)', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-10-11T17:30:44.000Z')); // 14:30:44 en Chile
      mock.setResult('class_b_sessions', [{ id: 1 }]);
      const b = mock.builderFor('class_b_sessions');
      b.select.mockClear();

      await facade.startClass(1, 12000, 5);
      vi.useRealTimers();

      const payload = b.update.mock.calls.at(-1)[0];
      expect(payload.start_time).toBe('14:30:44');
      expect(payload.vehicle_id).toBe(5);
      // refreshSilently → vuelve a leer la tabla del día
      expect(b.select).toHaveBeenCalled();
      expect(facade.kpis()).not.toBeNull();
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
