import { kpiDisplayValue } from './kpi-display-value.util';

// spec-0012 — AC1, AC2, AC3, AC-E1, AC-E2
describe('kpiDisplayValue', () => {
  it('AC1 — number 42 → "42"', () => {
    expect(kpiDisplayValue(42)).toBe('42');
  });

  it('AC-E1 — number 0 → "0" (no falsy)', () => {
    expect(kpiDisplayValue(0)).toBe('0');
  });

  it('AC2 — string "N/A" → "N/A" sin transformar', () => {
    expect(kpiDisplayValue('N/A')).toBe('N/A');
  });

  it('AC3 — string "85%" → "85%" sin transformar', () => {
    expect(kpiDisplayValue('85%')).toBe('85%');
  });

  it('AC-E2 — string vacío "" → "—" (fallback)', () => {
    expect(kpiDisplayValue('')).toBe('—');
  });
});
