import {
  isCadenceDate,
  isValidPromotionCode,
  maxPromotionCode,
  promotionCodeError,
  promotionNameForCode,
  promotionWriteErrorMessage,
  suggestNextPromotionCode,
} from './promotion-code.utils';

describe('promotion-code.utils (fix-323-m)', () => {
  describe('isValidPromotionCode', () => {
    it('acepta solo dígitos (con espacios alrededor)', () => {
      expect(isValidPromotionCode('281')).toBe(true);
      expect(isValidPromotionCode(' 281 ')).toBe(true);
    });

    it('rechaza vacío, letras y mezclas (S7)', () => {
      expect(isValidPromotionCode('')).toBe(false);
      expect(isValidPromotionCode('   ')).toBe(false);
      expect(isValidPromotionCode('abc')).toBe(false);
      expect(isValidPromotionCode('28a')).toBe(false);
      expect(isValidPromotionCode('PROM-2026-01')).toBe(false);
    });
  });

  describe('suggestNextPromotionCode', () => {
    it('devuelve el mayor número + 1, ignorando códigos no numéricos y vacíos', () => {
      expect(suggestNextPromotionCode(['279', '280', null, '', 'PROM-1', '99'])).toBe('281');
    });

    it('compara como número, no como texto', () => {
      expect(suggestNextPromotionCode(['99', '100'])).toBe('101');
    });

    it('sin ningún número previo parte en 276 (mismo fallback que la creación automática)', () => {
      expect(suggestNextPromotionCode([])).toBe('276');
      expect(suggestNextPromotionCode([null, 'abc'])).toBe('276');
    });
  });

  // fix-347-m (D19): el número de una manual no puede adelantarse sin tope.
  describe('número acotado (fix-347-m)', () => {
    it('isValidPromotionCode rechaza 0 y ceros a la izquierda', () => {
      expect(isValidPromotionCode('0')).toBe(false);
      expect(isValidPromotionCode('007')).toBe(false);
      expect(isValidPromotionCode('100')).toBe(true);
    });

    it('maxPromotionCode devuelve el mayor número, o null si no hay', () => {
      expect(maxPromotionCode(['279', '282', null, 'abc', '99'])).toBe(282);
      expect(maxPromotionCode([null, ''])).toBeNull();
    });

    it('promotionCodeError: vacío, letras y cero', () => {
      expect(promotionCodeError('  ', 282)).toBe('El número es obligatorio.');
      expect(promotionCodeError('28a', 282)).toBe('Debe ser solo números (ej: 281).');
      expect(promotionCodeError('0', 282)).toBe(
        'Debe ser un número mayor que 0, sin ceros delante.',
      );
    });

    it('promotionCodeError: hasta "último + 10" sirve; más allá no', () => {
      expect(promotionCodeError('283', 282)).toBeNull();
      expect(promotionCodeError('292', 282)).toBeNull();
      expect(promotionCodeError('293', 282)).toBe(
        'No puede ser mayor que 292: el último número usado es 282.',
      );
      expect(promotionCodeError('2830', 282)).not.toBeNull();
    });

    it('promotionCodeError: un número anterior libre sirve', () => {
      expect(promotionCodeError('150', 282)).toBeNull();
    });

    it('promotionCodeError: sin último número conocido no aplica el tope', () => {
      expect(promotionCodeError('9001', null)).toBeNull();
    });
  });

  // fix-346-m (D18): al cambiar el número, el nombre automático lo sigue.
  describe('promotionNameForCode', () => {
    it('nombre automático → mismo nombre con el número nuevo', () => {
      expect(promotionNameForCode('Promoción 9001 (30 de Noviembre 2026)', '9001', '9002')).toBe(
        'Promoción 9002 (30 de Noviembre 2026)',
      );
    });

    it('nombre escrito a mano → no cambia', () => {
      expect(promotionNameForCode('Promoción 15 de Junio 2026', '103', '104')).toBe(
        'Promoción 15 de Junio 2026',
      );
      expect(promotionNameForCode('Curso especial verano', '280', '281')).toBe(
        'Curso especial verano',
      );
    });

    it('número nuevo vacío o con letras → deja el nombre guardado', () => {
      const name = 'Promoción 280 (5 de Octubre 2026)';
      expect(promotionNameForCode(name, '280', '')).toBe(name);
      expect(promotionNameForCode(name, '280', '28a')).toBe(name);
    });

    it('no confunde un número que es prefijo de otro', () => {
      expect(promotionNameForCode('Promoción 2801 (5 de Octubre 2026)', '280', '281')).toBe(
        'Promoción 2801 (5 de Octubre 2026)',
      );
    });
  });

  describe('isCadenceDate', () => {
    it('los lunes de la cadencia de 14 días desde 2026-07-27 son de la cadencia', () => {
      expect(isCadenceDate('2026-07-27')).toBe(true);
      expect(isCadenceDate('2026-09-21')).toBe(true); // Promoción 279
      expect(isCadenceDate('2026-10-05')).toBe(true); // Promoción 280
    });

    it('un lunes intermedio no es de la cadencia', () => {
      expect(isCadenceDate('2026-10-12')).toBe(false);
    });
  });

  describe('promotionWriteErrorMessage', () => {
    it('número repetido → mensaje claro', () => {
      const err = {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "professional_promotions_code_key"',
      };
      expect(promotionWriteErrorMessage(err, '280')).toBe(
        'El número 280 ya lo usa otra promoción. Elige otro.',
      );
    });

    it('fecha de inicio ocupada → mensaje claro', () => {
      const err = {
        code: '23505',
        message:
          'duplicate key value violates unique constraint "professional_promotions_branch_start_date_key"',
      };
      expect(promotionWriteErrorMessage(err, '281')).toBe(
        'Ya hay una promoción que parte ese lunes. Elige otra fecha.',
      );
    });

    it('cancelar con alumnos activos (trigger de fix-325-m) → mensaje claro', () => {
      const err = {
        code: 'P0001',
        message: 'promotion_has_active_enrollments: la promoción 7 tiene 3 matrícula(s) activa(s)',
      };
      expect(promotionWriteErrorMessage(err, '280')).toBe(
        'No se puede cancelar: la promoción tiene alumnos con matrícula activa.',
      );
    });

    it('cualquier otro error → null (lo maneja el sanitizer)', () => {
      expect(promotionWriteErrorMessage(new Error('red caída'), '281')).toBeNull();
      expect(promotionWriteErrorMessage(null, '281')).toBeNull();
    });
  });
});
