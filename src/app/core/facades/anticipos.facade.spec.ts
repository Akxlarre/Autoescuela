import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { AnticiposFacade, tipoLabel, mapStatus } from './anticipos.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { NotificationsFacade } from '@core/facades/notifications.facade';

// ─── Helpers puros ────────────────────────────────────────────────────────────

describe('tipoLabel()', () => {
  it('mapea theory → Teórico', () => {
    expect(tipoLabel('theory')).toBe('Teórico');
  });
  it('mapea practice → Práctico', () => {
    expect(tipoLabel('practice')).toBe('Práctico');
  });
  it('mapea both → Teórico y Práctico', () => {
    expect(tipoLabel('both')).toBe('Teórico y Práctico');
  });
  it('retorna — para null', () => {
    expect(tipoLabel(null)).toBe('—');
  });
  it('retorna el valor original si no hay mapeo', () => {
    expect(tipoLabel('unknown')).toBe('unknown');
  });
  it('mapea "both" con espacios/mayúsculas (H-004: dato BD sucio) → Teórico y Práctico', () => {
    expect(tipoLabel('Both ')).toBe('Teórico y Práctico');
    expect(tipoLabel(' both')).toBe('Teórico y Práctico');
  });
});

describe('mapStatus()', () => {
  it('mapea discounted → discounted', () => {
    expect(mapStatus('discounted')).toBe('discounted');
  });
  it('mapea deducted → discounted (alias)', () => {
    expect(mapStatus('deducted')).toBe('discounted');
  });
  it('mapea pending → pending', () => {
    expect(mapStatus('pending')).toBe('pending');
  });
  it('mapea null → pending', () => {
    expect(mapStatus(null)).toBe('pending');
  });
});

// ─── KPIs computed ────────────────────────────────────────────────────────────

describe('AnticiposFacade — kpis computed', () => {
  let facade: AnticiposFacade;

  const mockSupabase = {
    client: {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    },
  };
  const mockAuth = { currentUser: vi.fn().mockReturnValue({ dbId: 1 }) };
  const mockToast = { success: vi.fn(), error: vi.fn() };
  const mockBranch = { selectedBranchId: vi.fn().mockReturnValue(null) };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AnticiposFacade,
        { provide: SupabaseService, useValue: mockSupabase },
        { provide: AuthFacade, useValue: mockAuth },
        { provide: BranchFacade, useValue: mockBranch },
        { provide: ToastService, useValue: mockToast },
      ],
    });
    facade = TestBed.inject(AnticiposFacade);
  });

  it('inicia con KPIs en cero', () => {
    const kpis = facade.kpis();
    expect(kpis.totalPendiente).toBe(0);
    expect(kpis.totalHistorico).toBe(0);
    expect(kpis.totalDescontado).toBe(0);
    expect(kpis.instructoresConSaldo).toBe(0);
  });

  it('isLoading inicia en false', () => {
    expect(facade.isLoading()).toBe(false);
  });

  it('isSaving inicia en false', () => {
    expect(facade.isSaving()).toBe(false);
  });

  it('historial inicia vacío', () => {
    expect(facade.historial()).toHaveLength(0);
  });

  it('cuentaCorriente inicia vacía', () => {
    expect(facade.cuentaCorriente()).toHaveLength(0);
  });

  it('instructores inicia vacío', () => {
    expect(facade.instructores()).toHaveLength(0);
  });
});

// ─── registrarAnticipo — sin sesión ──────────────────────────────────────────

describe('AnticiposFacade.registrarAnticipo()', () => {
  let facade: AnticiposFacade;
  const mockToast = { success: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AnticiposFacade,
        {
          provide: SupabaseService,
          useValue: {
            client: {
              from: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              order: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
            },
          },
        },
        { provide: AuthFacade, useValue: { currentUser: vi.fn().mockReturnValue(null) } },
        { provide: BranchFacade, useValue: { selectedBranchId: vi.fn().mockReturnValue(null) } },
        { provide: ToastService, useValue: mockToast },
      ],
    });
    facade = TestBed.inject(AnticiposFacade);
  });

  it('retorna false y muestra error cuando no hay sesión', async () => {
    const result = await facade.registrarAnticipo({
      instructorId: 1,
      date: '2026-04-01',
      amount: 50000,
      reason: 'salary',
      description: '',
    });
    expect(result).toBe(false);
    expect(mockToast.error).toHaveBeenCalledWith('No hay sesión activa.');
  });
});

