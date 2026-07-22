import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  inject,
  viewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';

import { IconComponent } from '../icon/icon.component';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';
import { SectionHeroComponent } from '../section-hero/section-hero.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { EgresadoTableRow } from '@core/models/ui/egresado-table.model';
import type { SectionHeroKpi } from '@core/models/ui/section-hero.model';

/**
 * Dumb presentacional para Ex-Alumnos Profesional (spec 0016).
 * Recibe la lista ya filtrada a `license_group='professional'` desde el Smart.
 */
@Component({
  selector: 'app-ex-alumnos-profesional-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    FormsModule,
    SelectModule,
    TagModule,
    IconComponent,
    SkeletonBlockComponent,
    SectionHeroComponent,
    EmptyStateComponent,
    BentoGridLayoutDirective,
    CardHoverDirective,
  ],
  template: `
    <div
      class="bento-grid bento-grid--fill-screen"
      appBentoGridLayout
      #bentoGrid
      aria-label="Ex-Alumnos Profesional"
    >
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="isLoading()"
        title="Ex-Alumnos Profesional"
        subtitle="Archivo histórico de egresados de Clase Profesional"
        icon="graduation-cap"
        [backRoute]="backRoute()"
        backLabel="Alumnos Profesional"
        [kpis]="heroKpis()"
        [actions]="[]"
      />

      <div
        class="bento-banner bento-fill card p-0 overflow-hidden flex flex-col dual-viewport-container w-full h-full"
        appCardHover
      >
        <!-- Toolbar -->
        <div class="flex flex-wrap items-center gap-3 p-4 border-b border-border-default">
          <div class="relative flex-1 min-w-52 max-w-xs">
            <app-icon
              name="search"
              [size]="15"
              class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted"
            />
            <input
              type="text"
              placeholder="Buscar por nombre o RUT..."
              class="w-full h-9 pl-8 pr-3 text-sm rounded-lg border border-border-default bg-surface text-text-primary outline-none"
              data-llm-description="Search professional graduates by name or RUT"
              [(ngModel)]="searchTerm"
            />
          </div>
          <p-select
            [options]="claseOptions()"
            [(ngModel)]="selectedClase"
            optionLabel="label"
            optionValue="value"
            placeholder="Todas las clases"
            class="h-9"
            data-llm-description="Filter professional graduates by license class"
          />
          <span class="ml-auto text-sm text-text-muted">
            {{ filtered().length }} resultado{{ filtered().length !== 1 ? 's' : '' }}
          </span>
        </div>

        @if (isLoading()) {
          <div class="desktop-view hide-on-squeeze p-4 space-y-3">
            @for (i of skeletonRows; track i) {
              <app-skeleton-block variant="rect" width="100%" height="44px" />
            }
          </div>
          <div class="mobile-view show-on-squeeze p-4 space-y-2">
            @for (i of skeletonRows; track i) {
              <app-skeleton-block variant="rect" width="100%" height="76px" />
            }
          </div>
        } @else {
          <!-- VISTA 1: TABLA CLÁSICA (Oculta cuando se comprime) -->
          <div class="desktop-view hide-on-squeeze overflow-x-auto">
            <table class="w-full border-collapse text-sm">
              <thead>
                <tr class="bg-subtle text-text-muted uppercase text-xs tracking-wider text-left">
                  <th class="py-3 px-5">Egresado</th>
                  <th class="py-3 px-5">Licencia</th>
                  <th class="py-3 px-5">Año / Sede</th>
                  <th class="py-3 px-5">Estado cuenta</th>
                  <th class="py-3 px-5 w-10"></th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border-subtle">
                @for (egresado of filtered(); track egresado.id) {
                  <tr class="rematricula-row hover:bg-elevated transition-colors">
                    <td class="py-4 px-5">
                      <div class="flex flex-col gap-0.5">
                        <span class="font-bold text-text-primary">{{ egresado.nombre }}</span>
                        <span class="text-xs text-text-muted">{{ egresado.rut }}</span>
                      </div>
                    </td>
                    <td class="py-4 px-5">
                      <span
                        class="text-xs px-2 py-0.5 rounded-full border border-border-subtle text-text-secondary bg-brand-muted"
                        >{{ egresado.licencia }}</span
                      >
                    </td>
                    <td class="py-4 px-5">
                      <div class="flex flex-col gap-0.5 text-xs">
                        <span class="font-bold text-text-primary">{{ egresado.anio ?? '—' }}</span>
                        <span class="text-text-muted italic">{{ egresado.sede }}</span>
                      </div>
                    </td>
                    <td class="py-4 px-5">
                      @if (egresado.saldoPendiente > 0) {
                        <span class="text-xs font-bold text-warning">
                          Debe {{ egresado.saldoPendiente | currency: 'CLP' : 'symbol' : '1.0-0' }}
                        </span>
                      } @else {
                        <span class="text-xs font-bold text-success">Al día</span>
                      }
                    </td>
                    <td class="py-4 px-5 text-right">
                      <button
                        type="button"
                        class="rematricular-btn"
                        (click)="reEnroll.emit(egresado)"
                        data-llm-action="re-enroll-student"
                        [attr.aria-label]="'Re-matricular a ' + egresado.nombre"
                      >
                        <app-icon name="user-plus" [size]="14" />
                        <span>Re-matricular</span>
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" class="p-0">
                      <app-empty-state
                        icon="graduation-cap"
                        message="No hay ex-alumnos profesionales"
                        subtitle="Ajusta la búsqueda o el filtro de clase."
                        actionLabel="Limpiar filtros"
                        actionIcon="refresh-cw"
                        (action)="resetFilters()"
                      />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- VISTA 2: TARJETAS COMPACTAS (Visible cuando se comprime) -->
          <div class="mobile-view show-on-squeeze flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
            @for (egresado of filtered(); track egresado.id) {
              <div class="flex flex-col gap-2 p-3 rounded-lg border border-border-subtle bg-base">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-bold text-text-primary truncate">
                      {{ egresado.nombre }}
                    </p>
                    <p class="text-xs text-text-muted font-mono truncate">{{ egresado.rut }}</p>
                  </div>
                  <p-tag
                    [value]="egresado.licencia"
                    severity="secondary"
                    styleClass="text-2xs shrink-0"
                  />
                </div>
                <div class="flex items-center justify-between gap-2">
                  <div class="text-xs">
                    <span class="font-bold text-text-primary">{{ egresado.anio ?? '—' }}</span>
                    <span class="text-text-muted italic"> · {{ egresado.sede }}</span>
                  </div>
                  @if (egresado.saldoPendiente > 0) {
                    <p-tag
                      [value]="
                        'Debe ' + (egresado.saldoPendiente | currency: 'CLP' : 'symbol' : '1.0-0')
                      "
                      severity="warn"
                      styleClass="text-2xs shrink-0"
                    />
                  } @else {
                    <p-tag value="Al día" severity="success" styleClass="text-2xs shrink-0" />
                  }
                </div>
                <button
                  type="button"
                  class="rematricular-btn w-full justify-center"
                  (click)="reEnroll.emit(egresado)"
                  data-llm-action="re-enroll-student-card"
                  [attr.aria-label]="'Re-matricular a ' + egresado.nombre"
                >
                  <app-icon name="user-plus" [size]="14" />
                  <span>Re-matricular</span>
                </button>
              </div>
            } @empty {
              <app-empty-state
                icon="graduation-cap"
                message="No hay ex-alumnos profesionales"
                subtitle="Ajusta la búsqueda o el filtro de clase."
                actionLabel="Limpiar filtros"
                actionIcon="refresh-cw"
                (action)="resetFilters()"
              />
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    /* Container Queries para Dual-Viewport Render — idéntico al patrón ya
       usado en app-alumnos-list-content / app-alumnos-profesional-list-content. */
    .dual-viewport-container {
      container-type: inline-size;
      container-name: listContainer;
    }

    .show-on-squeeze {
      display: none;
    }

    @container listContainer (max-width: 900px) {
      .hide-on-squeeze {
        display: none !important;
      }
      .show-on-squeeze {
        display: block !important;
      }
    }

    .rematricular-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border-radius: var(--radius-full);
      font-size: 12px;
      font-weight: 700;
      color: var(--ds-brand);
      background: var(--color-primary-tint);
      border: 1px solid color-mix(in srgb, var(--ds-brand) 25%, transparent);
      transition: all var(--duration-fast);
      cursor: pointer;
      white-space: nowrap;
    }
    .rematricular-btn:hover {
      background: var(--ds-brand);
      color: var(--color-primary-text);
    }
  `,
})
export class ExAlumnosProfesionalContentComponent implements AfterViewInit {
  readonly egresados = input.required<EgresadoTableRow[]>();
  readonly isLoading = input(false);
  readonly backRoute = input<string>('/app/admin/clase-profesional/alumnos');
  /** Emite el egresado a re-matricular; el Smart muestra confirmación y navega al wizard (fix-020). */
  readonly reEnroll = output<EgresadoTableRow>();

