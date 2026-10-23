import { describe, expect, it } from 'vitest';
import {
  BLOCKING_STATUSES,
  HISTORICAL_STATUSES,
  duplicateEnrollmentMessage,
  evaluateReenrollment,
  pickBlockingCourseName,
} from './reenrollment.utils';

// fix-066-i (B2-4): el aviso nombraba el curso elegido, no el que estaba en curso.
describe('pickBlockingCourseName', () => {
  it('devuelve el curso de la primera matrícula en curso, ignorando las históricas', () => {
    expect(
      pickBlockingCourseName([
        { status: 'completed', courseName: 'Clase B SENCE' },
        { status: 'active', courseName: 'Clase B' },
      ]),
    ).toBe('Clase B');
  });

  it('sin matrículas en curso devuelve null', () => {
    expect(pickBlockingCourseName([{ status: 'cancelled', courseName: 'Clase B' }])).toBeNull();
    expect(pickBlockingCourseName([])).toBeNull();
  });
});

describe('duplicateEnrollmentMessage', () => {
  it('con otro curso en curso, nombra los dos', () => {
    expect(duplicateEnrollmentMessage('Ana Soto', 'Clase B', 'Refuerzo Clase B')).toBe(
      'Ana Soto ya tiene una matrícula en curso en Clase B. No es posible matricularlo/a en Refuerzo Clase B mientras esa siga vigente.',
    );
  });

  it('con el mismo curso, mantiene el texto de siempre', () => {
    expect(duplicateEnrollmentMessage('Ana Soto', 'Clase B', 'Clase B')).toBe(
      'Ana Soto ya tiene una matrícula en curso en Clase B. No es posible crear una nueva mientras esa siga vigente.',
    );
  });

  it('si no se sabe el curso en curso, usa el elegido', () => {
    expect(duplicateEnrollmentMessage('Ana Soto', null, 'Clase B')).toBe(
      'Ana Soto ya tiene una matrícula en curso en Clase B. No es posible crear una nueva mientras esa siga vigente.',
    );
  });
});

/**
 * Núcleo funcional de la regla de re-matrícula (fix-020).
 * Contrato: data-in / data-out, sin Angular.
 *
 * Recibe los estados de las matrículas existentes del alumno en el MISMO curso
 * y decide si se puede crear una nueva matrícula:
 *  - 'block'   → hay una matrícula en curso (no puede matricularse dos veces)
 *  - 'confirm' → solo hay matrículas históricas (re-matrícula legítima, requiere confirmación)
 *  - 'allow'   → no hay matrícula previa en este curso
 */
describe('evaluateReenrollment', () => {
  describe('sin matrícula previa → allow', () => {
    it('lista vacía', () => {
      expect(evaluateReenrollment([])).toBe('allow');
    });

    it('solo valores nulos/indefinidos (sin filas reales)', () => {
      expect(evaluateReenrollment([null, undefined])).toBe('allow');
    });
  });

  describe('matrícula en curso → block', () => {
    it('active', () => {
      expect(evaluateReenrollment(['active'])).toBe('block');
    });

    it('pending_payment', () => {
      expect(evaluateReenrollment(['pending_payment'])).toBe('block');
    });

    it('draft', () => {
      expect(evaluateReenrollment(['draft'])).toBe('block');
    });
  });

  describe('solo matrículas históricas → confirm', () => {
    it('completed', () => {
      expect(evaluateReenrollment(['completed'])).toBe('confirm');
    });

    it('cancelled', () => {
      expect(evaluateReenrollment(['cancelled'])).toBe('confirm');
    });

    it('varias históricas', () => {
      expect(evaluateReenrollment(['completed', 'cancelled'])).toBe('confirm');
    });
  });

  describe('prioridad: block gana sobre confirm', () => {
    it('histórica + en curso → block (el más restrictivo manda)', () => {
      expect(evaluateReenrollment(['completed', 'active'])).toBe('block');
    });

    it('orden inverso → block igual', () => {
      expect(evaluateReenrollment(['active', 'completed'])).toBe('block');
    });
  });

  describe('estados desconocidos → block (conservador)', () => {
    it('un estado no reconocido no puede asumirse como histórico', () => {
      expect(evaluateReenrollment(['frozen'])).toBe('block');
    });

    it('desconocido mezclado con histórico → block', () => {
      expect(evaluateReenrollment(['completed', 'mistery'])).toBe('block');
    });

    it('histórico con nulos intercalados sigue siendo confirm', () => {
      expect(evaluateReenrollment([null, 'completed', undefined])).toBe('confirm');
    });
  });

  describe('conjuntos de estados', () => {
    it('BLOCKING_STATUSES contiene los estados en curso', () => {
      expect(BLOCKING_STATUSES).toContain('active');
      expect(BLOCKING_STATUSES).toContain('pending_payment');
      expect(BLOCKING_STATUSES).toContain('draft');
    });

    it('HISTORICAL_STATUSES contiene los estados terminados', () => {
      expect(HISTORICAL_STATUSES).toContain('completed');
      expect(HISTORICAL_STATUSES).toContain('cancelled');
    });

    it('los conjuntos son disjuntos', () => {
      for (const s of BLOCKING_STATUSES) {
        expect(HISTORICAL_STATUSES).not.toContain(s);
      }
    });
  });
});
