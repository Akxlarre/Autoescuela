import { TestBed } from '@angular/core/testing';
import { AgendaFacade } from './agenda.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from './auth.facade';
import { BranchFacade } from './branch.facade';
import { AgendaSettingsService } from '@core/services/ui/agenda-settings.service';
import { addDaysToIso } from '@core/utils/agenda-week.utils';

/**
 * Builder de cadena Supabase genérico y "thenable": cualquier método
 * (.select/.eq/.gte/.lt/.order/.in/.neq/...) devuelve la misma cadena, y
 * awaitear la cadena resuelve con la data configurada para esa tabla — sin
 * tener que adivinar la secuencia exacta de métodos que usa cada query real.
 */
function makeFlexibleSupabaseMock() {
  const results = new Map<string, { data: any; error: any }>();
  const builders = new Map<string, any>();

  function getBuilder(table: string): any {
    if (builders.has(table)) return builders.get(table);
    const b: any = {
      select: vi.fn(() => b),
      eq: vi.fn(() => b),
      neq: vi.fn(() => b),
      gte: vi.fn(() => b),
      lt: vi.fn(() => b),
      lte: vi.fn(() => b),
      gt: vi.fn(() => b),
      in: vi.fn(() => b),
      order: vi.fn(() => b),
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
      channel: vi.fn(() => channelStub),
      removeChannel: vi.fn(),
    },
    setResult: (table: string, data: any, error: any = null) => results.set(table, { data, error }),
  };
}

