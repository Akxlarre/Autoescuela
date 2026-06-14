import { Injectable, computed, inject } from '@angular/core';
import { AuthFacade } from '@core/facades/auth.facade';

/** Item de navegación lateral. `icon` es el nombre kebab-case de Lucide. */
export interface NavItem {
  label: string;
  /** Nombre kebab-case de lucide.dev (ej: 'layout-dashboard', 'settings') */
  icon: string;
  routerLink: string;
  badge?: number;
  requiresProfessional?: boolean;
}

/** Grupo de items de navegación con encabezado de sección. */
export interface NavGroup {
  group: string;
  items: NavItem[];
}

/**
 * MenuConfigService - Configuración del menú de navegación lateral por rol.
 *
 * `menuItems()` es un computed que reacciona al rol activo en RoleService.
 * Para añadir rutas: agrega un NavItem al grupo correspondiente.
 * Íconos: usa el nombre kebab-case de lucide.dev — registrar en app.config.ts.
 */
@Injectable({ providedIn: 'root' })
export class MenuConfigService {
  private readonly auth = inject(AuthFacade);

  readonly menuItems = computed<NavGroup[]>(() => {
    switch (this.auth.currentUser()?.role) {
      case 'admin':
        return ADMIN_NAV;
      case 'secretaria':
        return SECRETARIA_NAV;
      case 'instructor':
        return INSTRUCTOR_NAV;
      case 'alumno':
        return ALUMNO_NAV;
      default:
        return [];
    }
  });
}

// ── Configuración de navegación por rol ──────────────────────────────────────

const ADMIN_NAV: NavGroup[] = [
  {
    group: 'Operaciones Diarias',
    items: [
      { label: 'Inicio', icon: 'layout-dashboard', routerLink: '/app/admin/dashboard' },
      { label: 'Comunicación', icon: 'message-circle', routerLink: '/app/admin/tareas' },
      { label: 'Nueva Matrícula', icon: 'file-plus', routerLink: '/app/admin/matricula' },
    ],
  },
  {
    group: 'Academia Clase B',
    items: [
      { label: 'Agenda', icon: 'calendar', routerLink: '/app/admin/agenda' },
      { label: 'Base Alumnos B', icon: 'users', routerLink: '/app/admin/alumnos' },
      { label: 'Asistencia B', icon: 'clipboard-check', routerLink: '/app/admin/asistencia' },
      { label: 'Certificaciones B', icon: 'award', routerLink: '/app/admin/certificacion' },
    ],
  },
  {
    group: 'Academia Profesional',
    items: [
      {
        label: 'Promociones',
        icon: 'tag',
        routerLink: '/app/admin/clase-profesional/promociones',
        requiresProfessional: true,
      },
      {
        label: 'Relatores',
        icon: 'monitor',
        routerLink: '/app/admin/clase-profesional/relatores',
        requiresProfessional: true,
      },
      {
        label: 'Asistencia Prof.',
        icon: 'clipboard-list',
        routerLink: '/app/admin/clase-profesional/asistencia',
        requiresProfessional: true,
      },
      {
        label: 'Evaluaciones',
        icon: 'file-spreadsheet',
        routerLink: '/app/admin/clase-profesional/evaluaciones',
        requiresProfessional: true,
      },
      {
        label: 'Libro de Clases',
        icon: 'book-open',
        routerLink: '/app/admin/libro-de-clases',
        requiresProfessional: true,
      },
      {
        label: 'Certificados Prof.',
        icon: 'award',
        routerLink: '/app/admin/clase-profesional/certificados',
        requiresProfessional: true,
      },
      {
        label: 'Archivo',
        icon: 'archive',
        routerLink: '/app/admin/clase-profesional/archivo',
        requiresProfessional: true,
      },
    ],
  },
  {
    group: 'Finanzas y Caja',
    items: [
      {
        label: 'Caja Diaria',
        icon: 'calculator',
        routerLink: '/app/admin/contabilidad/cuadratura',
      },
      {
        label: 'Venta Servicios Especiales',
        icon: 'briefcase',
        routerLink: '/app/admin/servicios-especiales',
      },
      { label: 'Pagos', icon: 'credit-card', routerLink: '/app/admin/pagos' },
      {
        label: 'Reportes Contables',
        icon: 'bar-chart-2',
        routerLink: '/app/admin/contabilidad/reportes',
      },
      {
        label: 'Liquidaciones',
        icon: 'banknote',
        routerLink: '/app/admin/contabilidad/liquidaciones',
      },
      {
        label: 'Cursos Singulares',
        icon: 'book-open',
        routerLink: '/app/admin/contabilidad/cursos',
      },
      { label: 'Anticipos', icon: 'receipt', routerLink: '/app/admin/contabilidad/anticipos' },
      { label: 'Ex Alumnos', icon: 'user-minus', routerLink: '/app/admin/ex-alumnos' },
    ],
  },
  {
    group: 'Recursos y Logística',
    items: [
      { label: 'Instructores', icon: 'user-check', routerLink: '/app/admin/instructores' },
      { label: 'Flota', icon: 'truck', routerLink: '/app/admin/flota' },
      { label: 'DMS Documentos', icon: 'folder-open', routerLink: '/app/admin/documentos' },
    ],
  },
];

