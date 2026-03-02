import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';
import { guestGuard } from '@core/guards/guest.guard';

/**
 * Rutas de la aplicación.
 *
 * Estructura sugerida:
 *   /           → rutas públicas (login, register, reset-password)
 *   /app        → rutas protegidas envueltas en AppShellComponent (sidebar + topbar)
 *   /app/**     → features cargadas con lazy loading
 */
export const routes: Routes = [
  // Rutas públicas — autenticación
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },

  // Rutas protegidas — envueltas en el layout AppShell
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      // Ruta por defecto — dashboard directo (sin redirect para evitar race con View Transitions)
      {
        path: '',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'alumnos',
        loadComponent: () =>
          import('./features/alumnos/alumnos.component').then((m) => m.AlumnosComponent),
      },
      {
        path: 'clases',
        loadComponent: () =>
          import('./features/clases/clases.component').then((m) => m.ClasesComponent),
      },
      {
        path: 'examenes',
        loadComponent: () =>
          import('./features/examenes/examenes.component').then((m) => m.ExamenesComponent),
      },
      {
        path: 'instructores',
        loadComponent: () =>
          import('./features/instructores/instructores.component').then(
            (m) => m.InstructoresComponent,
          ),
      },
      {
        path: 'vehiculos',
        loadComponent: () =>
          import('./features/vehiculos/vehiculos.component').then((m) => m.VehiculosComponent),
      },
      {
        path: 'facturacion',
        loadComponent: () =>
          import('./features/facturacion/facturacion.component').then(
            (m) => m.FacturacionComponent,
          ),
      },
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/settings/settings.component').then((m) => m.SettingsComponent),
      },
    ],
  },

  { path: '', redirectTo: '/login', pathMatch: 'full' },
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
