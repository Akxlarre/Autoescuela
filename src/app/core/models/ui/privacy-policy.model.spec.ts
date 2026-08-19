import { describe, it, expect } from 'vitest';
import {
  PRIVACY_POLICIES,
  PRIVACY_POLICY_VERSION,
  SUPABASE_HOSTING_COUNTRY,
  getPolicyPublishBlockers,
  getPrivacyPolicy,
} from './privacy-policy.model';

/**
 * Spec 0009-m — contenido legal publicable (AC2).
 *
 * Estos tests no verifican estilo: verifican que la política **no le declare al titular
 * un dato falso**, que es lo que la Ley 21.719 sanciona.
 */
describe('PRIVACY_POLICIES', () => {
  it('hay exactamente dos políticas, una por sociedad', () => {
    expect(Object.keys(PRIVACY_POLICIES).sort()).toEqual([
      'autoescuela-chillan',
      'conductores-chillan',
    ]);
  });

  it('cada política identifica a su responsable con razón social, RUT, domicilio y canal', () => {
    for (const policy of Object.values(PRIVACY_POLICIES)) {
      expect(policy.legalName).toBeTruthy();
      expect(policy.rut).toMatch(/^\d{2}\.\d{3}\.\d{3}-[\dkK]$/);
      expect(policy.address).toContain('Chillán');
      expect(policy.rightsEmail).toContain('@');
      expect(policy.lastUpdated).toBeTruthy();
    }
  });

  it('no mezcla los datos de las dos sociedades', () => {
    const conductores = PRIVACY_POLICIES['conductores-chillan'];
    const autoescuela = PRIVACY_POLICIES['autoescuela-chillan'];

    expect(conductores.rut).toBe('77.940.120-0');
    expect(conductores.rightsEmail).toBe('conductorchillan@gmail.com');
    expect(autoescuela.rut).toBe('76.007.217-6');
    expect(autoescuela.rightsEmail).toBe('otecchillan@gmail.com');
    expect(conductores.legalName).not.toBe(autoescuela.legalName);

    // Ambas sociedades imparten Clase B y comparten el código SII 809030, así que las dos
    // declaran el mismo giro. Lo que NO puede pasar es que una arrastre datos de la otra;
    // eso es lo que verifica el bucle de abajo, recorriendo el texto completo de cada
    // política (el bug real de 2026-08-18 estaba DENTRO de un párrafo, no en un campo).

    for (const [policy, ajena] of [
      [conductores, autoescuela],
      [autoescuela, conductores],
    ] as const) {
      const texto = JSON.stringify(policy.sections);
      expect(texto).toContain(policy.rut);
      expect(texto).not.toContain(ajena.rut);
      expect(texto).not.toContain(ajena.rightsEmail);
      expect(texto).toContain(`Giro: ${policy.businessLine}`);
    }
  });

  it('las casillas del Art. 12 y del Art. 16 nombran a la sociedad correcta', () => {
    for (const policy of Object.values(PRIVACY_POLICIES)) {
      expect(policy.policyCheckboxLabel).toContain(policy.legalName);
      expect(policy.medicalCertCheckboxLabel).toContain(policy.legalName);
      expect(policy.medicalCertCheckboxLabel).toContain('Autorizo expresamente');
    }
  });

  it('ningún texto publicable conserva marcadores de redacción de .compliance/', () => {
    const everything = JSON.stringify(PRIVACY_POLICIES);
    expect(everything).not.toContain('COMPLETAR');
    expect(everything).not.toContain('CONFIRMAR');
  });

  // Mientras no se decida entre Brasil y EE.UU., decir "Estados Unidos" sería declararle
  // al titular un destino que puede ser falso.
  it('no afirma un país para Supabase mientras la región no esté decidida', () => {
    const transferTexts = Object.values(PRIVACY_POLICIES).flatMap((p) =>
      p.sections
        .filter((s) => s.heading.startsWith('4.'))
        .flatMap((s) => s.blocks.filter((b) => b.kind === 'paragraph').map((b) => b.text)),
    );
    const supabaseText = transferTexts.find((t) => t.includes('Supabase procesa datos'));

    expect(supabaseText).toBeDefined();

    // Solo la oración de Supabase: el resto del párrafo SÍ nombra Estados Unidos, y con
    // razón — Google, Zoom y el servidor de correo (OVH, Warrenton) están confirmados.
    const supabaseSentence = supabaseText!.split('.')[0];

    if (SUPABASE_HOSTING_COUNTRY) {
      expect(supabaseSentence).toContain(SUPABASE_HOSTING_COUNTRY);
    } else {
      expect(supabaseSentence).toBe('Supabase procesa datos fuera de Chile');
    }
  });

  it('declara el hosting de correo con el dato verificado del RAT', () => {
    for (const policy of Object.values(PRIVACY_POLICIES)) {
      const section = policy.sections.find((s) => s.heading.startsWith('4.'));
      expect(JSON.stringify(section)).toContain('OVH SAS');
      expect(JSON.stringify(section)).toContain('Warrenton, Virginia');
    }
  });
});

describe('getPrivacyPolicy()', () => {
  it('resuelve por slug', () => {
    expect(getPrivacyPolicy('conductores-chillan')?.rut).toBe('77.940.120-0');
  });

  it('devuelve null ante un slug inexistente, nulo o vacío', () => {
    expect(getPrivacyPolicy('no-existe')).toBeNull();
    expect(getPrivacyPolicy(null)).toBeNull();
    expect(getPrivacyPolicy('')).toBeNull();
  });
});

describe('getPolicyPublishBlockers()', () => {
  // Este test es el recordatorio vivo del pendiente: cuando se fije la región de
  // Supabase, cambia de rama solo y deja de reportar el bloqueo.
  it('reporta la región de Supabase mientras no esté definida', () => {
    const blockers = getPolicyPublishBlockers();

    if (SUPABASE_HOSTING_COUNTRY) {
      expect(blockers).toEqual([]);
    } else {
      expect(blockers).toHaveLength(1);
      expect(blockers[0]).toContain('SUPABASE_HOSTING_COUNTRY');
    }
  });
});

describe('PRIVACY_POLICY_VERSION', () => {
  it('es una fecha ISO — se persiste en consents.policy_version (AC-E4)', () => {
    expect(PRIVACY_POLICY_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
