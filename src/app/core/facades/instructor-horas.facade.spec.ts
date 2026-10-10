import { TestBed } from '@angular/core/testing';
import { InstructorHorasFacade } from './instructor-horas.facade';
import { InstructorProfileFacade } from './instructor-profile.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

describe('InstructorHorasFacade', () => {
  let facade: InstructorHorasFacade;
  let supabaseMock: any;
  let profileMock: any;

  function createChainMock(resolvedValue: any = { data: [], error: null }) {
    const chain: any = {};
    const methods = ['select', 'eq', 'in', 'gte', 'lt', 'lte', 'order', 'limit', 'not'];
    for (const m of methods) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
    // La consulta se puede esperar en cualquier eslabón, igual que el cliente real.
    chain.then = (resolve: (value: any) => void) => resolve(resolvedValue);
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
        InstructorHorasFacade,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: InstructorProfileFacade, useValue: profileMock },
      ],
    });

    facade = TestBed.inject(InstructorHorasFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  describe('hora de Chile — spec 0024-m', () => {
    function rangeChain(rows: any[]) {
      const chain: any = {};
      for (const m of ['select', 'eq', 'gte', 'lt']) chain[m] = vi.fn().mockReturnValue(chain);
      chain.order = vi.fn().mockResolvedValue({ data: rows, error: null });
      return chain;
    }

    const session = (scheduledAt: string) => ({
      id: 1,
      scheduled_at: scheduledAt,
      start_time: null,
      end_time: null,
      duration_min: 45,
      status: 'scheduled',
      class_number: 3,
      enrollments: null,
      vehicles: null,
    });

    afterEach(() => vi.useRealTimers());

    it('fetchWeeklySchedule pide la semana de Chile como rango semiabierto, también un lunes', async () => {
      const chain = rangeChain([]);
      supabaseMock.client.from.mockReturnValue(chain);

      await facade.fetchWeeklySchedule('2026-10-05'); // lunes

      expect(chain.gte).toHaveBeenCalledWith('scheduled_at', '2026-10-05T03:00:00.000Z');
      expect(chain.lt).toHaveBeenCalledWith('scheduled_at', '2026-10-12T03:00:00.000Z');
      const schedule = facade.weeklySchedule()!;
      expect(schedule.days.map((d) => d.date)).toEqual([
        '2026-10-05',
        '2026-10-06',
        '2026-10-07',
        '2026-10-08',
        '2026-10-09',
        '2026-10-10',
        '2026-10-11',
      ]);
      expect(schedule.weekLabel).toBe('5 Oct - 11 Oct 2026');
    });

    it('una clase a las 21:30 hora Chile cae en su día y hora de Chile, no en los de UTC', async () => {
      // 23:30 hora Chile del martes 6: en UTC ya es miércoles 7.
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-10-07T02:30:00.000Z'));
      // 21:30 hora Chile del martes 6 = 00:30 UTC del miércoles 7.
      supabaseMock.client.from.mockReturnValue(rangeChain([session('2026-10-07T00:30:00+00:00')]));

      await facade.fetchWeeklySchedule('2026-10-06');

      const schedule = facade.weeklySchedule()!;
      expect(schedule.blocks[0]).toMatchObject({
        dayOfWeek: 1, // martes
        hour: 21,
        minuteStart: 30,
        startTime: '21:30',
        endTime: '22:15',
      });
      expect(schedule.days[1]).toMatchObject({ date: '2026-10-06', dayNumber: 6, isToday: true });
      expect(schedule.days[2].isToday).toBe(false);
      expect(schedule.kpis.clasesHoy).toBe(1);
    });

    it('fetchSessionDetailsForPeriod pide el mes de Chile y muestra la hora de Chile', async () => {
      // 23:30 hora Chile del 30 de junio = 03:30 UTC del 1 de julio (invierno, UTC-4).
      const chain = rangeChain([session('2026-07-01T03:30:00+00:00')]);
      supabaseMock.client.from.mockReturnValue(chain);

      await facade.fetchSessionDetailsForPeriod('2026-06');

      expect(chain.gte).toHaveBeenCalledWith('scheduled_at', '2026-06-01T04:00:00.000Z');
      expect(chain.lt).toHaveBeenCalledWith('scheduled_at', '2026-07-01T04:00:00.000Z');
      expect(facade.sessionDetails()[0].startTime).toBe('23:30');
    });

    it('la meta y el registro del mes usan el mes de Chile a las 23:30 del último día', async () => {
      // 23:30 hora Chile del 30 de junio = 03:30 UTC del 1 de julio.
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-07-01T03:30:00.000Z'));
      const chain = createChainMock({
        data: [
          { id: 1, status: 'completed', duration_min: 60, scheduled_at: '2026-07-01T02:00:00Z' },
        ],
        error: null,
      });
      supabaseMock.client.from.mockReturnValue(chain);

      await (facade as any).fetchMonthlyTarget();

      expect(chain.gte).toHaveBeenCalledWith('scheduled_at', '2026-06-01T04:00:00.000Z');
      expect(chain.lt).toHaveBeenCalledWith('scheduled_at', '2026-07-01T04:00:00.000Z');
      // Día 30 de 30: lo proyectado es igual a lo completado.
      expect(facade.monthlyTarget()).toMatchObject({ completedHours: 1, projectedHours: 1 });

      await (facade as any).fetchSessionsLog();

      expect(facade.error()).toBeNull();
      expect(facade.sessionsLog()).toEqual([
        expect.objectContaining({ date: '2026-06-30', quantity: 1, hours: 1 }),
      ]);
    });
  });

  it('should initialize with default state', () => {
    expect(facade.monthlyHours()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
    expect(facade.error()).toBeNull();
    expect(facade.liquidacionKpis().horasPracticaMes).toBe(0);
  });

  it('initialize should set loading and fetch data', async () => {
    await facade.initialize();
    expect(profileMock.getInstructorId).toHaveBeenCalled();
    expect(supabaseMock.client.from).toHaveBeenCalledWith('instructor_monthly_hours');
    expect(supabaseMock.client.from).toHaveBeenCalledWith('class_b_sessions');
  });

  it('initialize should use SWR on second call', async () => {
    await facade.initialize();
    const callCount = supabaseMock.client.from.mock.calls.length;
    await facade.initialize();
    expect(supabaseMock.client.from.mock.calls.length).toBeGreaterThan(callCount);
  });

  it('fetchMonthlyTarget should query class_b_sessions', async () => {
    await facade.fetchMonthlyTarget();
    const tables = supabaseMock.client.from.mock.calls.map((c: any) => c[0]);
    expect(tables).toContain('class_b_sessions');
  });

  it('fetchSessionsLog should query completed class_b_sessions', async () => {
    await facade.fetchSessionsLog();
    const tables = supabaseMock.client.from.mock.calls.map((c: any) => c[0]);
    expect(tables).toContain('class_b_sessions');
  });
});
