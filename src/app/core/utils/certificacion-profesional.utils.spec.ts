import { isEligibleForProfessionalCertificate } from './certificacion-profesional.utils';
import type { ElegibilidadCertProf } from '@core/models/ui/certificacion-profesional.model';

function elegibilidad(overrides: Partial<ElegibilidadCertProf> = {}): ElegibilidadCertProf {
  return { promocion: true, teoria: true, practica: true, pago: true, nota: true, ...overrides };
}

describe('isEligibleForProfessionalCertificate', () => {
  it('admin siempre es elegible', () => {
    const sinNada = elegibilidad({ teoria: false, pago: false });
    expect(isEligibleForProfessionalCertificate(true, sinNada, true)).toBe(true);
    expect(isEligibleForProfessionalCertificate(true, sinNada, false)).toBe(true);
  });

  it('secretaria fuera del piloto: exige teoría y pago', () => {
    expect(isEligibleForProfessionalCertificate(false, elegibilidad(), true)).toBe(true);
    expect(isEligibleForProfessionalCertificate(false, elegibilidad({ teoria: false }), true)).toBe(
      false,
    );
    expect(isEligibleForProfessionalCertificate(false, elegibilidad({ pago: false }), true)).toBe(
      false,
    );
  });

  it('fix-465-m: secretaria con el recorte del piloto: solo exige pago (no hay asistencia)', () => {
    expect(
      isEligibleForProfessionalCertificate(false, elegibilidad({ teoria: false }), false),
    ).toBe(true);
    expect(
      isEligibleForProfessionalCertificate(
        false,
        elegibilidad({ teoria: false, pago: false }),
        false,
      ),
    ).toBe(false);
  });

  it('nota y práctica nunca bloquean', () => {
    const e = elegibilidad({ nota: false, practica: false });
    expect(isEligibleForProfessionalCertificate(false, e, true)).toBe(true);
  });
});
