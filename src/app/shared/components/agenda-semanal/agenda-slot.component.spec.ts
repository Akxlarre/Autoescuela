import { TestBed } from '@angular/core/testing';
import { LucideAngularModule, TriangleAlert } from 'lucide-angular';
import { AgendaSlotComponent } from './agenda-slot.component';
import type { AgendaSlot } from '@core/models/ui/agenda.model';

function makeSlot(overrides: Partial<AgendaSlot> = {}): AgendaSlot {
  return {
    id: 'slot-1',
    date: '2026-08-12',
    startTime: '08:30',
    endTime: '09:15',
    status: 'available',
    instructorId: 1,
    instructorName: 'Juan Pérez',
    vehicleId: 10,
    vehiclePlate: 'ABCD-12',
    vehicleDocWarning: null,
    ...overrides,
  };
}

// TODO: Component template tests require @analogjs/vite-plugin-angular for compilation.
// Adding that plugin to vitest.config.ts breaks TestBed for all facade/service tests.
// Track resolution in: fix vitest.config.ts to support both Angular plugin + TestBed.
describe.skip('AgendaSlotComponent — vehicleDocWarning badge', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AgendaSlotComponent, LucideAngularModule.pick({ TriangleAlert })],
    });
  });

  function createComponent(slot: AgendaSlot, showVehicleWarnings = true) {
    const fixture = TestBed.createComponent(AgendaSlotComponent);
    fixture.componentRef.setInput('slot', slot);
    fixture.componentRef.setInput('showVehicleWarnings', showVehicleWarnings);
    fixture.detectChanges();
    return fixture;
  }

  it('no muestra advertencia si el vehículo no tiene documentos vencidos ni por vencer', () => {
    const fixture = createComponent(makeSlot({ vehicleDocWarning: null }));
    expect(fixture.componentInstance.showVehicleDocWarning()).toBe(false);
  });

  it('muestra advertencia "expired" cuando vehicleDocWarning tiene expiredDocs', () => {
    const fixture = createComponent(
      makeSlot({ vehicleDocWarning: { expiredDocs: ['SOAP'], expiringSoonDocs: [] } }),
    );
    expect(fixture.componentInstance.showVehicleDocWarning()).toBe(true);
    expect(fixture.componentInstance.vehicleDocWarningLabel()).toContain('vencido');
  });

  it('muestra advertencia "expiring_soon" cuando vehicleDocWarning tiene expiringSoonDocs', () => {
    const fixture = createComponent(
      makeSlot({ vehicleDocWarning: { expiredDocs: [], expiringSoonDocs: ['Seguro'] } }),
    );
    expect(fixture.componentInstance.showVehicleDocWarning()).toBe(true);
    expect(fixture.componentInstance.vehicleDocWarningLabel()).toContain('por vencer');
  });

  it('oculta el badge cuando showVehicleWarnings=false, aunque el slot tenga advertencia', () => {
    const fixture = createComponent(
      makeSlot({ vehicleDocWarning: { expiredDocs: ['SOAP'], expiringSoonDocs: [] } }),
      false,
    );
    expect(fixture.componentInstance.showVehicleDocWarning()).toBe(false);
  });
});
