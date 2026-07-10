import { TestBed } from '@angular/core/testing';
import { EvaluacionesProfesionalFacade } from './evaluaciones-profesional.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { NotificationsFacade } from '@core/facades/notifications.facade';

const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Cobertura de la lógica de edición local del gradebook (fix-024).
 * El cálculo de KPIs/progreso vive en `core/utils/gradebook-stats.ts`
 * (probado por separado). Aquí se prueba el método de corrección de nota
 * mínima al blur (AC8) + el dirty tracking existente.
 */
describe('EvaluacionesProfesionalFacade', () => {
  let facade: EvaluacionesProfesionalFacade;
  let supabaseSpy: any;
  let toastSpy: any;
  let authSpy: any;
  let notificationsSpy: any;

  const pcQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({
      data: {
        id: 25,
        courses: { name: 'Profesional A2', license_class: 'A2' },
        professional_promotions: { name: 'Promo Test', code: 'P1' },
      },
      error: null,
    }),
  };

  const enrQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({
      data: [
        {
          id: 105,
          students: {
            users: {
              first_names: 'Benjamín',
              paternal_last_name: 'Rebolledo',
              maternal_last_name: 'Soto',
              rut: '13.201.368-3',
            },
          },
        },
      ],
      error: null,
    }),
  };

  const gradesQuery = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data: [], error: null }),
  };

  beforeEach(async () => {
    supabaseSpy = {
      client: {
        from: vi.fn((table: string) => {
          if (table === 'promotion_courses') return pcQuery;
          if (table === 'enrollments') return enrQuery;
          if (table === 'professional_module_grades') return gradesQuery;
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }),
      },
    };
    toastSpy = { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() };
    authSpy = { currentUser: vi.fn().mockReturnValue({ dbId: 1 }) };
    notificationsSpy = { notifyUsers: vi.fn().mockResolvedValue(undefined) };

    TestBed.configureTestingModule({
      providers: [
        EvaluacionesProfesionalFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: AuthFacade, useValue: authSpy },
        { provide: NotificationsFacade, useValue: notificationsSpy },
      ],
    });

    facade = TestBed.inject(EvaluacionesProfesionalFacade);
    // Poblar la grilla con un alumno y 7 celdas vacías.
    await facade.loadGrilla(25);
  });

  it('carga la grilla con el alumno y 7 módulos', () => {
    const g = facade.grilla();
    expect(g).not.toBeNull();
    expect(g!.totalAlumnos).toBe(1);
    expect(g!.filas[0].notas.length).toBe(7);
    expect(g!.moduleNames.length).toBe(7);
  });

  describe('corregirNotaMinima (AC8)', () => {
    it('eleva a 10 una nota < 10 y avisa con toast', () => {
      facade.setNota(105, 0, 5); // valor intermedio, sin clamp de mínimo
      facade.corregirNotaMinima(105, 0);

      expect(facade.grilla()!.filas[0].notas[0].grade).toBe(10);
      expect(toastSpy.info).toHaveBeenCalledTimes(1);
    });

    it('no toca una nota válida (>= 10) ni emite toast', () => {
      facade.setNota(105, 1, 80);
      facade.corregirNotaMinima(105, 1);

      expect(facade.grilla()!.filas[0].notas[1].grade).toBe(80);
      expect(toastSpy.info).not.toHaveBeenCalled();
    });

    it('es no-op cuando la celda está vacía (null)', () => {
      facade.corregirNotaMinima(105, 2);

      expect(facade.grilla()!.filas[0].notas[2].grade).toBeNull();
      expect(toastSpy.info).not.toHaveBeenCalled();
    });
  });

  describe('dirty tracking', () => {
    it('hayDirty es false al cargar y true tras editar una nota', () => {
      expect(facade.hayDirty()).toBe(false);
      facade.setNota(105, 0, 88);
      expect(facade.hayDirty()).toBe(true);
    });
  });

  // ── spec 0025 (T3.1): notificar notas confirmadas ──────────────────────────
  describe('confirmarNotas — notificación al alumno (spec 0025, AC3)', () => {
    beforeEach(() => {
      // Sobreescribe 'enrollments' para distinguir el resolver (in('id',...)) del
      // fetch de loadGrilla (in('status',...) → order('id')) sin tocar los mocks
      // compartidos por el resto de la suite.
      const enrollmentsMock: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn((col: string) => {
          if (col === 'id') {
            return Promise.resolve({
              data: [{ id: 105, students: { user_id: 200 } }],
              error: null,
            });
          }
          return enrollmentsMock;
        }),
        order: vi.fn().mockResolvedValue({
          data: [
            {
              id: 105,
              students: {
                users: {
                  first_names: 'Benjamín',
                  paternal_last_name: 'Rebolledo',
                  maternal_last_name: 'Soto',
                  rut: '13.201.368-3',
                },
              },
            },
          ],
          error: null,
        }),
      };

      supabaseSpy.client.from = vi.fn((table: string) => {
        if (table === 'promotion_courses') return pcQuery;
        if (table === 'enrollments') return enrollmentsMock;
        if (table === 'professional_module_grades') {
          return {
            upsert: vi.fn().mockResolvedValue({ error: null }),
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });
    });

    it('notifica al alumno con mensaje de aprobado (promedio >= 75)', async () => {
      facade.setNota(105, 0, 90);

      const ok = await facade.confirmarNotas();
      await flushMicrotasks();

      expect(ok).toBe(true);
      expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith(
        [200],
        expect.objectContaining({ referenceType: 'professional_session' }),
      );
      const message = notificationsSpy.notifyUsers.mock.calls[0][1].message as string;
      expect(message).not.toContain('no alcanzó');
    });

    it('notifica al alumno con mensaje de reprobado (promedio < 75)', async () => {
      facade.setNota(105, 0, 60);

      await facade.confirmarNotas();
      await flushMicrotasks();

      const message = notificationsSpy.notifyUsers.mock.calls[0][1].message as string;
      expect(message).toContain('no alcanzó');
    });

    it('no notifica si no hay notas nuevas que confirmar', async () => {
      const ok = await facade.confirmarNotas();
      await flushMicrotasks();

      expect(ok).toBe(true);
      expect(notificationsSpy.notifyUsers).not.toHaveBeenCalled();
    });

    it('un fallo en notifyUsers no revierte la confirmación de notas', async () => {
      facade.setNota(105, 0, 90);
      notificationsSpy.notifyUsers.mockRejectedValue(new Error('network error'));

      const ok = await facade.confirmarNotas();
      await flushMicrotasks();

      expect(ok).toBe(true);
    });
  });
});
