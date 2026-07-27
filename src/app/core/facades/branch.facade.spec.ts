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
});
