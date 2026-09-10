// Núcleo funcional de las plantillas de comunicado (spec 0042-b).
//
// La regla que más importa acá:
//
//   UN MARCADOR QUE NO SE PUEDE RESOLVER SE VACÍA, NUNCA LANZA.
//
// Estas funciones corren en el camino de un envío a cientos de destinatarios. Un typo en
// una plantilla ({{telefono}} en vez de {{nombre}}) tiene que salir como un hueco en el
// texto, no tumbar el envío entero (AC-E1).

import {
  TEMPLATE_VARIABLES,
  type TemplateDraft,
  type TemplateVariable,
  type TemplateVariableValues,
} from '@core/models/ui/notification-template.model';

/** `{{variable}}` con espacios opcionales adentro. */
const PLACEHOLDER = /\{\{\s*([a-zA-Z_]+)\s*\}\}/g;

export type TemplateDraftError = 'nombre_requerido' | 'asunto_requerido' | 'cuerpo_requerido';

export interface TemplateDraftValidation {
  valid: boolean;
  errors: TemplateDraftError[];
}

/**
 * Resuelve los marcadores de un texto con los valores de UN destinatario.
 *
 * El valor se inserta tal cual: escapar es responsabilidad de quien arma el HTML del
 * correo (la Edge Function), y tiene que ocurrir DESPUÉS de sustituir — si se escapara
 * antes, el escapado no alcanzaría al contenido de la variable.
 */
export function renderTemplate(body: string, values: TemplateVariableValues): string {
  return body.replace(PLACEHOLDER, (_match, key: string) => {
    const value = values[key as TemplateVariable];
    return value ?? '';
  });
}

/** Variables válidas que el cuerpo usa realmente, sin repetir y en orden de aparición. */
export function extractUsedVariables(body: string): TemplateVariable[] {
  const found = new Set<TemplateVariable>();

  for (const match of body.matchAll(PLACEHOLDER)) {
    const key = match[1] as TemplateVariable;
    if ((TEMPLATE_VARIABLES as readonly string[]).includes(key)) found.add(key);
  }

  return [...found];
}

/**
 * `null` significa "enviar ahora" y es válido. Con valor, tiene que ser futuro: agendar
 * para un instante ya pasado sería indistinguible de un envío inmediato, pero con la
 * demora del cron de por medio.
 */
export function isScheduledForValid(scheduledFor: string | null, now: Date = new Date()): boolean {
  if (scheduledFor === null) return true;

  const target = new Date(scheduledFor).getTime();
  if (Number.isNaN(target)) return false;

  return target > now.getTime();
}

export function validateTemplateDraft(draft: TemplateDraft): TemplateDraftValidation {
  const errors: TemplateDraftError[] = [];

  if (draft.name.trim().length === 0) errors.push('nombre_requerido');
  if (draft.subject.trim().length === 0) errors.push('asunto_requerido');
  if (draft.body.trim().length === 0) errors.push('cuerpo_requerido');

  return { valid: errors.length === 0, errors };
}
