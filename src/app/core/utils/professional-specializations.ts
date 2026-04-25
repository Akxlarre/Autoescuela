/**
 * Constantes compartidas para especialidades de Clase Profesional (A2–A5).
 * Usadas en: RelatoresFacade, AdminProfesionalRelatoresComponent y sus drawers.
 */

export const SPEC_COLORS: Record<string, string> = {
  A2: '#3b82f6',
  A3: '#8b5cf6',
  A4: '#f59e0b',
  A5: '#10b981',
};

export const SPEC_LABELS: Record<string, string> = {
  A2: 'Taxis y colectivos',
  A3: 'Buses',
  A4: 'Carga simple',
  A5: 'Carga profesional',
};

export const SPECIALIZATION_OPTIONS = [
  { value: 'A2', label: SPEC_LABELS['A2'], color: SPEC_COLORS['A2'] },
  { value: 'A3', label: SPEC_LABELS['A3'], color: SPEC_COLORS['A3'] },
  { value: 'A4', label: SPEC_LABELS['A4'], color: SPEC_COLORS['A4'] },
  { value: 'A5', label: SPEC_LABELS['A5'], color: SPEC_COLORS['A5'] },
] as const;

export function getSpecColor(spec: string): string {
  return SPEC_COLORS[spec] ?? '#6b7280';
}

export function getSpecLabel(spec: string): string {
  return SPEC_LABELS[spec] ?? spec;
}
