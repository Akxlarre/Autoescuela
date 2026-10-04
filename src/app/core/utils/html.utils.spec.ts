import { describe, expect, it } from 'vitest';
import { escapeHtml } from './html.utils';

describe('escapeHtml', () => {
  it('deja igual un texto sin caracteres especiales', () => {
    expect(escapeHtml('María José Núñez')).toBe('María José Núñez');
  });

  it('convierte las etiquetas en texto', () => {
    expect(escapeHtml('Ruiz <i>cursiva</i>')).toBe('Ruiz &lt;i&gt;cursiva&lt;/i&gt;');
  });

  it('convierte el ampersand antes que el resto, sin escapar dos veces', () => {
    expect(escapeHtml('Pérez & Cía <b>')).toBe('Pérez &amp; Cía &lt;b&gt;');
  });

  it('convierte comillas dobles y simples', () => {
    expect(escapeHtml(`"O'Higgins"`)).toBe('&quot;O&#39;Higgins&quot;');
  });

  it('devuelve vacío para null o undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});
