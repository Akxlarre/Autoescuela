import { TestBed } from '@angular/core/testing';
import { NotificationTemplatesFacade } from './notification-templates.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import type { TemplateDraft } from '@core/models/ui/notification-template.model';

const DRAFT: TemplateDraft = {
  id: null,
  name: 'Aviso de feriado',
  subject: 'No hay clases',
  body: 'Hola {{nombre}}, mañana no hay clases en {{sede}}.',
  active: true,
};

describe('NotificationTemplatesFacade', () => {
  let facade: NotificationTemplatesFacade;
  let supabaseSpy: any;
  let rows: any[];
  let insertPayload: any;
  let updatePayload: any;
  let deleteCalled: boolean;
  let mutationError: { message: string } | null;

  function buildClient() {
    return {
      from: vi.fn().mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: rows, error: null }),
          }),
          order: vi.fn().mockResolvedValue({ data: rows, error: null }),
        }),
        insert: vi.fn().mockImplementation((payload: any) => {
          insertPayload = payload;
          return Promise.resolve({ error: mutationError });
        }),
        update: vi.fn().mockImplementation((payload: any) => {
          updatePayload = payload;
          return { eq: vi.fn().mockResolvedValue({ error: mutationError }) };
        }),
        delete: vi.fn().mockImplementation(() => {
          deleteCalled = true;
          return { eq: vi.fn().mockResolvedValue({ error: mutationError }) };
        }),
      })),
    };
  }

  beforeEach(() => {
    rows = [];
    insertPayload = undefined;
    updatePayload = undefined;
    deleteCalled = false;
    mutationError = null;
    supabaseSpy = { client: buildClient() };

    TestBed.configureTestingModule({
      providers: [
        NotificationTemplatesFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
        {
          provide: ErrorSanitizerService,
          useValue: { sanitize: (e: Error) => ({ message: e.message }) },
        },
      ],
    });

    facade = TestBed.inject(NotificationTemplatesFacade);
  });

  it('arranca vacía y sin error', () => {
    expect(facade.templates()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
    expect(facade.error()).toBeNull();
  });

  describe('initialize() — SWR', () => {
    it('carga las plantillas activas', async () => {
      rows = [
        { id: 1, name: 'Feriado', subject: 'Sin clases', body: 'Hola {{nombre}}', active: true },
      ];

      await facade.initialize();

      expect(facade.templates()).toHaveLength(1);
      expect(facade.templates()[0].name).toBe('Feriado');
    });

    it('deriva las variables que cada plantilla usa', async () => {
      rows = [
        { id: 1, name: 'A', subject: 's', body: '{{nombre}} en {{sede}}', active: true },
        { id: 2, name: 'B', subject: 's', body: 'sin variables', active: true },
      ];

      await facade.initialize();

      expect(facade.templates()[0].usedVariables).toEqual(['nombre', 'sede']);
      expect(facade.templates()[1].usedVariables).toEqual([]);
    });

    // SWR: volver a entrar al compositor no puede re-mostrar el skeleton.
    it('la segunda llamada no vuelve a mostrar loading', async () => {
      await facade.initialize();

      const promesa = facade.initialize();
      expect(facade.isLoading()).toBe(false);
      await promesa;
    });
  });

  describe('save()', () => {
    it('AC1 · una plantilla nueva se inserta', async () => {
      const ok = await facade.save(DRAFT);

      expect(ok).toBe(true);
      expect(insertPayload).toMatchObject({ name: 'Aviso de feriado', active: true });
      expect(updatePayload).toBeUndefined();
    });

    it('marca la plantilla como de comunicado, no de otro uso de la tabla', async () => {
      await facade.save(DRAFT);

      // `notification_templates` es compartida con otros usos previstos del esquema.
      expect(insertPayload.type).toBe('announcement');
    });

    it('una plantilla con id se actualiza en vez de duplicarse', async () => {
      const ok = await facade.save({ ...DRAFT, id: 5, name: 'Editada' });

      expect(ok).toBe(true);
      expect(updatePayload).toMatchObject({ name: 'Editada' });
      expect(insertPayload).toBeUndefined();
    });

    it('un draft inválido no llega a la BD', async () => {
      const ok = await facade.save({ ...DRAFT, name: '   ' });

      expect(ok).toBe(false);
      expect(insertPayload).toBeUndefined();
      expect(facade.error()).toBeTruthy();
    });

    // AC4 — la RLS solo deja escribir al admin; la secretaría recibe el rechazo.
    it('AC4 · si la BD rechaza la escritura, se expone el error y no se miente', async () => {
      mutationError = { message: 'new row violates row-level security policy' };

      const ok = await facade.save(DRAFT);

      expect(ok).toBe(false);
      expect(facade.error()).toBeTruthy();
    });
  });

  describe('remove()', () => {
    it('borra la plantilla', async () => {
      const ok = await facade.remove(5);

      expect(ok).toBe(true);
      expect(deleteCalled).toBe(true);
    });

    it('AC4 · un rechazo de RLS al borrar se reporta como error', async () => {
      mutationError = { message: 'violates row-level security policy' };

      expect(await facade.remove(5)).toBe(false);
      expect(facade.error()).toBeTruthy();
    });
  });
});
