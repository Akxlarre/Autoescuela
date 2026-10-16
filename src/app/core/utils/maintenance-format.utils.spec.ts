import { formatKm, servicesLabel } from './maintenance-format.utils';

describe('maintenance-format.utils (hotfix-086-b)', () => {
  it('formatKm: separador de miles chileno', () => {
    expect(formatKm(1200)).toBe('1.200 km');
    expect(formatKm(300015)).toBe('300.015 km');
    expect(formatKm(0)).toBe('0 km');
    expect(formatKm(null)).toBe('—');
  });

  it('servicesLabel: singular y plural', () => {
    expect(servicesLabel(0)).toBe('0 servicios');
    expect(servicesLabel(1)).toBe('1 servicio');
    expect(servicesLabel(12)).toBe('12 servicios');
  });
});
