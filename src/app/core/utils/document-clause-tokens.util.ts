/**
 * Descripciones en español simple para los tokens `{{token}}` del editor de plantillas
 * (spec 0016-m, AC7). El token crudo (`{{saldoPendiente}}`) sigue siendo lo que se muestra en el
 * chip — esta descripción es un tooltip complementario para quien no reconoce el camelCase, no un
 * reemplazo del token.
 */
const TOKEN_DESCRIPTIONS: Record<string, string> = {
  claseTeoricas: 'Horario de las clases teóricas',
  valorCurso: 'Valor total del curso',
  textoDescuento: 'Descuento aplicado (si corresponde)',
  montoPagado: 'Monto que el alumno ya pagó',
  saldoPendiente: 'Saldo pendiente de pago',
  emailContacto: 'Correo de contacto de la escuela',
  politicaPrivacidadUrl: 'Enlace a la política de privacidad',
  nombreAlumno: 'Nombre del alumno',
  claseLicencia: 'Tipo de licencia del curso',
  horasCurso: 'Cantidad de horas del curso',
  fechaInicio: 'Fecha de inicio del curso',
  fechaFin: 'Fecha de término del curso',
  cursoLabel: 'Nombre del curso',
};

/** Fallback: si aparece un token nuevo sin descripción mapeada, se muestra el token crudo. */
export function getTokenDescription(token: string): string {
  return TOKEN_DESCRIPTIONS[token] ?? token;
}
