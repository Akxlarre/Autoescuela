export interface Branch {
  id: number;
  name: string;
  slug: string;
  address?: string | null;
  /** Teléfono de la escuela; también el del pie de sus correos (spec 0061-b). */
  phone?: string | null;
  /** Correo de contacto: dirección de respuesta de todos sus correos (spec 0061-b, AC13). */
  email?: string | null;
  /** Nombre visible del remitente; NULL = `name` (spec 0061-b). */
  email_sender_name?: string | null;
  /** Dirección de envío, siempre @gestordeautoescuelas.cl; NULL = la neutra (spec 0061-b). */
  email_sender_address?: string | null;
  active: boolean;
  has_professional: boolean;
  created_at: string;
}
