import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { NotificationsFacade } from '@core/facades/notifications.facade';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';

@Component({
  selector: 'app-instructor-notificaciones',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SectionHeroComponent, IconComponent, BentoGridLayoutDirective],
  template: `
    <div class="bento-grid" appBentoGridLayout #bentoGrid>
      <!-- HERO -->
      <div class="bento-banner">
        <app-section-hero
          #heroRef
          title="Notificaciones"
          subtitle="Centro de alertas y mensajes importantes"
          backRoute="/app/instructor/dashboard"
          backLabel="Dashboard"
          [actions]="heroActions"
          (actionClick)="onHeroAction($event)"
        />
      </div>

      <div class="bento-banner">
        <div class="card p-0 overflow-hidden divide-y divide-divider">
          @if (notifications().length === 0) {
            <div class="p-12 text-center">
              <app-icon
                name="bell-off"
                [size]="48"
                class="mx-auto mb-4 opacity-50 text-text-muted"
              />
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
    </div>
  `,
})
export class InstructorNotificacionesComponent implements OnInit, AfterViewInit {
  private gsap = inject(GsapAnimationsService);
  private notificationsFacade = inject(NotificationsFacade);
  private destroyRef = inject(DestroyRef);
  private readonly heroRef = viewChild<ElementRef<HTMLElement>>('heroRef');

  readonly heroActions: SectionHeroAction[] = [
    { id: 'mark-all-read', label: 'Marcar todas como leídas', icon: 'check-check', primary: true },
  ];

  readonly notifications = computed(() =>
    this.notificationsFacade.filteredNotifications().map((n) => ({
      id: n.id,
      type: this.mapReferenceToType(n.referenceType),
      title: n.title,
      message: n.message,
      time: this.formatRelativeTime(n.createdAt),
      unread: !n.read,
      actionLabel: null as string | null,
    })),
  );

  ngOnInit() {
    this.notificationsFacade.initialize();
    this.destroyRef.onDestroy(() => this.notificationsFacade.dispose());
  }

  ngAfterViewInit() {
    const hero = this.heroRef();
    if (hero) this.gsap.animateHero(hero.nativeElement);
  }

  onHeroAction(id: string) {
    if (id === 'mark-all-read') this.markAllRead();
  }

  markAllRead() {
    this.notificationsFacade.markAllAsRead();
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

  private mapReferenceToType(ref?: string | null): string {
    if (!ref) return 'system';
    const map: Record<string, string> = {
      class_b: 'schedule',
      professional_session: 'schedule',
      payment: 'system',
      document_expiry: 'system',
    };
    return map[ref] ?? 'system';
  }

  private formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Ahora';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `Hace ${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays} días`;
    return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
  }
}
