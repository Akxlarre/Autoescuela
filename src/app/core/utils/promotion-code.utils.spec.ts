import {
  isCadenceDate,
  isValidPromotionCode,
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

    it('cualquier otro error → null (lo maneja el sanitizer)', () => {
      expect(promotionWriteErrorMessage(new Error('red caída'), '281')).toBeNull();
      expect(promotionWriteErrorMessage(null, '281')).toBeNull();
    });
  });
});
