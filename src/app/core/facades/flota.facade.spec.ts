import { TestBed } from '@angular/core/testing';
import { FlotaFacade } from './flota.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { AuthFacade } from './auth.facade';

describe('FlotaFacade', () => {
  let service: FlotaFacade;
  let supabaseMock: any;

  beforeEach(() => {
    supabaseMock = {
      client: {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      },
    };

    TestBed.configureTestingModule({
      providers: [
        FlotaFacade,
        { provide: SupabaseService, useValue: supabaseMock },
        { provide: AuthFacade, useValue: { currentUser: vi.fn().mockReturnValue(null) } },
      ],
    });

    service = TestBed.inject(FlotaFacade);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with empty vehicles', () => {
    expect(service.vehicles()).toEqual([]);
    expect(service.isLoading()).toBe(false);
  });

  it('selectVehicle should update selectedVehicleId signal', () => {
    service.selectVehicle(123);
    expect(service.selectedVehicleId()).toBe(123);

    service.selectVehicle(null);
    expect(service.selectedVehicleId()).toBeNull();
  });
});
