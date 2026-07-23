import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { ExAlumnosFacade } from '@core/facades/ex-alumnos.facade';

export interface ComentarioMock {
  iniciales: string;
  nombre: string;
  rating: number;
  texto: string;
}

/** Cantidad de opiniones que se revelan por "página" de scroll infinito. */
const PAGE_STEP = 12;

/**
 * Drawer de "Opiniones de Egresados": buscador fijo en el header (nombre,
 * comentario o rating) + scroll infinito sobre la lista ya cargada por
 * `ExAlumnosFacade.surveys()` (sin paginación server-side — la vista carga
 * todas las encuestas de una vez; el scroll infinito aquí es una revelación
 * incremental client-side, mismo espíritu que el "Cargar más" de
 * `app-alumnos-list-content`, pero disparado por scroll en vez de un botón).
 * Self-sufficient (injecta el Facade directo, sin inputs del componente que lo abre).
 */
@Component({
  selector: 'app-admin-ex-alumnos-comentarios-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    IconComponent,
    BadgeComponent,
    SkeletonBlockComponent,
    DrawerContentLoaderComponent,
    EmptyStateComponent,
  ],
  template: `
    <app-drawer-content-loader>
      <ng-template #skeletons>
        <div class="flex flex-col gap-4 p-1">
          <app-skeleton-block variant="rect" width="100%" height="40px" />
          @for (_ of [1, 2, 3, 4]; track $index) {
            <div class="flex items-start gap-3">
              <app-skeleton-block variant="circle" width="40px" height="40px" />
              <div class="flex flex-col gap-1.5 flex-1">
                <app-skeleton-block variant="text" width="40%" height="12px" />
                <app-skeleton-block variant="text" width="90%" height="12px" />
              </div>
            </div>
          }
        </div>
      </ng-template>
      <ng-template #content>
        <div class="h-full min-h-0 flex flex-col">
          <!-- Header fijo: buscador + rating promedio -->
          <div class="shrink-0 flex items-center gap-3 p-1 pb-4">
            <div class="relative flex-1 min-w-0">
              <app-icon
                name="search"
                [size]="14"
                class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted"
              />
              <input
                type="text"
                placeholder="Buscar por nombre, comentario o rating..."
                class="w-full h-9 pl-8 pr-3 text-sm rounded-lg border border-border-default bg-surface text-text-primary outline-none"
                data-llm-description="Search graduate opinions by name, comment or rating"
                [ngModel]="searchTerm()"
                (ngModelChange)="onSearchChange($event)"
              />
            </div>
            <app-badge variant="warning" class="shrink-0">
              <app-icon name="star" [size]="14" />
              <span>{{ facade.avgSatisfaction() }}</span>
            </app-badge>
          </div>

          <!-- Lista con scroll infinito -->
          <div
            class="flex-1 min-h-0 overflow-y-auto pr-1"
            (scroll)="onScroll($event)"
            data-llm-description="infinite scroll list of graduate opinions"
          >
            <div class="flex flex-col divide-y divide-border-subtle">
              @for (comentario of visibleComentarios(); track comentario.nombre + $index) {
                <div class="flex items-start gap-4 py-4">
                  <div
                    class="flex items-center justify-center w-10 h-10 rounded-full shrink-0 text-sm font-bold bg-brand/10 text-brand border border-brand/20 shadow-sm"
                  >
                    {{ comentario.iniciales }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center justify-between gap-2 mb-1.5">
                      <span class="text-sm font-bold text-text-primary truncate">{{
                        comentario.nombre
                      }}</span>
                      <div
                        class="flex items-center gap-0.5 shrink-0"
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
                    <p class="text-xs leading-relaxed text-text-secondary m-0 italic">
                      "{{ comentario.texto }}"
                    </p>
                  </div>
                </div>
              } @empty {
                <app-empty-state
                  icon="message-square-off"
                  message="No hay opiniones que coincidan"
                  subtitle="Ajusta la búsqueda para ver más resultados."
                />
              }
            </div>

            @if (hasMore()) {
              <div class="flex flex-col gap-3 py-3">
                @for (_ of [1, 2]; track $index) {
                  <div class="flex items-start gap-4">
                    <app-skeleton-block variant="circle" width="40px" height="40px" />
                    <div class="flex flex-col gap-1.5 flex-1">
                      <app-skeleton-block variant="text" width="40%" height="12px" />
                      <app-skeleton-block variant="text" width="90%" height="12px" />
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </ng-template>
    </app-drawer-content-loader>
  `,
})
export class AdminExAlumnosComentariosDrawerComponent {
  protected readonly facade = inject(ExAlumnosFacade);

  protected readonly searchTerm = signal('');
  private readonly visibleCount = signal(PAGE_STEP);

  protected readonly filteredComentarios = computed<ComentarioMock[]>(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.facade.surveys();
    return this.facade
      .surveys()
      .filter(
        (c: ComentarioMock) =>
          c.nombre.toLowerCase().includes(term) ||
          c.texto.toLowerCase().includes(term) ||
          String(c.rating).includes(term),
      );
  });

  protected readonly visibleComentarios = computed(() =>
    this.filteredComentarios().slice(0, this.visibleCount()),
  );

  protected readonly hasMore = computed(
    () => this.visibleCount() < this.filteredComentarios().length,
  );

  protected onSearchChange(value: string): void {
    this.searchTerm.set(value);
    this.visibleCount.set(PAGE_STEP);
  }

  /** Revela la siguiente página cuando el scroll se acerca al fondo del contenedor. */
  protected onScroll(event: Event): void {
    if (!this.hasMore()) return;
    const el = event.target as HTMLElement;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 120;
    if (nearBottom) {
      this.visibleCount.update((n) => n + PAGE_STEP);
    }
  }
}
