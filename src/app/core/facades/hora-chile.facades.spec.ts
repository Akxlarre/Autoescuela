/**
 * Spec 0024-m — contrato transversal de "hoy en Chile" en los facades.
 *
 * Cada caso fija el reloj a las 23:30 hora Chile del 6 de octubre de 2026 (02:30 UTC del día 7)
 * y verifica que la fecha de negocio que el facade ESCRIBE o usa para FILTRAR sea el día 6.
 * Con el cálculo antiguo en UTC todos estos casos daban el día 7.
 *
 * Los métodos se invocan sobre el prototipo con un `this` falso: así el test mira solo la
 * decisión de fecha, sin montar las dependencias de cada facade.
 */
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { NotificationsFacade } from '@core/facades/notifications.facade';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { ToastService } from '@core/services/ui/toast.service';
import { AdminPreInscritosFacade } from './admin-pre-inscritos.facade';
import { AsistenciaProfesionalFacade } from './asistencia-profesional.facade';
import { CertificacionClaseBFacade } from './certificacion-clase-b.facade';
import { CertificacionProfesionalFacade } from './certificacion-profesional.facade';
import { DashboardAlertsFacade } from './dashboard-alerts.facade';
import { EnrollmentPaymentFacade } from './enrollment-payment.facade';
import { EnrollmentFacade } from './enrollment.facade';
import { RelatoresFacade } from './relatores.facade';
import { ReportesContablesFacade } from './reportes-contables.facade';
import { ServiciosEspecialesFacade } from './servicios-especiales.facade';
import { StudentHomeFacade } from './student-home.facade';

interface Call {
  table: string;
  method: string;
  args: unknown[];
}

/** Objeto que acepta cualquier acceso o llamada y se devuelve a sí mismo. No es thenable. */
function stub(): any {
  const self: any = new Proxy(function () {}, {
    get: (_target, prop) => (prop === 'then' ? undefined : self),
    apply: () => self,
  });
  return self;
}

/** Cliente Supabase que registra cada llamada encadenada y resuelve con filas de relleno. */
function recordingSupabase(results: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  const from = (table: string) => {
    let single = false;
    const chain: any = new Proxy(function () {}, {
      get(_target, prop) {
        if (prop === 'then') {
          return (resolve: (value: unknown) => unknown) =>
            resolve({
              data: single
                ? (results[`${table}:single`] ?? { id: 1 })
                : (results[table] ?? [{ id: 1 }]),
              error: null,
              count: 0,
            });
        }
        return (...args: unknown[]) => {
          if (prop === 'single' || prop === 'maybeSingle') single = true;
          calls.push({ table, method: String(prop), args });
          return chain;
        };
      },
    });
    return chain;
  };
  return { client: { from }, calls };
}

/** `this` falso: usa lo que se le pasa y responde con un stub a todo lo demás. */
function fakeThis(fields: Record<string, unknown>): any {
  return new Proxy(fields, {
    get: (target, prop) => (prop in target ? target[prop as string] : stub()),
  });
}

/** Ejecuta un método que puede fallar más adelante por el `this` falso: solo importan las llamadas. */
async function run(fn: () => unknown): Promise<void> {
  try {
    await fn();
  } catch {
    // El flujo posterior a la consulta no es objeto de estos tests.
  }
}

const find = (calls: Call[], table: string, method: string) =>
  calls.filter((c) => c.table === table && c.method === method);

/** Primer argumento de un insert, sea un objeto o un arreglo de un elemento. */
function insertedRow(calls: Call[], table: string): Record<string, unknown> {
  const arg = find(calls, table, 'insert')[0]?.args[0];
  return (Array.isArray(arg) ? arg[0] : arg) as Record<string, unknown>;
}

