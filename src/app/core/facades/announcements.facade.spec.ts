import { TestBed } from '@angular/core/testing';
import { AnnouncementsFacade } from './announcements.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { BranchFacade } from '@core/facades/branch.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import type { AnnouncementDraft } from '@core/models/ui/announcement.model';

const DRAFT: AnnouncementDraft = {
  kind: 'operativo',
  subject: 'No hay clases el viernes',
  body: 'Por el feriado no habrá clases prácticas.',
  filters: { branchId: 1, courseType: 'class_b', enrollmentStatus: 'active' },
  excludedUserIds: [],
};

describe('AnnouncementsFacade', () => {
  let facade: AnnouncementsFacade;
  let supabaseSpy: any;
  let invokeSpy: any;
  let insertSelectSingle: any;
  let historialRows: any[];
  /** Lo que la facade manda al INSERT de `announcements`, para poder afirmarlo. */
  let insertPayload: any;

  /** Encadena el mock de PostgREST para las dos consultas que hace la facade. */
  function buildClient() {
    insertSelectSingle = vi.fn().mockResolvedValue({ data: { id: 77 }, error: null });
    invokeSpy = vi.fn();

    return {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'announcements') {
          return {
            insert: vi.fn().mockImplementation((payload: any) => {
              insertPayload = payload;
              return { select: vi.fn().mockReturnValue({ maybeSingle: insertSelectSingle }) };
            }),
            update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: historialRows, error: null }),
              }),
              order: vi.fn().mockResolvedValue({ data: historialRows, error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }),
      functions: { invoke: (...args: unknown[]) => invokeSpy(...args) },
    };
  }

  beforeEach(() => {
    historialRows = [];
    supabaseSpy = { client: buildClient() };

    TestBed.configureTestingModule({
      providers: [
        AnnouncementsFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: BranchFacade, useValue: { selectedBranchId: vi.fn().mockReturnValue(null) } },
        {
          provide: AuthFacade,
          useValue: {
            currentUser: vi.fn().mockReturnValue({ role: 'admin', dbId: 2, branchId: null }),
          },
        },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        {
          provide: ErrorSanitizerService,
          useValue: { sanitize: (e: Error) => ({ message: e.message }) },
        },
      ],
    });

    facade = TestBed.inject(AnnouncementsFacade);
  });

  it('arranca con estado vacío', () => {
    expect(facade.announcements()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
    expect(facade.isSending()).toBe(false);
    expect(facade.error()).toBeNull();
  });

  describe('send()', () => {
    it('inserta el comunicado y despacha el primer lote', async () => {
      invokeSpy.mockResolvedValue({
        data: { recipientsTotal: 10, processed: 10, sent: 10, failed: 0, done: true },
        error: null,
      });

      const ok = await facade.send(DRAFT);

      expect(ok).toBe(true);
      expect(insertSelectSingle).toHaveBeenCalled();
      expect(invokeSpy).toHaveBeenCalledWith(
        'send-announcement',
        expect.objectContaining({
          body: expect.objectContaining({ announcementId: 77, offset: 0 }),
        }),
      );
    });

    // El envío se parte en lotes porque la Edge Function tiene límite de tiempo; la
    // pausa entre llamadas es además el throttling que cuida la reputación del dominio.
    it('itera todos los lotes hasta cubrir el total', async () => {
      invokeSpy
        .mockResolvedValueOnce({
          data: { recipientsTotal: 60, processed: 25, sent: 25, failed: 0, done: false },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { recipientsTotal: 60, processed: 25, sent: 25, failed: 0, done: false },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { recipientsTotal: 60, processed: 10, sent: 10, failed: 0, done: true },
          error: null,
        });

      await facade.send(DRAFT);

      expect(invokeSpy).toHaveBeenCalledTimes(3);
      const offsets = invokeSpy.mock.calls.map((c: any) => c[1].body.offset);
      expect(offsets).toEqual([0, 25, 50]);
    });

    it('actualiza el progreso a medida que avanza', async () => {
      invokeSpy
        .mockResolvedValueOnce({
          data: { recipientsTotal: 30, processed: 25, sent: 24, failed: 1, done: false },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { recipientsTotal: 30, processed: 5, sent: 5, failed: 0, done: true },
          error: null,
        });

      await facade.send(DRAFT);

      expect(facade.progress()).toEqual({ total: 30, processed: 30, ok: 29, failed: 1 });
    });

    // AC-E3 — un lote que falla no puede abortar el resto del comunicado.
    it('AC-E3 · si un lote falla, sigue con los siguientes y acumula los fallidos', async () => {
      invokeSpy
        .mockResolvedValueOnce({
          data: { recipientsTotal: 75, processed: 25, sent: 25, failed: 0, done: false },
          error: null,
        })
        .mockResolvedValueOnce({ data: null, error: { message: 'timeout' } })
        .mockResolvedValueOnce({
          data: { recipientsTotal: 75, processed: 25, sent: 25, failed: 0, done: true },
          error: null,
        });

      const ok = await facade.send(DRAFT);

      expect(invokeSpy).toHaveBeenCalledTimes(3);
      expect(facade.progress().failed).toBe(25);
      expect(facade.progress().ok).toBe(50);
      expect(ok).toBe(true);
    });

    it('AC-E1 · un segmento sin destinatarios no dispara más lotes', async () => {
      invokeSpy.mockResolvedValue({
        data: { recipientsTotal: 0, processed: 0, sent: 0, failed: 0, done: true },
        error: null,
      });

      await facade.send(DRAFT);

      expect(invokeSpy).toHaveBeenCalledTimes(1);
    });

    it('si el INSERT del comunicado falla, no invoca la función', async () => {
      insertSelectSingle.mockResolvedValue({ data: null, error: { message: 'RLS' } });

      const ok = await facade.send(DRAFT);

      expect(ok).toBe(false);
      expect(invokeSpy).not.toHaveBeenCalled();
      expect(facade.error()).not.toBeNull();
    });

    it('isSending vuelve a false al terminar, incluso si falla', async () => {
      insertSelectSingle.mockResolvedValue({ data: null, error: { message: 'RLS' } });

      await facade.send(DRAFT);

      expect(facade.isSending()).toBe(false);
    });

    it('manda los filtros del segmento, nunca una lista de destinatarios', async () => {
      invokeSpy.mockResolvedValue({
        data: { recipientsTotal: 1, processed: 1, sent: 1, failed: 0, done: true },
        error: null,
      });

      await facade.send({ ...DRAFT, excludedUserIds: [5, 9] });

      // El body de la EF lleva SOLO identificador y paginado. Si alguna vez apareciera
      // acá una lista de destinatarios, el filtro de consentimiento pasaría a depender
      // del cliente y un preview viejo podría alcanzar a alguien que ya revocó.
      const body = invokeSpy.mock.calls[0][1].body;
      expect(Object.keys(body).sort()).toEqual(['announcementId', 'batchSize', 'offset']);
    });

    it('las exclusiones manuales viajan en el comunicado, no en el body del lote', async () => {
      invokeSpy.mockResolvedValue({
        data: { recipientsTotal: 1, processed: 1, sent: 1, failed: 0, done: true },
        error: null,
      });

      await facade.send({ ...DRAFT, excludedUserIds: [5, 9] });

      expect(insertPayload.segment_filters.excludedUserIds).toEqual([5, 9]);
      expect(insertPayload.kind).toBe('operativo');
    });
  });

  describe('loadPreview()', () => {
    /** Reemplaza el mock de `from` por uno que responde el segmento y los consentimientos. */
    function mockSegmento(enrollmentRows: any[], consentRows: any[] = []) {
      supabaseSpy.client.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'enrollments') {
          const chain: any = {
            select: vi.fn().mockReturnValue(chainable()),
          };
          function chainable() {
            const c: any = {
              eq: vi.fn().mockImplementation(() => c),
              then: (resolve: any) => resolve({ data: enrollmentRows, error: null }),
            };
            return c;
          }
          return chain;
        }
        if (table === 'consents') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({ data: consentRows, error: null }),
                }),
              }),
            }),
          };
        }
        return { select: vi.fn() };
      });
    }

    function alumno(id: number, nombre: string, email = `a${id}@test.com`) {
      return {
        status: 'active',
        branch_id: 1,
        courses: { type: 'class_b' },
        students: {
          user_id: id,
          users: {
            id,
            first_names: nombre,
            paternal_last_name: 'Pérez',
            email,
            active: true,
          },
        },
      };
    }

    const FILTROS = DRAFT.filters;

    it('AC1 · resuelve el segmento con nombre y email', async () => {
      mockSegmento([alumno(1, 'Ana'), alumno(2, 'Beto')]);

      await facade.loadPreview(FILTROS, 'operativo');

      expect(facade.preview()).toHaveLength(2);
      expect(facade.preview()[0]).toMatchObject({ userId: 1, name: 'Ana Pérez', included: true });
    });

    it('un alumno con dos matrículas aparece una sola vez', async () => {
      mockSegmento([alumno(1, 'Ana'), alumno(1, 'Ana')]);

      await facade.loadPreview(FILTROS, 'operativo');

      expect(facade.preview()).toHaveLength(1);
    });

    it('AC4 · el operativo no marca a nadie como excluido', async () => {
      mockSegmento([alumno(1, 'Ana'), alumno(2, 'Beto')], []);

      await facade.loadPreview(FILTROS, 'operativo');

      expect(facade.preview().every((r) => r.included)).toBe(true);
    });

    it('AC3 · el promocional excluye a quien no consintió, con su motivo', async () => {
      mockSegmento(
        [alumno(1, 'Ana'), alumno(2, 'Beto')],
        [{ user_id: 1, granted: true, revoked_at: null, granted_at: '2026-09-01' }],
      );

      await facade.loadPreview(FILTROS, 'promocional');

      const [ana, beto] = facade.preview();
      expect(ana).toMatchObject({ userId: 1, included: true, exclusionReason: null });
      expect(beto).toMatchObject({
        userId: 2,
        included: false,
        exclusionReason: 'sin_consentimiento',
      });
    });

    it('AC3 · un consentimiento revocado no habilita', async () => {
      mockSegmento(
        [alumno(1, 'Ana')],
        [{ user_id: 1, granted: true, revoked_at: '2026-09-05', granted_at: '2026-09-01' }],
      );

      await facade.loadPreview(FILTROS, 'promocional');

      expect(facade.preview()[0].included).toBe(false);
    });

    // Un alumno con dos matrículas tiene una fila de consentimiento por matrícula:
    // vale su última expresión de voluntad, no la más conveniente.
    it('AC3 · con varios registros manda el más reciente', async () => {
      mockSegmento(
        [alumno(1, 'Ana')],
        [
          { user_id: 1, granted: false, revoked_at: null, granted_at: '2026-09-08' },
          { user_id: 1, granted: true, revoked_at: null, granted_at: '2026-09-01' },
        ],
      );

      await facade.loadPreview(FILTROS, 'promocional');

      expect(facade.preview()[0].included).toBe(false);
    });

    it('AC-E2 · un alumno sin email queda incluido, con email null', async () => {
      mockSegmento([alumno(1, 'Ana', '   ')]);

      await facade.loadPreview(FILTROS, 'operativo');

      expect(facade.preview()[0]).toMatchObject({ included: true, email: null });
    });
  });

  describe('initialize() — SWR', () => {
    // Se mira isLoading ANTES de esperar la promesa: después del await siempre es
    // false, así que un test que chequee ahí no puede distinguir SWR de no-SWR.
    it('la primera carga SÍ muestra skeleton', async () => {
      const pending = facade.initialize();

      expect(facade.isLoading()).toBe(true);

      await pending;
      expect(facade.isLoading()).toBe(false);
    });

    it('la segunda entrada NO vuelve a mostrar skeleton (datos cacheados)', async () => {
      await facade.initialize();

      const pending = facade.initialize();
      expect(facade.isLoading()).toBe(false);

      await pending;
    });

    it('la segunda entrada igual refresca en background', async () => {
      await facade.initialize();
      const llamadasIniciales = supabaseSpy.client.from.mock.calls.length;

      await facade.initialize();

      expect(supabaseSpy.client.from.mock.calls.length).toBeGreaterThan(llamadasIniciales);
    });
  });
});
