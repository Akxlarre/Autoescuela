import { isDeletableStudentDoc } from './dms-documents.utils';

describe('isDeletableStudentDoc (fix-470-m)', () => {
  it('documentos subidos y el contrato se pueden borrar desde el DMS', () => {
    expect(isDeletableStudentDoc('student_document')).toBe(true);
    expect(isDeletableStudentDoc('digital_contract')).toBe(true);
  });

  it('carnets, contrato firmado y certificados no: no tienen registro propio en el DMS', () => {
    expect(isDeletableStudentDoc('enrollment_license')).toBe(false);
    expect(isDeletableStudentDoc('enrollment_file')).toBe(false);
  });
});
