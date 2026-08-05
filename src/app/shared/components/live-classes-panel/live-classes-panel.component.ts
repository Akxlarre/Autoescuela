import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  ElementRef,
  viewChild,
  effect,
  inject,
  DestroyRef,
} from '@angular/core';
import { sliceByBudget } from '@core/utils/layout-tier.utils';
import { CommonModule } from '@angular/common';
import { LiveClassModel } from '@core/models/ui/dashboard.model';
import { isSessionOverdue } from '@core/utils/class-b-session-overdue.utils';
import { IconComponent } from '../icon/icon.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';
import { PressFeedbackDirective } from '@core/directives/press-feedback.directive';
import { AnimateInDirective } from '@core/directives/animate-in.directive';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'app-live-classes-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IconComponent,
    EmptyStateComponent,
    SkeletonBlockComponent,
    PressFeedbackDirective,
    AnimateInDirective,
    TooltipModule,
  ],
  host: {
    // El modo fill-screen (contain: size en desktop) lo aporta la clase
    // `.bento-fill` del design system (spec 0028) — el consumidor la pone
    // junto a bento-wide/bento-card. En móvil la celda mide su contenido.
    class: 'flex flex-col gap-3 h-full overflow-hidden w-full',
  },
  template: `
    <!-- Header de sección estandarizado -->
    <div class="flex items-center gap-2 mb-2 shrink-0">
      <app-icon name="radio" [size]="16" class="text-error animate-pulse" />
      <h2 class="m-0 font-semibold text-text-primary">Clases Actuales</h2>
    </div>

    @if (loading()) {
      <ul class="m-0 p-0 list-none flex flex-col gap-1 flex-1 min-h-0 overflow-hidden pr-2">
        @for (i of skeletonItems(); track i) {
          <li
            class="flex items-center justify-between p-3 rounded-xl bg-surface border border-transparent"
          >
            <!-- Lado Izquierdo Skeleton -->
            <div class="flex items-center gap-4">
              <div class="flex flex-col gap-1.5 w-14 shrink-0">
                <app-skeleton-block variant="text" width="40px" height="16px" />
                <app-skeleton-block variant="text" width="55px" height="9px" />
              </div>
              <div class="flex items-center gap-3">
                <div class="flex -space-x-2 shrink-0">
                  <app-skeleton-block
                    variant="circle"
                    width="32px"
                    height="32px"
                    class="relative z-10 border-2 border-surface"
                  />
                  <app-skeleton-block
                    variant="circle"
                    width="32px"
                    height="32px"
                    class="relative z-0 border-2 border-surface"
                  />
                </div>
                <div class="flex flex-col gap-1.5">
                  <app-skeleton-block variant="text" width="80px" height="14px" />
                  <app-skeleton-block variant="text" width="60px" height="10px" />
                </div>
              </div>
            </div>
            <!-- Lado Derecho Skeleton -->
            <div class="flex items-center gap-4 shrink-0">
              <div class="hidden sm:flex flex-col items-end">
                <app-skeleton-block variant="text" width="50px" height="12px" />
              </div>
              <app-skeleton-block variant="circle" width="32px" height="32px" />
            </div>
          </li>
        }
      </ul>
    } @else if (classes().length === 0) {
      <div
        class="border border-border-subtle rounded-xl bg-surface-hover flex-1 flex flex-col justify-center"
      >
        <app-empty-state
          icon="clock"
          message="Sin clases actuales"
          subtitle="No hay clases programadas en este momento."
        />
      </div>
    } @else {
      <!-- Contenedor vertical scrollable -->
      <ul
        #scrollContainer
        class="m-0 p-0 list-none flex flex-col gap-1 flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2 relative"
      >
        @for (cls of visibleClasses(); track cls.id; let i = $index) {
          <li
            [attr.data-status]="cls.status"
            class="live-class-item group flex items-center justify-between p-3 rounded-xl cursor-pointer hover:bg-subtle transition-all duration-300"
            appPressFeedback="press"
            (click)="actionClick.emit(cls)"
            [appAnimateIn]="{ delay: 0.1 + i * 0.05 }"
          >
            <!-- Lado Izquierdo: Hora y Avatares -->
            <div class="flex items-center gap-4 min-w-0">
              <!-- Hora y Estado -->
              <div class="flex flex-col shrink-0 w-14">
                <span class="font-bold text-text-primary leading-none">{{
                  formatTime(cls.scheduledAt)
                }}</span>
                <span
                  class="text-2xs font-bold uppercase tracking-widest mt-1 transition-colors duration-300 inline-flex items-center gap-1"
                  [class.text-warning]="cls.status === 'pending'"
                  [class.text-success]="cls.status === 'in_progress' && !isOverdue(cls)"
                  [class.text-text-muted]="cls.status === 'completed'"
                  [class.text-error]="isOverdue(cls)"
                  [attr.data-llm-description]="
                    isOverdue(cls) ? 'Clase con cierre atrasado, requiere atención' : null
                  "
                >
                  @if (isOverdue(cls)) {
                    <app-icon name="alert-triangle" [size]="11" class="badge-pulse shrink-0" />
                  }
                  {{ statusLabel(cls.status, isOverdue(cls)) }}
                </span>
              </div>

              <!-- Participantes (Avatares solapados) -->
              <div class="flex items-center gap-3 min-w-0">
                <div
                  class="flex -space-x-2 shrink-0 transition-transform duration-300 group-hover:translate-x-1"
                >
                  <!-- Alumno Avatar -->
                  <div
                    class="w-8 h-8 rounded-full bg-brand-muted text-brand border-2 border-surface flex items-center justify-center text-xs font-bold z-10 transition-colors duration-300"
                    [pTooltip]="'Alumno: ' + cls.studentName"
                    tooltipPosition="top"
                  >
                    {{ cls.studentName.charAt(0) }}
                  </div>
                  <!-- Instructor Avatar -->
                  <div
                    class="w-8 h-8 rounded-full bg-subtle text-text-secondary border-2 border-surface flex items-center justify-center z-0 transition-colors duration-300"
                    [pTooltip]="'Instructor: ' + cls.instructorName"
                    tooltipPosition="top"
                  >
                    <app-icon name="user" [size]="14" />
                  </div>
                </div>

                <div
                  class="flex flex-col min-w-0 transition-transform duration-300 group-hover:translate-x-1"
                >
                  <span
                    class="item-title truncate"
                    [pTooltip]="cls.studentName"
                    tooltipPosition="top"
                    >{{ cls.studentName.split(' ')[0] }}</span
                  >
                  <span
                    class="text-2xs text-text-muted truncate uppercase tracking-wider"
                    [pTooltip]="
                      cls.type === 'practical' ? cls.vehicle || 'Sin auto' : 'Clase Teórica'
                    "
                    tooltipPosition="bottom"
                  >
                    {{ cls.type === 'practical' ? cls.vehicle || 'Sin auto' : 'Teórica' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Lado Derecho: Tiempo Relativo y Acción -->
            <div class="flex items-center gap-4 shrink-0">
              <div class="hidden sm:flex flex-col text-right">
                <span
                  class="text-xs font-bold transition-transform duration-300 group-hover:-translate-x-1"
                  [class.text-warning]="cls.status === 'pending'"
                  [class.text-success]="cls.status === 'in_progress' && !isOverdue(cls)"
                  [class.text-text-muted]="cls.status === 'completed'"
                  [class.text-error]="isOverdue(cls)"
                >
                  {{ getRelativeTime(cls.scheduledAt, cls.status, isOverdue(cls)) }}
                </span>
              </div>

              <div
                class="flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 group-hover:scale-110 group-hover:shadow-sm hover-icon-container"
                [class.bg-brand]="cls.status === 'in_progress' && !isOverdue(cls)"
                [class.text-brand-text]="cls.status === 'in_progress' && !isOverdue(cls)"
                [class.bg-subtle]="cls.status === 'pending' || cls.status === 'completed'"
                [class.text-brand]="cls.status === 'pending'"
                [class.text-text-muted]="cls.status === 'completed'"
                [class.bg-error-subtle]="isOverdue(cls)"
                [class.text-error]="isOverdue(cls)"
              >
                <app-icon
                  [name]="
                    cls.status === 'completed'
                      ? 'chevron-right'
                      : isOverdue(cls)
                        ? 'alert-triangle'
                        : 'play'
                  "
                  [size]="14"
                  [class.animate-pulse]="cls.status === 'in_progress'"
                />
              </div>
            </div>
          </li>
        }

        <!-- Footer: Ver todas al final del scroll -->
        <li class="pt-2 mt-1 border-t border-border-subtle shrink-0">
          <button
            class="btn-ghost w-full flex items-center justify-center font-medium transition-colors cursor-pointer"
            (click)="viewAllClick.emit()"
            data-llm-action="view-all-classes"
          >
            Ver toda la agenda
          </button>
        </li>
      </ul>
    }
  `,
  styles: [
    `
      .hover-icon-container {
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
      }

      /* Scrollbar minimalista para listas */
      .custom-scrollbar::-webkit-scrollbar {
        width: 4px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background-color: var(--border-subtle);
        border-radius: 4px;
      }
      .custom-scrollbar:hover::-webkit-scrollbar-thumb {
        background-color: var(--text-muted);
      }

      /* Forzar color blanco en el icono cuando la fila (group) está en hover */
      .group:hover .hover-icon-container {
        color: #ffffff !important;
      }

      /* Cuando el contenedor está en modo compacto (drawer abierto),
         ocultamos los elementos marcados con "sm:flex" que asumen espacio de sobra. */
      :host-context(.force-compact) {
        .hidden.sm\:flex {
          display: none !important;
        }
      }
    `,
  ],
})
export class LiveClassesPanelComponent {
  readonly classes = input<LiveClassModel[]>([]);
  readonly loading = input<boolean>(false);
  /** Presupuesto de densidad (spec 0028): null = sin límite (desktop). */
  readonly maxItems = input<number | null>(null);
  readonly actionClick = output<LiveClassModel>();
  readonly viewAllClick = output<void>();
  private scrollContainer = viewChild<ElementRef<HTMLUListElement>>('scrollContainer');
  private readonly destroyRef = inject(DestroyRef);

