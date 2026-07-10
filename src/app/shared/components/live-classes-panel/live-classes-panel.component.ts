import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  ElementRef,
  viewChild,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LiveClassModel } from '@core/models/ui/dashboard.model';
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
    // contain: 'size' oculta el tamaño intrínseco del contenido al Bento Grid.
    // min-height asegura un tamaño base, pero al no tener contenido intrínseco visible para el grid,
    // NO estirará las filas automáticas, sino que se adaptará perfectamente al alto de la celda.
    // El fallback se neutraliza vía @container (ver `styles`), no con `lg:` de Tailwind:
    // el layout-drawer angosta <main> sin cambiar el viewport.
    class: 'flex flex-col gap-3 h-full overflow-hidden w-full min-h-[450px]',
    style: 'contain: size;',
  },
  template: `
    <!-- Header de sección estandarizado -->
    <div class="flex items-center gap-2 mb-2 shrink-0">
      <app-icon name="radio" [size]="16" class="text-error animate-pulse" />
      <h2 class="m-0 font-semibold text-text-primary">Clases Actuales</h2>
    </div>

    @if (loading()) {
      <ul class="m-0 p-0 list-none flex flex-col gap-1 flex-1 min-h-0 overflow-hidden pr-2">
        @for (i of [1, 2, 3, 4, 5]; track i) {
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
        @for (cls of classes(); track cls.id; let i = $index) {
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
                <span class="text-base font-bold text-text-primary leading-none">{{
                  formatTime(cls.scheduledAt)
                }}</span>
                <span
                  class="text-[9px] font-bold uppercase tracking-widest mt-1 transition-colors duration-300"
                  [class.text-warning]="cls.status === 'pending'"
                  [class.text-success]="cls.status === 'in_progress'"
                  [class.text-text-muted]="cls.status === 'completed'"
                >
                  {{ statusLabel(cls.status) }}
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
                    class="text-sm font-semibold text-text-primary truncate"
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
                  [class.text-success]="cls.status === 'in_progress'"
                  [class.text-text-muted]="cls.status === 'completed'"
                >
                  {{ getRelativeTime(cls.scheduledAt, cls.status) }}
                </span>
              </div>

              <div
                class="flex items-center justify-center w-8 h-8 rounded-full transition-all duration-300 group-hover:scale-110 group-hover:shadow-sm hover-icon-container"
                [class.bg-brand]="cls.status === 'in_progress'"
                [class.text-brand-text]="cls.status === 'in_progress'"
                [class.bg-subtle]="cls.status === 'pending' || cls.status === 'completed'"
                [class.text-brand]="cls.status === 'pending'"
                [class.text-text-muted]="cls.status === 'completed'"
              >
                <app-icon
                  [name]="cls.status === 'completed' ? 'chevron-right' : 'play'"
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

      /* El piso de min-height debe neutralizarse según el ancho del *contenedor*
         layoutmain, no del viewport: al abrir el layout-drawer, <main> se angosta
         sin que cambie el viewport (ver dashboard.component.ts, mismo patrón).
         Breakpoint 768px asegura que se active incluso cuando el drawer reduce <main>
         a ~800px en viewports como 1280x720. */
      @container layoutmain (min-width: 768px) {
        :host {
          min-height: 0;
        }
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
  readonly actionClick = output<LiveClassModel>();
  readonly viewAllClick = output<void>();
  private scrollContainer = viewChild<ElementRef<HTMLUListElement>>('scrollContainer');

  constructor() {
    effect(() => {
      const classList = this.classes();
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

  statusLabel(status: string): string {
    if (status === 'pending') return 'Por Iniciar';
    if (status === 'in_progress') return 'En Curso';
    return 'Finalizada';
  }

  formatTime(isoString: string): string {
    if (!isoString) return '00:00';
    const date = new Date(isoString);
    return date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false });
  }

  getRelativeTime(isoString: string, status: string): string {
    if (!isoString) return '';
    if (status === 'completed') return 'Concluida';
    if (status === 'in_progress') return 'Transcurriendo';

    const date = new Date(isoString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    if (diffMs <= 0) return 'Transcurriendo';

    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `En ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    return `En ${diffHours} h`;
  }
}
