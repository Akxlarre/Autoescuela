import { TestBed } from '@angular/core/testing';
import { BranchFacade } from './branch.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

const MOCK_BRANCHES = [
  { id: 1, name: 'Sede Central', slug: 'central', hasProfessional: false },
  { id: 2, name: 'Sede Norte', slug: 'norte', hasProfessional: false },
];

function buildSupabaseMock(response: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(response),
  };
  return { client: { from: vi.fn().mockReturnValue(builder) } };
}

const STORAGE_KEY = 'autoescuela:selectedBranchId';

describe('BranchFacade', () => {
  let facade: BranchFacade;
  let supabaseMock: ReturnType<typeof buildSupabaseMock>;

  beforeEach(() => {
    localStorage.clear();
    supabaseMock = buildSupabaseMock({ data: MOCK_BRANCHES, error: null });

    TestBed.configureTestingModule({
      providers: [BranchFacade, { provide: SupabaseService, useValue: supabaseMock }],
    });

    facade = TestBed.inject(BranchFacade);
  });

  it('should create', () => {
    expect(facade).toBeTruthy();
  });

  describe('initial state', () => {
    it('branches() starts empty', () => {
      expect(facade.branches()).toEqual([]);
    });

    it('selectedBranchId() starts as null (Todas las escuelas)', () => {
      expect(facade.selectedBranchId()).toBeNull();
    });

    it('selectedBranchLabel() shows "Todas las escuelas" when no branch selected', () => {
      expect(facade.selectedBranchLabel()).toBe('Todas las escuelas');
    });

    it('isLoading() starts false', () => {
      expect(facade.isLoading()).toBe(false);
    });

    it('error() starts null', () => {
      expect(facade.error()).toBeNull();
    });
  });

  describe('loadBranches()', () => {
    it('populates branches signal after successful fetch', async () => {
      await facade.loadBranches();
      expect(facade.branches()).toEqual(MOCK_BRANCHES);
    });

    it('queries the branches table ordered by id', async () => {
      await facade.loadBranches();
      expect(supabaseMock.client.from).toHaveBeenCalledWith('branches');
    });

    it('sets error signal on failure', async () => {
      supabaseMock.client.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      });

      await facade.loadBranches();

      expect(facade.error()).toBe('Ha ocurrido un error inesperado. Por favor, intenta de nuevo.');
      expect(facade.branches()).toEqual([]);
    });

    it('resets isLoading to false after fetch (success)', async () => {
      await facade.loadBranches();
      expect(facade.isLoading()).toBe(false);
    });

    it('resets isLoading to false after fetch (failure)', async () => {
      supabaseMock.client.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'fail' } }),
      });

      await facade.loadBranches();

      expect(facade.isLoading()).toBe(false);
    });
  });

  describe('selectBranch()', () => {
    it('updates selectedBranchId to the given number', () => {
      facade.selectBranch(1);
      expect(facade.selectedBranchId()).toBe(1);
    });

    it('accepts null to represent "Todas las escuelas"', () => {
      facade.selectBranch(1);
      facade.selectBranch(null);
      expect(facade.selectedBranchId()).toBeNull();
    });
  });

  describe('trySelectBranch() — hotfix-063-b', () => {
    beforeEach(async () => {
      await facade.loadBranches();
    });

    it('sin bloqueos elige la sede o "Todas"', () => {
      expect(facade.trySelectBranch(2)).toBe(true);
      expect(facade.selectedBranchId()).toBe(2);
      expect(facade.trySelectBranch(null)).toBe(true);
      expect(facade.selectedBranchId()).toBeNull();
    });

    it('con una vista que exige sede, rechaza "Todas"', () => {
      facade.selectBranch(1);
      facade.setRequiresSpecificBranch(true);
      expect(facade.trySelectBranch(null)).toBe(false);
      expect(facade.selectedBranchId()).toBe(1);
      expect(facade.trySelectBranch(2)).toBe(true);
    });

    it('con la sede bloqueada (ficha del alumno), rechaza las demás', () => {
      facade.lockToBranch(1, 'Ficha de un alumno de esta sede');
      expect(facade.trySelectBranch(2)).toBe(false);
      expect(facade.selectedBranchId()).toBe(1);
      expect(facade.trySelectBranch(null)).toBe(false);
    });
  });

  describe('selectedBranchLabel (computed)', () => {
    beforeEach(async () => {
      await facade.loadBranches();
    });

    it('returns branch name when a branch is selected', () => {
      facade.selectBranch(1);
      expect(facade.selectedBranchLabel()).toBe('Sede Central');
    });

    it('returns "Todas las escuelas" when selectedBranchId is null', () => {
      facade.selectBranch(null);
      expect(facade.selectedBranchLabel()).toBe('Todas las escuelas');
    });

    it('returns "—" for an id not found in branches list', () => {
      facade.selectBranch(999);
      expect(facade.selectedBranchLabel()).toBe('—');
    });
  });

  describe('reset()', () => {
    it('sets selectedBranchId back to null', () => {
      facade.selectBranch(2);
      facade.reset();
      expect(facade.selectedBranchId()).toBeNull();
    });

    it('selectedBranchLabel returns "Todas las escuelas" after reset', () => {
      facade.selectBranch(2);
      facade.reset();
      expect(facade.selectedBranchLabel()).toBe('Todas las escuelas');
    });
  });

  describe('persistencia en localStorage (fix-068/fix-069 / H-026)', () => {
    it('selectBranch() persiste {id, name}', async () => {
      await facade.loadBranches();
      facade.selectBranch(2);
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({
        id: 2,
        name: 'Sede Norte',
      });
    });

    it('selectBranch(null) limpia la persistencia', () => {
      facade.selectBranch(2);
      facade.selectBranch(null);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('reset() limpia la persistencia', () => {
      facade.selectBranch(2);
      facade.reset();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('loadBranches() mantiene la sede persistida si sigue existiendo', async () => {
      // El id se persiste ANTES de construir el facade (simula un F5 real) —
      // reusar la instancia del beforeEach no sirve porque esta ya se
      // construyó con localStorage vacío.
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: 2, name: 'Sede Norte' }));

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [BranchFacade, { provide: SupabaseService, useValue: supabaseMock }],
      });
      const freshFacade = TestBed.inject(BranchFacade);

      await freshFacade.loadBranches();
      expect(freshFacade.selectedBranchId()).toBe(2);
      expect(freshFacade.branches()).toEqual(MOCK_BRANCHES);
    });

    it('loadBranches() ignora y limpia un id persistido que ya no existe entre las sedes', async () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: 999, name: 'Sede Fantasma' }));
      await facade.loadBranches();
      expect(facade.selectedBranchId()).toBeNull();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('loadBranches() sin nada persistido mantiene "Todas las escuelas"', async () => {
      await facade.loadBranches();
      expect(facade.selectedBranchId()).toBeNull();
    });

    it('ignora un valor persistido en el formato legacy (id plano, sin JSON)', () => {
      localStorage.setItem(STORAGE_KEY, '2');

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [BranchFacade, { provide: SupabaseService, useValue: supabaseMock }],
      });
      const freshFacade = TestBed.inject(BranchFacade);

      expect(freshFacade.selectedBranchId()).toBeNull();
    });

    it('siembra branches() con un stub {id, name} de forma síncrona al construirse, antes de loadBranches() (evita flash de label incorrecto)', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: 2, name: 'Sede Norte' }));

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [BranchFacade, { provide: SupabaseService, useValue: supabaseMock }],
      });
      const freshFacade = TestBed.inject(BranchFacade);

      expect(freshFacade.selectedBranchId()).toBe(2);
      expect(freshFacade.branches()).toEqual([
        { id: 2, name: 'Sede Norte', slug: '', hasProfessional: false },
      ]);
      expect(freshFacade.selectedBranchLabel()).toBe('Sede Norte');
    });
  });

  describe('cambio temporal de sede — fix-274-m', () => {
    it('restaura "Todas las escuelas" si era lo elegido antes del cambio temporal', () => {
      facade.selectBranchTemporarily(2);
      expect(facade.selectedBranchId()).toBe(2);

      facade.restoreTemporaryBranch();

      expect(facade.selectedBranchId()).toBeNull();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('restaura la sede concreta que había antes', () => {
      facade.selectBranch(1);
      facade.selectBranchTemporarily(2);

      facade.restoreTemporaryBranch();

      expect(facade.selectedBranchId()).toBe(1);
    });

    it('dos cambios temporales seguidos restauran la sede original, no la intermedia', () => {
      facade.selectBranch(1);
      facade.selectBranchTemporarily(2);
      facade.selectBranchTemporarily(1);

      facade.restoreTemporaryBranch();

      expect(facade.selectedBranchId()).toBe(1);
    });

    it('sin un cambio temporal pendiente, restaurar no toca la sede elegida', () => {
      facade.selectBranch(2);

      facade.restoreTemporaryBranch();

      expect(facade.selectedBranchId()).toBe(2);
    });

    it('restaura una sola vez: después no pisa la sede que el admin elija', () => {
      facade.selectBranchTemporarily(2);
      facade.restoreTemporaryBranch();
      facade.selectBranch(1);

      facade.restoreTemporaryBranch();

      expect(facade.selectedBranchId()).toBe(1);
    });
  });

  describe('modo Profesional — fix-334-m', () => {
    // Sede 1 sin Clase Profesional · sede 2 con Clase Profesional (como en producción).
    const DB_ROWS = [
      { id: 1, name: 'Autoescuela Chillán', slug: 'autoescuela', has_professional: false },
      { id: 2, name: 'Conductores Chillán', slug: 'conductores', has_professional: true },
    ];
    const persisted = () => localStorage.getItem(STORAGE_KEY);

    function buildFacade(persistedBranch: { id: number; name: string } | null): {
      facade: BranchFacade;
      from: ReturnType<typeof vi.fn>;
    } {
      localStorage.clear();
      if (persistedBranch) localStorage.setItem(STORAGE_KEY, JSON.stringify(persistedBranch));
      const mock = buildSupabaseMock({ data: DB_ROWS, error: null });
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [BranchFacade, { provide: SupabaseService, useValue: mock }],
      });
      return { facade: TestBed.inject(BranchFacade), from: mock.client.from };
    }

    it('al entrar con las sedes cargadas aplica la sede Profesional sin guardarla', async () => {
      const { facade: f } = buildFacade(null);
      await f.loadBranches();

      f.setProfessionalOnly(true);

      expect(f.selectedBranchId()).toBe(2);
      expect(persisted()).toBeNull();
    });

    it('A10: entrar antes de que carguen las sedes (F5) aplica la Profesional al terminar la carga', async () => {
      const { facade: f } = buildFacade({ id: 1, name: 'Autoescuela Chillán' });

      f.setProfessionalOnly(true);
      await f.loadBranches();

      expect(f.selectedBranchId()).toBe(2);
      expect(JSON.parse(persisted()!).id).toBe(1);
    });

    it('A09: al salir vuelve a "Todas" si era lo previo, y lo guardado coincide', async () => {
      const { facade: f } = buildFacade(null);
      await f.loadBranches();

      f.setProfessionalOnly(true);
      f.setProfessionalOnly(false);

      expect(f.selectedBranchId()).toBeNull();
      expect(persisted()).toBeNull();
    });

    it('A09: al salir vuelve a la sede concreta previa (aunque se entró tras un F5)', async () => {
      const { facade: f } = buildFacade({ id: 1, name: 'Autoescuela Chillán' });
      f.setProfessionalOnly(true);
      await f.loadBranches();

      f.setProfessionalOnly(false);

      expect(f.selectedBranchId()).toBe(1);
      expect(JSON.parse(persisted()!).id).toBe(1);
    });

    it('una llamada anidada (Pre-inscritos embebido) no pisa la sede previa', async () => {
      const { facade: f } = buildFacade(null);
      await f.loadBranches();

      f.setProfessionalOnly(true);
      f.setProfessionalOnly(true);
      f.setProfessionalOnly(false);

      expect(f.selectedBranchId()).toBeNull();
    });

    it('salir sin haber entrado no toca la sede elegida', async () => {
      const { facade: f } = buildFacade(null);
      await f.loadBranches();
      f.selectBranch(1);

      f.setProfessionalOnly(false);

      expect(f.selectedBranchId()).toBe(1);
    });

    it('entrar ya estando en la sede Profesional la conserva al salir', async () => {
      const { facade: f } = buildFacade({ id: 2, name: 'Conductores Chillán' });
      await f.loadBranches();

      f.setProfessionalOnly(true);
      f.setProfessionalOnly(false);

      expect(f.selectedBranchId()).toBe(2);
      expect(JSON.parse(persisted()!).id).toBe(2);
    });

    it('ensureBranchesLoaded() reutiliza la carga en curso y no consulta dos veces', async () => {
      const { facade: f, from } = buildFacade({ id: 1, name: 'Autoescuela Chillán' });

      void f.loadBranches();
      await f.ensureBranchesLoaded();
      await f.ensureBranchesLoaded();

      expect(from).toHaveBeenCalledTimes(1);
      expect(f.branches().map((b) => b.id)).toEqual([1, 2]);
    });

    it('una carga fallida no bloquea un reintento', async () => {
      const { facade: f, from } = buildFacade(null);
      const builder = from();
      builder.order.mockResolvedValueOnce({ data: null, error: { message: 'red caída' } });
      from.mockClear();

      await f.loadBranches();
      await f.ensureBranchesLoaded();

      expect(from).toHaveBeenCalledTimes(2);
      expect(f.branches().map((b) => b.id)).toEqual([1, 2]);
    });

    // fix-342-m (D17): la ficha del alumno bloquea el selector en la sede de su matrícula.
    describe('bloqueo de sede (fix-342-m)', () => {
      const REASON = 'Sede de la matrícula del alumno';

      it('fija la sede en memoria, sin guardarla, y deshabilita "Todas" y las demás', async () => {
        const { facade: f } = buildFacade(null);
        await f.loadBranches();

        f.lockToBranch(1, REASON);

        expect(f.selectedBranchId()).toBe(1);
        expect(persisted()).toBeNull();
        expect(f.requiresSpecificBranch()).toBe(true);
        expect(f.disabledBranchIds()).toEqual([2]);
        expect(f.lockReason()).toBe(REASON);
      });

      it('al liberar vuelve a la sede previa ("Todas") y deja de bloquear', async () => {
        const { facade: f } = buildFacade(null);
        await f.loadBranches();
        f.lockToBranch(1, REASON);

        f.releaseBranchLock();

        expect(f.selectedBranchId()).toBeNull();
        expect(f.requiresSpecificBranch()).toBe(false);
        expect(f.disabledBranchIds()).toEqual([]);
        expect(f.lockReason()).toBeNull();
      });

      it('cambiar de matrícula mueve el bloqueo y al liberar vuelve a la sede ORIGINAL', async () => {
        const { facade: f } = buildFacade({ id: 2, name: 'Conductores Chillán' });
        await f.loadBranches();

        f.lockToBranch(1, REASON);
        f.lockToBranch(2, REASON);
        expect(f.selectedBranchId()).toBe(2);
        expect(f.disabledBranchIds()).toEqual([1]);

        f.lockToBranch(1, REASON);
        f.releaseBranchLock();
        expect(f.selectedBranchId()).toBe(2);
        expect(JSON.parse(persisted()!).id).toBe(2);
      });

      it('liberar sin bloqueo no toca la sede', async () => {
        const { facade: f } = buildFacade(null);
        await f.loadBranches();
        f.selectBranch(2);

        f.releaseBranchLock();

        expect(f.selectedBranchId()).toBe(2);
      });

      it('salir de Base Profesional → ficha → volver: la ficha bloquea y la Base vuelve a su sede', async () => {
        const { facade: f } = buildFacade(null);
        await f.loadBranches();
        f.setProfessionalOnly(true); // Base Profesional
        f.setProfessionalOnly(false); // se destruye al abrir la ficha → vuelve a "Todas"
        f.lockToBranch(2, REASON); // ficha de un alumno de Conductores
        expect(f.selectedBranchId()).toBe(2);
        expect(f.lockReason()).toBe(REASON);

        f.releaseBranchLock(); // Volver
        f.setProfessionalOnly(true); // Base Profesional otra vez
        expect(f.selectedBranchId()).toBe(2);
        expect(f.lockReason()).toBe('Solo sedes con Clase Profesional');
      });
    });

    it('ensureBranchesLoaded() carga si nadie lo hizo, aunque haya un stub de localStorage', async () => {
      const { facade: f, from } = buildFacade({ id: 1, name: 'Autoescuela Chillán' });
      expect(f.branches()).toHaveLength(1);

      await f.ensureBranchesLoaded();

      expect(from).toHaveBeenCalledTimes(1);
      expect(f.branches().find((b) => b.id === 2)?.hasProfessional).toBe(true);
    });
  });
});
