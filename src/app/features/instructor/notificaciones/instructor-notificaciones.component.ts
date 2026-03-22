import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';

@Component({
  selector: 'app-instructor-notificaciones',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionHeroComponent, IconComponent],
  template: `
    <div class="px-6 py-6 pb-20 max-w-4xl mx-auto space-y-6">
      <!-- HERO -->
      <section class="bento-hero surface-hero rounded-xl" #heroRef>
        <app-section-hero
          title="Notificaciones"
          subtitle="Centro de alertas y mensajes importantes"
          [actions]="heroActions"
          (actionClick)="onHeroAction($event)"
        />
      </section>

      <div class="card p-0 overflow-hidden divide-y divide-divider">
        @if (notifications().length === 0) {
          <div class="p-12 text-center">
            <app-icon name="bell-off" [size]="48" class="mx-auto mb-4 opacity-50 text-text-muted" />
            <h3 class="text-lg font-medium text-text-primary mb-1">No tienes notificaciones</h3>
            <p class="text-sm text-text-muted">Estás al día con todos tus mensajes y alertas.</p>
          </div>
        } @else {
          @for (notif of notifications(); track notif.id) {
            <div
              class="p-4 sm:p-5 flex gap-4 transition-colors hover:bg-surface-hover/50"
              [class.bg-brand-muted]="notif.unread"
            >
              <div
                class="w-10 h-10 shrink-0 rounded-full flex items-center justify-center"
                [style.background]="getIconBg(notif.type)"
                [style.color]="'white'"
              >
                <app-icon [name]="getIconName(notif.type)" [size]="20" />
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex justify-between items-start mb-1">
                  <h4
                    class="text-sm text-text-primary"
                    [class.font-bold]="notif.unread"
                    [class.font-semibold]="!notif.unread"
                  >
                    {{ notif.title }}
                  </h4>
                  <span class="text-xs text-text-muted whitespace-nowrap ml-4">{{
                    notif.time
                  }}</span>
                </div>
                <p class="text-sm text-text-secondary leading-relaxed mb-2">
                  {{ notif.message }}
                </p>
                @if (notif.actionLabel) {
                  <button
                    class="text-sm font-medium hover:underline"
                    style="color: var(--color-primary)"
                  >
                    {{ notif.actionLabel }}
                  </button>
                }
              </div>

              @if (notif.unread) {
                <div
                  class="w-2.5 h-2.5 rounded-full shrink-0 mt-2"
                  style="background: var(--color-primary)"
                ></div>
              }
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class InstructorNotificacionesComponent implements AfterViewInit {
  private gsap = inject(GsapAnimationsService);
  private readonly heroRef = viewChild<ElementRef<HTMLElement>>('heroRef');

  readonly heroActions: SectionHeroAction[] = [
    { id: 'mark-all-read', label: 'Marcar todas como leídas', icon: 'check-check', primary: true },
  ];

  notifications = signal([
    {
      id: 1,
      type: 'schedule',
      title: 'Cambio de horario asignado',
      message:
        'Se ha reagendado tu clase de las 14:00 con el alumno Juan Pérez para mañana a la misma hora.',
      time: 'Hace 1 hora',
      unread: true,
      actionLabel: 'Ver Horario',
    },
    {
      id: 2,
      type: 'student',
      title: 'Evaluación pendiente',
      message: 'No has registrado la evaluación de la clase de las 10:00 con María González.',
      time: 'Hace 4 horas',
      unread: true,
      actionLabel: 'Evaluar ahora',
    },
    {
      id: 3,
      type: 'system',
      title: 'Cierre de ciclo mensual',
      message:
        'Recuerda que el próximo viernes es el cierre de ciclo mensual. Revisa tu liquidación proyectada.',
      time: 'Ayer',
      unread: false,
      actionLabel: 'Ver Liquidación',
    },
    {
      id: 4,
      type: 'student',
      title: 'Alumno canceló su clase',
      message:
        'El alumno Pedro Díaz ha cancelado su clase práctica programada para hoy a las 16:00.',
      time: 'Hace 2 días',
      unread: false,
      actionLabel: null,
    },
  ]);

  ngAfterViewInit() {
    const hero = this.heroRef();
    if (hero) this.gsap.animateHero(hero.nativeElement);
  }

  onHeroAction(id: string) {
    if (id === 'mark-all-read') this.markAllRead();
  }

  markAllRead() {
    this.notifications.update((list) => list.map((n) => ({ ...n, unread: false })));
  }

  getIconBg(type: string): string {
    const map: Record<string, string> = {
      schedule: 'var(--color-primary)',
      student: 'var(--state-warning)',
      system: 'var(--text-muted)',
    };
    return map[type] ?? 'var(--color-primary)';
  }

  getIconName(type: string): string {
    const map: Record<string, string> = {
      schedule: 'calendar',
      student: 'users',
      system: 'settings',
    };
    return map[type] ?? 'bell';
  }
}
