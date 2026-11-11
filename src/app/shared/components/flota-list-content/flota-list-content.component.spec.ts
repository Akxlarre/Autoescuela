import { NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FlotaListContentComponent } from './flota-list-content.component';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { VehicleTableRow } from '@core/models/ui/vehicle-table.model';

function makeVehicle(overrides: Partial<VehicleTableRow> = {}): VehicleTableRow {
  return {
    id: 1,
    licensePlate: 'ABCD-12',
    brand: 'Suzuki',
    model: 'Swift',
    year: 2024,
    vehicleLabel: 'Suzuki Swift',
    status: 'available',
    currentKm: 15000,
    nextMaintenanceDate: null,
    instructorName: null,
    instructorId: null,
    branchId: 1,
    bothBranches: false,
    canManage: true,
    documents: [],
    combustibleMes: 0,
    ...overrides,
  };
}

describe('FlotaListContentComponent — layout Caso B en fill-screen (spec 0060-b T3.6)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('el aviso de Caso B vive dentro de .bento-fill y no como hijo directo de .bento-grid', () => {
    TestBed.configureTestingModule({
      imports: [FlotaListContentComponent],
      providers: [
        {
          provide: GsapAnimationsService,
          useValue: { animateBentoGrid: vi.fn(), animateHero: vi.fn(), addCardHover: vi.fn() },
        },
      ],
    }).overrideComponent(FlotaListContentComponent, {
      set: {
        imports: [CommonModule],
        schemas: [NO_ERRORS_SCHEMA],
      },
    });

    const fixture = TestBed.createComponent(FlotaListContentComponent);
    const component = fixture.componentInstance;
    Object.defineProperty(component, 'vehicles', { value: signal([makeVehicle()]) });
    Object.defineProperty(component, 'refreshFailed', { value: signal(true) });
    fixture.detectChanges();

    const alertCard = fixture.nativeElement.querySelector('app-alert-card') as HTMLElement | null;
    expect(alertCard).not.toBeNull();
    expect(alertCard?.closest('.bento-fill')).not.toBeNull();
    expect(alertCard?.parentElement?.classList.contains('bento-grid')).toBe(false);
    expect(fixture.nativeElement.querySelector('.bento-grid > [role="alert"]')).toBeNull();
  });
});
