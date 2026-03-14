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
  ArrowLeft,
  ArrowRight,
  BarChart2,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  LayoutDashboard,
  Plus,
  Settings,
  TrendingDown,
  TrendingUp,
  User,
  Users,
  UserPlus,
  // ── Shell support (topbar, login, mobile drawer) ──
  Bell,
  BellOff,
  LogOut,
  Menu,
  Search,
  X,
  XCircle,
  // ── Acciones comunes ──
  Check,
  Circle,
  Edit,
  Info,
  Trash2,
  Moon,
  Sun,
  // ── Autoescuela — iconos de navegación por rol ──
  Archive,
  Award,
  Banknote,
  BookOpen,
  Brain,
  Briefcase,
  Building2,
  Calculator,
  Calendar,
  Camera,
  Car,
  CheckSquare,
  ClipboardCheck,
  ClipboardList,
  Clock,
  CreditCard,
  DollarSign,
  Edit3,
  Eye,
  FileCheck,
  FilePen,
  FilePlus,
  FileSignature,
  FileText,
  Flag,
  FlaskConical,
  Printer,
  FolderOpen,
  GraduationCap,
  HelpCircle,
  Image,
  Landmark,
  Loader,
  Mail,
  MessageCircle,
  Monitor,
  PenTool,
  PlayCircle,
  Receipt,
  RefreshCw,
  RotateCcw,
  Scroll,
  ShieldAlert,
  ShieldCheck,
  Star,
  Stethoscope,
  Tag,
  Truck,
  Upload,
  UploadCloud,
  UserCheck,
  UserMinus,
  UserX,
  Video,
  Folder,
  Wrench,
  Ban,
  Home,
  ZoomIn,
  // ── Agenda Semanal ──
  CalendarDays,
  CalendarClock,
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
    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions({
        onViewTransitionCreated: ({ transition, from, to }) => {
          const fromUrl = '/' + from.url.map((s) => s.path).join('/');
          const toUrl = '/' + to.url.map((s) => s.path).join('/');

          const isLoginToApp = fromUrl === '/login' && toUrl.startsWith('/app');
          const isAppToLogin = fromUrl.startsWith('/app') && toUrl === '/login';

          if (isLoginToApp) {
            document.documentElement.classList.add('vt-login-enter');
            transition.finished.then(() =>
              document.documentElement.classList.remove('vt-login-enter'),
            );
          } else if (isAppToLogin) {
            document.documentElement.classList.add('vt-login-leave');
            transition.finished.then(() =>
              document.documentElement.classList.remove('vt-login-leave'),
            );
          }
        },
      }),
    ),
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
     * Lucide Icons — set completo para todos los roles (46 íconos).
     *
     * lucide-angular 0.575 usa LucideAngularModule.pick() (no provideIcons).
     * Para añadir más: importar de 'lucide-angular' y agregar al objeto.
     * Referencia: https://lucide.dev/icons
     */
    importProvidersFrom(
      LucideAngularModule.pick({
        // Shell & boilerplate
        Activity,
        AlertCircle,
        AlertTriangle,
        ArrowLeft,
        ArrowRight,
        BarChart2,
        CheckCircle,
        ChevronDown,
        ChevronLeft,
        ChevronRight,
        ChevronUp,
        Download,
        LayoutDashboard,
        Plus,
        Settings,
        TrendingDown,
        TrendingUp,
        User,
        Users,
        UserPlus,
        Bell,
        BellOff,
        LogOut,
        Menu,
        Search,
        X,
        XCircle,
        Check,
        Circle,
        Edit,
        Info,
        Trash2,
        Moon,
        Sun,
        // Autoescuela — navegación por rol
        Archive,
        Award,
        Banknote,
        BookOpen,
        Brain,
        Briefcase,
        Building2,
        Calculator,
        Calendar,
        Camera,
        Car,
        CheckSquare,
        ClipboardCheck,
        ClipboardList,
        Clock,
        CreditCard,
        DollarSign,
        Edit3,
        Eye,
        FileCheck,
        FilePen,
        FilePlus,
        FileSignature,
        FileText,
        Flag,
        FlaskConical,
        Printer,
        FolderOpen,
        GraduationCap,
        HelpCircle,
        Image,
        Landmark,
        Loader,
        Mail,
        MessageCircle,
        Monitor,
        PenTool,
        PlayCircle,
        Receipt,
        RefreshCw,
        RotateCcw,
        Scroll,
        ShieldAlert,
        ShieldCheck,
        Star,
        Stethoscope,
        Tag,
        Truck,
        Upload,
        UploadCloud,
        UserCheck,
        UserMinus,
        UserX,
        Video,
        Ban,
        Folder,
        Home,
        Wrench,
        ZoomIn,
        // Agenda Semanal
        CalendarDays,
        CalendarClock,
      }),
    ),
  ],
};
