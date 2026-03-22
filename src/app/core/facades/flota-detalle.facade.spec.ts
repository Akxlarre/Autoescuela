import { TestBed } from '@angular/core/testing';
import { FlotaDetalleFacade } from './flota-detalle.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';

describe('FlotaDetalleFacade', () => {
  let service: FlotaDetalleFacade;
  let supabaseMock: any;

  beforeEach(() => {
    supabaseMock = {
      client: {
        from: (window as any).vi?.fn() || (() => ({})),
      },
    };

    TestBed.configureTestingModule({
      providers: [
        FlotaDetalleFacade,
        { provide: SupabaseService, useValue: supabaseMock },
      ],
    });

    service = TestBed.inject(FlotaDetalleFacade);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should initialize with null vehicle and empty maintenances', () => {
    expect(service.vehicle()).toBe(null);
    expect(service.maintenances()).toEqual([]);
  });

  it('selectMaintenance should update selectedMaintenanceId signal', () => {
    service.selectMaintenance(456);
    expect(service.selectedMaintenanceId()).toBe(456);
    
    service.selectMaintenance(null);
    expect(service.selectedMaintenanceId()).toBe(null);
  });
});
