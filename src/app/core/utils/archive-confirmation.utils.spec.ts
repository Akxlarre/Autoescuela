import { describe, expect, it } from 'vitest';
import { isArchiveConfirmationText } from './archive-confirmation.utils';

describe('isArchiveConfirmationText() — hotfix-124-m', () => {
  it('acepta la palabra tal como la pide el modal', () => {
    expect(isArchiveConfirmationText('borrarlo')).toBe(true);
  });

  it('ignora espacios al inicio y al final', () => {
    expect(isArchiveConfirmationText('  borrarlo ')).toBe(true);
  });

  it.each(['BORRARLO', 'Borrarlo', 'borrarLo'])('no acepta mayúsculas: "%s"', (text) => {
    expect(isArchiveConfirmationText(text)).toBe(false);
  });

  it.each(['', 'borrar', 'borrarlos', 'borrar lo'])('no acepta otro texto: "%s"', (text) => {
    expect(isArchiveConfirmationText(text)).toBe(false);
  });
});
