import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import Aura from '@primeng/themes/aura';
import { MessageService, ConfirmationService } from 'primeng/api';
import {
  LucideAngularModule,
  // ── Usados por el boilerplate (dashboard, kpi-card, sidebar) ──
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BarChart2,
  CheckCircle,
  ChevronRight,
  Download,
  LayoutDashboard,
  Plus,
  Settings,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  // ── Shell support (topbar, login, mobile drawer) ──
  Bell,
  BellOff,
  LogOut,
  Menu,
  Search,
  X,
  XCircle,
  // ── Acciones comunes (ampliar según el proyecto — ver lucide.dev) ──
  Check,
  Edit,
  Info,
  Trash2,
  Moon,
  Sun,
  // ── Autoescuela ──
  Calendar,
  Car,
  CreditCard,
  GraduationCap,
  UserCheck,
} from 'lucide-angular';

import { routes } from './app.routes';
import { provideCoreAuth } from '@core/auth/provide-core-auth';

/**
 * Configuración principal de la aplicación.
 *
 * provideCoreAuth() ya incluye provideHttpClient(withInterceptors([authInterceptor])).
 * NO añadas provideHttpClient() por separado o se duplicará.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    provideAnimationsAsync(),
    providePrimeNG({
      theme: {
        preset: Aura,
        options: {
          darkModeSelector: '.fake-dark-mode',
          cssLayer: {
            name: 'primeng',
            order: 'tailwind-base, primeng, tailwind-utilities',
          },
        },
      },
    }),
    provideCoreAuth(),
    MessageService,
    ConfirmationService,
    /**
     * Lucide Icons — Set mínimo del shell (23 íconos).
     *
     * lucide-angular 0.575 usa LucideAngularModule.pick() (no provideIcons).
     * Para añadir más: importar de 'lucide-angular' y agregar al objeto.
     * Referencia: https://lucide.dev/icons
     */
    importProvidersFrom(
      LucideAngularModule.pick({
        Activity,
        AlertCircle,
        AlertTriangle,
        ArrowRight,
        BarChart2,
        CheckCircle,
        ChevronRight,
        Download,
        LayoutDashboard,
        Plus,
        Settings,
        TrendingDown,
        TrendingUp,
        User,
        Users,
        Bell,
        BellOff,
        LogOut,
        Menu,
        Search,
        X,
        XCircle,
        Check,
        Edit,
        Info,
        Trash2,
        Moon,
        Sun,
        // ── Autoescuela ──
        Calendar,
        Car,
        CreditCard,
        GraduationCap,
        UserCheck,
      }),
    ),
  ],
};