  readonly visibleClasses = computed(() => sliceByBudget(this.classes(), this.maxItems()));
  readonly skeletonItems = computed(() =>
    Array.from({ length: this.maxItems() ?? 5 }, (_, i) => i),
  );

  /** Tick de UI puro (spec 0001-i): re-evalúa isOverdue() cada minuto sin
   * volver a pedir datos — no confundir con el polling de fetch eliminado
   * en fix-004-i. `classes()` solo cambia con datos nuevos (Realtime/SWR);
   * "atrasada" depende del paso del tiempo, así que necesita su propio tick. */
  private readonly _now = signal(new Date());

  constructor() {
    const intervalId = setInterval(() => this._now.set(new Date()), 60_000);
    this.destroyRef.onDestroy(() => clearInterval(intervalId));

    effect(() => {
      const classList = this.visibleClasses();
      const container = this.scrollContainer()?.nativeElement;
      if (classList.length > 0 && container) {
        // Encontrar la primera clase en curso o pendiente para centrarla
        const targetIndex = classList.findIndex(
          (c) => c.status === 'in_progress' || c.status === 'pending',
        );
        if (targetIndex !== -1) {
          // Esperamos a que Angular renderice los items
          setTimeout(() => {
            const items = container.querySelectorAll('.live-class-item');
            const targetEl = items[targetIndex] as HTMLElement;
            if (targetEl) {
              // Scroll para centrar el elemento
              const containerHeight = container.clientHeight;
              const elementOffset = targetEl.offsetTop;
              const elementHeight = targetEl.clientHeight;

              const scrollTo = elementOffset - containerHeight / 2 + elementHeight / 2;

              container.scrollTo({
                top: scrollTo,
                behavior: 'smooth',
              });
            }
          }, 100);
        }
      }
    });
  }

