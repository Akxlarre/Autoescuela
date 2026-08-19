// Registro de consentimiento (Ley 21.719) — mapea la tabla `consents` 1:1.
// Migración: supabase/migrations/20260817130000_consents_table_and_rls.sql

/** Tipo de consentimiento otorgado. Espeja el CHECK de `consents.consent_type`. */
export type ConsentType =
  | 'matricula_datos'
  | 'certificado_medico'
  | 'preinscripcion'
  | 'test_psicologico';

/**
 * Por qué vía se otorgó. Espeja el CHECK de `consents.source`.
 *
 * Sin `'papel'`: el negocio confirmó (17-08-2026) que nunca se digita una matrícula
 * tomada en ficha física, así que ese valor sería una rama muerta.
 */
export type ConsentSource = 'public' | 'secretaria';

export interface Consent {
  id: number;

  /** NULL mientras el lead de preinscripción todavía no tiene cuenta. */
  user_id: number | null;
  /** Fallback de identificación del titular cuando `user_id` aún es NULL. */
  subject_rut: string | null;
  enrollment_id: number | null;

  /** Ante qué responsable (sociedad) se otorgó. NOT NULL en BD. */
  branch_id: number;

  consent_type: ConsentType;

  /** `false` = negativa expresa. Se registra como fila, no como ausencia de fila. */
  granted: boolean;
  granted_at: string;
  revoked_at: string | null;

  /** La escribe el trigger `trg_consents_set_ip`; el cliente nunca la envía. */
  ip: string | null;

  policy_version: string;
  source: ConsentSource;

  /**
   * `true` = lo otorgó el representante legal de un menor. Su identidad no se guarda acá:
   * consta en la autorización notarial del expediente, que es obligatoria para menores.
   */
  granted_by_representative: boolean;

  created_at: string;
}
