import { TooltipModule } from 'primeng/tooltip';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '@shared/components/icon/icon.component';
import { Button } from 'primeng/button';
import { CardHoverDirective } from '@core/directives/card-hover.directive';

export interface ComentarioMock {
  iniciales: string;
  nombre: string;
  rating: number;
  texto: string;
}

@Component({
  selector: 'app-admin-ex-alumnos-comments',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TooltipModule, CommonModule, IconComponent, Button, CardHoverDirective],
  template: `
    <div
      class="bento-card bento-tall p-6 flex flex-col h-full bg-surface overflow-hidden"
      appCardHover
    >
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div class="flex flex-col">
          <h3 class="text-base font-bold text-text-primary m-0">Opiniones de Egresados</h3>
          <span class="text-2xs text-text-muted font-bold uppercase tracking-widest mt-0.5"
            >Encuestas de Satisfacción</span
          >
        </div>
        <div
          class="flex items-center gap-2 px-3 py-1.5 rounded-full bg-warning/10 border border-warning/20 text-warning text-xs font-bold shadow-sm"
        >
          <app-icon name="star" [size]="14" />
          <span>{{ avgRate() }}</span>
        </div>
      </div>

      <!-- Content -->
      <div class="flex flex-col flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-2">
        <div class="flex flex-col divide-y divide-border-subtle">
          @for (comentario of comentarios(); track comentario.nombre) {
            <div class="flex items-start gap-4 py-4 group transition-all hover:translate-x-1">
              <!-- Avatar -->
              <div
                class="flex items-center justify-center w-10 h-10 rounded-full shrink-0 text-sm font-bold bg-brand/10 text-brand border border-brand/20 shadow-sm"
              >
                {{ comentario.iniciales }}
              </div>

              <!-- Review -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2 mb-1.5">
                  <span
                    class="text-sm font-bold text-text-primary truncate"
                    [pTooltip]="comentario.nombre"
                    tooltipPosition="top"
                    >{{ comentario.nombre }}</span
                  >
                  <!-- Ratings -->
                  <div
                    class="flex items-center gap-0.5"
                    role="img"
                    [attr.aria-label]="'Calificación: ' + comentario.rating + ' de 5 estrellas'"
                  >
                    @for (star of [1, 2, 3, 4, 5]; track star) {
                      <app-icon
                        name="star"
                        [size]="12"
                        [color]="
                          star <= comentario.rating
                            ? 'var(--state-warning)'
                            : 'var(--border-default)'
                        "
                      />
                    }
                  </div>
                </div>
                <p
                  class="text-xs leading-relaxed text-text-secondary m-0 line-clamp-3 md:line-clamp-none italic"
                >
                  "{{ comentario.texto }}"
                </p>
              </div>
            </div>
          } @empty {
            <div class="flex flex-col items-center justify-center py-12 gap-3 opacity-40">
              <app-icon name="message-square-off" [size]="32" />
              <p class="text-xs font-medium text-center">No hay comentarios previos registrados</p>
            </div>
          }
        </div>
      </div>

      <!-- Footer Buttons -->
      <div class="mt-auto pt-6 border-t border-border-subtle/50">
        <p-button
          label="Ver todas las encuestas"
          icon="pi pi-external-link"
          size="small"
          [text]="true"
          class="w-full"
          ariaLabel="Acceder a sección de encuestas detalladas"
        />
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .custom-scrollbar::-webkit-scrollbar {
      width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: var(--border-default);
      border-radius: 10px;
    }
  `,
})
export class AdminExAlumnosCommentsComponent {
  readonly comentarios = input<ComentarioMock[]>([]);
  readonly avgRate = input<number>(0);
}
