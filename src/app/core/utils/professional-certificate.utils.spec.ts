import {
  cursoCertLabel,
  promocionCertLabel,
  promotionAllowsCertificate,
} from './professional-certificate.utils';

describe('etiquetas de los selectores (hotfix-167-m)', () => {
  it('promoción: no repite el número si el nombre ya lo trae', () => {
    expect(promocionCertLabel('278', 'Promoción 278 (7 de Septiembre 2026)')).toBe(
      'Promoción 278 (7 de Septiembre 2026)',
    );
  });

  it('promoción: antepone el número si el nombre no lo trae', () => {
    expect(promocionCertLabel('103', 'Promoción 15 de Junio 2026')).toBe(
      '103 — Promoción 15 de Junio 2026',
    );
  });

  it('curso: no repite la clase si el nombre ya la trae', () => {
    expect(cursoCertLabel('Profesional A2', 'A2')).toBe('Profesional A2');
  });

  it('curso: agrega la clase si el nombre no la trae', () => {
    expect(cursoCertLabel('Curso Profesional', 'A4')).toBe('Curso Profesional (A4)');
  });
});

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
