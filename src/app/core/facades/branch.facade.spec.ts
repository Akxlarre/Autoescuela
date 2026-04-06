import { TestBed } from '@angular/core/testing';
import { BranchFacade } from './branch.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

const MOCK_BRANCHES = [
  { id: 1, name: 'Sede Central', slug: 'central' },
  { id: 2, name: 'Sede Norte', slug: 'norte' },
];

function buildSupabaseMock(response: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(response),
  };
  return { client: { from: vi.fn().mockReturnValue(builder) } };
}

describe('BranchFacade', () => {
  let facade: BranchFacade;
  let supabaseMock: ReturnType<typeof buildSupabaseMock>;

  beforeEach(() => {
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

      expect(facade.error()).toBe('DB error');
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
});