const SECRETARIA_NAV: NavGroup[] = [
  {
    group: 'Operaciones Diarias',
    items: [
      { label: 'Inicio', icon: 'layout-dashboard', routerLink: '/app/secretaria/dashboard' },
      {
        label: 'Comunicación',
        icon: 'message-circle',
        routerLink: '/app/secretaria/observaciones',
      },
      { label: 'Nueva Matrícula', icon: 'file-plus', routerLink: '/app/secretaria/matricula' },
    ],
  },
  {
    group: 'Academia Clase B',
    items: [
      { label: 'Agenda', icon: 'calendar', routerLink: '/app/secretaria/agenda' },
      { label: 'Base Alumnos B', icon: 'users', routerLink: '/app/secretaria/alumnos' },
      { label: 'Asistencia B', icon: 'clipboard-check', routerLink: '/app/secretaria/asistencia' },
      { label: 'Certificaciones B', icon: 'award', routerLink: '/app/secretaria/certificados' },
    ],
  },
  {
    group: 'Academia Profesional',
    items: [
      {
        label: 'Promociones',
        icon: 'tag',
        routerLink: '/app/secretaria/profesional/promociones',
        requiresProfessional: true,
      },
      {
        label: 'Relatores',
        icon: 'monitor',
        routerLink: '/app/secretaria/profesional/relatores',
        requiresProfessional: true,
      },
      {
        label: 'Asistencia Prof.',
        icon: 'clipboard-list',
        routerLink: '/app/secretaria/profesional/asistencia',
        requiresProfessional: true,
      },
      {
        label: 'Calificaciones',
        icon: 'star',
        routerLink: '/app/secretaria/profesional/notas',
        requiresProfessional: true,
      },
      {
        label: 'Libro de Clases',
        icon: 'book-open',
        routerLink: '/app/secretaria/libro-de-clases',
        requiresProfessional: true,
      },
      {
        label: 'Certificados Prof.',
        icon: 'award',
        routerLink: '/app/secretaria/profesional/certificados',
        requiresProfessional: true,
      },
      {
        label: 'Archivo',
        icon: 'archive',
        routerLink: '/app/secretaria/profesional/archivo',
        requiresProfessional: true,
      },
    ],
  },
  {
    group: 'Finanzas y Caja',
    items: [
      {
        label: 'Caja Diaria',
        icon: 'calculator',
        routerLink: '/app/secretaria/contabilidad/cuadratura',
      },
      {
        label: 'Venta Servicios Especiales',
        icon: 'briefcase',
        routerLink: '/app/secretaria/servicios-especiales',
      },
      { label: 'Pagos', icon: 'credit-card', routerLink: '/app/secretaria/pagos' },
      {
        label: 'Reportes Contables',
        icon: 'bar-chart-2',
        routerLink: '/app/secretaria/contabilidad/reportes',
      },
      {
        label: 'Liquidaciones',
        icon: 'banknote',
        routerLink: '/app/secretaria/contabilidad/liquidaciones',
      },
      { label: 'Ex Alumnos', icon: 'user-minus', routerLink: '/app/secretaria/ex-alumnos' },
      {
        label: 'Comunicaciones',
        icon: 'message-circle',
        routerLink: '/app/secretaria/comunicaciones',
      },
    ],
  },
  {
    group: 'Recursos y Logística',
    items: [
      { label: 'Instructores', icon: 'user-check', routerLink: '/app/secretaria/instructores' },
      { label: 'DMS Documentos', icon: 'folder-open', routerLink: '/app/secretaria/documentos' },
    ],
  },
];

const INSTRUCTOR_NAV: NavGroup[] = [
  {
    group: 'Mi Trabajo',
    items: [
      { label: 'Mi Dashboard', icon: 'layout-dashboard', routerLink: '/app/instructor/dashboard' },
    ],
  },
  {
    group: 'Mis Recursos',
    items: [
      { label: 'Mi Horario', icon: 'clock', routerLink: '/app/instructor/horario' },
      { label: 'Mis Alumnos', icon: 'users', routerLink: '/app/instructor/alumnos' },
      {
        label: 'Ensayos Teóricos',
        icon: 'book-open',
        routerLink: '/app/instructor/ensayos-teoricos',
      },
      { label: 'Mis Horas', icon: 'dollar-sign', routerLink: '/app/instructor/liquidacion' },
      { label: 'Comunicación', icon: 'message-circle', routerLink: '/app/instructor/tareas' },
    ],
  },
];

const ALUMNO_NAV: NavGroup[] = [
  {
    group: 'Mi Progreso',
    items: [{ label: 'Inicio', icon: 'layout-dashboard', routerLink: '/app/alumno/dashboard' }],
  },
  {
    group: 'Mis Clases',
    items: [
      { label: 'Mis Clases', icon: 'calendar', routerLink: '/app/alumno/clases' },
      { label: 'Mi Horario', icon: 'calendar', routerLink: '/app/alumno/horario' },
      { label: 'Pruebas Online', icon: 'brain', routerLink: '/app/alumno/pruebas-online' },
    ],
  },
  {
    group: 'Pagos y Clases',
    items: [{ label: 'Pagos y Clases', icon: 'wallet', routerLink: '/app/alumno/pagos' }],
  },
  {
    group: 'Ayuda',
    items: [{ label: 'Ayuda', icon: 'help-circle', routerLink: '/app/alumno/ayuda' }],
  },
];