describe('Hoy en Chile en los facades — 23:30 hora Chile (spec 0024-m)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-07T02:30:00.000Z'));
  });
  afterEach(() => vi.useRealTimers());

  describe('fechas que se escriben', () => {
    it('EnrollmentPaymentFacade.recordPayment guarda el pago con la fecha de hoy', async () => {
      const supabase = recordingSupabase();
      const self = fakeThis({
        supabase,
        _pricing: () => ({}),
        _paymentMethod: () => 'efectivo',
        totalToPay: () => 1000,
        _documentNumber: () => '',
      });

      await run(() => EnrollmentPaymentFacade.prototype.recordPayment.call(self, 10, 1));

      expect(insertedRow(supabase.calls, 'payments')['payment_date']).toBe('2026-10-06');
    });

    it('AdminPreInscritosFacade.completarMatricula guarda el pago con la fecha de hoy', async () => {
      const supabase = recordingSupabase();
      const self = fakeThis({
        supabase,
        _preInscritos: () => [{ id: 1, tempUserId: 2, branchId: 1 }],
        authFacade: { currentUser: () => ({ dbId: 9 }) },
        ensureStudentRecord: async () => 5,
        generateEnrollmentNumber: async () => 'M-1',
      });
      const payload = {
        preInscritoId: 1,
        courseId: 1,
        promotionCourseId: null,
        basePrice: 1000,
        discountAmount: 0,
        totalPaid: 1000,
        paymentMethod: 'efectivo',
      };

      await run(() =>
        AdminPreInscritosFacade.prototype.completarMatricula.call(self, payload as never),
      );

      expect(insertedRow(supabase.calls, 'payments')['payment_date']).toBe('2026-10-06');
    });

    it('RelatoresFacade.crearRelator registra al relator con la fecha de hoy', async () => {
      const supabase = recordingSupabase();
      const self = fakeThis({ supabase });
      const payload = {
        rut: '1-9',
        firstNames: 'Ana',
        paternalLastName: 'Rojas',
        specializations: [],
      };

      await run(() => RelatoresFacade.prototype.crearRelator.call(self, payload as never));

      expect(insertedRow(supabase.calls, 'lecturers')['registration_date']).toBe('2026-10-06');
    });
  });

  describe('"hoy" como filtro', () => {
    it('EnrollmentPaymentFacade.loadAvailableDiscounts filtra la vigencia contra hoy', async () => {
      const supabase = recordingSupabase();

      await run(() =>
        EnrollmentPaymentFacade.prototype.loadAvailableDiscounts.call(
          fakeThis({ supabase }),
          'class_b',
          1,
          1,
        ),
      );

      const filters = find(supabase.calls, 'discounts', 'or').map((c) => c.args[0]);
      expect(filters).toContain('valid_until.is.null,valid_until.gte.2026-10-06');
    });

    it('EnrollmentFacade.loadSenceCodes filtra la vigencia contra hoy', async () => {
      const supabase = recordingSupabase();

      await run(() => EnrollmentFacade.prototype.loadSenceCodes.call(fakeThis({ supabase }), 3));

      const filters = find(supabase.calls, 'sence_codes', 'or').map((c) => c.args[0]);
      expect(filters).toContain('end_date.is.null,end_date.gte.2026-10-06');
    });

    it('DashboardAlertsFacade: documentos vencidos y por vencer se miden desde hoy', async () => {
      // Sin configuración, el horizonte por defecto es de 30 días: 6-oct + 30 = 5-nov.
      const supabase = recordingSupabase({ alert_config: [] });
      const proto = DashboardAlertsFacade.prototype as unknown as {
        checkExpiredDocuments(branchId: number | null): Promise<unknown>;
      };

      await run(() => proto.checkExpiredDocuments.call(fakeThis({ supabase }), null));

      const calls = supabase.calls.filter((c) => c.table === 'vehicle_documents');
      const withArgs = (method: string) =>
        calls.filter((c) => c.method === method).map((c) => c.args);
      expect(withArgs('lt')).toContainEqual(['expiry_date', '2026-10-06']);
      expect(withArgs('gte')).toContainEqual(['expiry_date', '2026-10-06']);
      expect(withArgs('lte')).toContainEqual(['expiry_date', '2026-11-05']);
    });

    it('CertificacionProfesionalFacade: una promoción que termina hoy ya es certificable', async () => {
      const supabase = recordingSupabase();
      const proto = CertificacionProfesionalFacade.prototype as unknown as {
        fetchPromociones(): Promise<unknown>;
      };

      await run(() => proto.fetchPromociones.call(fakeThis({ supabase })));

      const filters = find(supabase.calls, 'professional_promotions', 'or').map((c) => c.args[0]);
      expect(filters).toContain(
        'status.eq.finished,and(status.eq.in_progress,end_date.eq.2026-10-06)',
      );
    });

    it('StudentHomeFacade: la próxima práctica profesional es posterior a hoy', async () => {
      const supabase = recordingSupabase();
      const proto = StudentHomeFacade.prototype as unknown as {
        buildProfessionalSnapshot(e: unknown, id: number, name: string): Promise<unknown>;
      };

      await run(() =>
        proto.buildProfessionalSnapshot.call(
          fakeThis({ supabase }),
          { promotion_course_id: 5 },
          1,
          'Ana',
        ),
      );

      const filters = find(supabase.calls, 'professional_practice_sessions', 'gt').map(
        (c) => c.args,
      );
      expect(filters).toContainEqual(['date', '2026-10-06']);
    });
  });

  describe('derivados de "hoy" en la UI', () => {
    const anyStub = () => ({ useValue: stub() });

    it('AsistenciaProfesionalFacade.weekDays arma la semana de Chile y marca hoy', () => {
      TestBed.configureTestingModule({
        providers: [
          AsistenciaProfesionalFacade,
          { provide: SupabaseService, ...anyStub() },
          { provide: ToastService, ...anyStub() },
          { provide: AuthFacade, ...anyStub() },
          { provide: BranchFacade, ...anyStub() },
          { provide: ConfirmModalService, ...anyStub() },
          { provide: ErrorSanitizerService, ...anyStub() },
        ],
      });
      const facade = TestBed.inject(AsistenciaProfesionalFacade);

      const days = facade.weekDays();

      // El 6 de octubre de 2026 es martes: la semana va del lunes 5 al sábado 10.
      expect(days.map((d) => d.date)).toEqual([
        '2026-10-05',
        '2026-10-06',
        '2026-10-07',
        '2026-10-08',
        '2026-10-09',
        '2026-10-10',
      ]);
      expect(days.filter((d) => d.isToday).map((d) => d.date)).toEqual(['2026-10-06']);
      expect(days[1]).toMatchObject({ label: '6 Oct', dayLabel: 'Mar' });
    });

    it('ServiciosEspecialesFacade.kpis cuenta "ventas del mes" con el mes de Chile', () => {
      // 23:30 hora Chile del 31 de octubre: en UTC ya es noviembre.
      vi.setSystemTime(new Date('2026-11-01T02:30:00.000Z'));
      TestBed.configureTestingModule({
        providers: [
          ServiciosEspecialesFacade,
          { provide: SupabaseService, ...anyStub() },
          { provide: AuthFacade, ...anyStub() },
          { provide: BranchFacade, ...anyStub() },
          { provide: NotificationsFacade, ...anyStub() },
          { provide: LayoutDrawerFacadeService, ...anyStub() },
          { provide: ErrorSanitizerService, ...anyStub() },
        ],
      });
      const facade = TestBed.inject(ServiciosEspecialesFacade);
      (facade as unknown as { _ventas: { set(v: unknown[]): void } })._ventas.set([
        { fecha: '2026-10-31', cobrado: true, precio: 1000 },
        { fecha: '2026-10-15', cobrado: false, precio: 500 },
        { fecha: '2026-11-01', cobrado: true, precio: 700 },
      ]);

      const kpis = facade.kpis();

      expect(kpis.ventasMes).toBe(2);
      expect(kpis.recaudacionMes).toBe(1000);
    });
  });
});

