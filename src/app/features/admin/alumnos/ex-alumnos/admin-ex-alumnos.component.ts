import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { ExAlumnosFacade } from '@core/facades/ex-alumnos.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import type { EgresadoTableRow } from '@core/models/ui/egresado-table.model';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { AdminExAlumnosTasasDrawerComponent } from './components/stats/admin-ex-alumnos-tasas-drawer.component';
import { AdminExAlumnosComentariosDrawerComponent } from './components/comments/admin-ex-alumnos-comentarios-drawer.component';
import type {
  SectionHeroAction,
  SectionHeroChip,
  SectionHeroKpi,
} from '@core/models/ui/section-hero.model';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';

@Component({
  selector: 'app-admin-ex-alumnos',
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
    BentoGridLayoutDirective,
    CardHoverDirective,
  ],
  template: `
    <div class="bento-grid bento-grid--fill-screen" appBentoGridLayout>
      <!-- ── Hero ── -->
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="facade.isLoading()"
        title="Ex-Alumnos B"
        subtitle="Archivo histórico de egresados de Clase B"
        icon="graduation-cap"
        [actions]="heroActions"
        [chips]="heroChips()"
        [kpis]="heroKpis()"
        (actionClick)="handleHeroAction($event)"
      />

      <!-- Archivo Histórico — full width, celda app-like (scroll interno en desktop) -->
      <div
        class="bento-banner bento-fill card p-0! overflow-hidden flex flex-col dual-viewport-container w-full h-full"
        appCardHover
      >
        <!-- Header -->
        <div class="flex items-center justify-between p-5 border-b border-border-subtle bg-surface">
          <div class="flex items-center gap-3">
            <div
              class="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center text-brand"
            >
              <app-icon name="archive" [size]="18" />
            </div>
            <h2 class="text-sm font-bold text-text-primary m-0">Registro Histórico</h2>
          </div>

          <div class="flex items-center gap-2">
            <div class="hidden lg:flex items-center gap-2">
              <p-select
                [options]="yearSelectOptions()"
                optionLabel="label"
                optionValue="value"
                placeholder="Todos los años"
                [ngModel]="filtroAnio()"
                (ngModelChange)="filtroAnio.set($event)"
                styleClass="w-44"
                appendTo="body"
                data-llm-description="filter ex-students by graduation year"
              />
            </div>
            <div class="w-px h-6 bg-border-subtle mx-1 hidden lg:block"></div>
            <button
              type="button"
              class="p-2 rounded-lg text-text-muted hover:text-text-primary transition-colors flex items-center justify-center cursor-pointer"
              style="--hover-color: var(--ds-brand)"
              (click)="clearFilters()"
              pTooltip="Limpiar Filtros"
              aria-label="Limpiar todos los filtros"
            >
              <app-icon name="filter-x" [size]="16" />
            </button>
          </div>
        </div>

        <!-- Búsqueda -->
        <div class="px-5 py-4 border-b border-border-subtle bg-surface">
          <div class="relative w-full max-w-md">
            <span
              class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none"
            >
              <app-icon name="search" [size]="14" />
            </span>
            <input
              type="text"
              class="search-input"
              placeholder="Buscar por Nombre o RUT..."
              [ngModel]="searchTerm()"
              (ngModelChange)="searchTerm.set($event)"
            />
          </div>
        </div>

        <!-- Tabla / Tarjetas (Dual-Viewport, mismo patrón que app-alumnos-list-content) -->
        <div class="desktop-view hide-on-squeeze flex-1 min-h-0 overflow-x-auto">
          <table class="w-full border-collapse text-sm">
            <thead>
              <tr class="bg-surface">
                <th class="th-col">EGRESADO</th>
                <th class="th-col">LICENCIA</th>
                <th class="th-col">AÑO / SEDE</th>
                <th class="th-col">ESTADO CUENTA</th>
                <th class="w-10"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-border-subtle">
              @if (facade.isLoading()) {
                @for (_ of [1, 2, 3, 4, 5]; track $index) {
                  <tr>
                    <td class="py-4 px-5">
                      <app-skeleton-block variant="text" width="160px" height="12px" />
                    </td>
                    <td class="py-4 px-5">
                      <app-skeleton-block variant="rect" width="60px" height="24px" />
                    </td>
                    <td class="py-4 px-5">
                      <app-skeleton-block variant="text" width="100px" height="12px" />
                    </td>
                    <td class="py-4 px-5">
                      <app-skeleton-block variant="rect" width="80px" height="24px" />
                    </td>
                    <td></td>
                  </tr>
                }
              } @else {
                @for (egresado of filteredEgresados(); track egresado.id) {
                  <tr class="table-row group">
                    <td class="py-4 px-5">
                      <div class="flex flex-col gap-0.5">
                        <span class="font-bold text-text-primary">{{ egresado.nombre }}</span>
                        <span class="text-xs text-text-muted">{{ egresado.rut }}</span>
                      </div>
                    </td>
                    <td class="py-4 px-5">
                      <span class="inas-badge" [attr.data-licencia]="egresado.licencia">
                        {{ egresado.licencia }}
                      </span>
                    </td>
                    <td class="py-4 px-5">
                      <div class="flex flex-col gap-0.5 text-xs">
                        <span class="font-bold text-text-primary">{{ egresado.anio }}</span>
                        <span class="text-text-muted italic">{{ egresado.sede }}</span>
                      </div>
                    </td>
                    <td class="py-4 px-5">
                      @if (egresado.saldoPendiente > 0) {
                        <span class="status-chip status-chip--warn">
                          Debe
                          {{ egresado.saldoPendiente | currency: 'CLP' : 'symbol' : '1.0-0' }}
                        </span>
                      } @else {
                        <span class="status-chip status-chip--success">
                          <app-icon name="check" [size]="10" class="mr-1" /> Al día
                        </span>
                      }
                    </td>
                    <td class="py-4 px-5 text-right">
                      <button
                        type="button"
                        class="rematricular-btn"
                        (click)="reEnroll(egresado)"
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
                    <td colspan="5" class="py-20 text-center">
                      <div class="flex flex-col items-center gap-3 opacity-30">
                        <app-icon name="search-x" [size]="48" />
                        <p class="text-sm font-medium text-text-secondary">
                          No se encontraron egresados con estos criterios
                        </p>
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        <!-- VISTA TARJETAS (Visible cuando se comprime) -->
        <div class="mobile-view show-on-squeeze flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
          @if (facade.isLoading()) {
            @for (_ of [1, 2, 3, 4]; track $index) {
              <app-skeleton-block variant="rect" width="100%" height="76px" />
            }
          } @else {
            @for (egresado of filteredEgresados(); track egresado.id) {
              <div class="flex flex-col gap-2 p-3 rounded-lg border border-border-subtle bg-base">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-bold text-text-primary truncate">
                      {{ egresado.nombre }}
                    </p>
                    <p class="text-xs text-text-muted font-mono truncate">{{ egresado.rut }}</p>
                  </div>
                  <span class="inas-badge shrink-0" [attr.data-licencia]="egresado.licencia">
                    {{ egresado.licencia }}
                  </span>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <div class="text-xs">
                    <span class="font-bold text-text-primary">{{ egresado.anio }}</span>
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
                  (click)="reEnroll(egresado)"
                  data-llm-action="re-enroll-student-card"
                  [attr.aria-label]="'Re-matricular a ' + egresado.nombre"
                >
                  <app-icon name="user-plus" [size]="14" />
                  <span>Re-matricular</span>
                </button>
              </div>
            } @empty {
              <div class="flex flex-col items-center gap-3 opacity-30 py-16">
                <app-icon name="search-x" [size]="40" />
                <p class="text-sm font-medium text-text-secondary">
                  No se encontraron egresados con estos criterios
                </p>
              </div>
            }
          }
        </div>
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

    .search-input {
      width: 100%;
      padding: 9px 12px 9px 36px;
      border-radius: var(--radius-full);
      border: 1px solid var(--border-default);
      background: var(--bg-surface);
      color: var(--text-primary);
      font-size: var(--text-sm);
      outline: none;
      transition: all var(--duration-fast);
    }
    .search-input:focus {
      border-color: var(--ds-brand);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ds-brand) 12%, transparent);
    }

    .th-col {
      text-align: left;
      padding: 12px 20px;
      color: var(--text-muted);
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .table-row {
      transition: background var(--duration-fast);
      cursor: pointer;
    }
    .table-row:hover {
      background: var(--bg-elevated);
    }

    .inas-badge {
      display: inline-flex;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      background: var(--bg-subtle);
      border: 1px solid var(--border-subtle);
    }
    .inas-badge[data-licencia*='B'] {
      color: var(--color-primary);
      background: var(--color-primary-tint);
      border-color: var(--color-primary);
    }
    .inas-badge[data-licencia*='A'] {
      color: var(--state-warning);
      background: var(--state-warning-bg);
      border-color: var(--state-warning-border);
    }

    .status-chip {
      display: inline-flex;
      align-items: center;
      padding: 2px 10px;
      border-radius: var(--radius-full);
      font-size: 11px;
      font-weight: 700;
    }
    .status-chip--warn {
      color: var(--state-warning);
      background: var(--state-warning-bg);
      border: 1px solid var(--state-warning-border);
    }
    .status-chip--success {
      color: var(--state-success);
      background: var(--state-success-bg);
      border: 1px solid var(--state-success-border);
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
export class AdminExAlumnosComponent {
  protected readonly facade = inject(ExAlumnosFacade);
  private readonly branchFacade = inject(BranchFacade);
  private readonly router = inject(Router);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  // ── Hero Config ─────────────────────────────────────────────────────────────
  protected readonly heroActions: SectionHeroAction[] = [
    { id: 'tasas', label: 'Tasas de Aprobación', icon: 'trending-up', primary: false },
    { id: 'opiniones', label: 'Opiniones de Egresados', icon: 'message-square', primary: false },
  ];

  protected handleHeroAction(actionId: string): void {
    switch (actionId) {
      case 'tasas':
        this.layoutDrawer.open(
          AdminExAlumnosTasasDrawerComponent,
          'Tasas de Aprobación',
          'trending-up',
        );
        break;
      case 'opiniones':
        this.layoutDrawer.open(
          AdminExAlumnosComentariosDrawerComponent,
          'Opiniones de Egresados',
          'message-square',
        );
        break;
      default:
        break;
    }
  }

  protected readonly heroChips = computed<SectionHeroChip[]>(() => [
    {
      label: 'Historial Consolidado',
      style: 'default',
      icon: 'archive',
    },
    {
      label: `${this.facade.egresadosClaseB()} Egresados`,
      style: 'success',
      icon: 'circle-check',
    },
  ]);

  // ── Filtros locales ──────────────────────────────────────────────────────────
  protected readonly searchTerm = signal('');
  protected readonly filtroAnio = signal('');
  protected readonly filtroEstado = signal('');

  // ── Lista filtrada (cliente) ─────────────────────────────────────────────────
  protected readonly filteredEgresados = computed<EgresadoTableRow[]>(() => {
    let results: EgresadoTableRow[] = this.facade.egresadosClaseBList();

    const term = this.searchTerm().toLowerCase().trim();
    if (term) {
      results = results.filter(
        (e: EgresadoTableRow) =>
          e.nombre.toLowerCase().includes(term) ||
          e.rut.toLowerCase().includes(term) ||
          (e.nroCertificado?.toLowerCase().includes(term) ?? false),
      );
    }
    if (this.filtroAnio()) {
      results = results.filter((e: EgresadoTableRow) => String(e.anio) === this.filtroAnio());
    }
    return results;
  });

  // ── Opciones de filtros dinámicas ────────────────────────────────────────────
  readonly yearSelectOptions = computed(() =>
    this.availableYears().map((y) => ({ label: y, value: y })),
  );

  protected readonly availableYears = computed<string[]>(() => {
    const years = this.facade
      .egresadosClaseBList()
      .map((e: EgresadoTableRow) => e.anio)
      .filter((y): y is number => y !== null);
    return [...new Set(years)].sort((a: number, b: number) => Number(b) - Number(a)).map(String);
  });

  constructor() {
    effect(() => {
      this.branchFacade.selectedBranchId();
      void this.facade.loadEgresados();
    });
  }

  /** Re-matricula a un egresado: muestra confirmación y luego abre el wizard con datos precargados. */
  protected async reEnroll(egresado: EgresadoTableRow): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: 'Re-matricular alumno',
      message: `Se abrirá el formulario de nueva matrícula con los datos personales de <strong>${egresado.nombre}</strong> precargados. Podrás seleccionar un curso nuevo antes de continuar.`,
      severity: 'info',
      confirmLabel: 'Continuar',
      cancelLabel: 'Cancelar',
    });
    if (!confirmed) return;
    void this.router.navigate(['/app/admin/matricula'], {
      queryParams: { rut: egresado.rut },
    });
  }

  protected readonly heroKpis = computed((): SectionHeroKpi[] => [
    {
      id: 'total',
      label: 'Egresados Clase B',
      value: this.facade.egresadosClaseB(),
      icon: 'graduation-cap',
    },
    {
      id: 'deuda',
      label: 'Con deuda',
      value: this.facade.egresadosClaseBList().filter((e) => e.saldoPendiente > 0).length,
      icon: 'circle-alert',
      color: 'warning',
    },
  ]);

  protected clearFilters(): void {
    this.searchTerm.set('');
    this.filtroAnio.set('');
    this.filtroEstado.set('');
  }
}
