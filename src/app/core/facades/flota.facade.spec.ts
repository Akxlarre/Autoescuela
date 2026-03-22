import { TestBed } from '@angular/core/testing';
import { FlotaFacade } from './flota.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

describe('FlotaFacade', () => {
  let service: FlotaFacade;
  let supabaseMock: any;

  beforeEach(() => {
    supabaseMock = {
      client: {
        from: (window as any).vi.fn().mockReturnValue({
          select: (window as any).vi.fn().mockReturnValue({
            order: (window as any).vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      },
    };

    TestBed.configureTestingModule({
      providers: [
        FlotaFacade,
        { provide: SupabaseService, useValue: supabaseMock },
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
