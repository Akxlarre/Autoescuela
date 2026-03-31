import { Injectable, computed, inject } from '@angular/core';
import { AuthFacade } from '@core/facades/auth.facade';

/** Item de navegación lateral. `icon` es el nombre kebab-case de Lucide. */
export interface NavItem {
  label: string;
  /** Nombre kebab-case de lucide.dev (ej: 'layout-dashboard', 'settings') */
  icon: string;
  routerLink: string;
  badge?: number;
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
      case 'relator':
        return RELATOR_NAV;
      default:
        return [];
    }
  });
}

// ── Configuración de navegación por rol ──────────────────────────────────────

const ADMIN_NAV: NavGroup[] = [
  {
    group: 'Dashboard',
    items: [{ label: 'Inicio', icon: 'layout-dashboard', routerLink: '/app/admin/dashboard' }],
  },
  {
    group: 'Operación Diaria',
    items: [
      { label: 'Notificaciones', icon: 'bell', routerLink: '/app/admin/notificaciones' },
      { label: 'Tareas', icon: 'check-square', routerLink: '/app/admin/tareas' },
      { label: 'Nueva Matrícula', icon: 'file-plus', routerLink: '/app/admin/matricula' },
    ],
  },
  {
    group: 'Alumnos',
    items: [
      { label: 'Base de Alumnos', icon: 'users', routerLink: '/app/admin/alumnos' },
      { label: 'Certificados', icon: 'award', routerLink: '/app/admin/certificacion' },
      {
        label: 'Servicios Especiales',
        icon: 'settings',
        routerLink: '/app/admin/servicios-especiales',
      },
    ],
  },
  {
    group: 'Agenda y Clases',
    items: [
      { label: 'Agenda Semanal', icon: 'calendar', routerLink: '/app/admin/agenda' },
      { label: 'Asistencia', icon: 'clipboard-check', routerLink: '/app/admin/asistencia' },
    ],
  },
  {
    group: 'Administración',
    items: [
      { label: 'Pagos', icon: 'credit-card', routerLink: '/app/admin/pagos' },
      {
        label: 'Cuadratura Caja',
        icon: 'calculator',
        routerLink: '/app/admin/contabilidad/cuadratura',
      },
      { label: 'Secretarias', icon: 'users', routerLink: '/app/admin/secretarias' },
      { label: 'Instructores', icon: 'user-check', routerLink: '/app/admin/instructores' },
      {
        label: 'Reportes Contables',
        icon: 'bar-chart-2',
        routerLink: '/app/admin/contabilidad/reportes',
      },
      {
        label: 'Cursos Singulares',
        icon: 'book-open',
        routerLink: '/app/admin/contabilidad/cursos',
      },
      { label: 'Anticipos', icon: 'receipt', routerLink: '/app/admin/contabilidad/anticipos' },
      {
        label: 'Historial Cuadraturas',
        icon: 'history',
        routerLink: '/app/admin/contabilidad/historial-cuadraturas',
      },
      { label: 'Flota', icon: 'truck', routerLink: '/app/admin/flota' },
      { label: 'Libro de Clases', icon: 'book-open', routerLink: '/app/admin/libro-de-clases' },
      { label: 'DMS', icon: 'folder-open', routerLink: '/app/admin/documentos' },
    ],
  },
  {
    group: 'Clase Profesional',
    items: [
      {
        label: 'Relatores',
        icon: 'monitor',
        routerLink: '/app/admin/clase-profesional/relatores',
      },
      {
        label: 'Promociones',
        icon: 'tag',
        routerLink: '/app/admin/clase-profesional/promociones',
      },
      {
        label: 'Certificados Prof.',
        icon: 'award',
        routerLink: '/app/admin/clase-profesional/certificados',
      },
      {
        label: 'Archivo',
        icon: 'archive',
        routerLink: '/app/admin/clase-profesional/archivo',
      },
    ],
  },
  {
    group: 'Reportes',
    items: [{ label: 'Auditoría', icon: 'shield-check', routerLink: '/app/admin/auditoria' }],
  },
];

