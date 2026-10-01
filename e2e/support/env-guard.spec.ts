import { describe, expect, it } from 'vitest';
import { assertDevSupabase } from './env-guard';

describe('assertDevSupabase', () => {
  const allowed = ['skvekggejikzxhzsjmkz'];

  it('acepta la URL del proyecto de desarrollo', () => {
    expect(() =>
      assertDevSupabase('https://skvekggejikzxhzsjmkz.supabase.co', allowed),
    ).not.toThrow();
  });

  it('rechaza otro proyecto e informa la URL detectada', () => {
    const url = 'https://otroproyecto123.supabase.co';
    expect(() => assertDevSupabase(url, allowed)).toThrow(url);
  });

  it('rechaza un dominio que solo contiene el ref como prefijo', () => {
    expect(() => assertDevSupabase('https://skvekggejikzxhzsjmkz.evil.com', allowed)).toThrow();
  });

  it('rechaza una URL malformada', () => {
    expect(() => assertDevSupabase('no-es-una-url', allowed)).toThrow('no-es-una-url');
  });

  it('rechaza todo si la lista de permitidos está vacía', () => {
    expect(() => assertDevSupabase('https://skvekggejikzxhzsjmkz.supabase.co', [])).toThrow();
  });
});
