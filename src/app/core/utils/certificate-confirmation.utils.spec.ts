import {
  bulkCertificateSummary,
  buildCertificateConfirmation,
  certificateWarnings,
  type CertificateConfirmationInput,
} from './certificate-confirmation.utils';

function input(
  overrides: Partial<CertificateConfirmationInput> = {},
): CertificateConfirmationInput {
  return { nombre: 'Pérez Soto Ana', accion: 'generar', saldoPendiente: 0, ...overrides };
}

describe('certificateWarnings', () => {
  it('sin datos académicos ni prácticas pendientes: sin avisos', () => {
    expect(certificateWarnings(input())).toEqual([]);
    expect(certificateWarnings(input({ pctTeoria: null, pctPractica: null }))).toEqual([]);
  });

  it('prácticas incompletas de Clase B', () => {
    expect(
      certificateWarnings(input({ practicasIncompletas: { completadas: 9, requeridas: 12 } })),
    ).toEqual(['Lleva 9/12 clases prácticas completadas.']);
  });

  it('asistencia bajo el mínimo: avisa, en el orden teoría → práctica', () => {
    expect(certificateWarnings(input({ pctTeoria: 60, pctPractica: 80 }))).toEqual([
      'Asistencia teórica de 60 % (mínimo 75 %).',
      'Asistencia práctica de 80 % (recomendado 100 %).',
    ]);
  });

  it('asistencia en o sobre el mínimo: sin aviso', () => {
    expect(certificateWarnings(input({ pctTeoria: 75, pctPractica: 100 }))).toEqual([]);
  });
});

describe('buildCertificateConfirmation', () => {
  it('sin deuda ni avisos: confirmación simple', () => {
    const c = buildCertificateConfirmation(input());
    expect(c.title).toBe('Generar certificado');
    expect(c.message).toBe('¿Generar el certificado de Pérez Soto Ana?');
    expect(c.severity).toBe('info');
    expect(c.requiresReason).toBe(false);
  });

  it('regenerar: aclara que se conserva el folio', () => {
    const c = buildCertificateConfirmation(input({ accion: 'regenerar' }));
    expect(c.title).toBe('Regenerar certificado');
    expect(c.confirmLabel).toBe('Regenerar');
    expect(c.message).toContain('se conserva el folio');
  });

  it('con avisos: los lista y sube la severidad, sin pedir motivo', () => {
    const c = buildCertificateConfirmation(input({ pctTeoria: 50 }));
    expect(c.severity).toBe('warn');
    expect(c.message).toContain('• Asistencia teórica de 50 % (mínimo 75 %).');
    expect(c.requiresReason).toBe(false);
  });

  it('spec 0010-i: con deuda sin autorizar pide motivo y muestra el monto', () => {
    const c = buildCertificateConfirmation(input({ saldoPendiente: 125000 }));
    expect(c.requiresReason).toBe(true);
    expect(c.severity).toBe('warn');
    expect(c.message).toContain('saldo pendiente de $125.000');
    expect(c.message).toContain('se avisará a los administradores');
  });

  it('con deuda ya autorizada antes: no vuelve a pedir motivo', () => {
    const c = buildCertificateConfirmation(
      input({ saldoPendiente: 125000, deudaAutorizada: true }),
    );
    expect(c.requiresReason).toBe(false);
    expect(c.message).toContain('ya se autorizó');
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
