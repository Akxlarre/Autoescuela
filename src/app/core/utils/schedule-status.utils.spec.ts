
import { describe, it, expect } from 'vitest';
import { getStatusVisual, getStatusLabel, getDotStyle, SessionStatus } from './schedule-status.utils';

describe('schedule-status.utils', () => {
  describe('getStatusVisual', () => {
    it('should return correct visual for "in_progress"', () => {
      const visual = getStatusVisual('in_progress');
      expect(visual.label).toBe('En curso');
      expect(visual.borderColor).toBe('var(--state-warning)');
      expect(visual.bgClass).toBe('bg-brand');
    });

    it('should return correct visual for "completed"', () => {
      const visual = getStatusVisual('completed');
      expect(visual.label).toBe('Completada');
      expect(visual.opacity).toBe(0.6);
    });

    it('should return correct visual for "cancelled"', () => {
      const visual = getStatusVisual('cancelled');
      expect(visual.label).toBe('Cancelada');
      expect(visual.interactive).toBe(false);
    });
  });

  describe('getStatusLabel', () => {
    it('should return correct label', () => {
      expect(getStatusLabel('no_show')).toBe('No asistió');
    });
  });

  describe('getDotStyle', () => {
    it('should return a style object with background and border', () => {
      const style = getDotStyle('scheduled');
      expect(style['background']).toBe('var(--bg-surface)');
      expect(style['border']).toContain('var(--color-primary)');
    });
  });
});
