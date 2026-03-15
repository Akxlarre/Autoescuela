import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, delay, map, of, tap } from 'rxjs';
import { DashboardModel } from '@core/models/ui/dashboard.model';

/**
 * DashboardFacade — Maneja el estado global del Dashboard de Admin.
 *
 * Expone señales reactivas (`loading`, `data`, `error`) consumidas por el `DashboardComponent`.
 * En un escenario real, delega llamadas HTTP/Supabase aquí.
 */
@Injectable({
  providedIn: 'root',
})
export class DashboardFacade {
  // ── Estado (Signals) ────────────────────────────────────────────────────────
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  // Datos principales
  readonly data = signal<DashboardModel | null>(null);

  constructor(private readonly http: HttpClient) {}

  // ── Acciones ────────────────────────────────────────────────────────────────

  /**
   * Carga los datos del dashboard.
   * Por ahora simula una llamada de red con datos mockup.
   */
  loadDashboardData(): void {
    this.loading.set(true);
    this.error.set(null);

    // TODO: Reemplazar estof con llamada HTTP o Supabase real:
    // this.http.get<DashboardModel>('/api/dashboard/admin').pipe(...)

    // Simulación de red (Mock)
    of(this.getMockData())
      .pipe(
        delay(800), // Simular delay de carga para ver skeletons
        tap((res) => this.data.set(res)),
        catchError((err) => {
          this.error.set('Error al cargar datos del dashboard');
          return of(null);
        }),
        tap(() => this.loading.set(false)),
      )
      .subscribe();
  }

  // ── Mock Data ───────────────────────────────────────────────────────────────

  private getMockData(): DashboardModel {
    // Obtenemos la fecha de hoy para el hero
    const today = new Date();
    const formatter = new Intl.DateTimeFormat('es', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const dateStr = formatter.format(today);
    const dateCapitalized = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

    return {
      hero: {
        userName: 'Pepito Admi',
        date: dateCapitalized,
        classesToday: 18,
        practicalClasses: 12,
        theoreticalClasses: 6,
        activeAlerts: 2,
      },
      kpis: [
        {
          id: 'users',
          label: 'Alumnos Activos',
          value: 234,
          trend: 12,
          trendLabel: 'vs mes anterior',
          icon: 'users',
          color: 'default',
        },
        {
          id: 'classes',
          label: 'Clases Hoy',
          value: 18,
          subValue: '12 prácticas, 6 teóricas',
          icon: 'book-open',
          color: 'success',
        },
        {
          id: 'revenue',
          label: 'Ingresos Mes',
          value: 8.2, // Será formateado en el template con 'M'
          prefix: '$',
          suffix: 'M',
          trend: 3,
          trendLabel: 'vs mes anterior',
          icon: 'credit-card',
          color: 'default',
        },
        {
          id: 'vehicles',
          label: 'Vehículos',
          value: 8,
          subValue: 'En uso / Total: 12', // Adaptación provisoria o usar string plano
          icon: 'truck',
          color: 'warning',
        },
      ],
      activities: [
        {
          id: 'a1',
          icon: 'user',
          title: 'Nueva matrícula: María González - Clase B',
          description: '',
          time: 'Hace 5 min',
          iconBg: 'var(--color-primary-muted)',
          iconColor: 'var(--color-primary)', // text-primary
        },
        {
          id: 'a2',
          icon: 'dollar-sign',
          title: 'Pago recibido: $180.000 - Juan Pérez',
          description: '',
          time: 'Hace 12 min',
          iconBg: 'var(--state-success-bg)', // bg-state-success
          iconColor: 'var(--state-success)', // text-state-success
        },
        {
          id: 'a3',
          icon: 'check-circle',
          title: 'Clase completada: Instructor Carlos - Ana Martínez',
          description: '',
          time: 'Hace 20 min',
          iconBg: 'var(--color-purple-muted)',
          iconColor: 'var(--color-purple)', // text-purple
        },
        {
          id: 'a4',
          icon: 'alert-triangle',
          title: 'Documento vencido: Vehículo ABC-123 - Revisión técnica',
          description: '',
          time: 'Hace 1 hora',
          iconBg: 'var(--state-error-bg)', // bg-state-error
          iconColor: 'var(--state-error)', // text-state-error
        },
      ],
      alerts: [
        {
          id: 'al1',
          title: '3 Documentos vencidos',
          description: 'Vehículos requieren atención',
          severity: 'error',
        },
        {
          id: 'al2',
          title: '12 Pagos pendientes',
          description: 'Revisar cuentas por cobrar',
          severity: 'warning',
        },
      ],
      quickActions: [
        {
          id: 'qa1',
          icon: 'plus',
          label: 'Nueva Matrícula',
          llmAction: 'new-enrollment',
          iconBg: 'var(--color-primary-muted)',
          iconColor: 'var(--color-primary)',
        },
        {
          id: 'qa2',
          icon: 'calendar',
          label: 'Ver Agenda',
          llmAction: 'view-calendar',
          iconBg: 'transparent',
          iconColor: 'var(--text-secondary)',
        },
        {
          id: 'qa3',
          icon: 'credit-card',
          label: 'Registrar Pago',
          llmAction: 'register-payment',
          iconBg: 'transparent',
          iconColor: 'var(--text-secondary)',
        },
      ],
      systemStatus: [
        { name: 'API', ok: true },
        { name: 'Base de datos', ok: true },
      ],
    };
  }
}
