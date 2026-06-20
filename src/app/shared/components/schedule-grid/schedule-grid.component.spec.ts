import { describe, it, expect } from 'vitest';
import {
  formatDayShort,
  isInsufficientAvailability,
  isSlotSelectable,
  maxSelectableSlots,
  selectedSlotsLabels,
  toggleSlotIds,
} from './schedule-grid.logic';
import type {
  ScheduleGrid,
  SlotSelection,
  TimeSlot,
} from '@core/models/ui/enrollment-assignment.model';

function slot(
  id: string,
  date: string,
  startTime: string,
  status: TimeSlot['status'] = 'available',
): TimeSlot {
  return { id, date, startTime, endTime: startTime, status };
}

/** Grilla con 2 días (22 y 23 de junio), 3 horas cada uno, todos disponibles. */
function buildGrid(): ScheduleGrid {
  return {
    week: {
      startDate: '2026-06-22',
      endDate: '2026-06-23',
      label: 'Semana',
      days: [
        { date: '2026-06-22', label: 'lun 22/6', dayOfWeek: 'LUN' },
        { date: '2026-06-23', label: 'mar 23/6', dayOfWeek: 'MAR' },
      ],
    },
    timeRows: ['08:30-09:15', '09:20-10:05', '10:10-10:55'],
    slots: [
      slot('s-l1', '2026-06-22', '08:30'),
      slot('s-l2', '2026-06-22', '09:20'),
      slot('s-l3', '2026-06-22', '10:10'),
      slot('s-m1', '2026-06-23', '08:30'),
      slot('s-m2', '2026-06-23', '09:20'),
      slot('s-m3', '2026-06-23', '10:10'),
    ],
  };
}

function selection(over: Partial<SlotSelection> = {}): SlotSelection {
  const selectedSlotIds = over.selectedSlotIds ?? [];
  return {
    selectedSlotIds,
    requiredCount: over.requiredCount ?? 4,
    currentCount: selectedSlotIds.length,
    maxClassesPerDay: over.maxClassesPerDay ?? 1,
    isComplete: false,
  };
}

