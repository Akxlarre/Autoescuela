import type { DocumentType } from '@core/models/dto/document-template.model';

// Re-exportado para que los componentes (Smart/Dumb) nunca importen directo de `dto/` (ARCH-12,
// `.claude/rules/models.md`) — `DocumentType` es un union type simple, no un DTO con forma cruda,
// así que re-exportarlo tal cual desde `ui/` no duplica ninguna transformación.
export type { DocumentType };

/**
 * Forma editable de una cláusula/sección para el formulario del editor. Existe como modelo de UI
 * (en vez de exponer el DTO crudo) porque el JSON de `content` en BD no trae labels legibles ni
 * los tokens disponibles por cláusula — esa metadata es estática (definida acá, no en BD) y varía
 * por tipo de documento (spec 0016-m, plan.md §4).
 */
export interface DocumentTemplateSection {
  /** Clave dentro de `DocumentTemplate.content` (ej. 'primero', 'cuerpo'). */
  id: string;
  /** Label legible para el editor (ej. "PRIMERO", "Encabezado — Nombre"). */
  label: string;
  /** Texto actual de la sección (ya resuelto: contenido guardado o fallback histórico). */
  body: string;
  /** Límite de caracteres sugerido para esa sección (mitigación de overflow, AC5). */
  maxLength: number;
  /** Placeholders `{{token}}` disponibles en esta sección — vacío si es texto estático puro. */
  availableTokens: string[];
}

export interface DocumentTemplateForm {
  branchId: number;
  documentType: DocumentType;
  sections: DocumentTemplateSection[];
}

/** Metadata estática (label + tokens + límite) por tipo de documento — ver plan.md §4 para el
 * detalle de por qué cada token existe. No viene de BD: es la forma fija de cada tipo. */
export const DOCUMENT_TEMPLATE_SECTIONS: Record<
  DocumentType,
  Array<Pick<DocumentTemplateSection, 'id' | 'label' | 'maxLength' | 'availableTokens'>>
> = {
  contract_b: [
    { id: 'primero', label: 'PRIMERO', maxLength: 800, availableTokens: [] },
    { id: 'segundo', label: 'SEGUNDO', maxLength: 600, availableTokens: ['claseTeoricas'] },
    { id: 'tercero', label: 'TERCERO', maxLength: 600, availableTokens: [] },
    { id: 'cuarto', label: 'CUARTO', maxLength: 600, availableTokens: [] },
    {
      id: 'quinto',
      label: 'QUINTO',
      maxLength: 900,
      availableTokens: ['valorCurso', 'textoDescuento', 'montoPagado', 'saldoPendiente'],
    },
    {
      id: 'sexto',
      label: 'SEXTO — Protección de datos',
      maxLength: 900,
      availableTokens: ['emailContacto', 'politicaPrivacidadUrl'],
    },
  ],
  contract_professional: [
    {
      id: 'primero',
      label: 'PRIMERO',
      maxLength: 800,
      availableTokens: ['nombreAlumno', 'claseLicencia'],
    },
    { id: 'segundo', label: 'SEGUNDO', maxLength: 700, availableTokens: ['horasCurso'] },
    { id: 'tercero', label: 'TERCERO', maxLength: 600, availableTokens: [] },
    { id: 'cuarto', label: 'CUARTO', maxLength: 700, availableTokens: [] },
    {
      id: 'quinto',
      label: 'QUINTO',
      maxLength: 900,
      availableTokens: ['valorCurso', 'textoDescuento', 'montoPagado', 'saldoPendiente'],
    },
    {
      id: 'sexto',
      label: 'SEXTO — Protección de datos',
      maxLength: 900,
      availableTokens: ['emailContacto', 'politicaPrivacidadUrl'],
    },
  ],
  certificate_b: [
    { id: 'encabezado_nombre', label: 'Encabezado — Nombre', maxLength: 60, availableTokens: [] },
    {
      id: 'encabezado_subtitulo',
      label: 'Encabezado — Subtítulo',
      maxLength: 80,
      availableTokens: [],
    },
    {
      id: 'encabezado_direccion',
      label: 'Encabezado — Dirección/contacto',
      maxLength: 100,
      availableTokens: [],
    },
    { id: 'intro', label: 'Introducción', maxLength: 400, availableTokens: [] },
    { id: 'cuerpo', label: 'Cuerpo', maxLength: 400, availableTokens: ['fechaInicio', 'fechaFin'] },
    { id: 'cierre', label: 'Cierre', maxLength: 200, availableTokens: [] },
    { id: 'firma_nombre', label: 'Firma — Nombre', maxLength: 80, availableTokens: [] },
    { id: 'firma_cargo', label: 'Firma — Cargo', maxLength: 80, availableTokens: [] },
  ],
  certificate_professional: [
    { id: 'encabezado_nombre', label: 'Encabezado — Nombre', maxLength: 60, availableTokens: [] },
    {
      id: 'encabezado_subtitulo',
      label: 'Encabezado — Subtítulo',
      maxLength: 80,
      availableTokens: [],
    },
    {
      id: 'encabezado_direccion',
      label: 'Encabezado — Dirección/contacto',
      maxLength: 100,
      availableTokens: [],
    },
    { id: 'intro', label: 'Introducción', maxLength: 400, availableTokens: [] },
    {
      id: 'cuerpo',
      label: 'Cuerpo',
      maxLength: 400,
      availableTokens: ['cursoLabel', 'fechaInicio', 'fechaFin'],
    },
    { id: 'cierre', label: 'Cierre', maxLength: 200, availableTokens: [] },
    { id: 'firma_nombre', label: 'Firma — Nombre', maxLength: 80, availableTokens: [] },
    { id: 'firma_cargo', label: 'Firma — Cargo', maxLength: 80, availableTokens: [] },
  ],
};

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  contract_b: 'Contrato Clase B',
  contract_professional: 'Contrato Profesional',
  certificate_b: 'Certificado Clase B',
  certificate_professional: 'Certificado Profesional',
};
