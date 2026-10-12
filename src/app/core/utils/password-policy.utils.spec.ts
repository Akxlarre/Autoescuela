import {
  evaluatePassword,
  PASSWORD_MIN_LENGTH,
  passwordStrengthLabel,
  type PasswordRequirementId,
} from './password-policy.utils';

const ANA = { name: 'Ana María Pérez', email: 'anaperez@escuela.cl', rut: '15.206.231-4' };

function pendientes(password: string, ctx = ANA): PasswordRequirementId[] {
  return evaluatePassword(password, ctx)
    .requirements.filter((r) => !r.met)
    .map((r) => r.id);
}

describe('evaluatePassword (spec 0050-b)', () => {
  it('el mínimo es 10', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(10);
  });

  it('siempre devuelve los 4 requisitos, en el mismo orden', () => {
    expect(evaluatePassword('').requirements.map((r) => r.id)).toEqual([
      'length',
      'letter',
      'digit',
      'not-personal',
    ]);
  });

  it('una clave de 10 con letras y números, sin datos propios, es válida (AC2)', () => {
    const r = evaluatePassword('camino2026', ANA);
    expect(r.valid).toBe(true);
    expect(r.requirements.every((req) => req.met)).toBe(true);
  });

  it.each([
    ['camino202', ['length']], // 9 caracteres
    ['caminolargo', ['digit']], // sin números
    ['1234567890', ['letter']], // sin letras
    ['abc', ['length', 'digit']],
  ] as [string, PasswordRequirementId[]][])('"%s" deja pendiente %j', (password, esperado) => {
    expect(pendientes(password)).toEqual(esperado);
    expect(evaluatePassword(password, ANA).valid).toBe(false);
  });

  describe('no contiene datos propios (AC4)', () => {
    it.each([
      ['maria2026ok', 'una palabra del nombre'],
      ['MARÍA2026ok', 'sin distinguir mayúsculas ni tildes'],
      ['xxperezxx12', 'el apellido en medio'],
      ['anaperez99x', 'la parte local del correo'],
      ['clave15206231', 'el cuerpo del RUT'],
    ])('"%s": %s', (password) => {
      expect(pendientes(password)).toEqual(['not-personal']);
    });

    it('una palabra corta del nombre (menos de 4 letras) no cuenta: "Ana" no bloquea "banana"', () => {
      expect(pendientes('banana2026')).toEqual([]);
    });

    it('sin datos de la persona, el requisito se cumple con cualquier clave no vacía', () => {
      expect(evaluatePassword('maria2026ok').valid).toBe(true);
      expect(evaluatePassword('maria2026ok', { name: null, email: '', rut: undefined }).valid).toBe(
        true,
      );
    });

    it('con la clave vacía queda pendiente: no se marca cumplido algo sin evaluar', () => {
      expect(pendientes('')).toEqual(['length', 'letter', 'digit', 'not-personal']);
    });
  });

  it('las letras con tilde y la ñ cuentan como letras', () => {
    expect(pendientes('ñandúñandú12')).toEqual([]);
  });

  describe('fortaleza (orientativa, no bloquea)', () => {
    it.each([
      ['', 'empty'],
      ['abc', 'weak'],
      ['camino202', 'weak'], // no válida
      ['camino2026', 'fair'], // válida, 10, 2 clases
      ['Camino2026', 'good'], // 3 clases
      ['caminolargo2026', 'good'], // 14+
      ['Camino-largo-2026', 'strong'], // 14+ y 3+ clases
    ])('"%s" → %s', (password, esperado) => {
      expect(evaluatePassword(password, ANA).strength).toBe(esperado);
    });
  });

  it('cada nivel tiene su etiqueta en español', () => {
    expect(passwordStrengthLabel('empty')).toBe('');
    expect(passwordStrengthLabel('weak')).toBe('Débil');
    expect(passwordStrengthLabel('fair')).toBe('Aceptable');
    expect(passwordStrengthLabel('good')).toBe('Buena');
    expect(passwordStrengthLabel('strong')).toBe('Muy buena');
  });
});
