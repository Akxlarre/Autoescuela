// Modelos de UI de las plantillas de comunicado (spec 0042-b).
// El DTO crudo vive en core/models/dto/notification-template.model.ts.

import type { NotificationTemplate } from '@core/models/dto/notification-template.model';

/**
 * Variables que una plantilla puede usar. Deliberadamente acotado a identidad: meter
 * datos financieros o de agenda (`{{saldo}}`, `{{proxima_clase}}`) en un envío masivo
 * significa que un segmento mal armado le muestra a un alumno el dato de otro.
 */
export const TEMPLATE_VARIABLES = ['nombre', 'sede'] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

/** Valores concretos con los que se resuelve una plantilla para UN destinatario. */
export type TemplateVariableValues = Partial<Record<TemplateVariable, string>>;

/** Lo que edita el admin en el formulario de plantillas. */
export interface TemplateDraft {
  /** `null` = plantilla nueva; con id = edición. */
  id: number | null;
  name: string;
  subject: string;
  body: string;
  active: boolean;
}

/** Fila de la lista de plantillas. */
export interface TemplateRow extends Pick<NotificationTemplate, 'id' | 'name'> {
  subject: string;
  body: string;
  active: boolean;
  /** Variables efectivamente usadas en el cuerpo, para mostrarlas en la lista. */
  usedVariables: TemplateVariable[];
}
