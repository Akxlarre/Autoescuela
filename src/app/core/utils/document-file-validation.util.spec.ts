import { describe, it, expect } from 'vitest';
import { checkDocumentFile, validateDocumentFile } from './document-file-validation.util';

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

  it('fix-474-m: rechaza un archivo de 0 bytes', () => {
    expect(validateDocumentFile(makeFile('vacio.pdf', 'application/pdf', 0))).toBe(
      'El archivo está vacío.',
    );
  });
});

describe('checkDocumentFile() (fix-474-m)', () => {
  function withBytes(name: string, type: string, bytes: number[]): File {
    return new File([new Uint8Array([...bytes, ...new Array(20).fill(0)])], name, { type });
  }
  const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];
  const JPG = [0xff, 0xd8, 0xff, 0xe0];
  const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];

  it('acepta PDF, JPG, PNG y WEBP con su firma real', async () => {
    expect(await checkDocumentFile(withBytes('a.pdf', 'application/pdf', PDF))).toBeNull();
    expect(await checkDocumentFile(withBytes('a.jpg', 'image/jpeg', JPG))).toBeNull();
    expect(await checkDocumentFile(withBytes('a.png', 'image/png', PNG))).toBeNull();
    expect(await checkDocumentFile(withBytes('a.webp', 'image/webp', WEBP))).toBeNull();
  });

  it('rechaza un .exe renombrado a .pdf', async () => {
    expect(await checkDocumentFile(withBytes('virus.pdf', 'application/pdf', [0x4d, 0x5a]))).toBe(
      'El archivo no es un PDF o una imagen válida.',
    );
  });

  it('aplica primero las reglas de tipo, tamaño y vacío', async () => {
    expect(await checkDocumentFile(makeFile('vacio.pdf', 'application/pdf', 0))).toBe(
      'El archivo está vacío.',
    );
    expect(await checkDocumentFile(withBytes('a.docx', 'application/msword', PDF))).toBe(
      'Solo se permiten archivos PDF, JPG, PNG o WEBP.',
    );
  });
});
