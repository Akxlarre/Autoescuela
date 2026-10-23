import { isDeletableStudentDoc } from './dms-documents.utils';

describe('isDeletableStudentDoc (fix-470-m)', () => {
  it('solo los documentos subidos se pueden borrar desde el DMS', () => {
    expect(isDeletableStudentDoc('student_document')).toBe(true);
  });

  it('fix-475-m: el contrato no se borra desde el DMS (decisión F04)', () => {
    expect(isDeletableStudentDoc('digital_contract')).toBe(false);
  });

  it('carnets, contrato firmado y certificados no: no tienen registro propio en el DMS', () => {
    expect(isDeletableStudentDoc('enrollment_license')).toBe(false);
    expect(isDeletableStudentDoc('enrollment_file')).toBe(false);
  });
});
