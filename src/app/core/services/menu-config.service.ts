import { Injectable, computed } from '@angular/core';

/** Item de navegación lateral. `icon` es el nombre kebab-case de Lucide. */
export interface NavItem {
  label: string;
  /** Nombre kebab-case de lucide.dev (ej: 'layout-dashboard', 'settings') */
  icon: string;
  routerLink: string;
}

/**
 * MenuConfigService - Configuración del menú de navegación lateral.
 *
 * Para añadir rutas: agrega un NavItem a la lista.
 * Íconos: usa el nombre kebab-case de lucide.dev.
 * Los íconos deben estar registrados en provideIcons() en app.config.ts.
 */
@Injectable({
  providedIn: 'root',
})
export class MenuConfigService {
  readonly menuItems = computed<NavItem[]>(() => {
    return [
      {
        label: 'Dashboard',
        icon: 'layout-dashboard',
        routerLink: '/app',
      },
      {
        label: 'Alumnos',
        icon: 'users',
        routerLink: '/app/alumnos',
      },
      {
        label: 'Clases',
        icon: 'calendar',
        routerLink: '/app/clases',
      },
      {
        label: 'Exámenes',
        icon: 'graduation-cap',
        routerLink: '/app/examenes',
      },
      {
        label: 'Instructores',
        icon: 'user-check',
        routerLink: '/app/instructores',
      },
      {
        label: 'Vehículos',
        icon: 'car',
        routerLink: '/app/vehiculos',
      },
      {
        label: 'Facturación',
        icon: 'credit-card',
        routerLink: '/app/facturacion',
      },
      {
        label: 'Configuración',
        icon: 'settings',
        routerLink: '/app/settings',
      },
      ...Array.from({ length: 20 }).map((_, i) => ({
        label: `Ruta de prueba ${i + 1}`,
        icon: 'settings',
        routerLink: `/app/test-${i}`,
      })),
    ];
  });
}