  private readonly gsap = inject(GsapAnimationsService);
  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  protected readonly skeletonRows = Array(6).fill(0);
  searchTerm = '';
  selectedClase = '';

  readonly claseOptions = computed(() =>
    [...new Set(this.egresados().map((e) => e.licencia))]
      .sort()
      .map((l) => ({ label: l, value: l })),
  );

  readonly heroKpis = computed((): SectionHeroKpi[] => [
    {
      id: 'total',
      label: 'Egresados Profesional',
      value: this.egresados().length,
      icon: 'graduation-cap',
    },
    {
      id: 'deuda',
      label: 'Con deuda',
      value: this.egresados().filter((e) => e.saldoPendiente > 0).length,
      icon: 'circle-alert',
      color: 'warning',
    },
  ]);

  ngAfterViewInit(): void {
    const grid = this.bentoGrid();
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }

  filtered(): EgresadoTableRow[] {
    const term = this.searchTerm.toLowerCase().trim();
    return this.egresados().filter((e) => {
      const matchSearch =
        !term || e.nombre.toLowerCase().includes(term) || e.rut.toLowerCase().includes(term);
      const matchClase = !this.selectedClase || e.licencia === this.selectedClase;
      return matchSearch && matchClase;
    });
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedClase = '';
  }
}
