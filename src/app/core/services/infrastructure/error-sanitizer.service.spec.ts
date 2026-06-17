import { TestBed } from '@angular/core/testing';
import { ErrorSanitizerService } from './error-sanitizer.service';
import { HttpErrorResponse } from '@angular/common/http';

describe('ErrorSanitizerService', () => {
  let service: ErrorSanitizerService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ErrorSanitizerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should handle Supabase AuthApiError (invalid credentials)', () => {
    const error = { name: 'AuthApiError', message: 'invalid credentials', code: 400 };
    const result = service.sanitize(error);
    expect(result.message).toBe('El correo electrónico o la contraseña son incorrectos.');
    expect(result.code).toBe('400');
  });

  it('should handle Postgres unique constraint violation (23505)', () => {
    const error = { code: '23505', message: 'duplicate key value violates unique constraint' };
    const result = service.sanitize(error);
    expect(result.message).toBe('Ya existe un registro con estos datos. Verifica el RUT o el correo ingresado.');
    expect(result.code).toBe('23505');
  });

  it('should handle HttpErrorResponse 500', () => {
    const error = new HttpErrorResponse({ status: 500, statusText: 'Internal Server Error' });
    const result = service.sanitize(error);
    expect(result.message).toBe('Ha ocurrido un error inesperado en el servidor. Inténtalo más tarde.');
    expect(result.code).toBe(500);
  });

  it('should handle Network Error (TypeError: Failed to fetch)', () => {
    const error = new TypeError('Failed to fetch');
    const result = service.sanitize(error);
    expect(result.message).toBe('No se pudo conectar al servidor. Por favor, verifica tu conexión a internet.');
    expect(result.isNetworkError).toBe(true);
  });

  it('should return a generic message for an unknown string', () => {
    const result = service.sanitize('Unexpected string error');
    expect(result.message).toBe('Unexpected string error');
    expect(result.code).toBe('UNKNOWN_STRING');
  });

  it('should return a safe generic message for an unmapped Supabase code', () => {
    const error = { code: '99999', details: 'Secret database details' };
    const result = service.sanitize(error);
    expect(result.message).toBe('Ha ocurrido un error procesando la solicitud (99999).');
    expect(result.code).toBe('99999');
    // Important: details should not be in the message
    expect(result.message).not.toContain('Secret database details');
  });

  it('should pass through explicit front-end Error instances', () => {
    const error = new Error('No se pudo determinar el vehículo.');
    const result = service.sanitize(error);
    expect(result.message).toBe('No se pudo determinar el vehículo.');
    expect(result.code).toBe('JS_ERROR');
  });

  it('should handle CUPOS_AGOTADOS trigger exception', () => {
    const error = { message: 'RAISE EXCEPTION CUPOS_AGOTADOS' };
    const result = service.sanitize(error);
    expect(result.message).toBe('No quedan cupos disponibles en este curso. Actualiza la lista para ver el estado actual.');
    expect(result.code).toBe('CUPOS_AGOTADOS');
  });
});
