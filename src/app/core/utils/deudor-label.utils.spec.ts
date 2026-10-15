import { describeMatriculaDeudor } from './deudor-label.utils';

describe('describeMatriculaDeudor (fix-053-i)', () => {
  it('matrícula en curso: N° y curso, sin estado', () => {
    expect(
      describeMatriculaDeudor({
        numeroMatricula: 'B-0123',
        cursoNombre: 'Clase B',
        estadoMatricula: 'active',
      }),
    ).toBe('N° B-0123 · Clase B');
  });

  it('pago pendiente de confirmar también cuenta como en curso', () => {
    expect(
      describeMatriculaDeudor({
        numeroMatricula: 'B-0123',
        cursoNombre: 'Clase B',
        estadoMatricula: 'pending_payment',
      }),
    ).toBe('N° B-0123 · Clase B');
  });

  it('matrícula cancelada o terminada: agrega el estado', () => {
    expect(
      describeMatriculaDeudor({
        numeroMatricula: 'B-0088',
        cursoNombre: 'Clase B',
        estadoMatricula: 'cancelled',
      }),
    ).toBe('N° B-0088 · Clase B · cancelada');
    expect(
      describeMatriculaDeudor({
        numeroMatricula: 'B-0088',
        cursoNombre: 'Clase B',
        estadoMatricula: 'completed',
      }),
    ).toBe('N° B-0088 · Clase B · terminada');
  });

  it('sin número de matrícula muestra "sin N°"', () => {
    expect(
      describeMatriculaDeudor({
        numeroMatricula: null,
        cursoNombre: 'Clase B',
        estadoMatricula: 'active',
      }),
    ).toBe('sin N° · Clase B');
  });
});
