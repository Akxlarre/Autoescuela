/**
 * Enum de los 4 documentos obligatorios de un vehículo (RF-021). Única fuente de verdad —
 * reutilizado por `VehicleDocumentsDrawerComponent` (edición) y `VehicleFormDrawerComponent`
 * (staging al crear, fix-154-m). Mismo patrón que `INSTRUCTOR_DOC_TYPES`.
 */
export const VEHICLE_DOC_TYPES = [
  { label: 'SOAP', value: 'soap', icon: 'file-text' },
  { label: 'Revisión Técnica', value: 'technical_inspection', icon: 'wrench' },
  { label: 'Permiso de Circulación', value: 'circulation_permit', icon: 'file-badge' },
  { label: 'Seguro', value: 'insurance', icon: 'shield-check' },
] as const;
