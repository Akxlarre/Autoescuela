import { documentDownloadUrl } from './document-download.utils';

const SIGNED =
  'https://abc.supabase.co/storage/v1/object/sign/documents/students/12/carnet.pdf?token=eyJ.x.y';
const PUBLIC = 'https://abc.supabase.co/storage/v1/object/public/assets/logos/logo.png';

describe('documentDownloadUrl (fix-468-m)', () => {
  it('URL firmada: agrega download con el nombre y la extensión del archivo', () => {
    expect(documentDownloadUrl(SIGNED, 'Carnet')).toBe(`${SIGNED}&download=Carnet.pdf`);
  });

  it('no duplica la extensión si el nombre ya la trae', () => {
    expect(documentDownloadUrl(SIGNED, 'carnet.PDF')).toBe(`${SIGNED}&download=carnet.PDF`);
  });

  it('URL pública sin query: agrega ?download=', () => {
    expect(documentDownloadUrl(PUBLIC, 'Logo')).toBe(`${PUBLIC}?download=Logo.png`);
  });

  it('codifica el nombre y quita caracteres inválidos en un nombre de archivo', () => {
    expect(documentDownloadUrl(SIGNED, 'Certificado — Juan López / 2026')).toBe(
      `${SIGNED}&download=${encodeURIComponent('Certificado — Juan López 2026.pdf')}`,
    );
  });

  it('nombre vacío: usa el nombre del archivo en Storage', () => {
    expect(documentDownloadUrl(SIGNED, '  ')).toBe(`${SIGNED}&download=carnet.pdf`);
  });

  it('URL que no es de Storage: null (no se puede forzar la descarga)', () => {
    expect(documentDownloadUrl('https://example.com/a.pdf', 'A')).toBeNull();
    expect(documentDownloadUrl('blob:http://localhost:4200/123', 'A')).toBeNull();
  });
});