// ─── registrarAnticipo — notificación al instructor (spec 0025, AC4) ─────────

describe('AnticiposFacade.registrarAnticipo() — notifica al instructor (spec 0025, AC4)', () => {
  let facade: AnticiposFacade;
  let notificationsSpy: any;
  let toastSpy: any;
  let singleMock: any;
  let advancesChain: any;

  const payload = {
    instructorId: 7,
    date: '2026-04-01',
    amount: 50000,
    reason: 'salary',
    description: '',
  };

  beforeEach(() => {
    notificationsSpy = { notifyUsers: vi.fn().mockResolvedValue(undefined) };
    toastSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
    singleMock = vi.fn().mockResolvedValue({ data: { user_id: 99 }, error: null });

    // Chain thenable + encadenable con .eq(): soporta el filtro opcional de
    // sede (fix-071) que se agrega DESPUÉS de .order(), sin importar si se aplica o no.
    const asyncChain = (result: { data: unknown[]; error: unknown }): any => {
      const chain: any = {
        eq: vi.fn(() => chain),
        then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
          Promise.resolve(result).then(resolve, reject),
      };
      return chain;
    };

    const instructorsChain = {
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: singleMock,
          order: vi.fn(() => asyncChain({ data: [], error: null })),
        }),
      }),
    };
    advancesChain = {
      insert: vi.fn().mockResolvedValue({ error: null }),
      select: vi.fn().mockReturnValue({
        order: vi.fn(() => asyncChain({ data: [], error: null })),
      }),
    };

    const supabaseSpy = {
      client: {
        from: vi.fn((table: string) => {
          if (table === 'instructor_advances') return advancesChain;
          if (table === 'instructors') return instructorsChain;
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
        }),
      },
    };

    TestBed.configureTestingModule({
      providers: [
        AnticiposFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: AuthFacade, useValue: { currentUser: vi.fn().mockReturnValue({ dbId: 1 }) } },
        { provide: BranchFacade, useValue: { selectedBranchId: vi.fn().mockReturnValue(null) } },
        { provide: ToastService, useValue: toastSpy },
        { provide: NotificationsFacade, useValue: notificationsSpy },
      ],
    });
    facade = TestBed.inject(AnticiposFacade);
  });

  it('resuelve instructors.id → users.id y notifica al instructor', async () => {
    const ok = await facade.registrarAnticipo(payload);

    expect(ok).toBe(true);
    expect(notificationsSpy.notifyUsers).toHaveBeenCalledWith(
      [99],
      expect.objectContaining({ referenceType: 'payment' }),
    );
  });

  it('no notifica si no se pudo resolver el userId del instructor', async () => {
    singleMock.mockResolvedValue({ data: null, error: { message: 'not found' } });

    const ok = await facade.registrarAnticipo(payload);

    expect(ok).toBe(true);
    expect(notificationsSpy.notifyUsers).not.toHaveBeenCalled();
  });

  it('un fallo en notifyUsers no revierte el registro del anticipo', async () => {
    notificationsSpy.notifyUsers.mockRejectedValue(new Error('network error'));

    const ok = await facade.registrarAnticipo(payload);

    expect(ok).toBe(true);
  });

  it('fix-445-m: un anticipo con fecha de un día con caja cerrada muestra ese motivo', async () => {
    advancesChain.insert.mockResolvedValue({
      error: { code: 'P0001', message: 'CAJA_CERRADA', details: null, hint: null },
    });

    const ok = await facade.registrarAnticipo(payload);

    expect(ok).toBe(false);
    expect(toastSpy.error).toHaveBeenCalledWith(expect.stringContaining('ya está cerrada'));
    expect(notificationsSpy.notifyUsers).not.toHaveBeenCalled();
    // No es un error de carga: la página no muestra "Error al cargar anticipos".
    expect(facade.error()).toBeNull();
  });

  // ─── fix-243-m: método de pago persiste (afecta el arqueo de caja) ─────────
  it('persiste el paymentMethod recibido en el insert', async () => {
    await facade.registrarAnticipo({ ...payload, paymentMethod: 'transferencia' });

    expect(advancesChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ payment_method: 'transferencia' }),
    );
  });

  it('usa payment_method "efectivo" por defecto cuando no se pasa', async () => {
    await facade.registrarAnticipo(payload);

    expect(advancesChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ payment_method: 'efectivo' }),
    );
  });
});

