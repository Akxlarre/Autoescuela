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
  scheduledFor: null,
  templateId: null,
};

describe('AnnouncementsFacade', () => {
  let facade: AnnouncementsFacade;
  let supabaseSpy: any;
  let invokeSpy: any;
  let insertSelectSingle: any;
  let historialRows: any[];
  /** Lo que la facade manda al INSERT de `announcements`, para poder afirmarlo. */
  let insertPayload: any;
  /** Idem para el UPDATE, y los filtros que se le aplicaron. */
  let updatePayload: any;
  let updateFilters: string[];
  /** Filtros aplicados al SELECT del historial (fix-168-b). */
  let historialFilters: string[];

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
            update: vi.fn().mockImplementation((payload: any) => {
              updatePayload = payload;
              updateFilters = [];
              // `update().eq().eq()` encadena: se registran todos los filtros aplicados
              // para poder afirmar que cancelar solo toca lo que sigue programado.
              const chain: any = {
                eq: vi.fn().mockImplementation((col: string, val: unknown) => {
                  updateFilters.push(`${col}=${val}`);
                  return chain;
                }),
                then: (resolve: any) => resolve({ error: null }),
              };
              return chain;
            }),
            select: vi.fn().mockImplementation(() => {
              // Registra los filtros del historial: el bug de fix-168-b era invisible
              // mirando las filas devueltas — había que mirar QUÉ se le pedía a la BD.
              const chain: any = {
                eq: vi.fn().mockImplementation((col: string, val: unknown) => {
                  historialFilters.push(`${col}=${val}`);
                  return chain;
                }),
                order: vi.fn().mockResolvedValue({ data: historialRows, error: null }),
              };
              return chain;
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
    updatePayload = undefined;
    updateFilters = [];
    historialFilters = [];
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

  // ── fix-168-b ──────────────────────────────────────────────────────────────
  //
  // `selectedBranchId` se persiste en localStorage bajo una clave sin namespacing por
  // usuario que nadie limpia al cerrar sesión. Para un admin es una comodidad; para una
  // secretaria es un filtro que no eligió, no ve y no puede corregir — no tiene selector
  // de sede en el topbar. El síntoma era el peor posible: historial vacío, sin error.
  //
  // Estos tests miran QUÉ se le pide a la BD, no qué filas vuelven: el mock siempre
  // devuelve lo mismo, así que un test sobre las filas no habría visto nada.
  describe('scope de sede del historial (fix-168-b)', () => {
    function comoSecretaria(extra: Record<string, unknown> = {}): void {
      (TestBed.inject(AuthFacade) as any).currentUser.mockReturnValue({
        role: 'secretaria',
        dbId: 8,
        branchId: 1,
        ...extra,
      });
    }

    function sedePersistida(id: number | null): void {
      (TestBed.inject(BranchFacade) as any).selectedBranchId.mockReturnValue(id);
    }

    it('una secretaria ignora la sede persistida de otro usuario', async () => {
      comoSecretaria();
      sedePersistida(2); // el admin dejó elegida otra sede en este navegador

      await facade.initialize();

      expect(historialFilters).not.toContain('branch_id=2');
    });

    // El primer intento de fix ancló a la secretaria con eq(branch_id, la suya) y le
    // borró de la pantalla los comunicados que administración manda a TODAS las sedes
    // —que llegaron a sus propios alumnos—. En esta tabla NULL significa "a todas", no
    // "sin sede", y quien resuelve eso bien es la RLS (branch_visible), no el cliente.
    it('una secretaria no filtra en el cliente: la RLS le da su sede Y los multi-sede', async () => {
      comoSecretaria();
      sedePersistida(2);

      await facade.initialize();

      expect(historialFilters).toEqual([]);
    });

    it('un admin sí respeta el selector de sede', async () => {
      sedePersistida(2);

      await facade.initialize();

      expect(historialFilters).toContain('branch_id=2');
    });

    it('un admin en "todas las sedes" consulta sin filtro', async () => {
      sedePersistida(null);

      await facade.initialize();

      expect(historialFilters).toEqual([]);
    });

    // Spec 0017: el grant multi-sede la hace comportarse como admin para el scope.
    it('una secretaria con grant multi-sede respeta el selector', async () => {
      comoSecretaria({ canAccessBothBranches: true });
      sedePersistida(2);

      await facade.initialize();

      expect(historialFilters).toContain('branch_id=2');
    });

    // El grant de spec 0017 amplía lo que se puede LEER, no lo que se escribe acá: la
    // policy `insert_announcements` exige `branch_id = auth_user_branch_id()` para todo
    // rol `secretary`. Mandar la sede del selector le daría un 403 de la BD.
    it('una secretaria con grant igual manda con SU sede: la RLS del INSERT la ancla', async () => {
      comoSecretaria({ canAccessBothBranches: true });
      invokeSpy.mockResolvedValue({
        data: { recipientsTotal: 1, processed: 1, sent: 1, failed: 0, done: true },
        error: null,
      });

      await facade.send({ ...DRAFT, filters: { ...DRAFT.filters, branchId: 2 } });

      expect(insertPayload.branch_id).toBe(1);
    });

    // El centinela sirve para filtrar, no para guardar: `branch_id` es una FK, así que
    // mandarlo daría un error de integridad crudo en vez de decir qué pasa.
    it('el centinela nunca llega al INSERT: el envío se corta antes con el motivo real', async () => {
      comoSecretaria({ branchId: null });

      const ok = await facade.send(DRAFT);

      expect(ok).toBe(false);
      expect(insertSelectSingle).not.toHaveBeenCalled();
      expect(facade.error()).toContain('no tiene una sede asignada');
    });
  });

  describe('schedule() y cancelScheduled() — spec 0042-b', () => {
    it('AC5 · programar persiste el comunicado SIN despachar nada', async () => {
      const cuando = new Date(Date.now() + 86_400_000).toISOString();

      const ok = await facade.schedule({ ...DRAFT, scheduledFor: cuando });

      expect(ok).toBe(true);
      expect(insertPayload.status).toBe('programado');
      expect(insertPayload.scheduled_for).toBe(cuando);
      // Lo que separa programar de enviar: la Edge Function no se toca.
      expect(invokeSpy).not.toHaveBeenCalled();
    });

    it('AC5 · guarda los filtros del segmento, no una lista de destinatarios', async () => {
      await facade.schedule({
        ...DRAFT,
        scheduledFor: new Date(Date.now() + 3600_000).toISOString(),
      });

      // El segmento se resuelve recién al enviar: quien revoque en el medio queda fuera.
      expect(insertPayload.segment_filters).toMatchObject({ courseType: 'class_b' });
      expect(insertPayload.recipients_total ?? 0).toBe(0);
    });

    it('programar con fecha pasada no persiste nada', async () => {
      const ayer = new Date(Date.now() - 86_400_000).toISOString();

      const ok = await facade.schedule({ ...DRAFT, scheduledFor: ayer });

      expect(ok).toBe(false);
      expect(facade.error()).toBeTruthy();
    });

    it('programar sin fecha no persiste nada: para eso está send()', async () => {
      expect(await facade.schedule({ ...DRAFT, scheduledFor: null })).toBe(false);
    });

    it('AC8 · cancelar pasa a cancelado y NO borra la fila', async () => {
      const ok = await facade.cancelScheduled(77);

      expect(ok).toBe(true);
      expect(updatePayload).toMatchObject({ status: 'cancelado' });
    });

    it('AC8 · cancelar solo afecta a lo que sigue programado', async () => {
      await facade.cancelScheduled(77);

      // Sin este filtro, cancelar podría pisar un comunicado que ya arrancó a salir.
      expect(updateFilters.join(',')).toContain('programado');
    });
  });

  describe('loadPreviewHtml() — spec 0043-b', () => {
    it('AC1 · pide el HTML a la Edge Function y lo expone', async () => {
      invokeSpy.mockResolvedValue({ data: { html: '<html>hola</html>' }, error: null });

      const ok = await facade.loadPreviewHtml(DRAFT);

      expect(ok).toBe(true);
      expect(facade.previewHtml()).toBe('<html>hola</html>');
      expect(invokeSpy).toHaveBeenCalledWith(
        'send-announcement',
        expect.objectContaining({ body: expect.objectContaining({ previewOnly: true }) }),
      );
    });

    it('AC1 · manda el asunto y el cuerpo tal como se redactaron, con los marcadores', async () => {
      invokeSpy.mockResolvedValue({ data: { html: '<html></html>' }, error: null });

      await facade.loadPreviewHtml({ ...DRAFT, body: 'Hola {{nombre}}' });

      // Los marcadores los resuelve el servidor: mandarlos ya sustituidos desde acá
      // haría que el preview muestre algo distinto de lo que se va a guardar.
      expect(invokeSpy.mock.calls[0][1].body.preview.body).toBe('Hola {{nombre}}');
    });

    // AC-E2 — un preview vacío no dice nada; mejor avisar que gastar un round-trip.
    it('AC-E2 · con cuerpo vacío no llama a la Edge Function', async () => {
      const ok = await facade.loadPreviewHtml({ ...DRAFT, body: '   ' });

      expect(ok).toBe(false);
      expect(invokeSpy).not.toHaveBeenCalled();
      expect(facade.error()).toBeTruthy();
    });

    it('AC-E2 · con asunto vacío tampoco', async () => {
      expect(await facade.loadPreviewHtml({ ...DRAFT, subject: '' })).toBe(false);
      expect(invokeSpy).not.toHaveBeenCalled();
    });

    it('si la función falla, expone el error y no deja HTML viejo', async () => {
      invokeSpy.mockResolvedValue({ data: null, error: { message: 'boom' } });

      const ok = await facade.loadPreviewHtml(DRAFT);

      expect(ok).toBe(false);
      expect(facade.previewHtml()).toBeNull();
      expect(facade.error()).toBeTruthy();
    });

    it('isLoadingPreviewHtml vuelve a false aunque falle', async () => {
      invokeSpy.mockResolvedValue({ data: null, error: { message: 'boom' } });

      await facade.loadPreviewHtml(DRAFT);

      expect(facade.isLoadingPreviewHtml()).toBe(false);
    });
  });
});
