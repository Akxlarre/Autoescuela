import { TestBed } from '@angular/core/testing';
import { ClassBTopicsFacade } from './class-b-topics.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { ToastService } from '@core/services/ui/toast.service';

describe('ClassBTopicsFacade', () => {
  let facade: ClassBTopicsFacade;
  let supabaseSpy: any;
  let toastSpy: any;
  /** Lo que devuelve el SELECT del listado. */
  let fetchResult: { data: unknown; error: unknown };
  /** Lo que devuelve el UPDATE. */
  let updateResult: { data: unknown; error: unknown };
  /** Payload que recibió el UPDATE, para poder afirmarlo. */
  let updatePayload: any;
  let orderSpy: any;

  const FILA = (n: number, topic: string) => ({
    id: `uuid-${n}`,
    class_number: n,
    topic,
    created_at: '2026-09-22T00:00:00Z',
    updated_at: '2026-09-22T00:00:00Z',
  });

  beforeEach(() => {
    fetchResult = { data: [FILA(1, 'Psicotécnico / Pre-conducción')], error: null };
    updateResult = { data: FILA(1, 'Tema editado'), error: null };
    updatePayload = undefined;

    orderSpy = vi.fn().mockImplementation(() => Promise.resolve(fetchResult));

    supabaseSpy = {
      client: {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({ order: orderSpy }),
          update: vi.fn().mockImplementation((payload: any) => {
            updatePayload = payload;
            return {
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(updateResult)),
                }),
              }),
            };
          }),
        }),
      },
    };

    toastSpy = { error: vi.fn(), success: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        ClassBTopicsFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: ToastService, useValue: toastSpy },
        {
          provide: ErrorSanitizerService,
          useValue: { sanitize: (e: Error) => ({ message: e.message }) },
        },
      ],
    });

    facade = TestBed.inject(ClassBTopicsFacade);
  });

  it('arranca con estado vacío', () => {
    expect(facade.topics()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
    expect(facade.error()).toBeNull();
  });

  describe('initialize()', () => {
    it('carga la malla ordenada por número de clase', async () => {
      await facade.initialize();

      expect(facade.topics()).toHaveLength(1);
      expect(facade.topicsByClassNumber().get(1)).toBe('Psicotécnico / Pre-conducción');
      expect(orderSpy).toHaveBeenCalledWith('class_number', { ascending: true });
    });

    // Se mira isLoading ANTES de esperar la promesa: después del await siempre es false.
    it('la primera carga SÍ muestra skeleton', async () => {
      const pending = facade.initialize();

      expect(facade.isLoading()).toBe(true);

      await pending;
      expect(facade.isLoading()).toBe(false);
    });

    it('la segunda entrada NO vuelve a mostrar skeleton, pero sí refresca (SWR)', async () => {
      await facade.initialize();
      const llamadasIniciales = supabaseSpy.client.from.mock.calls.length;

      const pending = facade.initialize();
      expect(facade.isLoading()).toBe(false);

      await pending;
      expect(supabaseSpy.client.from.mock.calls.length).toBeGreaterThan(llamadasIniciales);
    });

    it('un error de carga queda expuesto en el signal, no solo en un toast', async () => {
      fetchResult = { data: null, error: new Error('conexión caída') };

      await facade.initialize();

      expect(facade.error()).toContain('conexión caída');
      expect(toastSpy.error).toHaveBeenCalled();
    });

    // El refresh SWR no debe vaciar la pantalla si falla: los datos viejos siguen sirviendo.
    it('si el refresh silencioso falla, conserva la malla ya cargada', async () => {
      await facade.initialize();
      fetchResult = { data: null, error: new Error('timeout') };

      await facade.initialize();

      expect(facade.topics()).toHaveLength(1);
    });
  });

  describe('updateTopic()', () => {
    it('guarda el tema y refleja el cambio en el estado local', async () => {
      await facade.initialize();

      const ok = await facade.updateTopic(1, 'Tema editado');

      expect(ok).toBe(true);
      expect(updatePayload).toEqual({ topic: 'Tema editado' });
      expect(facade.topicsByClassNumber().get(1)).toBe('Tema editado');
      expect(toastSpy.success).toHaveBeenCalled();
    });

    it('recorta los espacios antes de guardar', async () => {
      await facade.initialize();

      await facade.updateTopic(1, '   Tema editado   ');

      expect(updatePayload).toEqual({ topic: 'Tema editado' });
    });

    // La tabla tiene CHECK de no-vacío; cortar acá evita el viaje y da un mensaje claro.
    it('un tema vacío no llega a la BD', async () => {
      await facade.initialize();

      const ok = await facade.updateTopic(1, '   ');

      expect(ok).toBe(false);
      expect(updatePayload).toBeUndefined();
      expect(facade.error()).toContain('no puede quedar vacío');
    });

    // Solo admin puede escribir: si la RLS filtra la fila, el UPDATE vuelve sin data.
    // Con `single()` eso sería un error de "0 filas" y se leería como fallo de red.
    it('sin permisos (RLS filtra la fila) reporta el motivo y no toca el estado', async () => {
      await facade.initialize();
      updateResult = { data: null, error: null };

      const ok = await facade.updateTopic(1, 'Intento sin permiso');

      expect(ok).toBe(false);
      expect(facade.error()).toContain('sin permisos');
      expect(facade.topicsByClassNumber().get(1)).toBe('Psicotécnico / Pre-conducción');
    });
  });
});
