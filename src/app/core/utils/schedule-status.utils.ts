
export type SessionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

export interface StatusVisual {
  label: string;
  borderColor: string;    // CSS var para border-left accent
  dotBg: string;          // CSS var para dot background
  dotBorder: string;      // CSS border para dot
  textColor: string;      // Color del texto dentro del bloque
  bgClass: string;        // Tailwind/token class para fondo del bloque
  opacity: number;        // 0-1
  interactive: boolean;   // ¿clickeable?
  icon: string | null;    // Lucide icon name
}

export function getStatusVisual(status: SessionStatus): StatusVisual {
  switch (status) {
    case 'in_progress':
      return {
        label: 'En curso',
        borderColor: 'var(--state-warning)',
        dotBg: 'var(--color-primary)',
        dotBorder: '2px solid var(--color-primary)',
        textColor: 'var(--color-primary-text)',
        bgClass: 'bg-brand',
        opacity: 1.0,
        interactive: true,
        icon: 'user'
      };
    case 'scheduled':
      return {
        label: 'Programada',
        borderColor: 'var(--color-primary)',
        dotBg: 'var(--bg-surface)',
        dotBorder: '2px solid color-mix(in srgb, var(--color-primary) 50%, transparent)',
        textColor: 'var(--text-primary)',
        bgClass: 'bg-surface',
        opacity: 1.0,
        interactive: true,
        icon: null
      };
    case 'completed':
      return {
        label: 'Completada',
        borderColor: 'var(--state-success)',
        dotBg: 'var(--bg-elevated)',
        dotBorder: '1px solid var(--border-subtle)',
        textColor: 'var(--text-secondary)',
        bgClass: 'bg-surface',
        opacity: 0.6,
        interactive: true,
        icon: 'check'
      };
    case 'cancelled':
      return {
        label: 'Cancelada',
        borderColor: 'var(--border-subtle)',
        dotBg: 'transparent',
        dotBorder: '2px dashed var(--border-subtle)',
        textColor: 'var(--text-muted)',
        bgClass: 'bg-surface',
        opacity: 0.4,
        interactive: false,
        icon: null
      };
    case 'no_show':
      return {
        label: 'No asistió',
        borderColor: 'var(--state-error)',
        dotBg: 'var(--state-error-bg)',
        dotBorder: '2px solid var(--state-error)',
        textColor: 'var(--text-muted)',
        bgClass: 'bg-surface',
        opacity: 0.5,
        interactive: false,
        icon: 'x'
      };
    default:
      return {
        label: 'Desconocido',
        borderColor: 'var(--border-subtle)',
        dotBg: 'var(--bg-surface)',
        dotBorder: '1px solid var(--border-subtle)',
        textColor: 'var(--text-primary)',
        bgClass: 'bg-surface',
        opacity: 1.0,
        interactive: false,
        icon: null
      };
  }
}

export function getStatusLabel(status: SessionStatus): string {
  return getStatusVisual(status).label;
}

export function getDotStyle(status: SessionStatus): Record<string, string> {
  const visual = getStatusVisual(status);
  const ring = { 'box-shadow': '0 0 0 3px var(--bg-surface)' };
  
  return {
    background: visual.dotBg,
    border: visual.dotBorder,
    ...ring
  };
}
