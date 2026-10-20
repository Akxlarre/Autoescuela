import { describe, expect, it } from 'vitest';
import { isMissingBranch } from './missing-branch.utils';

describe('isMissingBranch', () => {
  it('secretaria sin sede → true', () => {
    expect(isMissingBranch('secretaria', null)).toBe(true);
    expect(isMissingBranch('secretaria', undefined)).toBe(true);
  });

  it('secretaria con sede → false', () => {
    expect(isMissingBranch('secretaria', 1)).toBe(false);
  });

  it('secretaria sin sede pero con grant multisede → false (opera en ambas)', () => {
    expect(isMissingBranch('secretaria', null, true)).toBe(false);
  });

  it('admin sin sede es lo normal → false', () => {
    expect(isMissingBranch('admin', null)).toBe(false);
  });

  it('sin usuario → false', () => {
    expect(isMissingBranch(undefined, null)).toBe(false);
  });
});
