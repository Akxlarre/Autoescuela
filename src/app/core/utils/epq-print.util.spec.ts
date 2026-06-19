import { describe, it, expect } from 'vitest';
import { buildEpqTestHtml } from './epq-print.util';
import { EPQ_QUESTIONS } from './epq-questions.const';

describe('buildEpqTestHtml', () => {
  it('incluye las 81 preguntas del EPQ', () => {
    const html = buildEpqTestHtml();
    // Una fila <tr> por pregunta dentro del tbody.
    const rowCount = (html.match(/<tr>/g) ?? []).length;
    expect(rowCount).toBe(EPQ_QUESTIONS.length);
    expect(EPQ_QUESTIONS.length).toBe(81);
  });

  it('renderiza casillas Sí y No por pregunta', () => {
    const html = buildEpqTestHtml();
    expect(html).toContain('Sí');
    expect(html).toContain('No');
    // 2 casillas (box) por pregunta.
    const boxes = (html.match(/class="box"/g) ?? []).length;
    expect(boxes).toBe(EPQ_QUESTIONS.length * 2);
  });

  it('incluye el nombre y RUT del alumno cuando se proporcionan', () => {
    const html = buildEpqTestHtml({
      studentName: 'Juan Pérez',
      rut: '12.345.678-9',
      licencia: 'A2',
    });
    expect(html).toContain('Juan Pérez');
    expect(html).toContain('12.345.678-9');
    expect(html).toContain('A2');
  });

  it('deja líneas en blanco cuando faltan los datos del alumno', () => {
    const html = buildEpqTestHtml();
    expect(html).toContain('class="blank"');
  });

  it('escapa caracteres HTML para evitar inyección', () => {
    const html = buildEpqTestHtml({ studentName: '<script>alert(1)</script>' });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
