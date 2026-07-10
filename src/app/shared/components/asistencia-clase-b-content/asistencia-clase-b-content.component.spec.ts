import { TestBed } from '@angular/core/testing';
import { AsistenciaClaseBContentComponent } from './asistencia-clase-b-content.component';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { ClasePracticaRow } from '@core/models/ui/asistencia-clase-b.model';

function makeRow(over: Partial<ClasePracticaRow> = {}): ClasePracticaRow {
  return {
    id: 1,
    enrollmentId: 10,
    studentId: 5,
    classNumber: 1,
    horaInicio: '09:00',
    horaInicioReal: null,
    horaFinReal: null,
    instructorId: 3,
    instructorName: 'Inst',
    alumnoName: 'Juan Pérez',
    status: 'ausente',
    justificacion: null,
    branchId: 1,
    branchName: 'Chillán',
    scheduledAt: '2026-06-30T09:00:00',
    kmStart: null,
    vehiclePlate: null,
    vehicleBrand: null,
    vehicleModel: null,
    vehicleId: null,
    vehicleCurrentKm: null,
    ...over,
  };
}

describe('AsistenciaClaseBContentComponent — badge de estado', () => {
  let component: AsistenciaClaseBContentComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AsistenciaClaseBContentComponent],
      providers: [
        {
          provide: GsapAnimationsService,
          useValue: { animateBentoGrid: vi.fn() },
        },
      ],
    });
    component = TestBed.createComponent(AsistenciaClaseBContentComponent).componentInstance;
  });

  it('etiqueta una inasistencia sin justificar como "Ausente"', () => {
    const row = makeRow({ status: 'ausente', justificacion: null });
    expect((component as any).isJustificada(row)).toBe(false);
    expect((component as any).statusBadgeLabel(row)).toBe('Ausente');
  });

  it('etiqueta una inasistencia justificada como "Justificada"', () => {
    const row = makeRow({ status: 'ausente', justificacion: 'Certificado médico' });
    expect((component as any).isJustificada(row)).toBe(true);
    expect((component as any).statusBadgeLabel(row)).toBe('Justificada');
    expect((component as any).statusBadgeIcon(row)).toBe('shield-check');
  });

  it('no confunde "presente" con justificada aunque tenga texto residual', () => {
    const row = makeRow({ status: 'presente', justificacion: null });
    expect((component as any).isJustificada(row)).toBe(false);
    expect((component as any).statusBadgeLabel(row)).toBe('Presente');
  });
});
