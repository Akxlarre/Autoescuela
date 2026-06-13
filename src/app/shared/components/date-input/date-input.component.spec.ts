// NOTE: Excluded from vitest.config.ts — requires @analogjs/vite-plugin-angular for template tests.
// Conversion logic (isoToDate / toISODate) is verified in date.utils.spec.ts.
// Component rendering is verified via `ng build` and Playwright QA (T6.1 / T6.3).

import { describe, it, expect } from 'vitest';
import { isoToDate, toISODate } from '@core/utils/date.utils';

describe('DateInputComponent — conversion logic (isolated)', () => {
  it('getter: ISO string → Date with correct day/month/year', () => {
    const d = isoToDate('1990-06-15');
    expect(d).not.toBeNull();
    expect(d!.getFullYear()).toBe(1990);
    expect(d!.getMonth()).toBe(5);
    expect(d!.getDate()).toBe(15);
  });

  it('setter: Date → ISO string round-trip', () => {
    const iso = '1990-06-15';
    const d = isoToDate(iso)!;
    expect(toISODate(d)).toBe(iso);
  });

  it('getter: empty string → null (no date pre-selected)', () => {
    expect(isoToDate('')).toBeNull();
  });
});