  /** Sesión in_progress cuyo fin agendado (scheduledAt + durationMin) ya pasó
   * hace 15+ min sin cerrarse (spec 0001-i, AC3). Se re-evalúa cada minuto vía
   * `_now` (tick de UI, sin fetch). */
  isOverdue(cls: LiveClassModel): boolean {
    return isSessionOverdue(cls.scheduledAt, cls.durationMin, cls.status, this._now());
  }

  statusLabel(status: string, overdue = false): string {
    if (overdue) return 'Atrasada';
    if (status === 'pending') return 'Por Iniciar';
    if (status === 'in_progress') return 'En Curso';
    return 'Finalizada';
  }

  formatTime(isoString: string): string {
    if (!isoString) return '00:00';
    const date = new Date(isoString);
    return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  getRelativeTime(isoString: string, status: string, overdue = false): string {
    if (!isoString) return '';
    if (status === 'completed') return 'Concluida';
    if (overdue) return 'Cierre atrasado';
    if (status === 'in_progress') return 'Transcurriendo';

    const date = new Date(isoString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();

    if (diffMs <= 0) {
      // status === 'pending' con hora ya pasada: la clase debía iniciar pero
      // nadie la marcó in_progress. "Hace X" a secas se lee como si ya
      // estuviera transcurriendo — contradice la etiqueta "Por Iniciar" (H-008).
      const elapsedMins = Math.floor(-diffMs / 60000);
      if (elapsedMins < 60) return `Debía iniciar hace ${elapsedMins} min`;
      const elapsedHours = Math.floor(elapsedMins / 60);
      return `Debía iniciar hace ${elapsedHours} h`;
    }

    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `En ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    return `En ${diffHours} h`;
  }
}
