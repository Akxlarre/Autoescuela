import { TestBed } from '@angular/core/testing';
import { LiveClassesPanelComponent } from './live-classes-panel.component';

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
  });
});
