import { describe, it, expect } from 'vitest';
import {
  extractUsedVariables,
  insertAtCursor,
  isScheduledForValid,
  renderTemplate,
  validateTemplateDraft,
} from './announcement-template.utils';
import type { TemplateDraft } from '@core/models/ui/notification-template.model';

const VALORES = { nombre: 'Ana Pérez', sede: 'Chillán Centro' };

describe('renderTemplate()', () => {
  it('sustituye una variable por su valor', () => {
    expect(renderTemplate('Hola {{nombre}},', VALORES)).toBe('Hola Ana Pérez,');
  });

  it('sustituye varias variables distintas', () => {
    expect(renderTemplate('{{nombre}} de {{sede}}', VALORES)).toBe('Ana Pérez de Chillán Centro');
  });

  it('sustituye todas las ocurrencias de la misma variable, no solo la primera', () => {
    expect(renderTemplate('{{nombre}} y {{nombre}}', VALORES)).toBe('Ana Pérez y Ana Pérez');
  });

  it('tolera espacios dentro de las llaves', () => {
    expect(renderTemplate('Hola {{ nombre }}', VALORES)).toBe('Hola Ana Pérez');
  });

  // AC-E1 — un comunicado a cientos de personas no se cae por un typo en la plantilla.
  it('AC-E1 · una variable desconocida se reemplaza por vacío, sin lanzar', () => {
    expect(renderTemplate('Hola {{telefono}}!', VALORES)).toBe('Hola !');
  });

  it('AC-E1 · una variable conocida pero sin valor para este destinatario queda vacía', () => {
    expect(renderTemplate('Hola {{nombre}} de {{sede}}', { nombre: 'Ana' })).toBe('Hola Ana de ');
  });

  it('un cuerpo sin variables queda intacto', () => {
    const texto = 'Mañana no hay clases por el feriado.';
    expect(renderTemplate(texto, VALORES)).toBe(texto);
  });

  it('las llaves sueltas no rompen ni se comen texto', () => {
    expect(renderTemplate('un { y }} sueltos', VALORES)).toBe('un { y }} sueltos');
  });

  it('respeta los saltos de línea', () => {
    expect(renderTemplate('Hola {{nombre}}\n\nSaludos', VALORES)).toBe('Hola Ana Pérez\n\nSaludos');
  });

  it('cuerpo vacío devuelve vacío', () => {
    expect(renderTemplate('', VALORES)).toBe('');
  });

  // El valor lo pone la BD, no el redactor: si un alumno se llamara "<b>Ana", no puede
  // inyectar markup en el correo de nadie. El escapado va después, en la Edge Function,
  // pero esta función no debe "ayudar" desescapando nada.
  it('no interpreta el contenido del valor sustituido', () => {
    expect(renderTemplate('Hola {{nombre}}', { nombre: '<b>Ana</b>' })).toBe('Hola <b>Ana</b>');
  });
});

describe('extractUsedVariables()', () => {
  it('lista las variables conocidas que el cuerpo usa', () => {
    expect(extractUsedVariables('{{nombre}} en {{sede}}')).toEqual(['nombre', 'sede']);
  });

  it('no repite una variable usada varias veces', () => {
    expect(extractUsedVariables('{{nombre}} y {{nombre}}')).toEqual(['nombre']);
  });

  it('ignora marcadores que no son variables válidas', () => {
    expect(extractUsedVariables('{{nombre}} y {{saldo}}')).toEqual(['nombre']);
  });

  it('un cuerpo sin variables devuelve lista vacía', () => {
    expect(extractUsedVariables('texto plano')).toEqual([]);
  });
});

describe('isScheduledForValid()', () => {
  const ahora = new Date('2026-09-10T12:00:00Z');

  it('null es válido: significa enviar ahora', () => {
    expect(isScheduledForValid(null, ahora)).toBe(true);
  });

  it('una fecha futura es válida', () => {
    expect(isScheduledForValid('2026-09-11T09:00:00Z', ahora)).toBe(true);
  });

  it('una fecha pasada es inválida', () => {
    expect(isScheduledForValid('2026-09-09T09:00:00Z', ahora)).toBe(false);
  });

  it('exactamente ahora es inválido: para eso está el envío inmediato', () => {
    expect(isScheduledForValid('2026-09-10T12:00:00Z', ahora)).toBe(false);
  });

  it('una fecha ilegible es inválida en vez de romper', () => {
    expect(isScheduledForValid('no soy una fecha', ahora)).toBe(false);
  });
});

