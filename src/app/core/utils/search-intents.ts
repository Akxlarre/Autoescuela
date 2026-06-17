import type { ActionResult } from '@core/models/ui/global-search.model';

/**
 * Entrada del diccionario de intenciones.
 * `path` es relativo al prefijo de rol, e.g. 'admin' → '/app/admin/{path}'.
 * Si el path difiere entre admin y secretaria, usar `pathByRole`.
 */
interface IntentEntry {
  id: string;
  keywords: string[];
  label: string;
  description: string;
  icon: string;
  /** Path relativo al prefijo de rol (ej: 'alumnos', 'contabilidad/cuadratura') */
  path: string;
  /** Override por rol cuando la ruta difiere entre portales */
  pathByRole?: Partial<Record<string, string>>;
}

export const INTENT_ENTRIES: IntentEntry[] = [
  {
    id: 'dashboard',
    keywords: ['dashboard', 'inicio', 'home', 'principal', 'resumen', 'kpi', 'bienvenida'],
    label: 'Dashboard',
    description: 'Vista principal con KPIs del sistema',
    icon: 'layout-dashboard',
    path: 'dashboard',
  },
  {
    id: 'alumnos',
    keywords: [
      'alumno',
      'alumnos',
      'estudiante',
      'estudiantes',
      'base',
      'lista',
      'matrícula lista',
      'listado',
    ],
    label: 'Base de Alumnos',
    description: 'Ver y gestionar todos los alumnos',
    icon: 'users',
    path: 'alumnos',
  },
  {
    id: 'matricula',
    keywords: [
      'matricular',
      'inscribir',
      'matrícula',
      'matricula',
      'nuevo alumno',
      'enrolar',
      'incorporar',
      'registrar',
      'inscripción',
    ],
    label: 'Nueva Matrícula',
    description: 'Iniciar el proceso de matrícula de un alumno',
    icon: 'user-plus',
    path: 'matricula',
  },
  {
    id: 'agenda',
    keywords: [
      'agenda',
      'clase',
      'clases',
      'horario',
      'calendario',
      'práctica',
      'practica',
      'agendar',
      'sesión',
      'sesion',
      'programar',
    ],
    label: 'Agenda de Clases',
    description: 'Programar y visualizar clases prácticas',
    icon: 'calendar',
    path: 'agenda',
  },
  {
    id: 'asistencia',
    keywords: [
      'asistencia',
      'falta',
      'faltas',
      'inasistencia',
      'control',
      'presente',
      'ausente',
      'hoy',
      'lista presencia',
      'attendance',
    ],
    label: 'Control de Asistencia',
    description: 'Registro de asistencia del día',
    icon: 'clipboard-list',
    path: 'asistencia',
  },
  {
    id: 'pagos',
    keywords: [
      'pago',
      'pagos',
      'deuda',
      'deudores',
      'cobrar',
      'cobros',
      'finanzas',
      'transferencia',
      'boleta',
      'estado de cuenta',
      'saldo',
    ],
    label: 'Gestión de Pagos',
    description: 'Historial de pagos y alumnos con deuda',
    icon: 'credit-card',
    path: 'pagos',
    pathByRole: { admin: 'pagos', secretaria: 'pagos' },
  },
  {
    id: 'cuadratura',
    keywords: [
      'cuadratura',
      'caja',
      'cierre',
      'plata',
      'efectivo',
      'arqueo',
      'fondo',
      'dinero',
      'billete',
      'caja chica',
    ],
    label: 'Cuadratura Diaria',
    description: 'Control y cierre de caja del día',
    icon: 'landmark',
    path: 'contabilidad/cuadratura',
  },
  {
    id: 'liquidaciones',
    keywords: [
      'liquidación',
      'liquidacion',
      'sueldo',
      'nómina',
      'nomina',
      'pago instructor',
      'anticipo',
      'horas',
      'salario',
    ],
    label: 'Liquidaciones',
    description: 'Nómina mensual de instructores',
    icon: 'banknote',
    path: 'contabilidad/liquidaciones',
  },
  {
    id: 'flota',
    keywords: [
      'vehículo',
      'vehiculo',
      'auto',
      'autos',
      'flota',
      'patente',
      'carro',
      'yaris',
      'sail',
      'soap',
      'mantención',
      'mantencion',
      'revisión técnica',
    ],
    label: 'Flota Vehicular',
    description: 'Estado, documentos y asignación de vehículos',
    icon: 'car',
    path: 'flota',
  },
  {
    id: 'instructores',
    keywords: ['instructor', 'instructores', 'profesor', 'profesores', 'personal', 'conducción'],
    label: 'Instructores',
    description: 'Gestión del equipo de instructores',
    icon: 'user-check',
    path: 'instructores',
  },
  {
    id: 'historial',
    keywords: [
      'historial',
      'histórico',
      'historico',
      'cierres',
      'cuadraturas anteriores',
      'meses anteriores',
    ],
    label: 'Historial de Cuadraturas',
    description: 'Cierres de caja de meses anteriores',
    icon: 'book-open',
    path: 'contabilidad/historial-cuadraturas',
  },
  {
    id: 'certificacion',
    keywords: [
      'certificado',
      'certificados',
      'certificación',
      'certificacion',
      'diploma',
      'aprobar',
    ],
    label: 'Certificación',
    description: 'Generar y gestionar certificados de egreso',
    icon: 'graduation-cap',
    path: 'certificacion',
    pathByRole: { secretaria: 'certificados' },
  },
];

/**
 * Devuelve hasta `maxResults` acciones cuyas keywords coincidan con el query.
 * Matching: el query (o alguna de sus palabras) está contenido en la keyword,
 * o la keyword está contenida en el query.
 */
export function getActionResults(
  query: string,
  rolePrefix: string,
  role: string,
  maxResults = 4,
): ActionResult[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const words = q.split(/\s+/).filter((w) => w.length >= 2);
  const seen = new Set<string>();
  const results: ActionResult[] = [];

  for (const entry of INTENT_ENTRIES) {
    if (seen.has(entry.id)) continue;

    const matched = entry.keywords.some((keyword) => {
      if (keyword.includes(q) || q.includes(keyword)) return true;
      return words.some((word) => keyword.includes(word));
    });

    if (matched) {
      seen.add(entry.id);
      const path = entry.pathByRole?.[role] ?? entry.path;
      results.push({
        type: 'action',
        id: entry.id,
        label: entry.label,
        description: entry.description,
        icon: entry.icon,
        route: [`${rolePrefix}/${path}`],
      });
      if (results.length >= maxResults) break;
    }
  }

  return results;
}
