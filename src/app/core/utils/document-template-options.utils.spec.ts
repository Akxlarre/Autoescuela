import { editableDocumentTypes } from './document-template-options.utils';

describe('editableDocumentTypes', () => {
  it('sede sin Profesional: solo Clase B', () => {
    expect(editableDocumentTypes(false)).toEqual(['contract_b', 'certificate_b']);
  });

  it('fix-465-m: sede con Profesional, los 4 tipos aun con el recorte del piloto', () => {
    expect(editableDocumentTypes(true)).toEqual([
      'contract_b',
      'certificate_b',
      'contract_professional',
      'certificate_professional',
    ]);
  });
});
