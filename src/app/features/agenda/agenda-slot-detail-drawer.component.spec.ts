import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { AgendaSlotDetailDrawerComponent } from './agenda-slot-detail-drawer.component';
import { AgendaFacade } from '@core/facades/agenda.facade';
import { AsistenciaClaseBFacade } from '@core/facades/asistencia-clase-b.facade';
import { DashboardFacade } from '@core/facades/dashboard.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import type { AgendaSlot } from '@core/models/ui/agenda.model';

function makeSlot(overrides: Partial<AgendaSlot> = {}): AgendaSlot {
  return {
    id: 'slot-1',
    date: '2026-11-16',
    startTime: '15:00',
    endTime: '15:45',
    status: 'available',
    instructorId: 1,
    instructorName: 'Juan Pérez',
    vehicleId: 7,
    vehiclePlate: 'RTRE29',
    vehicleDocWarning: { expiredDocs: ['SOAP'], expiringSoonDocs: [] },
    ...overrides,
  };
}

describe('AgendaSlotDetailDrawerComponent — fix-251-b: aviso de documentos del vehículo', () => {
  let component: AgendaSlotDetailDrawerComponent;
  let selected: ReturnType<typeof signal<AgendaSlot | null>>;
  let facadeSpy: {
    selectedSlot: () => AgendaSlot | null;
    setSelectedSlot: ReturnType<typeof vi.fn>;
  };
  let drawerSpy: { close: ReturnType<typeof vi.fn>; back: ReturnType<typeof vi.fn> };
  let routerSpy: { url: string; navigateByUrl: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    selected = signal<AgendaSlot | null>(makeSlot());
    facadeSpy = { selectedSlot: selected.asReadonly(), setSelectedSlot: vi.fn() };
    drawerSpy = { close: vi.fn(), back: vi.fn() };
    routerSpy = { url: '/app/secretaria/agenda', navigateByUrl: vi.fn() };

    TestBed.configureTestingModule({
      imports: [AgendaSlotDetailDrawerComponent],
      providers: [
        { provide: AgendaFacade, useValue: facadeSpy },
        { provide: AsistenciaClaseBFacade, useValue: { isSaving: signal(false).asReadonly() } },
        { provide: DashboardFacade, useValue: {} },
        { provide: LayoutDrawerFacadeService, useValue: drawerSpy },
        { provide: Router, useValue: routerSpy },
      ],
    });
    component = TestBed.createComponent(AgendaSlotDetailDrawerComponent).componentInstance;
  });

  it('horario disponible con el SOAP vencido → aviso con patente y documento', () => {
    expect((component as any).vehicleDocNotice()).toEqual({
      title: 'Vehículo RTRE29: SOAP vencido',
      body: 'El horario se sigue ofreciendo. Regulariza el documento en Flota.',
    });
  });

  it('clase agendada → aviso que pide regularizar antes de salir', () => {
    selected.set(makeSlot({ status: 'scheduled', studentName: 'Ana' }));
    expect((component as any).vehicleDocNotice()?.body).toBe(
      'La clase no se bloquea. Regulariza el documento antes de salir con el vehículo.',
    );
  });

  it('clase completada o "no asistió" → sin aviso', () => {
    selected.set(makeSlot({ status: 'completed' }));
    expect((component as any).vehicleDocNotice()).toBeNull();
    selected.set(makeSlot({ status: 'no_show' }));
    expect((component as any).vehicleDocNotice()).toBeNull();
  });

  it('vehículo al día → sin aviso', () => {
    selected.set(makeSlot({ vehicleDocWarning: null }));
    expect((component as any).vehicleDocNotice()).toBeNull();
  });

  it('"Ver en Flota" cierra el drawer y abre la Flota del portal actual', () => {
    (component as any).verFlota();
    expect(facadeSpy.setSelectedSlot).toHaveBeenCalledWith(null);
    expect(drawerSpy.close).toHaveBeenCalled();
    expect(routerSpy.navigateByUrl).toHaveBeenCalledWith('/app/secretaria/flota');
  });
});