describe('CertificacionClaseBFacade — fecha de término en día de Chile (spec 0024-m)', () => {
  it('una última práctica a las 23:30 hora Chile termina ese día, no el siguiente', async () => {
    const supabase = recordingSupabase({
      enrollments: [
        {
          id: 1,
          certificate_b_pdf_url: null,
          courses: { name: 'Clase B', practical_hours: 9 },
          students: {
            id: 2,
            users: {
              first_names: 'Ana',
              paternal_last_name: 'Rojas',
              maternal_last_name: null,
              rut: '11111111-1',
              email: '',
            },
          },
          certificates: [],
        },
      ],
      // 23:30 hora Chile del 6 de octubre = 02:30 UTC del día 7.
      v_student_progress_b: [
        { enrollment_id: 1, last_practice_session: '2026-10-07T02:30:00+00:00' },
      ],
      class_b_sessions: [],
    });
    const setAlumnos = vi.fn();
    const self = fakeThis({
      supabase,
      getActiveBranchId: () => null,
      authFacade: { currentUser: () => ({ role: 'admin' }) },
      certGuard: { isCurrent: () => true },
      _alumnos: { set: setAlumnos },
    });
    const proto = CertificacionClaseBFacade.prototype as unknown as {
      fetchAlumnos(token: number): Promise<void>;
    };

    await proto.fetchAlumnos.call(self, 1);

    expect(setAlumnos).toHaveBeenCalledTimes(1);
    expect(setAlumnos.mock.calls[0][0][0].fechaTermino).toBe('2026-10-06');
  });
});

describe('ReportesContablesFacade — rango del reporte en días de Chile (spec 0024-m)', () => {
  it('los cobros de cursos singulares se piden como rango semiabierto', () => {
    const supabase = recordingSupabase();
    const proto = ReportesContablesFacade.prototype as unknown as {
      querySingularSales(desde: string, hasta: string): unknown;
    };

    proto.querySingularSales.call(fakeThis({ supabase }), '2026-10-01', '2026-10-06');

    const calls = supabase.calls.filter((c) => c.table === 'standalone_course_enrollments');
    // Octubre: Chile en UTC-3. "Hasta" es el inicio del día siguiente, exclusivo.
    expect(calls.find((c) => c.method === 'gte')?.args).toEqual([
      'paid_at',
      '2026-10-01T03:00:00.000Z',
    ]);
    expect(calls.find((c) => c.method === 'lt')?.args).toEqual([
      'paid_at',
      '2026-10-07T03:00:00.000Z',
    ]);
  });
});
