// Plantilla de comunicado (spec 0042-b) — mapea la tabla `notification_templates` 1:1.
//
// La tabla existe desde el esquema original (RF-016/RF-017) pero nunca se había usado:
// estaba vacía hasta esta spec. Su RLS ya era la correcta para lo que se necesita
// (INSERT/UPDATE/DELETE solo admin, SELECT admin + secretaría), así que no hizo falta
// migrarla.

/**
 * Para qué sirve la plantilla. Distingue las de comunicado global de otros usos que la
 * tabla pueda tener en el futuro (la columna es libre en BD, sin CHECK).
 */
export type NotificationTemplateType = 'announcement';

export interface NotificationTemplate {
  id: number;
  name: string;
  type: string | null;
  subject: string | null;
  /**
   * Texto plano con marcadores `{{variable}}` sin resolver. Se guardan crudos: la
   * sustitución ocurre por destinatario al enviar, no al guardar.
   */
  body: string;
  /** `false` = archivada; no aparece en el compositor pero no se pierde. */
  active: boolean | null;
  created_at: string | null;
}