// ─── fetchData — filtro de sede (fix-071) ────────────────────────────────────

describe('AnticiposFacade — filtro de sede (fix-071)', () => {
  function makeSupabaseSpy() {
    const eqCalls: [string, unknown][] = [];
    const chain: any = {
      select: vi.fn(() => chain),
      order: vi.fn(() => chain),
      eq: vi.fn((col: string, val: unknown) => {
        eqCalls.push([col, val]);
        return chain;
      }),
      then: (resolve: (v: unknown) => unknown) =>
        Promise.resolve({ data: [], error: null }).then(resolve),
    };
    const client = { from: vi.fn(() => chain) };
    return { client, eqCalls };
  }

  const mockToast = { success: vi.fn(), error: vi.fn() };
  const mockNotifications = { notifyUsers: vi.fn() };

  it('aplica .eq(branch_id) en ambas queries cuando el admin tiene una sede seleccionada', async () => {
    const { client, eqCalls } = makeSupabaseSpy();
    TestBed.configureTestingModule({
      providers: [
        AnticiposFacade,
        { provide: SupabaseService, useValue: { client } },
        {
          provide: AuthFacade,
          useValue: { currentUser: vi.fn().mockReturnValue({ role: 'admin' }) },
        },
        { provide: BranchFacade, useValue: { selectedBranchId: vi.fn().mockReturnValue(2) } },
        { provide: ToastService, useValue: mockToast },
        { provide: NotificationsFacade, useValue: mockNotifications },
      ],
    });
    const facade = TestBed.inject(AnticiposFacade);

    await facade.initialize();

    expect(eqCalls).toContainEqual(['instructors.users.branch_id', 2]);
    expect(eqCalls).toContainEqual(['users.branch_id', 2]);
  });

  it('NO filtra por sede cuando el admin selecciona "Todas las sedes" (null)', async () => {
    const { client, eqCalls } = makeSupabaseSpy();
    TestBed.configureTestingModule({
      providers: [
        AnticiposFacade,
        { provide: SupabaseService, useValue: { client } },
        {
          provide: AuthFacade,
          useValue: { currentUser: vi.fn().mockReturnValue({ role: 'admin' }) },
        },
        { provide: BranchFacade, useValue: { selectedBranchId: vi.fn().mockReturnValue(null) } },
        { provide: ToastService, useValue: mockToast },
        { provide: NotificationsFacade, useValue: mockNotifications },
      ],
    });
    const facade = TestBed.inject(AnticiposFacade);

    await facade.initialize();

    expect(eqCalls.some(([col]) => col.includes('branch_id'))).toBe(false);
  });

  it('re-fetchea al cambiar de sede seleccionada (SWR con branch tracking)', async () => {
    const { client, eqCalls } = makeSupabaseSpy();
    const selectedBranchId = vi.fn().mockReturnValue(1);
    TestBed.configureTestingModule({
      providers: [
        AnticiposFacade,
        { provide: SupabaseService, useValue: { client } },
        {
          provide: AuthFacade,
          useValue: { currentUser: vi.fn().mockReturnValue({ role: 'admin' }) },
        },
        { provide: BranchFacade, useValue: { selectedBranchId } },
        { provide: ToastService, useValue: mockToast },
        { provide: NotificationsFacade, useValue: mockNotifications },
      ],
    });
    const facade = TestBed.inject(AnticiposFacade);

    await facade.initialize();
    expect(eqCalls).toContainEqual(['instructors.users.branch_id', 1]);

    selectedBranchId.mockReturnValue(2);
    await facade.initialize();

    expect(eqCalls).toContainEqual(['instructors.users.branch_id', 2]);
  });
});

// ─── spec 0060-b (T1.5): una lectura que falla se ve como error, no como $0 ──

