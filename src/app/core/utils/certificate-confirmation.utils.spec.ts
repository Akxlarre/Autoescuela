import {
  buildEmailConfirmation,
  buildWarningConfirmation,
  bulkCertificateSummary,
  certificateWarnings,
} from './certificate-confirmation.utils';

describe('certificateWarnings', () => {
  it('sin datos académicos ni prácticas pendientes: sin avisos', () => {
    expect(certificateWarnings({ nombre: 'Ana' })).toEqual([]);
    expect(certificateWarnings({ nombre: 'Ana', pctTeoria: null, pctPractica: null })).toEqual([]);
  });

  it('prácticas incompletas de Clase B', () => {
    expect(
      certificateWarnings({
        nombre: 'Ana',
        practicasIncompletas: { completadas: 9, requeridas: 12 },
      }),
    ).toEqual(['Lleva 9/12 clases prácticas completadas.']);
  });

  it('asistencia bajo el mínimo: avisa, en el orden teoría → práctica', () => {
    expect(certificateWarnings({ nombre: 'Ana', pctTeoria: 60, pctPractica: 80 })).toEqual([
      'Asistencia teórica de 60 % (mínimo 75 %).',
      'Asistencia práctica de 80 % (recomendado 100 %).',
    ]);
  });

  it('asistencia en o sobre el mínimo: sin aviso', () => {
    expect(certificateWarnings({ nombre: 'Ana', pctTeoria: 75, pctPractica: 100 })).toEqual([]);
  });
});

describe('buildWarningConfirmation (fix-466-m)', () => {
  it('sin avisos: null (se genera directo, sin modal)', () => {
    expect(buildWarningConfirmation({ nombre: 'Ana' })).toBeNull();
    expect(
      buildWarningConfirmation({
        nombre: 'Ana',
        practicasIncompletas: { completadas: 12, requeridas: 12 },
      }),
    ).toBeNull();
  });

  it('con avisos: modal de advertencia que los lista', () => {
    const modal = buildWarningConfirmation({ nombre: 'Ana Pérez', pctTeoria: 50 });
    expect(modal).toEqual({
      title: 'Generar certificado',
      message:
        'Ana Pérez:\n• Asistencia teórica de 50 % (mínimo 75 %).\n\n¿Generar el certificado de todos modos?',
      severity: 'warn',
      confirmLabel: 'Generar de todos modos',
    });
  });
});

describe('buildEmailConfirmation (fix-466-m)', () => {
  it('nombra al alumno y el correo', () => {
    expect(
      buildEmailConfirmation({ nombre: 'Ana', email: 'ana@test.com', yaEnviado: false }).message,
    ).toBe('Se enviará el certificado de Ana al correo ana@test.com.');
  });

  it('avisa si ya se había enviado y tolera correo vacío', () => {
    expect(buildEmailConfirmation({ nombre: 'Ana', email: null, yaEnviado: true }).message).toBe(
      'Se enviará el certificado de Ana.\n\nYa fue enviado anteriormente.',
    );
  });
});

describe('bulkCertificateSummary', () => {
  it('todo generado: éxito con plural correcto', () => {
    expect(bulkCertificateSummary(1, 0, 0)).toEqual({
      ok: true,
      message: '1 certificado generado correctamente',
    });
    expect(bulkCertificateSummary(3, 0, 0).message).toBe('3 certificados generados correctamente');
  });

  it('con deuda o errores: advertencia que los cuenta', () => {
    expect(bulkCertificateSummary(2, 1, 1)).toEqual({
      ok: false,
      message: '2 generados, 1 con deuda (emítelos uno a uno), 1 con error',
    });
  });
});
