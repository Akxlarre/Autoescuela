import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { VehicleMaintenancesComponent } from './vehicle-maintenances.component';
import { FlotaDetalleFacade } from '@core/facades/flota-detalle.facade';
import { FlotaFacade } from '@core/facades/flota.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { ScheduledMaintenance } from '@core/models/ui/vehicle-detail.model';

// ─── fix-133-b (ASG-b-077): hasScheduledMaintenances decide el modificador del root
// bento-grid (--fill-screen-kpi vs --fill-screen) según haya o no mantenciones
// programadas, para que la tabla siempre caiga en la fila fill del grid. ───
describe('VehicleMaintenancesComponent — hasScheduledMaintenances (fix-133-b)', () => {
  let component: VehicleMaintenancesComponent;
  let isLoading: ReturnType<typeof signal<boolean>>;
  let scheduledMaintenances: ReturnType<typeof signal<ScheduledMaintenance[]>>;

  const scheduled: ScheduledMaintenance = { type: 'Revisión técnica', dueDate: null, status: 'ok' };

  function setup(): void {
    isLoading = signal(false);
    scheduledMaintenances = signal<ScheduledMaintenance[]>([]);

    TestBed.configureTestingModule({
      imports: [VehicleMaintenancesComponent],
      providers: [
        {
          provide: FlotaDetalleFacade,
          useValue: {
            vehicle: signal(null),
            maintenances: signal([]),
            scheduledMaintenances,
            isLoading,
            error: signal(null),
            maintenanceKpis: () => ({ totalCount: 0, totalSpent: 0, avgMonthly: 0, kmTraveled: 0 }),
            selectMaintenance: vi.fn(),
            loadVehicleDetail: vi.fn().mockResolvedValue(undefined),
          },
        },
        { provide: FlotaFacade, useValue: { selectVehicle: vi.fn() } },
        {
          provide: LayoutDrawerFacadeService,
          useValue: { open: vi.fn(), close: vi.fn(), isOpen: signal(false) },
        },
        { provide: GsapAnimationsService, useValue: { animateBentoGrid: vi.fn() } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: new Map([['id', '1']]) } },
        },
      ],
    });

    component = TestBed.createComponent(VehicleMaintenancesComponent).componentInstance;
  }

  beforeEach(() => setup());

  it('es false mientras carga, aunque ya haya datos programados en el signal', () => {
    isLoading.set(true);
    scheduledMaintenances.set([scheduled]);
    expect(component.hasScheduledMaintenances()).toBe(false);
  });

  it('es false con 0 mantenciones programadas (vehículo sin vehicle_documents)', () => {
    isLoading.set(false);
    scheduledMaintenances.set([]);
    expect(component.hasScheduledMaintenances()).toBe(false);
  });

  it('es true con al menos 1 mantención programada y carga terminada', () => {
    isLoading.set(false);
    scheduledMaintenances.set([scheduled]);
    expect(component.hasScheduledMaintenances()).toBe(true);
  });
});
