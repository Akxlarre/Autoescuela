import { describe, it, expect } from 'vitest';
import { validateDocumentFile } from './document-file-validation.util';

function makeFile(name: string, type: string, sizeBytes: number): File {
  const blob = new Blob([new Uint8Array(sizeBytes)], { type });
  return new File([blob], name, { type });
}

describe('validateDocumentFile()', () => {
  it('acepta PDF, JPG, PNG y WEBP dentro del límite de tamaño', () => {
    expect(validateDocumentFile(makeFile('a.pdf', 'application/pdf', 1024))).toBeNull();
    expect(validateDocumentFile(makeFile('a.jpg', 'image/jpeg', 1024))).toBeNull();
    expect(validateDocumentFile(makeFile('a.png', 'image/png', 1024))).toBeNull();
    expect(validateDocumentFile(makeFile('a.webp', 'image/webp', 1024))).toBeNull();
  });

  it('rechaza un tipo MIME no permitido', () => {
    expect(validateDocumentFile(makeFile('a.docx', 'application/msword', 1024))).toBe(
      'Solo se permiten archivos PDF, JPG, PNG o WEBP.',
    );
  });

  it('rechaza un archivo mayor a 5 MB', () => {
    const bigFile = makeFile('a.pdf', 'application/pdf', 5 * 1024 * 1024 + 1);
    expect(validateDocumentFile(bigFile)).toBe('El archivo no puede superar los 5 MB.');
  });

  it('acepta un archivo justo en el límite de 5 MB', () => {
    const exactFile = makeFile('a.pdf', 'application/pdf', 5 * 1024 * 1024);
    expect(validateDocumentFile(exactFile)).toBeNull();
  });
});
