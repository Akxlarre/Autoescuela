import { editableDocumentTypes } from './document-template-options.utils';

describe('editableDocumentTypes', () => {
  it('sede sin Profesional: solo Clase B', () => {
    expect(editableDocumentTypes(false, false)).toEqual(['contract_b', 'certificate_b']);
    expect(editableDocumentTypes(false, true)).toEqual(['contract_b', 'certificate_b']);
  });

  it('sede con Profesional fuera del piloto: los 4 tipos', () => {
    expect(editableDocumentTypes(true, false)).toEqual([
      'contract_b',
      'certificate_b',
      'contract_professional',
      'certificate_professional',
    ]);
  });

  it('fix-463-m: con el recorte del piloto, sin certificado Profesional pero con su contrato', () => {
    expect(editableDocumentTypes(true, true)).toEqual([
      'contract_b',
      'certificate_b',
      'contract_professional',
    ]);
  });
});
