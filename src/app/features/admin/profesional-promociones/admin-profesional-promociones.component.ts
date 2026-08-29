import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  computed,
  effect,
  inject,
  signal,
  ElementRef,
  viewChild,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BranchFacade } from '@core/facades/branch.facade';
import { PromocionesFacade } from '@core/facades/promociones.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import type { PromocionTableRow, PromocionStatus } from '@core/models/ui/promocion-table.model';
import type { SectionHeroAction, SectionHeroKpi } from '@core/models/ui/section-hero.model';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';

import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { AdminPromocionCrearDrawerComponent } from './admin-promocion-crear-drawer.component';
import { AdminPromocionVerDrawerComponent } from './admin-promocion-ver-drawer.component';
import { AdminPromocionEditarDrawerComponent } from './admin-promocion-editar-drawer.component';
import { getCourseColor } from '@core/utils/course-colors';

/** Prioridad de estado para el orden de la lista: activas primero, planificadas al final. */
const STATUS_ORDER: Record<PromocionStatus, number> = {
  in_progress: 0,
  finished: 1,
  cancelled: 2,
  planned: 3,
};

@Component({
  selector: 'app-admin-profesional-promociones',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    SelectModule,
    TableModule,
    TagModule,
    ButtonModule,
    TooltipModule,
    SectionHeroComponent,
    IconComponent,
    EmptyStateComponent,
    SkeletonBlockComponent,
    BentoGridLayoutDirective,
    CardHoverDirective,
  ],
  template: `
    <div class="bento-grid bento-grid--fill-screen" appBentoGridLayout #bentoGrid>
      <!-- ── Hero ──────────────────────────────────────────────────────────── -->
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="facade.isLoading()"
        title="Promociones Profesionales"
        subtitle="Programación y gestión de ciclos de cursos Clase Profesional"
        [actions]="heroActions()"
        [kpis]="heroKpis()"
        (actionClick)="handleHeroAction($event)"
      />

      <!-- ── Tabla / Tarjetas (Dual-Viewport) ─────────────────────────────── -->
      <div
        class="bento-banner bento-fill card p-0 overflow-hidden flex flex-col w-full h-full dual-viewport-container"
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
              type="search"
              placeholder="Buscar por nombre o código..."
              class="w-full h-9 pl-8 pr-3 text-sm rounded-lg border border-border-default bg-surface text-text-primary outline-none transition-colors"
              [ngModel]="searchTerm()"
              (ngModelChange)="searchTerm.set($event)"
              data-llm-description="Search promotions by name or code"
            />
          </div>

          <p-select
            [options]="estadoOptions"
            optionLabel="label"
            optionValue="value"
            placeholder="Todos los estados"
            [showClear]="true"
            [ngModel]="filtroEstado()"
            (ngModelChange)="filtroEstado.set($event)"
            class="h-9"
            data-llm-description="filter promotions by status"
          />

          <span class="text-xs text-text-muted ml-auto">
            {{ filteredPromociones().length }} promociones encontradas
          </span>
        </div>

        <!-- Contenido -->
        @if (facade.isLoading()) {
          <!-- VISTA Desktop: Tabla skeleton (oculta cuando se comprime) -->
          <div class="desktop-view hide-on-squeeze flex flex-col flex-1 min-h-0 h-full w-full p-4">
            <div class="flex items-center gap-4 py-3 border-b border-border-subtle">
              <app-skeleton-block variant="text" width="24%" height="11px" />
              <app-skeleton-block variant="text" width="18%" height="11px" />
              <app-skeleton-block variant="text" width="12%" height="11px" />
              <app-skeleton-block variant="text" width="16%" height="11px" />
              <app-skeleton-block variant="text" width="10%" height="11px" />
            </div>
            @for (row of [1, 2, 3, 4, 5, 6]; track row) {
              <div class="flex items-center gap-4 py-3 border-b border-border-subtle">
                <div class="flex items-center gap-3 w-[24%]">
                  <app-skeleton-block variant="circle" width="36px" height="36px" />
                  <div class="flex flex-col gap-1.5 flex-1">
                    <app-skeleton-block variant="text" width="75%" height="12px" />
                    <app-skeleton-block variant="text" width="45%" height="10px" />
                  </div>
                </div>
                <app-skeleton-block variant="text" width="18%" height="12px" />
                <app-skeleton-block variant="text" width="12%" height="12px" />
                <div class="flex items-center gap-1">
                  <app-skeleton-block variant="rect" width="28px" height="18px" />
                  <app-skeleton-block variant="rect" width="28px" height="18px" />
                </div>
                <app-skeleton-block variant="rect" width="64px" height="20px" />
                <div class="flex items-center gap-1 ml-auto">
                  <app-skeleton-block variant="circle" width="28px" height="28px" />
                  <app-skeleton-block variant="circle" width="28px" height="28px" />
                </div>
              </div>
            }
          </div>

          <!-- VISTA Mobile: Tarjetas skeleton (visible cuando se comprime) -->
          <div class="mobile-view show-on-squeeze p-4 space-y-4">
            @for (card of [1, 2, 3]; track card) {
              <div class="bg-base border border-border-subtle rounded-xl p-4 space-y-4">
                <div class="flex items-center gap-3">
                  <app-skeleton-block variant="circle" width="40px" height="40px" />
                  <div class="flex flex-col gap-1.5 flex-1">
                    <app-skeleton-block variant="text" width="70%" height="13px" />
                    <app-skeleton-block variant="text" width="40%" height="11px" />
                  </div>
                  <app-skeleton-block variant="rect" width="60px" height="20px" />
                </div>
                <app-skeleton-block variant="text" width="90%" height="11px" />
                <div class="flex flex-wrap gap-2">
                  <app-skeleton-block variant="rect" width="30px" height="18px" />
                  <app-skeleton-block variant="rect" width="30px" height="18px" />
                </div>
              </div>
            }
          </div>
        } @else {
          <!-- VISTA Desktop: Tabla clásica con paginación (oculta cuando se comprime) -->
          <div class="desktop-view hide-on-squeeze flex flex-col flex-1 min-h-0 h-full w-full">
            <p-table
              [value]="filteredPromociones()"
              [rows]="10"
              [paginator]="true"
              [scrollable]="true"
              scrollHeight="flex"
              styleClass="p-datatable-sm h-full flex flex-col"
              [showCurrentPageReport]="true"
              currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} promociones"
            >
              <ng-template pTemplate="header">
                <tr class="micro-label text-left">
                  <th class="pl-6 py-4">Promoción</th>
                  <th>Fechas</th>
                  <th>Alumnos</th>
                  <th>Cursos</th>
                  <th>Estado</th>
                  <th class="pr-6 text-right">Acciones</th>
                </tr>
              </ng-template>
              <ng-template pTemplate="body" let-promo>
                <tr class="list-item-hover transition-colors border-b border-border-subtle">
                  <!-- Promoción -->
                  <td class="pl-6 py-4">
                    <div class="flex items-center gap-3">
                      <div
                        class="w-9 h-9 rounded-full bg-brand-tint text-brand flex items-center justify-center shrink-0"
                      >
                        <app-icon name="calendar" [size]="16" />
                      </div>
                      <div class="flex flex-col min-w-0">
                        <span class="item-title truncate">{{ promo.name }}</span>
                        <span class="text-xs font-mono text-text-muted">{{ promo.code }}</span>
                      </div>
                    </div>
                  </td>
                  <!-- Fechas -->
                  <td class="text-xs text-text-muted whitespace-nowrap">
                    {{ promo.startDate | date: 'dd/MM/yyyy' }} →
                    {{ promo.endDate | date: 'dd/MM/yyyy' }}
                  </td>
                  <!-- Alumnos -->
                  <td class="text-xs text-text-secondary whitespace-nowrap">
                    {{ promo.totalEnrolled }} / {{ promo.maxStudents }}
                  </td>
                  <!-- Cursos -->
                  <td>
                    <div class="flex flex-wrap gap-1.5">
                      @for (curso of promo.cursos; track curso.id) {
                        <span
                          class="course-badge"
                          [style.background]="getCourseColor(curso.courseCode)"
                          [pTooltip]="
                            curso.courseName +
                            ': ' +
                            curso.enrolledStudents +
                            '/' +
                            curso.maxStudents +
                            ' alumnos'
                          "
                        >
                          {{ curso.courseCode }}
                        </span>
                      }
                    </div>
                  </td>
                  <!-- Estado -->
                  <td>
                    <p-tag
                      [value]="statusLabel(promo.status)"
                      [severity]="statusSeverity(promo.status)"
                      styleClass="text-xs font-bold px-2 py-0.5"
                    ></p-tag>
                  </td>
                  <!-- Acciones -->
                  <td class="pr-6 text-right">
                    <div class="inline-flex items-center justify-end gap-0.5">
                      <button
                        aria-label="Ver detalle"
                        pButton
                        class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                        pTooltip="Ver detalle"
                        (click)="openVerDrawer(promo)"
                        data-llm-action="ver-promocion"
                      >
                        <app-icon name="eye" [size]="16" />
                      </button>
                      <button
                        aria-label="Editar promoción"
                        pButton
                        class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                        pTooltip="Editar promoción"
                        (click)="openEditarDrawer(promo)"
                        data-llm-action="editar-promocion"
                      >
                        <app-icon name="edit" [size]="16" />
                      </button>
                    </div>
                  </td>
                </tr>
              </ng-template>
              <ng-template pTemplate="emptymessage">
                <tr>
                  <td colspan="6" class="p-0">
                    <app-empty-state
                      icon="calendar-x"
                      message="No se encontraron promociones"
                      subtitle="Intenta cambiar los términos de búsqueda o filtros."
                      actionLabel="Limpiar Filtros"
                      actionIcon="filter-x"
                      (action)="limpiarFiltros()"
                    />
                  </td>
                </tr>
              </ng-template>
            </p-table>
          </div>

          <!-- VISTA Mobile: Tarjetas apiladas (visible cuando se comprime / drawer abierto) -->
          <div class="mobile-view show-on-squeeze p-4 space-y-4 overflow-y-auto">
            @for (promo of filteredPromociones(); track promo.id) {
              <div class="promo-card p-4 rounded-xl border border-(--border-subtle) relative">
                <!-- Header: icono + nombre/código + estado -->
                <div class="flex items-start justify-between gap-3 mb-3">
                  <div class="flex items-center gap-3 min-w-0">
                    <div
                      class="w-10 h-10 rounded-full bg-brand-tint text-brand flex items-center justify-center shrink-0"
                    >
                      <app-icon name="calendar" [size]="18" />
                    </div>
                    <div class="flex flex-col min-w-0">
                      <h3 class="item-title truncate">{{ promo.name }}</h3>
                      <span class="text-xs font-mono text-text-muted">{{ promo.code }}</span>
                    </div>
                  </div>
                  <p-tag
                    [value]="statusLabel(promo.status)"
                    [severity]="statusSeverity(promo.status)"
                    styleClass="text-2xs font-bold px-2 py-0.5 shrink-0"
                  ></p-tag>
                </div>

                <!-- Meta: fechas + alumnos -->
                <div class="flex items-center gap-4 flex-wrap mb-3">
                  <span class="flex items-center gap-1.5 text-xs text-text-muted">
                    <app-icon name="calendar" [size]="12" />
                    {{ promo.startDate | date: 'dd/MM/yyyy' }} →
                    {{ promo.endDate | date: 'dd/MM/yyyy' }}
                  </span>
                  <span class="flex items-center gap-1.5 text-xs text-text-secondary">
                    <app-icon name="users" [size]="12" />
                    {{ promo.totalEnrolled }} / {{ promo.maxStudents }} alumnos
                  </span>
                </div>

                <!-- Cursos -->
                <div class="flex flex-wrap gap-1.5 mb-3">
                  @for (curso of promo.cursos; track curso.id) {
                    <span
                      class="course-badge"
                      [style.background]="getCourseColor(curso.courseCode)"
                      [pTooltip]="
                        curso.courseName +
                        ': ' +
                        curso.enrolledStudents +
                        '/' +
                        curso.maxStudents +
                        ' alumnos'
                      "
                    >
                      {{ curso.courseCode }}
                    </span>
                  }
                </div>

                <!-- Footer: acciones -->
                <div
                  class="flex items-center justify-between pt-3"
                  style="border-top: 1px dashed var(--border-subtle)"
                >
                  <span class="text-2xs uppercase font-bold text-text-muted">
                    {{ promo.cursos.length }} curso(s)
                  </span>
                  <div class="inline-flex items-center gap-0.5">
                    <button
                      aria-label="Ver detalle"
                      pButton
                      class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                      pTooltip="Ver detalle"
                      (click)="openVerDrawer(promo)"
                      data-llm-action="ver-promocion"
                    >
                      <app-icon name="eye" [size]="16" />
                    </button>
                    <button
                      aria-label="Editar promoción"
                      pButton
                      class="p-button-rounded p-button-text p-button-sm w-8 h-8 p-0 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                      pTooltip="Editar promoción"
                      (click)="openEditarDrawer(promo)"
                      data-llm-action="editar-promocion"
                    >
                      <app-icon name="edit" [size]="16" />
                    </button>
                  </div>
                </div>
              </div>
            } @empty {
              <app-empty-state
                icon="calendar-x"
                message="No se encontraron promociones"
                subtitle="Intenta cambiar los términos de búsqueda o filtros."
                actionLabel="Limpiar Filtros"
                actionIcon="filter-x"
                (action)="limpiarFiltros()"
              />
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .promo-card {
      background: var(--bg-base);
      transition: all var(--duration-fast);
      cursor: default;
    }
    .promo-card:hover {
      border-color: var(--ds-brand);
      box-shadow: var(--shadow-sm);
      transform: translateY(-2px);
    }

    .course-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 26px;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      color: white;
      cursor: default;
    }

    /* Container Queries para Dual-Viewport Render — idéntico a
       app-admin-profesional-relatores para consistencia entre listados. */
    .dual-viewport-container {
      container-type: inline-size;
      container-name: promoContainer;
    }

    .show-on-squeeze {
      display: none;
    }

    @container promoContainer (max-width: 850px) {
      .hide-on-squeeze {
        display: none !important;
      }
      .show-on-squeeze {
        display: block !important;
      }
    }
  `,
})
export class AdminProfesionalPromocionesComponent implements OnInit, OnDestroy, AfterViewInit {
  protected readonly facade = inject(PromocionesFacade);
  private readonly branchFacade = inject(BranchFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly gsap = inject(GsapAnimationsService);

  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  constructor() {
    effect(() => {
      this.branchFacade.selectedBranchId();
      this.facade.initialize();
    });
  }

  ngOnInit(): void {
    this.branchFacade.setProfessionalOnly(true);
  }

  ngOnDestroy(): void {
    this.branchFacade.setProfessionalOnly(false);
  }

  ngAfterViewInit(): void {
    const grid = this.bentoGrid();
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }

  protected limpiarFiltros(): void {
    this.searchTerm.set('');
    this.filtroEstado.set(null);
  }

  // ── Hero ──────────────────────────────────────────────────────────────────
  protected readonly heroActions = computed((): SectionHeroAction[] => [
    { id: 'new', label: 'Programar Promoción', icon: 'plus', primary: true },
  ]);

  protected readonly heroKpis = computed((): SectionHeroKpi[] => [
    {
      id: 'total',
      label: 'Total Promociones',
      value: this.facade.totalPromociones(),
      icon: 'calendar',
    },
    {
      id: 'en-curso',
      label: 'En curso',
      value: this.facade.enCurso(),
      icon: 'play-circle',
      color: 'success',
    },
    { id: 'planificadas', label: 'Planificadas', value: this.facade.planificadas(), icon: 'clock' },
    {
      id: 'canceladas',
      label: 'Canceladas',
      value: this.facade.canceladas(),
      icon: 'ban',
      color: 'warning',
    },
  ]);

  protected handleHeroAction(actionId: string): void {
    if (actionId === 'new') {
      this.layoutDrawer.open(
        AdminPromocionCrearDrawerComponent,
        'Programar Promoción',
        'calendar-plus',
      );
    }
  }

  // ── Filtros locales ────────────────────────────────────────────────────────
  protected readonly searchTerm = signal('');
  protected readonly filtroEstado = signal<string | null>(null);

  readonly estadoOptions = [
    { label: 'Planificada', value: 'planned' },
    { label: 'En curso', value: 'in_progress' },
    { label: 'Finalizada', value: 'finished' },
    { label: 'Cancelada', value: 'cancelled' },
  ];

  // ── Lista filtrada + ordenada (activas primero, planificadas al final) ─────
  protected readonly filteredPromociones = computed<PromocionTableRow[]>(() => {
    let results = this.facade.promociones();

    const term = this.searchTerm().toLowerCase().trim();
    if (term) {
      results = results.filter(
        (p) => p.name.toLowerCase().includes(term) || p.code.toLowerCase().includes(term),
      );
    }
    if (this.filtroEstado()) {
      results = results.filter((p) => p.status === this.filtroEstado());
    }

    // Orden estable: prioridad de estado; dentro de cada grupo se respeta el
    // orden del facade (start_date desc).
    return [...results].sort(
      (a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99),
    );
  });

  protected statusLabel(status: string): string {
    const map: Record<string, string> = {
      planned: 'Planificada',
      in_progress: 'En curso',
      finished: 'Finalizada',
      cancelled: 'Cancelada',
    };
    return map[status] ?? status;
  }

  protected statusSeverity(
    status: string,
  ): 'success' | 'info' | 'warn' | 'danger' | 'secondary' | undefined {
    switch (status) {
      case 'planned':
        return 'warn';
      case 'in_progress':
        return 'success';
      case 'finished':
        return 'info';
      case 'cancelled':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  protected getCourseColor(code: string): string {
    return getCourseColor(code);
  }

  protected openVerDrawer(promo: PromocionTableRow): void {
    this.facade.selectPromocion(promo);
    this.layoutDrawer.open(AdminPromocionVerDrawerComponent, 'Detalle de Promoción', 'eye');
  }

  protected openEditarDrawer(promo: PromocionTableRow): void {
    this.facade.selectPromocion(promo);
    this.layoutDrawer.open(AdminPromocionEditarDrawerComponent, 'Editar Promoción', 'edit');
  }
}
