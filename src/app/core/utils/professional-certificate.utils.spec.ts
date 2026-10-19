import { promotionAllowsCertificate } from './professional-certificate.utils';

describe('promotionAllowsCertificate (fix-467-m)', () => {
  it('promoción en curso: no', () => {
    expect(promotionAllowsCertificate('2026-10-24', '2026-10-19')).toBe(false);
  });

  it('último día de la promoción: sí', () => {
    expect(promotionAllowsCertificate('2026-10-19', '2026-10-19')).toBe(true);
  });

  it('promoción terminada: sí', () => {
    expect(promotionAllowsCertificate('2026-08-24', '2026-10-19')).toBe(true);
  });

  it('sin promoción o sin fecha: no', () => {
    expect(promotionAllowsCertificate(null, '2026-10-19')).toBe(false);
    expect(promotionAllowsCertificate('', '2026-10-19')).toBe(false);
  });
});
