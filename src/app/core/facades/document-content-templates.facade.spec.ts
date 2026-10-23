import { TestBed } from '@angular/core/testing';
import { DocumentContentTemplatesFacade } from './document-content-templates.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';

describe('DocumentContentTemplatesFacade', () => {
  let facade: DocumentContentTemplatesFacade;
  let supabaseSpy: any;
  let toastSpy: any;

  function makeSelectQuery(resolvedValue: any) {
    return {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue(resolvedValue),
    };
  }

  /**
   * fix-478-m: escritura condicional. `update().eq()…select()` resuelve con `update` (por defecto
   * 1 fila actualizada); `insert()` resuelve con `insert` (por defecto sin error).
   */
  function makeWriteQuery(
    results: { update?: { data?: unknown; error?: unknown }; insert?: { error?: unknown } } = {},
  ) {
    const q: any = {};
    q.update = vi.fn(() => q);
    q.eq = vi.fn(() => q);
    q.select = vi.fn(() =>
      Promise.resolve({
        data: results.update?.data ?? [{ updated_at: 'nuevo' }],
        error: results.update?.error ?? null,
      }),
    );
    q.insert = vi.fn(() => Promise.resolve({ data: null, error: results.insert?.error ?? null }));
    return q;
  }

  beforeEach(() => {
    supabaseSpy = {
      client: {
        from: vi.fn().mockReturnValue(makeSelectQuery({ data: null, error: null })),
        functions: {
          invoke: vi.fn().mockResolvedValue({ data: { pdfBase64: 'BASE64' }, error: null }),
        },
      },
    };
    toastSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        DocumentContentTemplatesFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: ToastService, useValue: toastSpy },
        ErrorSanitizerService,
      ],
    });

    facade = TestBed.inject(DocumentContentTemplatesFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  describe('Estado inicial', () => {
    it('form arranca en null', () => {
      expect(facade.form()).toBeNull();
    });

    it('isLoading/isPublishing/isGeneratingPreview arrancan en false', () => {
      expect(facade.isLoading()).toBe(false);
      expect(facade.isPublishing()).toBe(false);
      expect(facade.isGeneratingPreview()).toBe(false);
    });
  });

  describe('load()', () => {
    it('trae el content guardado y lo mapea a las secciones de ese tipo de documento', async () => {
      supabaseSpy.client.from.mockReturnValue(
        makeSelectQuery({
          data: {
            id: 1,
            name: 'Contrato Clase B — Conductores Chillán',
            branch_id: 2,
            document_type: 'contract_b',
            content: { primero: 'Texto real de PRIMERO', segundo: 'Texto real de SEGUNDO' },
          },
          error: null,
        }),
      );

      await facade.load(2, 'contract_b');

      const form = facade.form();
      expect(form?.branchId).toBe(2);
      expect(form?.documentType).toBe('contract_b');
      const primero = form?.sections.find((s) => s.id === 'primero');
      expect(primero?.body).toBe('Texto real de PRIMERO');
      // quinto no tiene texto guardado en el mock → body vacío, no undefined/crash
      const quinto = form?.sections.find((s) => s.id === 'quinto');
      expect(quinto?.body).toBe('');
    });

    it('sede/tipo sin fila (AC-E1): arma el form igual, con secciones vacías, sin error', async () => {
      supabaseSpy.client.from.mockReturnValue(makeSelectQuery({ data: null, error: null }));

      await facade.load(1, 'certificate_b');

      expect(facade.error()).toBeNull();
      expect(facade.form()?.sections.length).toBeGreaterThan(0);
      expect(facade.form()?.sections.every((s) => s.body === '')).toBe(true);
    });

    it('error de red setea el signal de error y no rompe', async () => {
      supabaseSpy.client.from.mockReturnValue(
        makeSelectQuery({ data: null, error: new Error('network down') }),
      );

      await facade.load(2, 'contract_b');

      expect(facade.error()).toBe('network down');
      expect(toastSpy.error).toHaveBeenCalled();
    });

    it('desactiva isLoading al terminar (éxito o error)', async () => {
      await facade.load(2, 'contract_b');
      expect(facade.isLoading()).toBe(false);
    });

    it('fix-469-m: si la carga de otra sede falla, no queda el form de la sede anterior', async () => {
      await facade.load(2, 'contract_b');
      expect(facade.form()?.branchId).toBe(2);

      supabaseSpy.client.from.mockReturnValue(
        makeSelectQuery({ data: null, error: new Error('network down') }),
      );
      await facade.load(1, 'contract_b');

      expect(facade.form()).toBeNull();
    });
  });

  describe('cambios sin publicar (fix-469-m)', () => {
    beforeEach(async () => {
      supabaseSpy.client.from.mockReturnValue(
        makeSelectQuery({ data: { content: { primero: 'Publicado' } }, error: null }),
      );
      await facade.load(2, 'contract_b');
    });

    const primero = () => facade.form()?.sections.find((s) => s.id === 'primero')?.body;

    it('recién cargado no hay cambios', () => {
      expect(facade.hasUnsavedChanges()).toBe(false);
    });

    it('editar una sección marca cambios; volver al texto publicado los quita', () => {
      facade.updateSection('primero', 'Editado');
      expect(facade.hasUnsavedChanges()).toBe(true);
      facade.updateSection('primero', 'Publicado');
      expect(facade.hasUnsavedChanges()).toBe(false);
    });

    it('discardChanges() vuelve al texto publicado', () => {
      facade.updateSection('primero', 'Editado');
      facade.discardChanges();
      expect(primero()).toBe('Publicado');
      expect(facade.hasUnsavedChanges()).toBe(false);
    });

    it('tras publicar, el borrador pasa a ser lo publicado', async () => {
      for (const s of facade.form()?.sections ?? []) facade.updateSection(s.id, `Texto ${s.id}`);
      expect(facade.hasUnsavedChanges()).toBe(true);
      supabaseSpy.client.from.mockReturnValue(makeWriteQuery());

      await facade.publish();

      expect(facade.hasUnsavedChanges()).toBe(false);
      facade.discardChanges();
      expect(primero()).toBe('Texto primero');
    });

    it('si publicar falla, los cambios siguen pendientes', async () => {
      for (const s of facade.form()?.sections ?? []) facade.updateSection(s.id, `Texto ${s.id}`);
      supabaseSpy.client.from.mockReturnValue(
        makeWriteQuery({ insert: { error: new Error('insert failed') } }),
      );

      await facade.publish();

      expect(facade.hasUnsavedChanges()).toBe(true);
    });
  });

  describe('publish()', () => {
    it('sin form cargado no hace upsert y devuelve false', async () => {
      const ok = await facade.publish();
      expect(ok).toBe(false);
      expect(supabaseSpy.client.from).not.toHaveBeenCalledWith('document_templates');
    });

    /** Llena todas las secciones del form cargado (publish() exige que ninguna quede vacía). */
    function fillAllSections(): void {
      for (const s of facade.form()?.sections ?? []) facade.updateSection(s.id, `Texto ${s.id}`);
    }

    it('no publica si hay secciones vacías y las nombra en el toast (fix-450-m)', async () => {
      supabaseSpy.client.from.mockReturnValueOnce(makeSelectQuery({ data: null, error: null }));
      await facade.load(2, 'certificate_b');
      fillAllSections();
      facade.updateSection('firma_cargo', '');
      facade.updateSection('cierre', '   ');

      const write = makeWriteQuery();
      supabaseSpy.client.from.mockReturnValue(write);

      const ok = await facade.publish();

      expect(ok).toBe(false);
      expect(write.insert).not.toHaveBeenCalled();
      expect(write.update).not.toHaveBeenCalled();
      expect(toastSpy.error).toHaveBeenCalledWith(
        'Hay secciones vacías',
        expect.stringContaining('Firma — Cargo'),
      );
      expect(toastSpy.error.mock.calls[0][1]).toContain('Cierre');
      expect(facade.isPublishing()).toBe(false);
    });

    it('sede/tipo sin fila: inserta con branch_id + document_type + content de las secciones', async () => {
      supabaseSpy.client.from.mockReturnValueOnce(makeSelectQuery({ data: null, error: null }));
      await facade.load(2, 'contract_b');
      fillAllSections();
      facade.updateSection('primero', 'Texto editado por el admin');

      const write = makeWriteQuery();
      supabaseSpy.client.from.mockReturnValue(write);

      const ok = await facade.publish();

      expect(ok).toBe(true);
      expect(write.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          branch_id: 2,
          document_type: 'contract_b',
          name: 'Contrato Clase B',
          content: expect.objectContaining({ primero: 'Texto editado por el admin' }),
        }),
      );
      expect(toastSpy.success).toHaveBeenCalled();
    });

    it('error al escribir setea el signal de error y devuelve false', async () => {
      supabaseSpy.client.from.mockReturnValueOnce(makeSelectQuery({ data: null, error: null }));
      await facade.load(2, 'contract_b');
      fillAllSections();

      supabaseSpy.client.from.mockReturnValue(
        makeWriteQuery({ insert: { error: new Error('insert failed') } }),
      );

      const ok = await facade.publish();

      expect(ok).toBe(false);
      expect(facade.error()).toBe('insert failed');
    });

    describe('conflicto con otra publicación (fix-478-m)', () => {
      const V1 = '2026-10-20T10:00:00.000+00:00';

      async function cargarPublicada(): Promise<void> {
        supabaseSpy.client.from.mockReturnValueOnce(
          makeSelectQuery({ data: { content: {}, updated_at: V1 }, error: null }),
        );
        await facade.load(2, 'contract_b');
        fillAllSections();
      }

      it('con fila: actualiza solo si sigue en la versión cargada', async () => {
        await cargarPublicada();
        const write = makeWriteQuery();
        supabaseSpy.client.from.mockReturnValue(write);

        expect(await facade.publish()).toBe(true);
        expect(write.update).toHaveBeenCalled();
        expect(write.eq).toHaveBeenCalledWith('updated_at', V1);
        expect(write.insert).not.toHaveBeenCalled();
      });

      it('si otra persona publicó entre medio (0 filas), avisa, no pisa y conserva el borrador', async () => {
        await cargarPublicada();
        facade.updateSection('primero', 'Mi versión');
        supabaseSpy.client.from.mockReturnValue(makeWriteQuery({ update: { data: [] } }));

        expect(await facade.publish()).toBe(false);
        expect(toastSpy.warning).toHaveBeenCalledWith(
          'Otra persona publicó esta plantilla',
          expect.stringContaining('no se publicaron'),
        );
        expect(toastSpy.success).not.toHaveBeenCalled();
        expect(facade.form()?.sections.find((s) => s.id === 'primero')?.body).toBe('Mi versión');
        expect(facade.hasUnsavedChanges()).toBe(true);
      });

      it('sin fila al cargar y otra persona la creó entre medio (23505), mismo aviso', async () => {
        supabaseSpy.client.from.mockReturnValueOnce(makeSelectQuery({ data: null, error: null }));
        await facade.load(2, 'contract_b');
        fillAllSections();
        supabaseSpy.client.from.mockReturnValue(
          makeWriteQuery({ insert: { error: { code: '23505', message: 'duplicate key' } } }),
        );

        expect(await facade.publish()).toBe(false);
        expect(toastSpy.warning).toHaveBeenCalledWith(
          'Otra persona publicó esta plantilla',
          expect.any(String),
        );
      });

      it('dos publicaciones seguidas en la misma sesión no chocan entre sí', async () => {
        await cargarPublicada();
        const write = makeWriteQuery();
        supabaseSpy.client.from.mockReturnValue(write);

        expect(await facade.publish()).toBe(true);
        facade.updateSection('primero', 'Segunda versión');
        expect(await facade.publish()).toBe(true);
        expect(write.eq).not.toHaveBeenCalledWith('updated_at', V1, expect.anything());
        expect(write.eq.mock.calls.filter((c: unknown[]) => c[0] === 'updated_at')[1][1]).not.toBe(
          V1,
        );
      });
    });
  });

  describe('preview()', () => {
    it('sin form cargado no invoca ninguna Edge Function', async () => {
      const result = await facade.preview();
      expect(result).toBeNull();
      expect(supabaseSpy.client.functions.invoke).not.toHaveBeenCalled();
    });

    it('invoca generate-contract-pdf con mode preview y el content en borrador (sin guardar)', async () => {
      supabaseSpy.client.from.mockReturnValueOnce(makeSelectQuery({ data: null, error: null }));
      await facade.load(2, 'contract_b');
      facade.updateSection('primero', 'Borrador sin publicar');

      const pdfBase64 = await facade.preview();

      expect(pdfBase64).toBe('BASE64');
      expect(supabaseSpy.client.functions.invoke).toHaveBeenCalledWith('generate-contract-pdf', {
        body: expect.objectContaining({
          mode: 'preview',
          branch_id: 2,
          document_type: 'contract_b',
          content: expect.objectContaining({ primero: 'Borrador sin publicar' }),
        }),
      });
    });

    it('invoca generate-certificate-b-pdf para certificate_b (sin document_type en el body)', async () => {
      supabaseSpy.client.from.mockReturnValueOnce(makeSelectQuery({ data: null, error: null }));
      await facade.load(1, 'certificate_b');

      await facade.preview();

      const [fnName, options] = supabaseSpy.client.functions.invoke.mock.calls[0];
      expect(fnName).toBe('generate-certificate-b-pdf');
      expect(options.body.document_type).toBeUndefined();
    });

    it('no publica nada — preview nunca vuelve a tocar la tabla document_templates', async () => {
      supabaseSpy.client.from.mockReturnValueOnce(makeSelectQuery({ data: null, error: null }));
      await facade.load(2, 'contract_b');
      supabaseSpy.client.from.mockClear();

      await facade.preview();

      expect(supabaseSpy.client.from).not.toHaveBeenCalled();
    });

    it('error de la Edge Function setea el signal de error y devuelve null', async () => {
      supabaseSpy.client.from.mockReturnValueOnce(makeSelectQuery({ data: null, error: null }));
      await facade.load(2, 'contract_b');
      supabaseSpy.client.functions.invoke.mockResolvedValueOnce({
        data: null,
        error: new Error('edge function failed'),
      });

      const result = await facade.preview();

      expect(result).toBeNull();
      expect(facade.error()).toBe('edge function failed');
    });
  });

  describe('viewPublished()', () => {
    it('invoca con mode sample, sin content en el body', async () => {
      await facade.viewPublished(2, 'certificate_professional');

      expect(supabaseSpy.client.functions.invoke).toHaveBeenCalledWith(
        'generate-certificate-professional-pdf',
        { body: expect.objectContaining({ mode: 'sample', branch_id: 2 }) },
      );
      const [, options] = supabaseSpy.client.functions.invoke.mock.calls[0];
      expect(options.body.content).toBeUndefined();
    });
  });
});
