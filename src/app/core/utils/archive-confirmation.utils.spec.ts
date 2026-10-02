import { describe, expect, it } from 'vitest';
import {
  buildFutureClassesBlockMessage,
  isArchiveConfirmationText,
} from './archive-confirmation.utils';

describe('buildFutureClassesBlockMessage() — fix-277-m', () => {
  it('una clase: singular', () => {
    expect(buildFutureClassesBlockMessage(1)).toBe(
      'Tiene 1 clase agendada. Cancélala o reagéndala antes de archivar al alumno.',
    );
  });

  it('varias clases: plural, con la cantidad', () => {
    expect(buildFutureClassesBlockMessage(4)).toBe(
      'Tiene 4 clases agendadas. Cancélalas o reagéndalas antes de archivar al alumno.',
    );
  });
});

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