describe('validateTemplateDraft()', () => {
  const BASE: TemplateDraft = {
    id: null,
    name: 'Aviso de feriado',
    subject: 'No hay clases el {{fecha}}',
    body: 'Hola {{nombre}}, mañana no hay clases.',
    active: true,
  };

  function validar(cambios: Partial<TemplateDraft>) {
    return validateTemplateDraft({ ...BASE, ...cambios });
  }

  it('un draft completo es válido', () => {
    expect(validar({}).valid).toBe(true);
  });

  it('sin nombre es inválido', () => {
    expect(validar({ name: '  ' }).errors).toContain('nombre_requerido');
  });

  it('sin asunto es inválido', () => {
    expect(validar({ subject: '' }).errors).toContain('asunto_requerido');
  });

  it('sin cuerpo es inválido', () => {
    expect(validar({ body: '\n' }).errors).toContain('cuerpo_requerido');
  });

  it('acumula todos los errores en vez de cortar en el primero', () => {
    expect(validar({ name: '', subject: '', body: '' }).errors).toEqual(
      expect.arrayContaining(['nombre_requerido', 'asunto_requerido', 'cuerpo_requerido']),
    );
  });
});

describe('insertAtCursor()', () => {
  it('inserta en la posición del cursor, no al final (AC10)', () => {
    const { text } = insertAtCursor('Hola , nos vemos el lunes.', '{{nombre}}', 5, 5);
    expect(text).toBe('Hola {{nombre}}, nos vemos el lunes.');
  });

  it('deja el cursor justo después de lo insertado', () => {
    const { caret } = insertAtCursor('Hola , nos vemos.', '{{nombre}}', 5, 5);
    expect(caret).toBe(5 + '{{nombre}}'.length);
  });

  it('reemplaza el texto seleccionado', () => {
    const { text } = insertAtCursor('Hola NOMBRE, ¿cómo estás?', '{{nombre}}', 5, 11);
    expect(text).toBe('Hola {{nombre}}, ¿cómo estás?');
  });

  it('sin cursor (textarea que nunca tuvo foco) cae al final, como antes', () => {
    const { text, caret } = insertAtCursor('Hola', '{{sede}}', null, null);
    expect(text).toBe('Hola{{sede}}');
    expect(caret).toBe('Hola{{sede}}'.length);
  });

  it('inserta al inicio cuando el cursor está en 0', () => {
    expect(insertAtCursor('lunes', '{{nombre}}: ', 0, 0).text).toBe('{{nombre}}: lunes');
  });

  it('funciona sobre un cuerpo vacío', () => {
    expect(insertAtCursor('', '{{nombre}}', 0, 0)).toEqual({ text: '{{nombre}}', caret: 10 });
  });

  it('un índice más allá del texto no duplica ni pierde contenido', () => {
    expect(insertAtCursor('Hola', '{{sede}}', 99, 99).text).toBe('Hola{{sede}}');
  });

  it('un índice negativo se trata como el inicio', () => {
    expect(insertAtCursor('Hola', '{{sede}}', -5, -5).text).toBe('{{sede}}Hola');
  });

  it('normaliza un rango invertido en vez de cortar mal', () => {
    expect(insertAtCursor('Hola NOMBRE!', '{{nombre}}', 11, 5).text).toBe('Hola {{nombre}}!');
  });

  it('el resultado sigue siendo un marcador que renderTemplate resuelve', () => {
    const { text } = insertAtCursor('Hola , nos vemos.', '{{nombre}}', 5, 5);
    expect(renderTemplate(text, VALORES)).toBe('Hola Ana Pérez, nos vemos.');
  });
});
