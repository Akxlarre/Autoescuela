import { describe, expect, it } from 'vitest';

import { missingDocumentHint } from './documents-step.utils';

describe('missingDocumentHint (fix-070-i)', () => {
  it('sin foto pide la foto', () => {
    expect(missingDocumentHint(false, [{ label: 'Autorización Notarial' }])).toBe(
      'Sube la foto carnet para continuar',
    );
  });

  it('con la foto, nombra el primer documento obligatorio que falta', () => {
    expect(missingDocumentHint(true, [{ label: 'Autorización Notarial' }])).toBe(
      'Sube la Autorización Notarial para continuar',
    );
  });

  it('con todo subido no hay aviso', () => {
    expect(missingDocumentHint(true, [])).toBeNull();
  });
});
