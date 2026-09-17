/**
 * Contenido editable de un documento generado por Edge Function (contrato/certificado), por sede
 * x tipo de documento. Reestructurado en spec 0016-m — antes esta tabla guardaba archivos
 * descargables subidos a mano (feature en desuso real, eliminado sin reemplazo).
 */
export type DocumentType =
  'contract_b' | 'contract_professional' | 'certificate_b' | 'certificate_professional';

export interface DocumentTemplate {
  id: number;
  name: string;
  description?: string | null;
  branch_id: number;
  document_type: DocumentType;
  /** Claves de cláusula/sección editables — ver tabla de tokens en
   * specs/specs/0016-m-editor-plantillas-documentos/plan.md §4. */
  content: Record<string, string>;
  updated_by?: number | null;
  updated_at?: string;
}
