import { describe, it, expect } from 'vitest';
import {
  normalizeBranchEmailForm,
  replyToError,
  senderAddressError,
  validateBranchEmailForm,
} from './branch-email.utils';

// spec 0061-b — configuración de correo por escuela (AC11, AC-E6).
describe('senderAddressError (AC-E6)', () => {
  it('acepta direcciones del dominio autenticado, sin importar mayúsculas', () => {
    expect(senderAddressError('autoescuela-chillan@gestordeautoescuelas.cl')).toBeNull();
    expect(senderAddressError('Cuentas@GestorDeAutoescuelas.cl')).toBeNull();
  });

  it('rechaza otro dominio y explica por qué', () => {
    const error = senderAddressError('escuela@gmail.com');
    expect(error).toContain('@gestordeautoescuelas.cl');
    expect(error).toContain('autenticado');
  });

  it('rechaza subdominios y dominios que solo lo contienen', () => {
    expect(senderAddressError('x@sub.gestordeautoescuelas.cl')).not.toBeNull();
    expect(senderAddressError('x@gestordeautoescuelas.cl.evil.com')).not.toBeNull();
  });

  it('vacío es válido: la escuela sale desde la dirección neutra (AC-E2)', () => {
    expect(senderAddressError('')).toBeNull();
    expect(senderAddressError('   ')).toBeNull();
  });
});

describe('replyToError', () => {
  it('acepta cualquier dominio', () => {
    expect(replyToError('conductorchillan@gmail.com')).toBeNull();
  });

  it('rechaza algo que no es un correo', () => {
    expect(replyToError('no-es-correo')).not.toBeNull();
  });

  it('vacío es válido: los correos salen sin dirección de respuesta (AC-E1)', () => {
    expect(replyToError('')).toBeNull();
  });
});

describe('normalizeBranchEmailForm', () => {
  it('recorta espacios, pasa a minúsculas las direcciones y deja null lo vacío', () => {
    expect(
      normalizeBranchEmailForm({
        senderName: '  Conductores Chillán ',
        senderAddress: ' Conductores-Chillan@GestorDeAutoescuelas.cl ',
        replyTo: ' ConductorChillan@Gmail.com ',
        phone: '   ',
      }),
    ).toEqual({
      senderName: 'Conductores Chillán',
      senderAddress: 'conductores-chillan@gestordeautoescuelas.cl',
      replyTo: 'conductorchillan@gmail.com',
      phone: null,
    });
  });
});

describe('validateBranchEmailForm', () => {
  it('devuelve los errores por campo', () => {
    expect(
      validateBranchEmailForm({
        senderName: 'X',
        senderAddress: 'x@gmail.com',
        replyTo: 'malo',
        phone: null,
      }),
    ).toEqual({
      senderAddress: expect.any(String),
      replyTo: expect.any(String),
    });
  });

  it('formulario válido → sin errores', () => {
    expect(
      validateBranchEmailForm({
        senderName: 'X',
        senderAddress: 'x@gestordeautoescuelas.cl',
        replyTo: 'x@gmail.com',
        phone: '+56 9 1234 5678',
      }),
    ).toEqual({});
  });
});
