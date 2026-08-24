import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { EPQ_QUESTIONS } from '@core/utils/epq-questions.const';

/**
 * Verifica que `supabase/functions/_shared/epq-questions.ts` (copia Deno-accesible, ver
 * comentario en `epq-questions.const.ts`) tenga exactamente las mismas 81 preguntas, en el
 * mismo orden, que la fuente de verdad Angular. Deno no puede importar `src/app/`, así que
 * no hay forma de compartir el módulo directamente — este test es la única red de seguridad
 * contra que ambas copias diverjan en silencio.
 */
function readDenoQuestions(): string[] {
  const path = resolve(__dirname, '../../../../supabase/functions/_shared/epq-questions.ts');
  const source = readFileSync(path, 'utf-8');
  const match = source.match(/EPQ_QUESTIONS[^=]*=\s*\[([\s\S]*?)\]\s*as const;/);
  if (!match) {
    throw new Error(
      'No se pudo parsear EPQ_QUESTIONS desde supabase/functions/_shared/epq-questions.ts',
    );
  }
  const arrayBody = match[1];
  const items: string[] = [];
  const stringLiteralRe = /'((?:[^'\\]|\\.)*)'/g;
  let m: RegExpExecArray | null;
  while ((m = stringLiteralRe.exec(arrayBody)) !== null) {
    items.push(m[1].replace(/\\'/g, "'"));
  }
  return items;
}

describe('EPQ_QUESTIONS parity (Angular vs. Deno)', () => {
  it('tiene la misma cantidad de preguntas en ambas copias', () => {
    const denoQuestions = readDenoQuestions();
    expect(denoQuestions.length).toBe(EPQ_QUESTIONS.length);
  });

  it('tiene el mismo texto, en el mismo orden, en ambas copias', () => {
    const denoQuestions = readDenoQuestions();
    expect(denoQuestions).toEqual([...EPQ_QUESTIONS]);
  });
});
