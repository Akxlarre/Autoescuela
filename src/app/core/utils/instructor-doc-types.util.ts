/**
 * Enum de tipos de documento requeridos para un instructor Clase B (Decreto 39/1985 MTT,
 * ver spec 0003-m §6). Única fuente de verdad — reutilizado por el selector de tipo del
 * DMS (`dms-upload-drawer`) y por la subida de documentos al crear un instructor
 * (`admin-instructor-crear-drawer`).
 */
export const INSTRUCTOR_DOC_TYPES = [
  { label: 'Cert. Antecedentes', value: 'certificado_antecedentes' },
  { label: 'Cert. Enseñanza Media', value: 'certificado_ensenanza_media' },
  { label: 'Cert. Curso Tránsito y Mecánica', value: 'certificado_curso_transito_mecanica' },
  { label: 'Hoja de Vida del Conductor', value: 'hoja_vida_conductor' },
  { label: 'Credencial SEMEP', value: 'credencial_semep' },
  { label: 'Licencia Clase B', value: 'licencia_clase_b' },
  { label: 'Cert. Curso Instructor Teórico', value: 'certificado_curso_instructor_teorico' },
] as const;
