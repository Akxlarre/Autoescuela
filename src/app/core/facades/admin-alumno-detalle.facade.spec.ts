import { TestBed } from '@angular/core/testing';
import { AdminAlumnoDetalleFacade } from './admin-alumno-detalle.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { DmsViewerService } from '@core/services/ui/dms-viewer.service';
import { NotificationsFacade } from '@core/facades/notifications.facade';

describe('AdminAlumnoDetalleFacade', () => {
  let facade: AdminAlumnoDetalleFacade;
  let supabaseSpy: any;
  let invokeSpy: any;
  let dmsViewerSpy: any;
  let toastSpy: any;
  let notificationsSpy: any;

  beforeEach(() => {
    invokeSpy = vi.fn().mockResolvedValue({
      data: { pdfUrl: 'https://signed/url', pdfPath: 'student-licenses/1/Carnet.pdf' },
      error: null,
    });

    supabaseSpy = { client: vi.fn() };
    (supabaseSpy as any).client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
        insert: vi.fn().mockResolvedValue({ error: null }),
      }),
      functions: { invoke: invokeSpy },
    };

    dmsViewerSpy = { openByUrl: vi.fn() };
    toastSpy = { error: vi.fn(), success: vi.fn(), warning: vi.fn(), info: vi.fn() };
    notificationsSpy = {
      notifyUsers: vi.fn().mockResolvedValue(undefined),
      notifyRole: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        AdminAlumnoDetalleFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: DmsViewerService, useValue: dmsViewerSpy },
        { provide: NotificationsFacade, useValue: notificationsSpy },
      ],
    });

    facade = TestBed.inject(AdminAlumnoDetalleFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should have initial empty state', () => {
    expect(facade.alumno()).toBeNull();
    expect(facade.inasistencias()).toEqual([]);
    expect(facade.clasesPracticas()).toEqual([]);
    expect(facade.isLoading()).toBe(false);
  });

  it('porcentajePracticas should return 0 initially', () => {
    expect(facade.porcentajePracticas()).toBe(0);
  });

  it('porcentajeTeoricas should return 0 initially', () => {
    expect(facade.porcentajeTeoricas()).toBe(0);
  });

  describe('generarCarnet', () => {
    it("variant 'initial' invoca la Edge Function con variant=initial y setea el path inicial", async () => {
      await facade.generarCarnet(1, 'initial');

      expect(invokeSpy).toHaveBeenCalledWith('generate-student-license-pdf', {
        body: { enrollment_id: 1, variant: 'initial' },
      });
      expect(facade.licenseInitialPath()).toBe('student-licenses/1/Carnet.pdf');
      expect(facade.licenseFullPath()).toBeNull();
      expect(dmsViewerSpy.openByUrl).toHaveBeenCalled();
    });

    it("variant 'full' invoca con variant=full y setea sólo el path completo", async () => {
      await facade.generarCarnet(7, 'full');

      expect(invokeSpy).toHaveBeenCalledWith('generate-student-license-pdf', {
        body: { enrollment_id: 7, variant: 'full' },
      });
      expect(facade.licenseFullPath()).toBe('student-licenses/1/Carnet.pdf');
      expect(facade.licenseInitialPath()).toBeNull();
    });

    it('default es initial cuando no se pasa variant', async () => {
      await facade.generarCarnet(3);
      expect(invokeSpy).toHaveBeenCalledWith('generate-student-license-pdf', {
        body: { enrollment_id: 3, variant: 'initial' },
      });
    });
  });

  describe('reprogramarClase — notificaciones (Spec 0024, AC5)', () => {
    const basePayload = {
      sessionId: 55,
      enrollmentId: 7,
      claseNumero: 3,
      instructorId: 100,
      scheduledAt: '2026-07-10T14:00:00Z',
    };

    const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

    function mockFromByTable(handlers: Record<string, any>) {
      return vi.fn().mockImplementation((table: string) => {
        if (handlers[table]) return handlers[table];
        return {
          select: vi.fn().mockReturnValue({
            eq: vi
              .fn()
              .mockReturnValue({ single: vi.fn().mockResolvedValue({ data: null, error: null }) }),
          }),
          update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      });
    }

    beforeEach(() => {
      (facade as any)._alumno.set({ userId: 42, nombre: 'Ana Alumna' });
      (facade as any)._slotVehicleMap.set(basePayload.scheduledAt, 9);
    });

    it('notifica al alumno y al instructor cuando el instructor no cambia', async () => {
      const classBSessionsHandler = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { instructor_id: 100 }, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      };
      const instructorsHandler = {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [{ id: 100, user_id: 200 }], error: null }),
        }),
      };
      supabaseSpy.client.from = mockFromByTable({
        class_b_sessions: classBSessionsHandler,
        instructors: instructorsHandler,
      });

      await facade.reprogramarClase(basePayload);
      await flushMicrotasks();

      expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith(
        [42],
        expect.objectContaining({ referenceType: 'class_b', referenceId: 55 }),
      );
      expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith(
        [200],
        expect.objectContaining({ referenceType: 'class_b', referenceId: 55 }),
      );
      expect(notificationsSpy.notifyUsers).toHaveBeenCalledTimes(2);
    });

    it('notifica también al instructor anterior cuando el instructor cambia', async () => {
      const classBSessionsHandler = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { instructor_id: 999 }, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      };
      const instructorsHandler = {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            data: [
              { id: 100, user_id: 200 },
              { id: 999, user_id: 777 },
            ],
            error: null,
          }),
        }),
      };
      supabaseSpy.client.from = mockFromByTable({
        class_b_sessions: classBSessionsHandler,
        instructors: instructorsHandler,
      });

      await facade.reprogramarClase(basePayload);
      await flushMicrotasks();

      expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith([42], expect.any(Object));
      expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith([200], expect.any(Object));
      expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith([777], expect.any(Object));
      expect(notificationsSpy.notifyUsers).toHaveBeenCalledTimes(3);
    });

    it('no rompe la reprogramación si falla la notificación (AC-E1)', async () => {
      const classBSessionsHandler = {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { instructor_id: 100 }, error: null }),
          }),
        }),
        update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }),
      };
      supabaseSpy.client.from = mockFromByTable({ class_b_sessions: classBSessionsHandler });
      notificationsSpy.notifyUsers.mockRejectedValue(new Error('insert failed'));

      await expect(facade.reprogramarClase(basePayload)).resolves.toBeUndefined();
      await flushMicrotasks();
    });

    it('crea la sesión (sin sessionId) y notifica sin buscar instructor anterior', async () => {
      const insertPayload = { ...basePayload, sessionId: null };
      const classBSessionsHandler = {
        insert: vi.fn().mockResolvedValue({ error: null }),
      };
      const instructorsHandler = {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({ data: [{ id: 100, user_id: 200 }], error: null }),
        }),
      };
      supabaseSpy.client.from = mockFromByTable({
        class_b_sessions: classBSessionsHandler,
        instructors: instructorsHandler,
      });

      await facade.reprogramarClase(insertPayload);
      await flushMicrotasks();

      expect(classBSessionsHandler.insert).toHaveBeenCalled();
      expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith([42], expect.any(Object));
      expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith([200], expect.any(Object));
      expect(notificationsSpy.notifyUsers).toHaveBeenCalledTimes(2);
    });
  });
});
