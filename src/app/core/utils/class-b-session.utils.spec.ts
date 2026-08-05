import { describe, expect, it } from 'vitest';
import { VALID_CLASS_B_SESSION_STATUSES } from './class-b-session.utils';

describe('VALID_CLASS_B_SESSION_STATUSES', () => {
  it('excluye reserved y cancelled', () => {
    expect(VALID_CLASS_B_SESSION_STATUSES).not.toContain('reserved');
    expect(VALID_CLASS_B_SESSION_STATUSES).not.toContain('cancelled');
  });

  it('incluye los estados operativos legítimos', () => {
    expect(VALID_CLASS_B_SESSION_STATUSES).toEqual(
      expect.arrayContaining(['scheduled', 'in_progress', 'completed', 'no_show']),
    );
  });
});
