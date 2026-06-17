import { Injectable } from '@angular/core';

export interface SanitizedError {
  originalError: any;
  message: string;
  code?: string | number;
  isNetworkError: boolean;
}

const ERROR_DICTIONARY: Record<string, string> = {
  // PostgREST / PostgreSQL Errors
  '23505': 'Ya existe un registro con estos datos. Verifica el RUT o el correo ingresado.',
  '23503': 'No se puede eliminar o modificar este registro porque está en uso por otra parte del sistema.',
  '23502': 'Faltan datos obligatorios. Revisa que el formulario esté completo.',
  '23514': 'Los datos no cumplen los requisitos: verifica la fecha de nacimiento (el alumno debe tener al menos 17 años).',
  '42501': 'No tienes permisos para realizar esta acción en esta sede.',
  '22P02': 'El formato de los datos enviados es inválido.',
  
  // Custom Supabase Auth Errors
  'AuthApiError': 'Error de autenticación.',
  'invalid_credentials': 'El correo electrónico o la contraseña son incorrectos.',
  'user_not_found': 'Usuario no encontrado.',
  'email_exists': 'El correo electrónico ya está registrado.',
  
  // HTTP Errors
  '400': 'La solicitud no es válida. Por favor, verifica la información.',
  '401': 'No tienes autorización. Por favor, inicia sesión de nuevo.',
  '403': 'No tienes permisos para realizar esta acción.',
  '404': 'El recurso solicitado no fue encontrado.',
  '409': 'Existe un conflicto con el estado actual del recurso.',
  '422': 'Los datos proporcionados no son válidos.',
  '500': 'Ha ocurrido un error inesperado en el servidor. Inténtalo más tarde.',
  '502': 'Servicio temporalmente no disponible (Bad Gateway).',
  '503': 'El servicio se encuentra en mantenimiento. Inténtalo más tarde.',
  '504': 'El servidor tardó demasiado en responder.',
};

@Injectable({
  providedIn: 'root'
})
export class ErrorSanitizerService {
  /**
   * Recibe un error crudo de cualquier fuente (Supabase, HttpClient, Error de JS)
   * y retorna un objeto seguro y amigable para el usuario.
   */
  sanitize(error: any): SanitizedError {
    let message = 'Ha ocurrido un error inesperado. Por favor, intenta de nuevo.';
    let code: string | number | undefined;
    let isNetworkError = false;

    // 1. Manejo de Errores de Red / Desconexión
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      message = 'No se pudo conectar al servidor. Por favor, verifica tu conexión a internet.';
      isNetworkError = true;
      return { originalError: error, message, code: 'NETWORK_ERROR', isNetworkError };
    }

    if (error?.name === 'HttpErrorResponse') {
      if (error.status === 0) {
        message = 'No se pudo conectar al servidor. Verifica tu conexión a internet.';
        isNetworkError = true;
      } else {
        code = error.status;
        message = ERROR_DICTIONARY[String(code)] || message;
      }
      return { originalError: error, message, code, isNetworkError };
    }

    // Tokens de negocio emitidos por triggers (RAISE EXCEPTION)
    if (error?.message?.includes('CUPOS_AGOTADOS')) {
      return { 
        originalError: error, 
        message: 'No quedan cupos disponibles en este curso. Actualiza la lista para ver el estado actual.', 
        code: 'CUPOS_AGOTADOS', 
        isNetworkError 
      };
    }

    // 2. Manejo de Errores de Supabase / PostgREST
    // Supabase a menudo retorna un objeto con { code, message, details }
    if (error?.code) {
      code = String(error.code);
      // Buscamos en el diccionario si tenemos mapeado ese código específico de Postgres/PostgREST
      if (ERROR_DICTIONARY[code]) {
        message = ERROR_DICTIONARY[code];
      } 
      // Manejo especial para errores de validación de Auth
      else if (error.name === 'AuthApiError' || error.message?.includes('invalid credentials')) {
        message = ERROR_DICTIONARY['invalid_credentials'];
      }
      else {
         // Fallback seguro, no exponemos details ni hint
         message = `Ha ocurrido un error procesando la solicitud (${code}).`;
      }
      return { originalError: error, message, code, isNetworkError };
    }

    // 3. Errores genéricos
    if (error instanceof Error) {
      // Si es un error estándar (lanzado manualmente en el frontend con throw new Error('...'))
      // y no es un error de sistema (TypeError, ReferenceError), confiamos en su mensaje.
      if (error.constructor.name === 'Error') {
        message = error.message;
      }
      return { originalError: error, message, code: 'JS_ERROR', isNetworkError };
    }

    // 4. Strings y otros formatos desconocidos
    if (typeof error === 'string') {
      return { originalError: error, message: error, code: 'UNKNOWN_STRING', isNetworkError };
    }

    return { originalError: error, message, code: 'UNKNOWN', isNetworkError };
  }
}