describe('AgendaFacade', () => {
  let facade: AgendaFacade;
  let supabaseSpy: any;
  let authFacadeSpy: any;
  let branchFacadeSpy: any;

  beforeEach(() => {
    supabaseSpy = makeFlexibleSupabaseMock();
    authFacadeSpy = { currentUser: vi.fn().mockReturnValue({ role: 'admin' }) };
    branchFacadeSpy = { selectedBranchId: vi.fn().mockReturnValue(null) };

    TestBed.configureTestingModule({
      providers: [
        AgendaFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: AuthFacade, useValue: authFacadeSpy },
        { provide: BranchFacade, useValue: branchFacadeSpy },
      ],
    });

    facade = TestBed.inject(AgendaFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should have initial state', () => {
    expect(facade.isLoading()).toBe(false);
    expect(facade.weekData()).toBeNull();
    expect(facade.isCurrentWeek()).toBe(true);
  });

  it('nextWeek and prevWeek should change weekStart', () => {
    const initial = facade.weekStart();
    facade.goToNextWeek();
    expect(facade.weekStart()).not.toBe(initial);
    facade.goToPrevWeek();
    expect(facade.weekStart()).toBe(initial);
  });

  it('request guard: descarta una respuesta de fetch obsoleta cuando hay navegación rápida encolada', async () => {
    let callIndex = 0;
    const origFrom = supabaseSpy.client.from;
    supabaseSpy.client.from = vi.fn((table: string) => {
      if (table !== 'v_class_b_schedule_availability') return origFrom(table);
      const callNumber = ++callIndex;
      const delayMs = callNumber === 1 ? 20 : 0; // el primer click resuelve DESPUÉS del segundo
      const builder: any = {
        select: () => builder,
        eq: () => builder,
        neq: () => builder,
        gte: () => builder,
        lt: () => builder,
        lte: () => builder,
        gt: () => builder,
        in: () => builder,
        order: () => builder,
        then: (resolve: any) => setTimeout(() => resolve({ data: [], error: null }), delayMs),
      };
      return builder;
    });

    const pendingFirstLoad = facade.loadWeek(); // fetch #1 (semana actual, resuelve en 20ms)
    facade.goToNextWeek(); // fetch #2 (semana siguiente, resuelve en 0ms) — dispara loadWeek() interno
    const expectedFinalWeekStart = facade.weekStart();

    await pendingFirstLoad;
    await new Promise((resolve) => setTimeout(resolve, 30));

    // La respuesta más reciente (#2) debe ganar aunque haya resuelto antes que la obsoleta (#1).
    expect(facade.weekData()?.weekStart).toBe(expectedFinalWeekStart);
  });

  describe('goToNextWeek — límite de semanas fantasma', () => {
    it('no avanza weekStart ni dispara fetch si la próxima semana ya excede el límite configurado', () => {
      const localSupabaseSpy = makeFlexibleSupabaseMock();
      const localAuthSpy = { currentUser: vi.fn().mockReturnValue({ role: 'admin' }) };
      const localBranchSpy = { selectedBranchId: vi.fn().mockReturnValue(null) };

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          AgendaFacade,
          { provide: SupabaseService, useValue: localSupabaseSpy },
          { provide: AuthFacade, useValue: localAuthSpy },
          { provide: BranchFacade, useValue: localBranchSpy },
        ],
      });

      const limitedFacade = TestBed.inject(AgendaFacade);
      const settings = TestBed.inject(AgendaSettingsService);
      const currentWeekStart = limitedFacade.weekStart();

      // Límite justo dentro de la semana actual: la próxima semana ya sería 100% fantasma.
      vi.spyOn(settings, 'maxVisibleDateIso').mockReturnValue(addDaysToIso(currentWeekStart, 3));

      limitedFacade.goToNextWeek();

      expect(limitedFacade.weekStart()).toBe(currentWeekStart);
      expect(limitedFacade.isLoading()).toBe(false);
    });
  });

  it('setSelectedSlot should update selectedSlot signal', () => {
    const slot = { id: 'test' } as any;
    facade.setSelectedSlot(slot);
    expect(facade.selectedSlot()).toBe(slot);
  });

  describe('goToDate — salto rápido a una fecha específica', () => {
    it('salta al lunes de la semana que contiene la fecha elegida (fecha entre semana)', () => {
      // 2026-09-16 es un miércoles → el lunes de esa semana es 2026-09-14.
      facade.goToDate('2026-09-16');
      expect(facade.weekStart()).toBe('2026-09-14');
    });

    it('si la fecha elegida ya es lunes, salta a esa misma fecha', () => {
      facade.goToDate('2026-09-14');
      expect(facade.weekStart()).toBe('2026-09-14');
    });

    it('resuelve correctamente una fecha en domingo (vuelve al lunes anterior)', () => {
      // 2026-09-20 es domingo → pertenece a la semana que empezó el 2026-09-14.
      facade.goToDate('2026-09-20');
      expect(facade.weekStart()).toBe('2026-09-14');
    });

    it('ignora un string vacío (no rompe ni cambia weekStart)', () => {
      const initial = facade.weekStart();
      facade.goToDate('');
      expect(facade.weekStart()).toBe(initial);
    });
  });

  describe('timeRows — baseline de jornada completa', () => {
    it('incluye las 13 filas del bloque horario base aunque la semana no tenga ninguna clase', async () => {
      // El mock por defecto (beforeEach) ya resuelve slots y sesiones vacíos.
      await facade.loadWeek();

      expect(facade.timeRows()).toEqual([
        '08:30',
        '09:20',
        '10:10',
        '11:00',
        '11:50',
        '12:40',
        '15:00',
        '15:50',
        '16:40',
        '17:30',
        '18:20',
        '19:10',
        '20:00',
      ]);
    });

    it('une el baseline con un horario real fuera del bloque estándar, sin perder ninguna fila base', async () => {
      supabaseSpy.setResult('class_b_sessions', [
        {
          id: 1,
          instructor_id: 1,
          vehicle_id: 1,
          enrollment_id: 1,
          class_number: 1,
          // 17:30 UTC = 13:30 America/Santiago (UTC-4 en horario estándar) — fuera del bloque base.
          scheduled_at: `${facade.weekStart()}T17:30:00Z`,
          status: 'scheduled',
          enrollments: {
            students: { users: { first_names: 'Ana', paternal_last_name: 'Soto' } },
          },
        },
      ]);

      await facade.loadWeek();

      const rows = facade.timeRows();
      // Las 13 filas base siguen presentes...
      expect(rows).toEqual(expect.arrayContaining(['08:30', '11:00', '15:00', '20:00']));
      // ...y la fila real fuera del bloque estándar se agrega, no reemplaza nada.
      expect(rows).toContain('13:30');
      expect(rows.length).toBe(14);
    });
  });

  describe('vehicleDocWarning — fix-164-m', () => {
    it('expone vehicleDocWarning por slot según vehicle_documents', async () => {
      supabaseSpy.setResult('v_class_b_schedule_availability', [
        {
          instructor_id: 1,
          vehicle_id: 10,
          slot_start: `${facade.weekStart()}T12:30:00Z`,
          slot_end: `${facade.weekStart()}T13:15:00Z`,
          slot_status: 'available',
        },
        {
          instructor_id: 1,
          vehicle_id: 20,
          slot_start: `${facade.weekStart()}T13:20:00Z`,
          slot_end: `${facade.weekStart()}T14:05:00Z`,
          slot_status: 'available',
        },
      ]);
      supabaseSpy.setResult('vehicle_documents', [
        { vehicle_id: 10, type: 'soap', expiry_date: '2020-01-01', status: null }, // expired
        { vehicle_id: 20, type: 'soap', expiry_date: '2099-01-01', status: null }, // valid
      ]);

      await facade.initialize();

      const allSlots = facade.filteredDays().flatMap((d) => d.slots);
      expect(allSlots.find((s) => s.vehicleId === 10)?.vehicleDocWarning).toEqual({
        expiredDocs: ['SOAP'],
        expiringSoonDocs: [],
      });
      expect(allSlots.find((s) => s.vehicleId === 20)?.vehicleDocWarning).toBeNull();
    });
  });

  describe('loadInstructors (vía initialize) — fix-010-i, H-010', () => {
    it('re-ancla selectedInstructorId al cambiar de sede, en vez de dejar pegado el id de la sede anterior', async () => {
      supabaseSpy.setResult('instructors', [
        { id: 1, users: { first_names: 'Juan', paternal_last_name: 'Pérez' } },
      ]);
      branchFacadeSpy.selectedBranchId.mockReturnValue(1);

      await facade.initialize();
      expect(facade.selectedInstructorId()).toBe(1);

      // Cambia de sede — nueva lista de instructores, sin overlap de ids con la anterior.
      supabaseSpy.setResult('instructors', [
        { id: 7, users: { first_names: 'Camila', paternal_last_name: 'Rojas' } },
      ]);
      branchFacadeSpy.selectedBranchId.mockReturnValue(2);

      await facade.initialize();

      // Antes del fix: quedaba en 1 (id de la sede anterior, inexistente en la sede nueva),
      // haciendo que el selector no encontrara la opción y mostrara "Todos los instructores"
      // mientras la grilla seguía filtrando por el instructor de la sede vieja.
      expect(facade.selectedInstructorId()).toBe(7);
    });

    it('deja selectedInstructorId en null si la nueva sede no tiene instructores', async () => {
      supabaseSpy.setResult('instructors', [
        { id: 1, users: { first_names: 'Juan', paternal_last_name: 'Pérez' } },
      ]);
      branchFacadeSpy.selectedBranchId.mockReturnValue(1);
      await facade.initialize();
      expect(facade.selectedInstructorId()).toBe(1);

      supabaseSpy.setResult('instructors', []);
      branchFacadeSpy.selectedBranchId.mockReturnValue(2);
      await facade.initialize();

      expect(facade.selectedInstructorId()).toBeNull();
    });
  });
});
