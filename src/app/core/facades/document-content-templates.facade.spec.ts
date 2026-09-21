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
  });

  describe('publish()', () => {
    it('sin form cargado no hace upsert y devuelve false', async () => {
      const ok = await facade.publish();
      expect(ok).toBe(false);
      expect(supabaseSpy.client.from).not.toHaveBeenCalledWith('document_templates');
    });

    it('hace upsert con branch_id + document_type + content de las secciones', async () => {
      supabaseSpy.client.from.mockReturnValueOnce(makeSelectQuery({ data: null, error: null }));
      await facade.load(2, 'contract_b');
      facade.updateSection('primero', 'Texto editado por el admin');

      const upsertSpy = vi.fn().mockResolvedValue({ data: null, error: null });
      supabaseSpy.client.from.mockReturnValue({ upsert: upsertSpy });

      const ok = await facade.publish();

      expect(ok).toBe(true);
      expect(upsertSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          branch_id: 2,
          document_type: 'contract_b',
          name: 'Contrato Clase B',
          content: expect.objectContaining({ primero: 'Texto editado por el admin' }),
        }),
        expect.objectContaining({ onConflict: 'branch_id,document_type' }),
      );
      expect(toastSpy.success).toHaveBeenCalled();
    });

    it('error del upsert setea el signal de error y devuelve false', async () => {
      supabaseSpy.client.from.mockReturnValueOnce(makeSelectQuery({ data: null, error: null }));
      await facade.load(2, 'contract_b');

      supabaseSpy.client.from.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ data: null, error: new Error('upsert failed') }),
      });

      const ok = await facade.publish();

      expect(ok).toBe(false);
      expect(facade.error()).toBe('upsert failed');
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
