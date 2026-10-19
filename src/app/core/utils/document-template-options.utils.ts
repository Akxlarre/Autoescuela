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
 * - fix-463-m: mientras el piloto recorte Profesional, el certificado Profesional no se emite, así
 *   que tampoco se ofrece su plantilla. El contrato Profesional sí se usa (matrícula profesional).
 */
export function editableDocumentTypes(
  hasProfessional: boolean,
  professionalCertificatesBlocked: boolean,
): DocumentType[] {
  return ALL_DOCUMENT_TYPES.filter((type) => {
    if (!type.includes('professional')) return true;
    if (!hasProfessional) return false;
    return !(type === 'certificate_professional' && professionalCertificatesBlocked);
  });
}
