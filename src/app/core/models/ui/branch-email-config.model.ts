/**
 * Configuración de correo de una escuela, tal como la edita el admin (spec 0061-b, AC11).
 *
 * UI model y no el DTO porque los nombres de BD confunden en esta pantalla: `branches.email` es
 * el correo de RESPUESTA (`replyTo`) y `branches.phone` el teléfono del pie.
 */
export interface BranchEmailConfig {
  branchId: number;
  branchName: string;
  /** Nombre visible del remitente. */
  senderName: string | null;
  /** Dirección de envío (@gestordeautoescuelas.cl). */
  senderAddress: string | null;
  /** Correo al que llegan las respuestas; también el contacto del pie. */
  replyTo: string | null;
  /** Teléfono del pie. */
  phone: string | null;
}

/** Los 4 campos editables del formulario. */
export type BranchEmailForm = Pick<
  BranchEmailConfig,
  'senderName' | 'senderAddress' | 'replyTo' | 'phone'
>;