describe('schedule-grid.logic', () => {
  // ── max-per-day: público (1) vs admin (3) ──────────────────────────────────
  describe('isSlotSelectable — tope por día', () => {
    it('AC2: con maxClassesPerDay=1 bloquea un 2º slot el mismo día', () => {
      const sel = selection({ selectedSlotIds: ['s-l1'], maxClassesPerDay: 1 });
      const grid = buildGrid();
      // s-l2 es el mismo día (22/6) → no seleccionable
      expect(isSlotSelectable(slot('s-l2', '2026-06-22', '09:20'), grid, sel)).toBe(false);
      // s-m1 es otro día → seleccionable
      expect(isSlotSelectable(slot('s-m1', '2026-06-23', '08:30'), grid, sel)).toBe(true);
    });

    it('AC1: con maxClassesPerDay=3 permite el 3º slot del mismo día', () => {
      const sel = selection({
        selectedSlotIds: ['s-l1', 's-l2'],
        maxClassesPerDay: 3,
        requiredCount: 12,
      });
      expect(isSlotSelectable(slot('s-l3', '2026-06-22', '10:10'), buildGrid(), sel)).toBe(true);
    });

    it('AC1: con maxClassesPerDay=3 bloquea el 4º slot del mismo día', () => {
      const sel = selection({
        selectedSlotIds: ['s-l1', 's-l2', 's-l3'],
        maxClassesPerDay: 3,
        requiredCount: 12,
      });
      expect(isSlotSelectable(slot('s-l4', '2026-06-22', '11:00'), buildGrid(), sel)).toBe(false);
    });

    it('un slot ocupado nunca es seleccionable', () => {
      const sel = selection({ maxClassesPerDay: 3, requiredCount: 12 });
      expect(
        isSlotSelectable(slot('s-x', '2026-06-22', '08:30', 'occupied'), buildGrid(), sel),
      ).toBe(false);
    });

    it('un slot ya seleccionado siempre es "seleccionable" (para poder deseleccionar)', () => {
      const sel = selection({ selectedSlotIds: ['s-l1'], maxClassesPerDay: 1, requiredCount: 1 });
      expect(isSlotSelectable(slot('s-l1', '2026-06-22', '08:30'), buildGrid(), sel)).toBe(true);
    });
  });

  describe('toggleSlotIds', () => {
    it('agrega un slot no seleccionado dentro del cupo', () => {
      const sel = selection({ selectedSlotIds: [], maxClassesPerDay: 3, requiredCount: 12 });
      expect(toggleSlotIds(slot('s-l1', '2026-06-22', '08:30'), buildGrid(), sel)).toEqual([
        's-l1',
      ]);
    });

    it('deselecciona un slot ya seleccionado (siempre permitido)', () => {
      const sel = selection({ selectedSlotIds: ['s-l1'], maxClassesPerDay: 1 });
      expect(toggleSlotIds(slot('s-l1', '2026-06-22', '08:30'), buildGrid(), sel)).toEqual([]);
    });

    it('devuelve null si ya se alcanzó requiredCount', () => {
      const sel = selection({
        selectedSlotIds: ['s-l1', 's-m1'],
        requiredCount: 2,
        maxClassesPerDay: 3,
      });
      expect(toggleSlotIds(slot('s-l2', '2026-06-22', '09:20'), buildGrid(), sel)).toBeNull();
    });

    it('devuelve null al intentar un 2º slot del día con maxClassesPerDay=1', () => {
      const sel = selection({ selectedSlotIds: ['s-l1'], maxClassesPerDay: 1, requiredCount: 4 });
      expect(toggleSlotIds(slot('s-l2', '2026-06-22', '09:20'), buildGrid(), sel)).toBeNull();
    });

    it('devuelve null para un slot ocupado', () => {
      const sel = selection({ maxClassesPerDay: 1 });
      expect(
        toggleSlotIds(slot('s-x', '2026-06-22', '08:30', 'occupied'), buildGrid(), sel),
      ).toBeNull();
    });
  });

  // ── disponibilidad insuficiente ────────────────────────────────────────────
  describe('insufficientAvailability', () => {
    it('true cuando el cupo total no alcanza el requerido (2 días × 1/día < 4)', () => {
      const sel = selection({ maxClassesPerDay: 1, requiredCount: 4 });
      expect(isInsufficientAvailability(buildGrid(), sel)).toBe(true);
    });

    it('false cuando 3/día cubre el requerido (2 días × 3/día = 6 ≥ 4)', () => {
      const sel = selection({ maxClassesPerDay: 3, requiredCount: 4 });
      expect(isInsufficientAvailability(buildGrid(), sel)).toBe(false);
    });

    it('maxSelectableSlots respeta el cupo por día', () => {
      expect(maxSelectableSlots(buildGrid(), selection({ maxClassesPerDay: 1 }))).toBe(2);
      expect(maxSelectableSlots(buildGrid(), selection({ maxClassesPerDay: 3 }))).toBe(6);
    });
  });

  // ── resumen de clases seleccionadas ────────────────────────────────────────
  describe('selectedSlotsLabels', () => {
    it('devuelve etiquetas ordenadas cronológicamente', () => {
      const sel = selection({ selectedSlotIds: ['s-m1', 's-l1'] });
      const labels = selectedSlotsLabels(buildGrid(), sel.selectedSlotIds);
      expect(labels.map((d) => d.id)).toEqual(['s-l1', 's-m1']);
    });

    it('lista vacía si no hay selección', () => {
      expect(selectedSlotsLabels(buildGrid(), [])).toEqual([]);
    });
  });

  // ── formato de fecha (día + día/mes), idéntico en ambos flujos ──────────────
  describe('formatDayShort', () => {
    it('formatea "lun 22/6" con nombre de día abreviado, sin punto', () => {
      expect(formatDayShort('2026-06-22')).toBe('lun 22/6');
    });

    it('no usa ceros a la izquierda en día ni mes', () => {
      expect(formatDayShort('2026-06-01')).toBe('lun 1/6');
    });
  });
});