describe('AnticiposFacade — lecturas fallidas (spec 0060-b)', () => {
  type Respuesta = { data: unknown; error: unknown };
  type Tabla = 'instructor_advances' | 'instructors';

  const FALLA = { data: null, error: { message: 'boom' } };

  const anticipo = (id: number, instructorId: number, nombre: string) => ({
    id,
    date: '2026-11-10',
    amount: 50000,
    reason: 'salary',
    description: null,
    status: 'pending',
    instructor_id: instructorId,
    instructors: {
      id: instructorId,
      type: 'both',
      users: { first_names: nombre, paternal_last_name: 'Díaz', branch_id: 1 },
    },
  });
  const instructor = (id: number, nombre: string) => ({
    id,
    type: 'practice',
    users: { first_names: nombre, paternal_last_name: 'Soto', branch_id: 1 },
  });

  const OK_ANTICIPOS: Respuesta = { data: [anticipo(1, 7, 'Ana')], error: null };
  const OK_INSTRUCTORES: Respuesta = {
    data: [instructor(7, 'Ana'), instructor(8, 'Luis')],
    error: null,
  };

  /**
   * Cada lectura consume la siguiente respuesta de su cola; sin cola usa la última conocida.
   * Una respuesta puede ser una promesa, para controlar en qué orden llegan.
   */
  function setup(branchInicial: number | null = 1) {
    const colas: Record<Tabla, (Respuesta | Promise<Respuesta>)[]> = {
      instructor_advances: [],
      instructors: [],
    };
    const base: Record<Tabla, Respuesta> = {
      instructor_advances: OK_ANTICIPOS,
      instructors: OK_INSTRUCTORES,
    };
    const insert = vi.fn().mockResolvedValue({ error: null });
    const single = vi.fn().mockResolvedValue({ data: { user_id: 99 }, error: null });

    const client = {
      from: vi.fn((tabla: Tabla) => {
        const chain: any = {
          select: vi.fn(() => chain),
          order: vi.fn(() => chain),
          eq: vi.fn(() => chain),
          single,
          insert,
          then: (ok: (v: Respuesta) => unknown, ko?: (e: unknown) => unknown) =>
            Promise.resolve(colas[tabla].shift() ?? base[tabla]).then(ok, ko),
        };
        return chain;
      }),
    };

    const selectedBranchId = vi.fn().mockReturnValue(branchInicial);
    const toast = { success: vi.fn(), error: vi.fn(), warning: vi.fn() };
    const notifications = { notifyUsers: vi.fn().mockResolvedValue(undefined) };

    TestBed.configureTestingModule({
      providers: [
        AnticiposFacade,
        { provide: SupabaseService, useValue: { client } },
        {
          provide: AuthFacade,
          useValue: { currentUser: vi.fn().mockReturnValue({ role: 'admin', dbId: 1 }) },
        },
        { provide: BranchFacade, useValue: { selectedBranchId } },
        { provide: ToastService, useValue: toast },
        { provide: NotificationsFacade, useValue: notifications },
      ],
    });

    return {
      facade: TestBed.inject(AnticiposFacade),
      colas,
      base,
      insert,
      single,
      selectedBranchId,
      toast,
      notifications,
    };
  }

  const payload = {
    instructorId: 7,
    date: '2026-11-10',
    amount: 50000,
    reason: 'salary',
    description: '',
  };

  function diferida() {
    let resolver!: (r: Respuesta) => void;
    const promesa = new Promise<Respuesta>((r) => (resolver = r));
    return { promesa, resolver };
  }

  /** Deja correr los `await` internos, sin depender del reloj. */
  const vaciarMicrotareas = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };

  function expectSinDatos(facade: AnticiposFacade) {
    expect(facade.historial()).toEqual([]);
    expect(facade.cuentaCorriente()).toEqual([]);
    expect(facade.instructores()).toEqual([]);
  }

  function expectConDatos(facade: AnticiposFacade) {
    expect(facade.historial()).toHaveLength(1);
    expect(facade.cuentaCorriente()).toHaveLength(2);
    expect(facade.instructores()).toHaveLength(2);
  }

  const LECTURAS: Tabla[] = ['instructor_advances', 'instructors'];

  describe('carga correcta', () => {
    it('incluye a los instructores sin anticipos en la cuenta corriente y el selector', async () => {
      const { facade } = setup();
      await facade.initialize();

      expect(facade.cuentaCorriente().map((c) => c.instructorId)).toEqual([7, 8]);
      expect(facade.instructores().map((i) => i.id)).toEqual([7, 8]);
      expect(facade.error()).toBeNull();
      expect(facade.refreshFailed()).toBe(false);
    });
  });

  describe('caso A: primera carga o cambio de sede', () => {
    it.each(LECTURAS)('primera carga con error en %s: no aplica nada', async (tabla) => {
      const { facade, colas } = setup();
      colas[tabla].push(FALLA);

      await facade.initialize();

      expect(facade.error()).toBe('No se pudieron cargar los anticipos.');
      expect(facade.refreshFailed()).toBe(false);
      expect(facade.isLoading()).toBe(false);
      expectSinDatos(facade);
    });

    it.each(LECTURAS)('cambio de sede con error en %s: retira la sede anterior', async (tabla) => {
      const { facade, colas, selectedBranchId } = setup();
      await facade.initialize();
      expectConDatos(facade);

      selectedBranchId.mockReturnValue(2);
      colas[tabla].push(FALLA);
      await facade.initialize();

      expect(facade.error()).not.toBeNull();
      expect(facade.refreshFailed()).toBe(false);
      expectSinDatos(facade);
      expect(facade.kpis().totalHistorico).toBe(0);
    });

    it('al cambiar de sede no deja visibles los datos anteriores mientras carga', async () => {
      const { facade, colas, selectedBranchId } = setup();
      await facade.initialize();

      selectedBranchId.mockReturnValue(2);
      const pendiente = diferida();
      colas.instructor_advances.push(pendiente.promesa);
      const carga = facade.initialize();

      expect(facade.isLoading()).toBe(true);
      expectSinDatos(facade);

      pendiente.resolver(OK_ANTICIPOS);
      await carga;
      expectConDatos(facade);
    });

    it('tras una primera carga fallida, volver a entrar repite la carga con skeleton', async () => {
      const { facade, colas } = setup();
      colas.instructor_advances.push(FALLA);
      await facade.initialize();

      const pendiente = diferida();
      colas.instructor_advances.push(pendiente.promesa);
      const carga = facade.initialize();

      expect(facade.isLoading()).toBe(true);
      expect(facade.error()).toBeNull();
      pendiente.resolver(OK_ANTICIPOS);
      await carga;
      expectConDatos(facade);
      expect(facade.isLoading()).toBe(false);
    });

    it('tras un cambio de sede fallido, volver a la misma sede no pasa por refresco silencioso', async () => {
      const { facade, colas, selectedBranchId } = setup();
      await facade.initialize();
      selectedBranchId.mockReturnValue(2);
      colas.instructors.push(FALLA);
      await facade.initialize();

      const pendiente = diferida();
      colas.instructors.push(pendiente.promesa);
      const carga = facade.initialize();

      expect(facade.isLoading()).toBe(true);
      pendiente.resolver(OK_INSTRUCTORES);
      await carga;
      expect(facade.error()).toBeNull();
      expectConDatos(facade);
    });

    it('volver a la sede anterior tras un cambio fallido también carga completo', async () => {
      const { facade, colas, selectedBranchId } = setup();
      await facade.initialize();
      selectedBranchId.mockReturnValue(2);
      colas.instructors.push(FALLA);
      await facade.initialize();

      selectedBranchId.mockReturnValue(1);
      colas.instructors.push(FALLA);
      await facade.initialize();

      // Si hubiera ido por refresco, sería caso B sobre una pantalla vacía.
      expect(facade.refreshFailed()).toBe(false);
      expect(facade.error()).not.toBeNull();
    });
  });

  describe('caso B: re-entrada o refresco de la misma sede', () => {
    it.each(LECTURAS)('re-entrada con error en %s: conserva los datos y avisa', async (tabla) => {
      const { facade, colas } = setup();
      await facade.initialize();

      colas[tabla].push(FALLA);
      await facade.initialize();
      await vaciarMicrotareas();

      expect(facade.refreshFailed()).toBe(true);
      expect(facade.error()).toBeNull();
      expect(facade.isLoading()).toBe(false);
      expectConDatos(facade);
    });

    it('un refresco que sale bien después limpia el aviso', async () => {
      const { facade, colas } = setup();
      await facade.initialize();
      colas.instructor_advances.push(FALLA);
      await facade.initialize();
      await vaciarMicrotareas();
      expect(facade.refreshFailed()).toBe(true);

      await facade.initialize();
      await vaciarMicrotareas();

      expect(facade.refreshFailed()).toBe(false);
    });

    it('un refresco que falla con otra sede activa es caso A: esos datos no le corresponden', async () => {
      const { facade, colas, selectedBranchId } = setup();
      await facade.initialize();

      // Cuadratura no recarga anticipos al cambiar de sede: el refresco tras guardar lo descubre.
      selectedBranchId.mockReturnValue(2);
      colas.instructor_advances.push(FALLA);
      const ok = await facade.registrarAnticipo(payload);

      expect(ok).toBe(true);
      expect(facade.refreshFailed()).toBe(false);
      expect(facade.error()).not.toBeNull();
      expectSinDatos(facade);
    });
  });

  describe('reintentar()', () => {
    it('caso A: repite la carga completa y, si sale bien, limpia el error', async () => {
      const { facade, colas } = setup();
      colas.instructors.push(FALLA);
      await facade.initialize();

      const pendiente = diferida();
      colas.instructors.push(pendiente.promesa);
      const carga = facade.reintentar();
      expect(facade.isLoading()).toBe(true);
      expect(facade.error()).toBeNull();

      pendiente.resolver(OK_INSTRUCTORES);
      await carga;

      expect(facade.error()).toBeNull();
      expect(facade.isLoading()).toBe(false);
      expectConDatos(facade);
    });

    it('caso A: si vuelve a fallar, sigue el error y sin datos', async () => {
      const { facade, colas } = setup();
      colas.instructors.push(FALLA, FALLA);
      await facade.initialize();

      await facade.reintentar();

      expect(facade.error()).not.toBeNull();
      expectSinDatos(facade);
    });

    it('caso B: refresca sin skeleton y limpia el aviso', async () => {
      const { facade, colas } = setup();
      await facade.initialize();
      colas.instructors.push(FALLA);
      await facade.initialize();
      await vaciarMicrotareas();

      const pendiente = diferida();
      colas.instructors.push(pendiente.promesa);
      const carga = facade.reintentar();
      expect(facade.isLoading()).toBe(false);
      expectConDatos(facade);

      pendiente.resolver(OK_INSTRUCTORES);
      await carga;

      expect(facade.refreshFailed()).toBe(false);
    });

    it('caso B: si vuelve a fallar, mantiene datos y aviso', async () => {
      const { facade, colas } = setup();
      await facade.initialize();
      colas.instructors.push(FALLA, FALLA);
      await facade.initialize();
      await vaciarMicrotareas();

      await facade.reintentar();

      expect(facade.refreshFailed()).toBe(true);
      expect(facade.error()).toBeNull();
      expectConDatos(facade);
    });
  });

  describe('respuestas fuera de orden', () => {
    it('una respuesta vieja correcta no pisa la de la sede vigente', async () => {
      const { facade, colas, selectedBranchId } = setup();
      const vieja = diferida();
      colas.instructor_advances.push(vieja.promesa);
      const cargaVieja = facade.initialize();

      selectedBranchId.mockReturnValue(2);
      colas.instructor_advances.push({ data: [anticipo(2, 8, 'Luis')], error: null });
      await facade.initialize();

      vieja.resolver({ data: [anticipo(1, 7, 'Ana')], error: null });
      await cargaVieja;

      expect(facade.historial().map((h) => h.id)).toEqual([2]);
    });

    it('un error viejo no marca como fallida la carga vigente', async () => {
      const { facade, colas, selectedBranchId } = setup();
      const vieja = diferida();
      colas.instructor_advances.push(vieja.promesa);
      const cargaVieja = facade.initialize();

      selectedBranchId.mockReturnValue(2);
      await facade.initialize();

      vieja.resolver(FALLA);
      await cargaVieja;

      expect(facade.error()).toBeNull();
      expectConDatos(facade);
    });

    it('la carga vieja no apaga el skeleton de la vigente', async () => {
      const { facade, colas, selectedBranchId } = setup();
      const vieja = diferida();
      const vigente = diferida();
      colas.instructor_advances.push(vieja.promesa, vigente.promesa);
      const cargaVieja = facade.initialize();
      selectedBranchId.mockReturnValue(2);
      const cargaVigente = facade.initialize();

      vieja.resolver(OK_ANTICIPOS);
      await cargaVieja;
      expect(facade.isLoading()).toBe(true);
      expectSinDatos(facade);

      vigente.resolver(OK_ANTICIPOS);
      await cargaVigente;
      expect(facade.isLoading()).toBe(false);
    });

    it('un refresco viejo que falla no avisa si uno más nuevo salió bien', async () => {
      const { facade, colas } = setup();
      await facade.initialize();
      const vieja = diferida();
      colas.instructor_advances.push(vieja.promesa);
      await facade.initialize(); // refresco en curso
      await facade.reintentar(); // refresco más nuevo, correcto

      vieja.resolver(FALLA);
      await vaciarMicrotareas();

      expect(facade.refreshFailed()).toBe(false);
    });
  });

  describe('escrituras y estado de carga', () => {
    const RECHAZO = { error: { code: 'P0001', message: 'CAJA_CERRADA' } };

    it('una escritura fallida no borra el error de carga (caso A)', async () => {
      const { facade, colas, insert } = setup();
      colas.instructors.push(FALLA);
      await facade.initialize();
      const error = facade.error();
      insert.mockResolvedValue(RECHAZO);

      const ok = await facade.registrarAnticipo(payload);

      expect(ok).toBe(false);
      expect(facade.error()).toBe(error);
      expect(error).not.toBeNull();
    });

    it('una escritura en curso tampoco borra el error de carga', async () => {
      const { facade, colas, insert } = setup();
      colas.instructors.push(FALLA);
      await facade.initialize();
      let terminar!: (v: unknown) => void;
      insert.mockReturnValue(new Promise((r) => (terminar = r)));

      const guardado = facade.registrarAnticipo(payload);

      expect(facade.isSaving()).toBe(true);
      expect(facade.error()).not.toBeNull();
      terminar(RECHAZO);
      await guardado;
    });

    it('una escritura fallida no toca el aviso del caso B ni los datos', async () => {
      const { facade, colas, insert } = setup();
      await facade.initialize();
      colas.instructors.push(FALLA);
      await facade.initialize();
      await vaciarMicrotareas();
      insert.mockResolvedValue(RECHAZO);

      await facade.registrarAnticipo(payload);

      expect(facade.refreshFailed()).toBe(true);
      expectConDatos(facade);
    });

    it('fix-445-m: el rechazo por caja cerrada sale como toast, no como error de carga', async () => {
      const { facade, insert, toast } = setup();
      await facade.initialize();
      insert.mockResolvedValue(RECHAZO);

      await facade.registrarAnticipo(payload);

      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('ya está cerrada'));
      expect(facade.error()).toBeNull();
      expect(facade.refreshFailed()).toBe(false);
    });

    it('guardado correcto con refresco fallido: es éxito y pasa a caso B', async () => {
      const { facade, colas, toast } = setup();
      await facade.initialize();
      colas.instructor_advances.push(FALLA);

      const ok = await facade.registrarAnticipo(payload);

      expect(ok).toBe(true);
      expect(toast.success).toHaveBeenCalledWith('Anticipo registrado correctamente.');
      expect(toast.error).not.toHaveBeenCalled();
      expect(facade.refreshFailed()).toBe(true);
      expect(facade.error()).toBeNull();
      expect(facade.isSaving()).toBe(false);
      expectConDatos(facade);
    });

    it('guardado correcto desde el caso A: si el refresco carga, se limpia el error', async () => {
      const { facade, colas } = setup();
      colas.instructors.push(FALLA);
      await facade.initialize();
      expect(facade.error()).not.toBeNull();

      const ok = await facade.registrarAnticipo(payload);

      expect(ok).toBe(true);
      expect(facade.error()).toBeNull();
      expectConDatos(facade);
    });

    it('con refreshFailed se puede seguir registrando: la BD valida', async () => {
      const { facade, colas, insert } = setup();
      await facade.initialize();
      colas.instructors.push(FALLA);
      await facade.initialize();
      await vaciarMicrotareas();

      const ok = await facade.registrarAnticipo(payload);

      expect(ok).toBe(true);
      expect(insert).toHaveBeenCalledTimes(1);
      expect(facade.refreshFailed()).toBe(false);
    });

    it('si falla resolver al instructor a notificar, el anticipo sigue registrado', async () => {
      const { facade, single, notifications, toast } = setup();
      await facade.initialize();
      single.mockRejectedValue(new Error('red'));

      const ok = await facade.registrarAnticipo(payload);
      await vaciarMicrotareas();

      expect(ok).toBe(true);
      expect(notifications.notifyUsers).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();
      expect(facade.error()).toBeNull();
      expect(facade.refreshFailed()).toBe(false);
    });
  });
});
