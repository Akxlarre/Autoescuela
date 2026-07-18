import { TestBed } from '@angular/core/testing';
import { AgendaFacade } from './agenda.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from './auth.facade';

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

  beforeEach(() => {
    supabaseSpy = makeFlexibleSupabaseMock();
    authFacadeSpy = { currentUser: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        AgendaFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: AuthFacade, useValue: authFacadeSpy },
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

  it('setSelectedSlot should update selectedSlot signal', () => {
    const slot = { id: 'test' } as any;
    facade.setSelectedSlot(slot);
    expect(facade.selectedSlot()).toBe(slot);
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
});