const SECRETARIA_NAV: NavGroup[] = [
  {
    group: 'Mi Dashboard',
    items: [
      { label: 'Inicio', icon: 'layout-dashboard', routerLink: '/app/secretaria/dashboard' },
      { label: 'Notificaciones', icon: 'bell', routerLink: '/app/secretaria/notificaciones' },
      { label: 'Observaciones', icon: 'eye', routerLink: '/app/secretaria/observaciones' },
      { label: 'Nueva Matrícula', icon: 'file-plus', routerLink: '/app/secretaria/matricula' },
    ],
  },
  {
    group: 'Gestión de Alumnos',
    items: [
      { label: 'Matrículas', icon: 'file-text', routerLink: '/app/secretaria/matricula' },
      { label: 'Base de Alumnos', icon: 'users', routerLink: '/app/secretaria/alumnos' },
      { label: 'Ex Alumnos', icon: 'user-minus', routerLink: '/app/secretaria/ex-alumnos' },
      {
        label: 'Comunicaciones',
        icon: 'message-circle',
        routerLink: '/app/secretaria/comunicaciones',
      },
      { label: 'Certificados', icon: 'award', routerLink: '/app/secretaria/certificados' },
      { label: 'DMS', icon: 'folder-open', routerLink: '/app/secretaria/documentos' },
    ],
  },
  {
    group: 'Operaciones',
    items: [
      { label: 'Agenda', icon: 'calendar', routerLink: '/app/secretaria/agenda' },
      { label: 'Asistencia', icon: 'clipboard-check', routerLink: '/app/secretaria/asistencia' },
      { label: 'Instructores', icon: 'user-check', routerLink: '/app/secretaria/instructores' },
      { label: 'Pagos', icon: 'credit-card', routerLink: '/app/secretaria/pagos' },
      {
        label: 'Cuadratura',
        icon: 'calculator',
        routerLink: '/app/secretaria/contabilidad/cuadratura',
      },
      {
        label: 'Reportes',
        icon: 'bar-chart-2',
        routerLink: '/app/secretaria/contabilidad/reportes',
      },
      {
        label: 'Historial Cuadraturas',
        icon: 'history',
        routerLink: '/app/secretaria/contabilidad/historial-cuadraturas',
      },
      {
        label: 'Libro de Clases',
        icon: 'book-open',
        routerLink: '/app/secretaria/libro-de-clases',
      },
      {
        label: 'Servicios Especiales',
        icon: 'briefcase',
        routerLink: '/app/secretaria/servicios-especiales',
      },
    ],
  },
  {
    group: 'Clase Profesional',
    items: [
      {
        label: 'Relatores',
        icon: 'monitor',
        routerLink: '/app/secretaria/profesional/relatores',
      },
      {
        label: 'Promociones',
        icon: 'tag',
        routerLink: '/app/secretaria/profesional/promociones',
      },
      {
        label: 'Calificaciones',
        icon: 'star',
        routerLink: '/app/secretaria/profesional/notas',
      },
      {
        label: 'Certificados',
        icon: 'award',
        routerLink: '/app/secretaria/profesional/certificados',
      },
      {
        label: 'Archivo',
        icon: 'archive',
        routerLink: '/app/secretaria/profesional/archivo',
      },
    ],
  },
];

const INSTRUCTOR_NAV: NavGroup[] = [
  {
    group: 'Mi Trabajo',
    items: [
      { label: 'Mi Dashboard', icon: 'layout-dashboard', routerLink: '/app/instructor/dashboard' },
      { label: 'Notificaciones', icon: 'bell', routerLink: '/app/instructor/notificaciones' },
      { label: 'Iniciar Clase', icon: 'play-circle', routerLink: '/app/instructor/clase/iniciar' },
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
    ],
  },
];

const ALUMNO_NAV: NavGroup[] = [
  {
    group: 'Mi Progreso',
    items: [
      { label: 'Mi Dashboard', icon: 'layout-dashboard', routerLink: '/app/alumno/dashboard' },
      { label: 'Notificaciones', icon: 'bell', routerLink: '/app/alumno/notificaciones' },
      { label: 'Mi Certificado', icon: 'award', routerLink: '/app/alumno/certificado' },
      { label: 'Mis Notas', icon: 'star', routerLink: '/app/alumno/notas' },
      { label: 'Mi Progreso', icon: 'trending-up', routerLink: '/app/alumno/progreso' },
      { label: 'Mi Asistencia', icon: 'clipboard-check', routerLink: '/app/alumno/asistencia' },
    ],
  },
  {
    group: 'Mis Clases',
    items: [
      { label: 'Mis Clases', icon: 'calendar', routerLink: '/app/alumno/clases' },
      { label: 'Agendar Clase', icon: 'clock', routerLink: '/app/alumno/agendar' },
      { label: 'Mi Horario', icon: 'calendar', routerLink: '/app/alumno/horario' },
      { label: 'Pruebas Online', icon: 'brain', routerLink: '/app/alumno/pruebas-online' },
    ],
  },
  {
    group: 'Pagos',
    items: [{ label: 'Mis Pagos', icon: 'credit-card', routerLink: '/app/alumno/pagos' }],
  },
  {
    group: 'Ayuda',
    items: [{ label: 'Ayuda', icon: 'help-circle', routerLink: '/app/alumno/ayuda' }],
  },
];

const RELATOR_NAV: NavGroup[] = [
  {
    group: 'Mi Trabajo',
    items: [
      { label: 'Inicio', icon: 'layout-dashboard', routerLink: '/app/relator/dashboard' },
      { label: 'Asistencia', icon: 'clipboard-check', routerLink: '/app/relator/asistencia' },
      { label: 'Alumnos', icon: 'users', routerLink: '/app/relator/alumnos' },
      { label: 'Notas', icon: 'star', routerLink: '/app/relator/notas' },
      { label: 'Maquinaria', icon: 'wrench', routerLink: '/app/relator/maquinaria' },
      { label: 'Acta Final', icon: 'flag', routerLink: '/app/relator/acta-final' },
    ],
  },
];
