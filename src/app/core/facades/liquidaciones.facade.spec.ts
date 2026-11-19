import { TestBed } from '@angular/core/testing';
import { effect, signal } from '@angular/core';
import { LiquidacionesFacade } from './liquidaciones.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { NotificationsFacade } from '@core/facades/notifications.facade';
import { PayrollConfigFacade, PAYROLL_RATE_FALLBACK } from '@core/facades/payroll-config.facade';
import type { LiquidacionRow } from '@core/models/ui/liquidaciones.model';

// ─── Doble de supabase ────────────────────────────────────────────────────────

interface Respuesta {
  data: unknown;
  error: unknown;
}
type Filtro = [string, ...unknown[]];
type Lectura = (filtros: Filtro[]) => Respuesta | Promise<Respuesta>;
interface Escritura {
  table: string;
  op: 'upsert' | 'update' | 'delete';
  payload: unknown;
  filtros: Filtro[];
}

const ok = (data: unknown): Respuesta => ({ data, error: null });
const fallo = (): Respuesta => ({ data: null, error: { message: 'boom' } });
/** Deja correr las promesas pendientes (los mesAnterior()/refrescos no se esperan). */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const ANA = {
  id: 10,
  user_id: 100,
  users: { id: 100, first_names: 'Ana', paternal_last_name: 'Sur', rut: '1-1', branch_id: 1 },
};
const BETO = {
  id: 20,
  user_id: 200,
  users: { id: 200, first_names: 'Beto', paternal_last_name: 'Norte', rut: '2-2', branch_id: 2 },
};

