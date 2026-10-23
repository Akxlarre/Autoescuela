import type { DocumentType } from '@core/models/ui/document-content-template.model';

const ALL_DOCUMENT_TYPES: readonly DocumentType[] = [
  'contract_b',
  'certificate_b',
  'contract_professional',
  'certificate_professional',
];

/**
 * Tipos de documento que el editor de plantillas ofrece para una sede (spec 0016-m).
 *
 * - Sin Profesional en la sede → solo los de Clase B (AC8).
 * - fix-465-m: el certificado Profesional se emite también en el piloto, así que su plantilla se
 *   ofrece siempre en la sede con Profesional (fix-463-m la había sacado).
 */
export function editableDocumentTypes(hasProfessional: boolean): DocumentType[] {
  return ALL_DOCUMENT_TYPES.filter((type) => hasProfessional || !type.includes('professional'));
}
