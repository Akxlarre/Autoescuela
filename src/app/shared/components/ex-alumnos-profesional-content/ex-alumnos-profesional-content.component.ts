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
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';

import { IconComponent } from '../icon/icon.component';
import { SkeletonBlockComponent } from '../skeleton-block/skeleton-block.component';
import { SectionHeroComponent } from '../section-hero/section-hero.component';
import { EmptyStateComponent } from '../empty-state/empty-state.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { sliceByBudget } from '@core/utils/layout-tier.utils';
import { getInitialsFromDisplayName } from '@core/models/ui/user.model';
import type { EgresadoTableRow } from '@core/models/ui/egresado-table.model';
import type { SectionHeroKpi } from '@core/models/ui/section-hero.model';

/**
 * Dumb presentacional para Ex-Alumnos Profesional (spec 0016).
 * Recibe la lista ya filtrada a `license_group='professional'` desde el Smart.
 * Mismo patrón visual que app-alumnos-list-content (fix-084): toolbar + p-table
 * con paginador + tarjetas mobile con "Cargar más".
 */
@Component({
  selector: 'app-ex-alumnos-profesional-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    RouterLink,
    FormsModule,
    SelectModule,
    TagModule,
    TooltipModule,
    TableModule,
    ButtonModule,
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
        class="bento-banner bento-fill card p-0 overflow-hidden shadow-sm dual-viewport-container flex flex-col w-full h-full"
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
              placeholder="Buscar por nombre, RUT o Nº Matrícula..."
              class="w-full h-9 pl-8 pr-3 text-sm rounded-lg border border-border-default bg-surface text-text-primary outline-none transition-colors"
              data-llm-description="Search professional graduates by name, RUT or enrollment number"
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
        </div>

        @if (isLoading()) {
          <div class="viewport-content bg-surface flex flex-col flex-1 min-h-0 h-full w-full">
            <div
              class="desktop-view hide-on-squeeze p-4 space-y-0 flex flex-col flex-1 min-h-0 h-full w-full"
            >
              <div class="flex items-center gap-4 py-3 border-b border-border-subtle">
                @for (i of skeletonRows; track i) {
                  <app-skeleton-block variant="text" width="12%" height="11px" />
                }
              </div>
              @for (i of skeletonRows; track i) {
                <div class="flex items-center gap-4 py-3 border-b border-border-subtle">
                  <div class="flex items-center gap-3 w-[18%]">
                    <app-skeleton-block variant="circle" width="36px" height="36px" />
                    <app-skeleton-block variant="text" width="70%" height="12px" />
                  </div>
                  <app-skeleton-block variant="rect" width="80px" height="24px" />
                </div>
              }
            </div>
            <div class="mobile-view show-on-squeeze p-4 space-y-2">
              @for (i of skeletonRows; track i) {
                <app-skeleton-block variant="rect" width="100%" height="120px" />
              }
            </div>
          </div>
        } @else {
          <div class="viewport-content bg-surface flex flex-col flex-1 min-h-0 h-full w-full">
            <!-- VISTA 1: TABLA (Oculta cuando se comprime) -->
            <div class="desktop-view hide-on-squeeze flex flex-col flex-1 min-h-0 h-full w-full">
              <p-table
                [value]="filtered()"
                [rows]="10"
                [paginator]="true"
                [scrollable]="true"
                scrollHeight="flex"
                responsiveLayout="scroll"
                styleClass="p-datatable-sm p-datatable-striped h-full flex flex-col"
                [showCurrentPageReport]="true"
                currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} egresados"
              >
                <ng-template pTemplate="header">
                  <tr class="micro-label text-left">
                    <th class="pl-6 py-4">Alumno</th>
                    <th>RUT</th>
                    <th>Nº Mat.</th>
                    <th>Licencia</th>
                    <th>Año / Sede</th>
                    <th>Estado cuenta</th>
                    <th class="pr-6 text-right">Acciones</th>
                  </tr>
                </ng-template>
                <ng-template pTemplate="body" let-egresado>
                  <tr class="list-item-hover transition-colors border-b border-border-subtle">
                    <td class="pl-6 py-4">
                      <div class="flex items-center gap-3">
                        <div
                          class="w-9 h-9 rounded-full bg-elevated flex items-center justify-center border border-border-subtle text-text-secondary font-bold text-xs uppercase"
                        >
                          {{ initials(egresado.nombre) }}
                        </div>
                        <div class="flex flex-col">
                          <span class="item-title">{{ egresado.nombre }}</span>
                          <span class="text-xs text-text-muted">{{ egresado.correo }}</span>
                        </div>
                      </div>
                    </td>
                    <td class="text-xs font-medium text-text-secondary font-mono">
                      {{ egresado.rut }}
                    </td>
                    <td class="text-xs text-text-muted font-mono">
                      {{ egresado.nroExpediente ?? '—' }}
                    </td>
                    <td>
                      <span
                        class="text-xs px-2 py-0.5 rounded-full border border-border-subtle text-text-secondary bg-brand-muted"
                        >{{ egresado.licencia }}</span
                      >
                    </td>
                    <td class="text-xs text-text-secondary">
                      <div class="flex flex-col">
                        <span class="font-bold text-text-primary">{{ egresado.anio ?? '—' }}</span>
                        <span class="text-text-muted italic">{{ egresado.sede }}</span>
                      </div>
                    </td>
                    <td>
                      @if (egresado.saldoPendiente > 0) {
                        <p-tag
                          [value]="
                            'Debe ' +
                            (egresado.saldoPendiente | currency: 'CLP' : 'symbol' : '1.0-0')
                          "
                          severity="warn"
                          styleClass="text-xs font-bold px-2 py-0.5"
                        ></p-tag>
                      } @else {
                        <p-tag
                          value="Al día"
                          severity="success"
                          styleClass="text-xs font-bold px-2 py-0.5"
                        ></p-tag>
                      }
                    </td>
                    <td class="pr-6 text-right">
                      <div
                        class="inline-flex items-center justify-end gap-0.5 p-0.5 rounded-lg hover:bg-elevated hover:shadow-sm border border-transparent transition-all"
                      >
                        <button
                          aria-label="Ver ficha"
                          pButton
                          class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                          pTooltip="Ver ficha"
                          [routerLink]="[basePath() + '/alumnos', egresado.studentId]"
                          [queryParams]="{ from: 'ex-alumnos' }"
                          data-llm-action="view-student-detail"
                        >
                          <app-icon name="eye" [size]="16" />
                        </button>
                        <button
                          aria-label="Re-matricular"
                          pButton
                          class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform text-brand"
                          pTooltip="Re-matricular"
                          (click)="reEnroll.emit(egresado)"
                          data-llm-action="re-enroll-student"
                        >
                          <app-icon name="user-plus" [size]="16" />
                        </button>
                      </div>
                    </td>
                  </tr>
                </ng-template>
                <ng-template pTemplate="emptymessage">
                  <tr>
                    <td colspan="7" class="p-0">
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
                </ng-template>
              </p-table>
            </div>

            <!-- VISTA 2: TARJETAS (Visible cuando se comprime) -->
            <div class="mobile-view show-on-squeeze p-4 md:p-6 bg-surface">
              <div class="bento-grid">
                @for (egresado of visibleCards(); track egresado.id) {
                  <div
                    class="flex flex-col bg-base border border-border-subtle rounded-xl overflow-hidden shadow-sm bento-wide"
                    appCardHover
                    data-col-span="4"
                  >
                    <!-- Header -->
                    <div
                      class="p-4 border-b border-border-subtle flex items-start justify-between gap-3"
                    >
                      <div class="flex items-center gap-3 min-w-0">
                        <div
                          class="shrink-0 w-10 h-10 rounded-full bg-surface shadow-sm flex items-center justify-center border border-border-default text-text-primary font-black text-sm uppercase"
                        >
                          {{ initials(egresado.nombre) }}
                        </div>
                        <div class="flex flex-col min-w-0">
                          <span
                            class="item-title truncate"
                            [pTooltip]="egresado.nombre"
                            tooltipPosition="top"
                            >{{ egresado.nombre }}</span
                          >
                          <span
                            class="text-xs text-text-muted truncate"
                            [pTooltip]="egresado.correo"
                            tooltipPosition="top"
                            >{{ egresado.correo }}</span
                          >
                        </div>
                      </div>
                      <p-tag
                        [value]="egresado.licencia"
                        severity="secondary"
                        styleClass="text-2xs font-bold px-2 py-0.5 shrink-0"
                      ></p-tag>
                    </div>

                    <!-- Body -->
                    <div class="p-4 grid grid-cols-2 gap-y-5 gap-x-4 text-sm bg-surface">
                      <div class="flex flex-col">
                        <span class="text-2xs text-text-muted mb-0.5">RUT</span>
                        <span class="font-medium text-text-secondary font-mono text-xs">{{
                          egresado.rut
                        }}</span>
                      </div>
                      <div class="flex flex-col">
                        <span class="text-2xs text-text-muted mb-0.5">Nº Mat.</span>
                        <span class="font-medium text-text-secondary font-mono text-xs">{{
                          egresado.nroExpediente ?? '—'
                        }}</span>
                      </div>
                      <div class="flex flex-col">
                        <span class="text-2xs text-text-muted mb-0.5">Año / Sede</span>
                        <span class="font-medium text-text-secondary text-xs"
                          >{{ egresado.anio ?? '—' }} · {{ egresado.sede }}</span
                        >
                      </div>
                      <div class="flex flex-col">
                        <span class="text-2xs text-text-muted mb-0.5">Estado cuenta</span>
                        @if (egresado.saldoPendiente > 0) {
                          <p-tag
                            [value]="
                              'Debe ' +
                              (egresado.saldoPendiente | currency: 'CLP' : 'symbol' : '1.0-0')
                            "
                            severity="warn"
                            styleClass="text-2xs font-bold px-1.5 py-0.5 w-fit"
                          ></p-tag>
                        } @else {
                          <p-tag
                            value="Al día"
                            severity="success"
                            styleClass="text-2xs font-bold px-1.5 py-0.5 w-fit"
                          ></p-tag>
                        }
                      </div>
                    </div>

                    <!-- Footer Actions -->
                    <div
                      class="p-2 bg-transparent border-t border-border-subtle flex items-center justify-end gap-0.5"
                    >
                      <button
                        aria-label="Ver ficha"
                        pButton
                        class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center text-text-muted hover:text-brand hover:bg-elevated hover:scale-110 active:scale-95 transition-all"
                        pTooltip="Ver ficha"
                        [routerLink]="[basePath() + '/alumnos', egresado.studentId]"
                        [queryParams]="{ from: 'ex-alumnos' }"
                        data-llm-action="view-student-detail-card"
                      >
                        <app-icon name="eye" [size]="16" />
                      </button>
                      <button
                        aria-label="Re-matricular"
                        pButton
                        class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center text-text-muted hover:text-brand hover:bg-elevated hover:scale-110 active:scale-95 transition-all"
                        pTooltip="Re-matricular"
                        (click)="reEnroll.emit(egresado)"
                        data-llm-action="re-enroll-student-card"
                      >
                        <app-icon name="user-plus" [size]="16" />
                      </button>
                    </div>
                  </div>
                } @empty {
                  <div class="col-span-full py-8">
                    <app-empty-state
                      icon="graduation-cap"
                      message="No hay ex-alumnos profesionales"
                      subtitle="Ajusta la búsqueda o el filtro de clase."
                      actionLabel="Limpiar filtros"
                      actionIcon="refresh-cw"
                      (action)="resetFilters()"
                    />
                  </div>
                }

                @if (remainingCards() > 0) {
                  <div class="col-span-full pt-1">
                    <button
                      type="button"
                      class="btn-ghost w-full flex items-center justify-center gap-2 font-medium transition-colors cursor-pointer"
                      (click)="loadMoreCards()"
                      data-llm-action="load-more-egresados"
                    >
                      <app-icon name="chevron-down" [size]="16" />
                      Cargar más ({{ remainingCards() }} restantes)
                    </button>
                  </div>
                }
              </div>
            </div>
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
  `,
})
export class ExAlumnosProfesionalContentComponent implements AfterViewInit {
  readonly egresados = input.required<EgresadoTableRow[]>();
  readonly isLoading = input(false);
  readonly backRoute = input<string>('/app/admin/clase-profesional/alumnos');
  /** Prefijo de ruta para "Ver detalle" — misma ficha que Base Alumnos (admin vs secretaria). */
  readonly basePath = input<string>('/app/admin');
  /** Emite el egresado a re-matricular; el Smart muestra confirmación y navega al wizard (fix-020). */
  readonly reEnroll = output<EgresadoTableRow>();

  private readonly gsap = inject(GsapAnimationsService);
  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  protected readonly skeletonRows = Array(6).fill(0);
  searchTerm = '';
  selectedClase = '';

  /** Densidad incremental de la vista tarjetas (mismo patrón que app-alumnos-list-content). */
  private static readonly CARDS_STEP = 6;
  protected mobileShown = ExAlumnosProfesionalContentComponent.CARDS_STEP;

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
        !term ||
        e.nombre.toLowerCase().includes(term) ||
        e.rut.toLowerCase().includes(term) ||
        (e.nroExpediente?.toLowerCase().includes(term) ?? false);
      const matchClase = !this.selectedClase || e.licencia === this.selectedClase;
      return matchSearch && matchClase;
    });
  }

  visibleCards(): EgresadoTableRow[] {
    return sliceByBudget(this.filtered(), this.mobileShown);
  }

  remainingCards(): number {
    return Math.max(0, this.filtered().length - this.mobileShown);
  }

  loadMoreCards(): void {
    this.mobileShown += ExAlumnosProfesionalContentComponent.CARDS_STEP;
  }

  initials(nombre: string): string {
    return getInitialsFromDisplayName(nombre);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedClase = '';
    this.mobileShown = ExAlumnosProfesionalContentComponent.CARDS_STEP;
  }
}
