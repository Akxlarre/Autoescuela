import { describe, expect, it } from 'vitest';
import { filterRemainingBlocks, shouldShowEmptyDayState } from './daily-schedule-timeline.utils';
import type { DaySchedule, ScheduleBlock } from '@core/models/ui/instructor-portal.model';

function makeBlock(overrides: Partial<ScheduleBlock>): ScheduleBlock {
  return {
    dayOfWeek: 0,
    hour: 15,
    minuteStart: 0,
    durationMin: 45,
    status: 'scheduled',
    studentName: 'Alumna Test',
    vehiclePlate: 'XYZ12',
    classNumber: 1,
    sessionId: 1,
    startTime: '15:00',
    endTime: '15:45',
    ...overrides,
  };
}

function makeDaySchedule(overrides: Partial<DaySchedule>): DaySchedule {
  return {
    date: '2026-08-14',
    dayLabel: 'Viernes',
    dateLabel: '14 de Agosto, 2026',
    blocks: [],
    nextBlock: null,
    ...overrides,
  };
}

describe('filterRemainingBlocks', () => {
  it('excludes the nextBlock from the rail', () => {
    const nextBlock = makeBlock({ sessionId: 1, startTime: '15:00' });
    const otherBlock = makeBlock({ sessionId: 2, startTime: '15:50' });
    const daySchedule = makeDaySchedule({ blocks: [nextBlock, otherBlock], nextBlock });

    expect(filterRemainingBlocks(daySchedule)).toEqual([otherBlock]);
  });

  it('returns all blocks when there is no nextBlock', () => {
    const completedBlock = makeBlock({ sessionId: 3, status: 'completed' });
    const daySchedule = makeDaySchedule({ blocks: [completedBlock], nextBlock: null });

    expect(filterRemainingBlocks(daySchedule)).toEqual([completedBlock]);
  });

  it('returns an empty array for a null schedule', () => {
    expect(filterRemainingBlocks(null)).toEqual([]);
  });
});

describe('shouldShowEmptyDayState', () => {
  it('is true when the day has no blocks at all', () => {
    expect(shouldShowEmptyDayState(makeDaySchedule({ blocks: [] }))).toBe(true);
  });

  it('is false when the day has blocks even without a nextBlock (e.g. all completed)', () => {
    const completedBlock = makeBlock({ sessionId: 3, status: 'completed' });
    const daySchedule = makeDaySchedule({ blocks: [completedBlock], nextBlock: null });

    expect(shouldShowEmptyDayState(daySchedule)).toBe(false);
  });

  it('is true for a null schedule', () => {
    expect(shouldShowEmptyDayState(null)).toBe(true);
  });
});
