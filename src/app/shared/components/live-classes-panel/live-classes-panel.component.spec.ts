import { TestBed } from '@angular/core/testing';
import { LiveClassesPanelComponent } from './live-classes-panel.component';
import type { LiveClassModel } from '@core/models/ui/dashboard.model';

function makeLiveClass(over: Partial<LiveClassModel> = {}): LiveClassModel {
  return {
    id: 'prac-1',
    originalId: 1,
    studentName: 'Juan Pérez',
    instructorName: 'Ana Soto',
    timeLabel: '09:00 - 09:45',
    status: 'in_progress',
    type: 'practical',
    scheduledAt: '2026-07-27T11:15:00.000Z',
    durationMin: 45,
    studentId: 1,
    kmStart: null,
    ...over,
  };
}

describe('LiveClassesPanelComponent', () => {
  let component: LiveClassesPanelComponent;
  const NOW = new Date('2026-07-27T12:00:00.000Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);

    TestBed.configureTestingModule({
      imports: [LiveClassesPanelComponent],
    });
    component = TestBed.createComponent(LiveClassesPanelComponent).componentInstance;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ─── fix-073: "Transcurriendo" vs "Atrasada" según status real ─────────────
  describe('getRelativeTime (fix-073)', () => {
    it('clase pending con hora futura → "En X min"', () => {
      const future = new Date(NOW + 20 * 60000).toISOString();
      expect(component.getRelativeTime(future, 'pending')).toBe('En 20 min');
    });

    it('clase pending con hora futura lejana → "En X h"', () => {
      const future = new Date(NOW + 3 * 3600000).toISOString();
      expect(component.getRelativeTime(future, 'pending')).toBe('En 3 h');
    });

    it('clase pending con hora ya pasada (no iniciada) → "Debía iniciar hace X min" (H-008)', () => {
      const past = new Date(NOW - 10 * 60000).toISOString();
      expect(component.getRelativeTime(past, 'pending')).toBe('Debía iniciar hace 10 min');
    });

    it('clase pending con hora pasada hace más de 1h → "Debía iniciar hace X h" (H-008)', () => {
      const past = new Date(NOW - 2 * 3600000).toISOString();
      expect(component.getRelativeTime(past, 'pending')).toBe('Debía iniciar hace 2 h');
    });

    it('clase in_progress → "Transcurriendo" sin importar la hora', () => {
      const past = new Date(NOW - 30 * 60000).toISOString();
      expect(component.getRelativeTime(past, 'in_progress')).toBe('Transcurriendo');
    });

    it('clase completed → "Concluida"', () => {
      const past = new Date(NOW - 60 * 60000).toISOString();
      expect(component.getRelativeTime(past, 'completed')).toBe('Concluida');
    });
  });

  describe('statusLabel', () => {
    it('pending → "Por Iniciar"', () => {
      expect(component.statusLabel('pending')).toBe('Por Iniciar');
    });

    it('in_progress → "En Curso"', () => {
      expect(component.statusLabel('in_progress')).toBe('En Curso');
    });

    it('completed → "Finalizada"', () => {
      expect(component.statusLabel('completed')).toBe('Finalizada');
    });

    it('in_progress atrasada (overdue=true) → "Atrasada" (spec 0001-i)', () => {
      expect(component.statusLabel('in_progress', true)).toBe('Atrasada');
    });
  });

  // ─── isOverdue / aviso de cierre atrasado (spec 0001-i, AC3) ────────────────
  describe('isOverdue', () => {
    it('false para in_progress recién iniciada (fin agendado no llegó)', () => {
      const cls = makeLiveClass({
        status: 'in_progress',
        scheduledAt: new Date(NOW - 10 * 60000).toISOString(),
        durationMin: 45,
      });
      expect(component.isOverdue(cls)).toBe(false);
    });

    it('true para in_progress cuyo fin agendado + 15 min ya pasó', () => {
      const cls = makeLiveClass({
        status: 'in_progress',
        scheduledAt: new Date(NOW - 70 * 60000).toISOString(), // fin agendado hace 25 min (70-45)
        durationMin: 45,
      });
      expect(component.isOverdue(cls)).toBe(true);
    });

    it('false para pending sin importar el tiempo', () => {
      const cls = makeLiveClass({
        status: 'pending',
        scheduledAt: new Date(NOW - 200 * 60000).toISOString(),
        durationMin: 45,
      });
      expect(component.isOverdue(cls)).toBe(false);
    });

    it('getRelativeTime muestra "Cierre atrasado" cuando overdue=true', () => {
      const past = new Date(NOW - 60 * 60000).toISOString();
      expect(component.getRelativeTime(past, 'in_progress', true)).toBe('Cierre atrasado');
    });
  });
});
