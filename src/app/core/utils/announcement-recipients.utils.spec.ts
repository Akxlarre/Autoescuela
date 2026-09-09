import { describe, it, expect } from 'vitest';
import {
  ANNOUNCEMENT_BATCH_SIZE,
  ANNOUNCEMENT_MAX_RECIPIENTS,
  ANNOUNCEMENT_WARN_RECIPIENTS,
  buildBatches,
  countExclusions,
  validateAnnouncementDraft,
  type AnnouncementDraftValidation,
} from './announcement-recipients.utils';
import type { AnnouncementDraft, RecipientPreview } from '@core/models/ui/announcement.model';

const VALID_DRAFT: AnnouncementDraft = {
  kind: 'operativo',
  subject: 'No hay clases el viernes',
  body: 'Por el feriado, el viernes no habrá clases prácticas.',
  filters: { branchId: 2, courseType: null, enrollmentStatus: 'active' },
  excludedUserIds: [],
};

function preview(overrides: Partial<RecipientPreview> & { userId: number }): RecipientPreview {
  return {
    name: `Alumno ${overrides.userId}`,
    email: `alumno${overrides.userId}@test.com`,
    included: true,
    exclusionReason: null,
    ...overrides,
  };
}

describe('buildBatches()', () => {
  it('parte una lista en lotes del tamaño pedido', () => {
    const batches = buildBatches(10, 4);

    expect(batches).toEqual([
      { offset: 0, size: 4 },
      { offset: 4, size: 4 },
      { offset: 8, size: 2 },
    ]);
  });

  it('divisón exacta: sin lote final parcial', () => {
    expect(buildBatches(9, 3)).toEqual([
      { offset: 0, size: 3 },
      { offset: 3, size: 3 },
      { offset: 6, size: 3 },
    ]);
  });

  it('menos destinatarios que el tamaño del lote: un solo lote corto', () => {
    expect(buildBatches(2, 25)).toEqual([{ offset: 0, size: 2 }]);
  });

  it('lista vacía: ningún lote (no se invoca la Edge Function al pedo)', () => {
    expect(buildBatches(0, 25)).toEqual([]);
  });

  it('usa el tamaño de lote canónico por defecto', () => {
    const batches = buildBatches(ANNOUNCEMENT_BATCH_SIZE + 1);

    expect(batches).toHaveLength(2);
    expect(batches[0].size).toBe(ANNOUNCEMENT_BATCH_SIZE);
    expect(batches[1].size).toBe(1);
  });

  it('los lotes cubren exactamente el total, sin huecos ni solapamiento', () => {
    const total = 137;
    const batches = buildBatches(total, 25);
    const cubierto = batches.reduce((acc, b) => acc + b.size, 0);

    expect(cubierto).toBe(total);
    batches.forEach((batch, i) => {
      if (i > 0) expect(batch.offset).toBe(batches[i - 1].offset + batches[i - 1].size);
    });
  });
});

describe('validateAnnouncementDraft()', () => {
  function validar(
    draft: Partial<AnnouncementDraft>,
    includedCount = 10,
  ): AnnouncementDraftValidation {
    return validateAnnouncementDraft({ ...VALID_DRAFT, ...draft }, includedCount);
  }

  it('un draft completo con destinatarios es válido', () => {
    expect(validar({}).valid).toBe(true);
  });

  // AC2 — el tipo es obligatorio y no tiene default: declararlo es lo que decide
  // si el consentimiento promocional se respeta o no.
  it('AC2 — sin kind declarado es inválido', () => {
    const resultado = validar({ kind: null });

    expect(resultado.valid).toBe(false);
    expect(resultado.errors).toContain('kind_requerido');
  });

  it('asunto vacío o solo espacios es inválido', () => {
    expect(validar({ subject: '' }).errors).toContain('asunto_requerido');
    expect(validar({ subject: '   ' }).errors).toContain('asunto_requerido');
  });

  it('cuerpo vacío o solo espacios es inválido', () => {
    expect(validar({ body: '' }).errors).toContain('cuerpo_requerido');
    expect(validar({ body: '  \n ' }).errors).toContain('cuerpo_requerido');
  });

  // AC-E1 — no se registra un comunicado que no le llega a nadie.
  it('AC-E1 — sin destinatarios incluidos es inválido', () => {
    const resultado = validar({}, 0);

    expect(resultado.valid).toBe(false);
    expect(resultado.errors).toContain('sin_destinatarios');
  });

  it('por encima del tope duro es inválido', () => {
    const resultado = validar({}, ANNOUNCEMENT_MAX_RECIPIENTS + 1);

    expect(resultado.valid).toBe(false);
    expect(resultado.errors).toContain('excede_tope');
  });

  it('exactamente en el tope duro sigue siendo válido', () => {
    expect(validar({}, ANNOUNCEMENT_MAX_RECIPIENTS).valid).toBe(true);
  });

  // El aviso de volumen no bloquea: advierte. Quemar la reputación del dominio SMTP
  // arrastra también a contratos, certificados y facturas.
  it('sobre el umbral de advertencia avisa pero no invalida', () => {
    const resultado = validar({}, ANNOUNCEMENT_WARN_RECIPIENTS + 1);

    expect(resultado.valid).toBe(true);
    expect(resultado.warnsHighVolume).toBe(true);
  });

  it('por debajo del umbral de advertencia no avisa', () => {
    expect(validar({}, ANNOUNCEMENT_WARN_RECIPIENTS).warnsHighVolume).toBe(false);
  });

  it('acumula todos los errores en vez de cortar en el primero', () => {
    const resultado = validar({ kind: null, subject: '', body: '' }, 0);

    expect(resultado.errors).toEqual(
      expect.arrayContaining([
        'kind_requerido',
        'asunto_requerido',
        'cuerpo_requerido',
        'sin_destinatarios',
      ]),
    );
  });
});

describe('countExclusions()', () => {
  it('agrupa los excluidos por motivo', () => {
    const resultado = countExclusions([
      preview({ userId: 1 }),
      preview({ userId: 2, included: false, exclusionReason: 'sin_consentimiento' }),
      preview({ userId: 3, included: false, exclusionReason: 'sin_consentimiento' }),
      preview({ userId: 4, included: false, exclusionReason: 'excluido_manualmente' }),
    ]);

    expect(resultado).toEqual({
      included: 1,
      sinConsentimiento: 2,
      excluidoManualmente: 1,
    });
  });

  it('lista vacía: todo en cero', () => {
    expect(countExclusions([])).toEqual({
      included: 0,
      sinConsentimiento: 0,
      excluidoManualmente: 0,
    });
  });

  it('un excluido sin motivo declarado no se cuenta como incluido', () => {
    const resultado = countExclusions([preview({ userId: 1, included: false })]);

    expect(resultado.included).toBe(0);
  });

  // AC-E2 — un alumno sin email sigue siendo destinatario: recibe la notificación
  // in-app. No es una exclusión.
  it('AC-E2 — un alumno sin email cuenta como incluido', () => {
    const resultado = countExclusions([preview({ userId: 1, email: null })]);

    expect(resultado.included).toBe(1);
  });
});