describe('LiquidacionesFacade', () => {
  let facade: LiquidacionesFacade;
  let supabaseSpy: any;
  let toastSpy: any;
  let notificationsSpy: any;
  let payrollConfigSpy: any;

  const currentUser = signal<any>(null);
  const selectedBranchId = signal<number | null>(null);

  let tablas: Record<string, Lectura>;
  let respuestasEscritura: Record<string, () => unknown>;
  let escrituras: Escritura[];
  let lecturas: string[];
  let realtimeHandlers: (() => void)[];

  function chainFor(table: string) {
    const filtros: Filtro[] = [];
    let op: Escritura['op'] | null = null;
    let payload: unknown;
    const ejecutar = (): Promise<unknown> => {
      if (op) {
        escrituras.push({ table, op, payload, filtros });
        const responder = respuestasEscritura[`${table}:${op}`];
        return Promise.resolve(responder ? responder() : { error: null });
      }
      lecturas.push(table);
      const leer = tablas[table];
      return Promise.resolve(leer ? leer(filtros) : ok([]));
    };
    const filtrar =
      (nombre: string) =>
      (...args: unknown[]) => {
        filtros.push([nombre, ...args]);
        return chain;
      };
    const chain: any = {
      select: () => chain,
      eq: filtrar('eq'),
      gte: filtrar('gte'),
      lte: filtrar('lte'),
      upsert: (record: unknown) => {
        op = 'upsert';
        payload = record;
        return chain;
      },
      update: (record: unknown) => {
        op = 'update';
        payload = record;
        return chain;
      },
      delete: () => {
        op = 'delete';
        return chain;
      },
      then: (onOk: any, onError: any) => ejecutar().then(onOk, onError),
    };
    return chain;
  }

  /** Ana: 9 h a $5.000, anticipo $12.000, pendiente. Beto: 8 h a $6.500, pagado. */
  function datosCompletos(): Record<string, Lectura> {
    return {
      instructors: () => ok([ANA, BETO]),
      instructor_monthly_hours: () =>
        ok([
          { instructor_id: 10, practical_sessions: 12, total_equivalent: 9 },
          { instructor_id: 20, practical_sessions: 11, total_equivalent: 8 },
        ]),
      instructor_advances: () => ok([{ instructor_id: 10, amount: 12000 }]),
      instructor_monthly_payments: () =>
        ok([{ instructor_id: 20, id: 555, payment_status: 'paid', paid_at: '2026-09-01' }]),
    };
  }

  const fila = (id: number): LiquidacionRow =>
    facade.liquidaciones().find((r) => r.instructorId === id)!;
  const conEscrituras = (table: string, op: Escritura['op']) =>
    escrituras.filter((e) => e.table === table && e.op === op);

  beforeEach(() => {
    currentUser.set({ role: 'admin', branchId: null, dbId: 1 });
    selectedBranchId.set(null);
    tablas = datosCompletos();
    respuestasEscritura = {};
    escrituras = [];
    lecturas = [];
    realtimeHandlers = [];

    toastSpy = { error: vi.fn(), success: vi.fn(), warning: vi.fn() };
    notificationsSpy = { notifyUsers: vi.fn().mockResolvedValue(undefined) };
    const rateForBranch = vi.fn((id: number | null | undefined) =>
      id === 1 ? 5000 : id === 2 ? 6500 : PAYROLL_RATE_FALLBACK,
    );
    payrollConfigSpy = {
      rateForBranch,
      readRates: vi.fn(async () => (id: number | null | undefined) => rateForBranch(id)),
    };

    const channel: any = {
      on: vi.fn((_type: string, _filter: unknown, handler: () => void) => {
        realtimeHandlers.push(handler);
        return channel;
      }),
      subscribe: vi.fn(() => channel),
    };
    supabaseSpy = {
      client: {
        channel: vi.fn(() => channel),
        removeChannel: vi.fn(),
        from: vi.fn((table: string) => chainFor(table)),
      },
    };

    TestBed.configureTestingModule({
      providers: [
        LiquidacionesFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: AuthFacade, useValue: { currentUser } },
        { provide: BranchFacade, useValue: { selectedBranchId } },
        { provide: ToastService, useValue: toastSpy },
        { provide: NotificationsFacade, useValue: notificationsSpy },
        { provide: PayrollConfigFacade, useValue: payrollConfigSpy },
      ],
    });

    facade = TestBed.inject(LiquidacionesFacade);
  });

  it('should be created', () => {
    expect(facade).toBeTruthy();
  });

  it('should have initial month and year', () => {
    const now = new Date();
    expect(facade.mesActual()).toBe(now.getMonth() + 1);
    expect(facade.anioActual()).toBe(now.getFullYear());
  });

  it('mesAnterior should decrement mesActual', () => {
    const initialMes = facade.mesActual();
    facade.mesAnterior();
    if (initialMes === 1) {
      expect(facade.mesActual()).toBe(12);
    } else {
      expect(facade.mesActual()).toBe(initialMes - 1);
    }
  });

  it('mesSiguiente vuelve al mes actual desde el anterior (fix-079-i)', () => {
    const initialMes = facade.mesActual();
    const initialAnio = facade.anioActual();
    facade.mesAnterior();
    expect(facade.puedeAvanzarMes()).toBe(true);
    facade.mesSiguiente();
    expect(facade.mesActual()).toBe(initialMes);
    expect(facade.anioActual()).toBe(initialAnio);
  });

  it('mesSiguiente no pasa del mes actual (fix-079-i, F04)', () => {
    const initialMes = facade.mesActual();
    const initialAnio = facade.anioActual();
    expect(facade.puedeAvanzarMes()).toBe(false);
    facade.mesSiguiente();
    expect(facade.mesActual()).toBe(initialMes);
    expect(facade.anioActual()).toBe(initialAnio);
  });

  // ─── spec 0017 (T2.4): grant multi-sede de la secretaria ───────────────────
  // Verifica el cableado del resolver en una facade de Finanzas. Que getActiveBranchId()
  // cambie según el grant es lo que invalida la caché SWR al cambiarlo.
  describe('grant multi-sede (spec 0017, AC1/AC2)', () => {
    it('secretaria con grant: getActiveBranchId respeta el selector (sede elegida)', () => {
      currentUser.set({ role: 'secretaria', branchId: 1, canAccessBothBranches: true });
      selectedBranchId.set(2);

      expect((facade as any).getActiveBranchId()).toBe(2);
    });

    it('secretaria con grant + "Todas" (null): getActiveBranchId es null (como admin)', () => {
      currentUser.set({ role: 'secretaria', branchId: 1, canAccessBothBranches: true });
      selectedBranchId.set(null);

      expect((facade as any).getActiveBranchId()).toBeNull();
    });

    it('secretaria sin grant: anclada a su sede, ignora el selector', () => {
      currentUser.set({ role: 'secretaria', branchId: 1, canAccessBothBranches: false });
      selectedBranchId.set(2);

      expect((facade as any).getActiveBranchId()).toBe(1);
    });
  });

  // ─── spec 0025 (T1.1): notificar liquidación pagada al instructor ──────────
  describe('registrarPago — notificación al instructor (spec 0025, AC5)', () => {
    beforeEach(async () => {
      await facade.initialize();
    });

    it('notifica al instructor usando row.userId directamente', async () => {
      const ok_ = await facade.registrarPago(fila(10), { paymentMethod: 'cash' } as any);

      expect(ok_).toBe(true);
      expect(notificationsSpy.notifyUsers).toHaveBeenCalledTimes(1);
      expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith(
        [100],
        expect.objectContaining({ referenceType: 'payment' }),
      );
    });

    it('no notifica si row.userId es falsy (guard)', async () => {
      tablas['instructors'] = () => ok([{ ...ANA, users: { ...ANA.users, id: 0 } }]);
      await facade.reintentar();

      const ok_ = await facade.registrarPago(fila(10), { paymentMethod: 'cash' } as any);

      expect(ok_).toBe(true);
      expect(notificationsSpy.notifyUsers).not.toHaveBeenCalled();
    });

    it('un fallo en notifyUsers no revierte el registro del pago', async () => {
      notificationsSpy.notifyUsers.mockRejectedValue(new Error('network error'));

      const ok_ = await facade.registrarPago(fila(10), { paymentMethod: 'cash' } as any);

      expect(ok_).toBe(true);
    });

    // fix-362-m: el update de anticipos no se revisaba — el pago se daba por bueno y los
    // anticipos quedaban "pendientes", listos para descontarse otra vez el mes siguiente.
    it('fix-362-m: si no se pueden marcar los anticipos como descontados, no da éxito', async () => {
      respuestasEscritura['instructor_advances:update'] = () => ({
        error: { code: '42501', message: 'permission denied' },
      });

      const ok_ = await facade.registrarPago(fila(10), { paymentMethod: 'cash' } as any);

      expect(ok_).toBe(false);
      expect(toastSpy.success).not.toHaveBeenCalled();
      expect(toastSpy.error).toHaveBeenCalled();
      expect(notificationsSpy.notifyUsers).not.toHaveBeenCalled();
    });
  });

  // ─── spec 0014-m: tarifa por hora resuelta por sede del instructor ─────────
  describe('carga — tarifa por sede (spec 0014-m, AC3/AC4/AC-E1)', () => {
    it('AC4: cada instructor usa la tarifa de SU sede (multi-sede en un mismo fetch)', async () => {
      await facade.initialize();

      expect(payrollConfigSpy.readRates).toHaveBeenCalled();
      expect(fila(10).amountPerHour).toBe(5000);
      expect(fila(10).totalBaseAmount).toBe(45000); // 9 * 5000
      expect(fila(20).amountPerHour).toBe(6500);
      expect(fila(20).totalBaseAmount).toBe(52000); // 8 * 6500
    });

    it('AC3: total a pagar = base(sede) - anticipos', async () => {
      payrollConfigSpy.rateForBranch.mockReturnValue(6000);

      await facade.initialize();

      expect(fila(10).totalBaseAmount).toBe(54000); // 9 * 6000
      expect(fila(10).finalPaymentAmount).toBe(42000); // 54000 - 12000
    });

    it('AC-E1: sede sin fila de config → tarifa fallback, no es un error', async () => {
      payrollConfigSpy.rateForBranch.mockReturnValue(PAYROLL_RATE_FALLBACK);

      await facade.initialize();

      expect(facade.error()).toBeNull();
      expect(facade.puedeRegistrarPago()).toBe(true);
      expect(fila(10).amountPerHour).toBe(PAYROLL_RATE_FALLBACK);
      expect(fila(10).totalBaseAmount).toBe(45000);
    });

    it('AC-E3: una fila pagada no dispara ninguna escritura al recargar', async () => {
      payrollConfigSpy.rateForBranch.mockReturnValue(9000); // tarifa cambió tras el pago

      await facade.initialize();

      expect(fila(20).status).toBe('paid');
      expect(fila(20).paymentId).toBe(555);
      expect(escrituras).toEqual([]);
    });

    it('redondea totalBaseAmount a entero CLP cuando horas NUMERIC(6,1) × tarifa produce deriva flotante', async () => {
      payrollConfigSpy.rateForBranch.mockReturnValue(7000);
      tablas['instructors'] = () => ok([ANA]);
      tablas['instructor_advances'] = () => ok([]);
      tablas['instructor_monthly_hours'] = () =>
        ok([{ instructor_id: 10, practical_sessions: 3, total_equivalent: 2.3 }]);

      await facade.initialize();

      // En JS crudo 2.3 * 7000 === 16099.999999999998; base_salary es INTEGER en BD.
      expect(fila(10).totalBaseAmount).toBe(16100);
      expect(fila(10).finalPaymentAmount).toBe(16100);
    });

    it('AC17 (spec 0012-i): 3 clases = 2,25 h exactas y base $11.250 a $5.000/h', async () => {
      payrollConfigSpy.rateForBranch.mockReturnValue(5000);
      tablas['instructors'] = () => ok([ANA]);
      tablas['instructor_advances'] = () => ok([]);
      tablas['instructor_monthly_hours'] = () =>
        ok([{ instructor_id: 10, practical_sessions: 3, total_equivalent: 2.25 }]);

      await facade.initialize();

      expect(fila(10).totalHours).toBe(2.25);
      expect(fila(10).totalBaseAmount).toBe(11250);
    });
  });

  // ─── spec 0060-b T1.3: una lectura que falla no se ve como un monto ────────
  describe('lecturas fallidas (spec 0060-b)', () => {
    const LECTURAS = [
      'instructors',
      'instructor_monthly_hours',
      'instructor_advances',
      'instructor_monthly_payments',
    ];

    function expectCasoA(): void {
      expect(facade.error()).toBe('No se pudieron cargar las liquidaciones.');
      expect(facade.liquidaciones()).toEqual([]);
      expect(facade.kpis()).toBeNull();
      expect(facade.selectedRow()).toBeNull();
      expect(facade.refreshFailed()).toBe(false);
      expect(facade.puedeRegistrarPago()).toBe(false);
      expect(facade.isLoading()).toBe(false);
    }

    function expectCasoB(): void {
      expect(facade.error()).toBeNull();
      expect(facade.refreshFailed()).toBe(true);
      expect(facade.liquidaciones()).toHaveLength(2);
      expect(facade.kpis()?.totalInstructores).toBe(2);
      expect(facade.puedeRegistrarPago()).toBe(false);
      expect(facade.isLoading()).toBe(false);
    }

    describe('caso A: primera carga', () => {
      it.each(LECTURAS)('si falla %s, falla toda la carga y no se aplica nada', async (tabla) => {
        tablas[tabla] = fallo;

        await facade.initialize();

        expectCasoA();
      });

      it('si falla la tarifa, falla la carga: no se calcula con el valor de respaldo', async () => {
        payrollConfigSpy.readRates.mockRejectedValue({ message: 'boom' });

        await facade.initialize();

        expectCasoA();
        expect(payrollConfigSpy.rateForBranch).not.toHaveBeenCalled();
      });

      it('no lanza toast: el error se ve en la pantalla', async () => {
        tablas['instructors'] = fallo;

        await facade.initialize();

        expect(toastSpy.error).not.toHaveBeenCalled();
      });

      it('una lectura que lanza también cuenta como carga fallida', async () => {
        tablas['instructors'] = () => Promise.reject(new TypeError('Failed to fetch'));

        await facade.initialize();

        expectCasoA();
      });

      it('al volver a entrar reintenta con skeleton, no como refresco silencioso', async () => {
        tablas['instructors'] = fallo;
        await facade.initialize();
        tablas['instructors'] = () => ok([ANA, BETO]);

        const carga = facade.initialize();

        expect(facade.isLoading()).toBe(true);
        expect(facade.error()).toBeNull();
        await carga;
        expect(facade.liquidaciones()).toHaveLength(2);
        expect(facade.puedeRegistrarPago()).toBe(true);
      });
    });

    describe('caso A: cambio de consulta', () => {
      beforeEach(async () => {
        await facade.initialize();
        facade.seleccionarParaPago(fila(10));
      });

      it('cambio de mes con error: retira filas, selección y KPIs del mes anterior', async () => {
        tablas['instructor_advances'] = fallo;

        facade.mesAnterior();
        await settle();

        expectCasoA();
      });

      it('cambio de sede con error: retira los datos de la sede anterior', async () => {
        tablas['instructor_monthly_payments'] = fallo;
        selectedBranchId.set(2);

        await facade.initialize();

        expectCasoA();
      });

      it('la consulta anterior se retira apenas empieza la nueva, no al terminar', () => {
        facade.mesAnterior();

        expect(facade.isLoading()).toBe(true);
        expect(facade.liquidaciones()).toEqual([]);
        expect(facade.selectedRow()).toBeNull();
        expect(facade.puedeRegistrarPago()).toBe(false);
      });

      it('volver al mes que sí cargó no entra por refresco con la pantalla vacía', async () => {
        const mes = facade.mesActual();
        tablas['instructor_advances'] = fallo;
        facade.mesAnterior();
        await settle();
        tablas['instructor_advances'] = () => ok([]);

        facade.mesSiguiente();

        expect(facade.mesActual()).toBe(mes);
        expect(facade.isLoading()).toBe(true);
        expect(facade.error()).toBeNull();
        await settle();
        expect(facade.liquidaciones()).toHaveLength(2);
        expect(facade.isLoading()).toBe(false);
      });

      it('fix-079-i: un error no habilita meses futuros', async () => {
        tablas['instructors'] = fallo;
        selectedBranchId.set(2);
        await facade.initialize();

        expect(facade.puedeAvanzarMes()).toBe(false);
      });
    });

    describe('caso B: refresco de la misma consulta', () => {
      beforeEach(async () => {
        await facade.initialize();
      });

      it.each(LECTURAS)('re-entrada con %s fallando conserva los datos', async (tabla) => {
        tablas[tabla] = fallo;

        await facade.initialize();
        expect(facade.isLoading()).toBe(false);
        await settle();

        expectCasoB();
        expect(toastSpy.error).not.toHaveBeenCalled();
      });

      it('la tarifa fallando en un refresco también es caso B', async () => {
        payrollConfigSpy.readRates.mockRejectedValue({ message: 'boom' });

        await facade.initialize();
        await settle();

        expectCasoB();
        expect(fila(10).amountPerHour).toBe(5000);
      });

      it('un evento Realtime que falla también es caso B', async () => {
        tablas['instructor_advances'] = fallo;

        realtimeHandlers[0]();
        await settle();

        expectCasoB();
      });

      it('un refresco que sale bien después borra el aviso', async () => {
        tablas['instructor_advances'] = fallo;
        realtimeHandlers[0]();
        await settle();
        tablas['instructor_advances'] = () => ok([]);

        realtimeHandlers[0]();
        await settle();

        expect(facade.refreshFailed()).toBe(false);
        expect(facade.puedeRegistrarPago()).toBe(true);
        expect(fila(10).totalAdvances).toBe(0);
      });
    });

    describe('reintentar()', () => {
      it('caso A: limpia el error al empezar, con skeleton, y desbloquea al terminar', async () => {
        tablas['instructors'] = fallo;
        await facade.initialize();
        tablas['instructors'] = () => ok([ANA, BETO]);

        const reintento = facade.reintentar();

        expect(facade.error()).toBeNull();
        expect(facade.isLoading()).toBe(true);
        await reintento;
        expect(facade.liquidaciones()).toHaveLength(2);
        expect(facade.puedeRegistrarPago()).toBe(true);
      });

      it('caso B: sin skeleton, y sigue bloqueado hasta que la carga termina bien', async () => {
        await facade.initialize();
        tablas['instructors'] = fallo;
        await facade.reintentar();
        expectCasoB();
        const pendiente = deferred<Respuesta>();
        tablas['instructors'] = () => pendiente.promise;

        const reintento = facade.reintentar();

        expect(facade.isLoading()).toBe(false);
        expect(facade.reintentando()).toBe(true);
        expect(facade.puedeRegistrarPago()).toBe(false);
        pendiente.resolve(ok([ANA, BETO]));
        await reintento;
        expect(facade.reintentando()).toBe(false);
        expect(facade.refreshFailed()).toBe(false);
        expect(facade.puedeRegistrarPago()).toBe(true);
      });

      it('caso B: si vuelve a fallar los datos siguen y el aviso también', async () => {
        await facade.initialize();
        tablas['instructors'] = fallo;

        await facade.reintentar();
        await facade.reintentar();

        expectCasoB();
        expect(facade.reintentando()).toBe(false);
      });
    });

    describe('respuestas fuera de orden', () => {
      function dosCargas() {
        const vieja = deferred<Respuesta>();
        const nueva = deferred<Respuesta>();
        const respuestas = [vieja.promise, nueva.promise];
        tablas['instructors'] = () => respuestas.shift()!;
        void facade.initialize();
        facade.mesAnterior();
        return { vieja, nueva };
      }

      it('datos viejos que llegan después no pisan los nuevos', async () => {
        const { vieja, nueva } = dosCargas();
        nueva.resolve(ok([BETO]));
        await settle();

        vieja.resolve(ok([ANA]));
        await settle();

        expect(facade.liquidaciones().map((r) => r.instructorId)).toEqual([20]);
      });

      it('un error viejo no reemplaza datos nuevos', async () => {
        const { vieja, nueva } = dosCargas();
        nueva.resolve(ok([BETO]));
        await settle();

        vieja.resolve(fallo());
        await settle();

        expect(facade.error()).toBeNull();
        expect(facade.refreshFailed()).toBe(false);
        expect(facade.liquidaciones()).toHaveLength(1);
      });

      it('una carga reemplazada no apaga el skeleton de la vigente', async () => {
        const { vieja, nueva } = dosCargas();

        vieja.resolve(ok([ANA]));
        await settle();

        expect(facade.isLoading()).toBe(true);
        expect(facade.liquidaciones()).toEqual([]);
        nueva.resolve(ok([BETO]));
        await settle();
        expect(facade.isLoading()).toBe(false);
      });

      it('un refresco en curso no se aplica sobre el mes al que se cambió', async () => {
        await facade.initialize();
        const refresco = deferred<Respuesta>();
        tablas['instructors'] = () => refresco.promise;
        realtimeHandlers[0]();
        tablas['instructors'] = () => ok([BETO]);

        facade.mesAnterior();
        await settle();
        refresco.resolve(fallo());
        await settle();

        expect(facade.refreshFailed()).toBe(false);
        expect(facade.liquidaciones().map((r) => r.instructorId)).toEqual([20]);
      });

      it('un Realtime durante la primera carga no la convierte en caso B', async () => {
        const primera = deferred<Respuesta>();
        tablas['instructors'] = () => primera.promise;
        void facade.initialize();
        tablas['instructors'] = fallo;

        realtimeHandlers[0]();
        await settle();

        expect(facade.refreshFailed()).toBe(false);
        expect(facade.error()).not.toBeNull();
        expect(facade.isLoading()).toBe(false);
      });
    });

    it('dentro de un effect no crea dependencias: una carga no dispara otra', async () => {
      TestBed.runInInjectionContext(() =>
        effect(() => {
          selectedBranchId();
          void facade.initialize();
        }),
      );
      TestBed.tick();
      await settle();
      TestBed.tick();
      await settle();
      expect(lecturas.filter((t) => t === 'instructors')).toHaveLength(1);

      facade.mesAnterior();
      TestBed.tick();
      await settle();
      expect(lecturas.filter((t) => t === 'instructors')).toHaveLength(2);
    });

    describe('selectedRow sigue a la carga vigente', () => {
      beforeEach(async () => {
        await facade.initialize();
        facade.seleccionarParaPago(fila(10));
      });

      it('un refresco exitoso la reemplaza por la fila nueva', async () => {
        tablas['instructor_advances'] = () => ok([{ instructor_id: 10, amount: 20000 }]);

        await facade.reintentar();

        expect(facade.selectedRow()).toBe(fila(10));
        expect(facade.selectedRow()?.finalPaymentAmount).toBe(25000);
      });

      it('si el instructor ya no está en la carga, se limpia', async () => {
        tablas['instructors'] = () => ok([BETO]);

        await facade.reintentar();

        expect(facade.selectedRow()).toBeNull();
      });

      it('un refresco fallido la deja, pero bloqueada', async () => {
        const seleccionada = facade.selectedRow();
        tablas['instructors'] = fallo;

        await facade.reintentar();

        expect(facade.selectedRow()).toBe(seleccionada);
        expect(facade.puedeRegistrarPago()).toBe(false);
      });
    });

    describe('registrarPago bloqueado', () => {
      const PAGO = { paymentMethod: 'cash' } as const;

      async function expectSinEscrituras(row: LiquidacionRow): Promise<void> {
        const resultado = await facade.registrarPago(row, PAGO);

        expect(resultado).toBe(false);
        expect(escrituras).toEqual([]);
        expect(toastSpy.success).not.toHaveBeenCalled();
        expect(notificationsSpy.notifyUsers).not.toHaveBeenCalled();
        expect(facade.isSaving()).toBe(false);
      }

      beforeEach(async () => {
        await facade.initialize();
      });

      it.each(LECTURAS)('con el refresco de %s fallido', async (tabla) => {
        const row = fila(10);
        tablas[tabla] = fallo;
        await facade.reintentar();

        await expectSinEscrituras(row);
        expect(toastSpy.warning).toHaveBeenCalled();
      });

      it('con la tarifa fallida en el refresco', async () => {
        const row = fila(10);
        payrollConfigSpy.readRates.mockRejectedValue({ message: 'boom' });
        await facade.reintentar();

        await expectSinEscrituras(row);
      });

      it('con una foto de la fila tras un caso A', async () => {
        const row = fila(10);
        tablas['instructors'] = fallo;
        facade.mesAnterior();
        await settle();

        await expectSinEscrituras(row);
      });

      it('mientras carga otro mes', async () => {
        const row = fila(10);
        facade.mesAnterior();

        await expectSinEscrituras(row);
      });

      it('una fila de otro mes no se registra bajo el período nuevo', async () => {
        const row = fila(10);
        facade.mesAnterior();
        await settle();
        expect(facade.puedeRegistrarPago()).toBe(true);

        await expectSinEscrituras(row);
      });

      it('una fila de otra sede no se registra con la sede nueva activa', async () => {
        const row = fila(10);
        selectedBranchId.set(2);
        expect(facade.puedeRegistrarPago()).toBe(false);

        await expectSinEscrituras(row);
      });

      it('una foto anterior a un refresco no se paga con montos viejos', async () => {
        const row = fila(10);
        tablas['instructor_advances'] = () => ok([{ instructor_id: 10, amount: 20000 }]);
        await facade.reintentar();

        await expectSinEscrituras(row);
      });

      it('una fila ya pagada no pisa el pago existente', async () => {
        await expectSinEscrituras(fila(20));
      });

      it('tras reintentar con éxito sí registra, con los montos vigentes', async () => {
        tablas['instructor_advances'] = fallo;
        await facade.reintentar();
        tablas['instructor_advances'] = () => ok([{ instructor_id: 10, amount: 12000 }]);
        await facade.reintentar();

        expect(await facade.registrarPago(fila(10), PAGO)).toBe(true);

        const [pago] = conEscrituras('instructor_monthly_payments', 'upsert');
        expect(pago.payload).toEqual(
          expect.objectContaining({
            base_salary: 45000,
            advances_deducted: 12000,
            net_payment: 33000,
          }),
        );
      });
    });

    describe('errores de escritura separados de los de carga', () => {
      const PAGO = { paymentMethod: 'cash' } as const;

      beforeEach(async () => {
        await facade.initialize();
      });

      it('un pago rechazado no se vuelve error de carga ni retira la tabla', async () => {
        respuestasEscritura['instructor_monthly_payments:upsert'] = () => ({
          error: { message: 'RLS' },
        });

        expect(await facade.registrarPago(fila(10), PAGO)).toBe(false);

        expect(facade.error()).toBeNull();
        expect(facade.refreshFailed()).toBe(false);
        expect(facade.liquidaciones()).toHaveLength(2);
        expect(toastSpy.error).toHaveBeenCalled();
      });

      it('deshacer rechazado tampoco se vuelve error de carga', async () => {
        respuestasEscritura['instructor_monthly_payments:delete'] = () => ({
          error: { message: 'RLS' },
        });

        expect(await facade.deshacerPago(fila(20))).toBe(false);

        expect(facade.error()).toBeNull();
        expect(facade.liquidaciones()).toHaveLength(2);
      });

      it('una escritura no borra el aviso de una carga fallida', async () => {
        tablas['instructors'] = fallo;
        await facade.reintentar();
        respuestasEscritura['instructor_monthly_payments:delete'] = () => ({
          error: { message: 'RLS' },
        });

        await facade.deshacerPago(fila(20));

        expect(facade.refreshFailed()).toBe(true);
        expect(facade.puedeRegistrarPago()).toBe(false);
      });

      it('pago guardado con refresco fallido: es éxito y pasa a caso B', async () => {
        const row = fila(10);
        tablas['instructor_monthly_hours'] = fallo;

        expect(await facade.registrarPago(row, PAGO)).toBe(true);

        expect(toastSpy.success).toHaveBeenCalled();
        expectCasoB();
      });

      it('deshacer sigue disponible en caso B: no usa valores calculados', async () => {
        const row = fila(20);
        tablas['instructors'] = fallo;
        await facade.reintentar();

        expect(await facade.deshacerPago(row)).toBe(true);

        expect(conEscrituras('instructor_monthly_payments', 'delete')).toHaveLength(1);
        expect(conEscrituras('instructor_advances', 'update')[0].payload).toEqual({
          status: 'pending',
        });
      });

      it('deshacer no toca el período de otro mes con una fila vieja', async () => {
        const row = fila(20);
        facade.mesAnterior();
        await settle();

        expect(await facade.deshacerPago(row)).toBe(false);

        expect(escrituras).toEqual([]);
      });

      it('cambiar de mes durante el guardado no mueve anticipos ni aviso a otro período', async () => {
        const mm = String(facade.mesActual()).padStart(2, '0');
        const periodo = `${facade.anioActual()}-${mm}`;
        const aviso = `${facade.mesActual()}/${facade.anioActual()}`;
        const upsert = deferred<{ error: null }>();
        respuestasEscritura['instructor_monthly_payments:upsert'] = () => upsert.promise;

        const pago = facade.registrarPago(fila(10), PAGO);
        await settle();
        facade.mesAnterior();
        upsert.resolve({ error: null });
        await pago;

        const [anticipos] = conEscrituras('instructor_advances', 'update');
        expect(anticipos.filtros).toContainEqual(['gte', 'date', `${periodo}-01`]);
        expect(notificationsSpy.notifyUsers.mock.calls[0][1].message).toContain(aviso);
      });
    });
  });
});
