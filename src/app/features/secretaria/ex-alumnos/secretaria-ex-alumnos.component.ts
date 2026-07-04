import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { ExAlumnosFacade } from '@core/facades/ex-alumnos.facade';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import type { EgresadoTableRow } from '@core/models/ui/egresado-table.model';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { AdminStatsPanelComponent } from '../../admin/alumnos/ex-alumnos/components/stats/admin-ex-alumnos-stats.component';
import { AdminExAlumnosCommentsComponent } from '../../admin/alumnos/ex-alumnos/components/comments/admin-ex-alumnos-comments.component';
import type {
  SectionHeroAction,
  SectionHeroChip,
  SectionHeroKpi,
} from '@core/models/ui/section-hero.model';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';

@Component({
  selector: 'app-secretaria-ex-alumnos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    FormsModule,
    SelectModule,
    IconComponent,
    SkeletonBlockComponent,
    SectionHeroComponent,
    AdminStatsPanelComponent,
    AdminExAlumnosCommentsComponent,
    BentoGridLayoutDirective,
    CardHoverDirective,
  ],
  template: `
    <div class="bento-grid" appBentoGridLayout>
      <!-- ── Hero ── -->
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="facade.isLoading()"
        title="Ex-Alumnos B"
        subtitle="Archivo histórico de egresados de Clase B"
        icon="graduation-cap"
        backRoute="/app/secretaria/alumnos"
        backLabel="Alumnos"
        [actions]="heroActions"
        [chips]="heroChips()"
        [kpis]="heroKpis()"
        (actionClick)="handleHeroAction($event)"
      />

      <!-- Archivo Histórico — full width, 1 row -->
      <div class="bento-banner card p-0! overflow-hidden flex flex-col" appCardHover>
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
                [ngModel]="filtroAnio()"
                (ngModelChange)="filtroAnio.set($event)"
                styleClass="w-32"
                data-llm-description="filter ex-students by graduation year"
              />
              <p-select
                [options]="licenciaSelectOptions()"
                optionLabel="label"
                optionValue="value"
                [ngModel]="filtroLicencia()"
                (ngModelChange)="filtroLicencia.set($event)"
                styleClass="w-32"
                data-llm-description="filter ex-students by license class"
              />
            </div>
            <div class="w-px h-6 bg-border-subtle mx-1 hidden lg:block"></div>
            <button
              type="button"
              class="p-2 rounded-lg text-text-muted hover:text-text-primary transition-colors flex items-center justify-center"
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

        <!-- Tabla -->
        <div class="flex-1 min-h-0 overflow-x-auto">
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
      </div>

      <!-- Estadísticas Detalladas -->
      <app-admin-stats-panel
        class="bento-wide"
        [municipalRate]="facade.municipalApprovalRate()"
        [psychoRate]="facade.psychoApprovalRate()"
        [totalExams]="facade.totalExamenes()"
        [egresadosTotal]="facade.annualEgresadosTotal()"
        [licensesTotal]="facade.annualLicensesTotal()"
        [successRate]="facade.successConversionRate()"
      />

      <!-- Comentarios y Feedback -->
      <app-admin-ex-alumnos-comments
        class="bento-wide"
        [comentarios]="facade.surveys()"
        [avgRate]="facade.avgSatisfaction()"
      />
    </div>
  `,
  styles: `
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
export class SecretariaExAlumnosComponent implements OnInit {
  protected readonly facade = inject(ExAlumnosFacade);
  private readonly router = inject(Router);
  private readonly confirmModal = inject(ConfirmModalService);

  // ── Hero Config ─────────────────────────────────────────────────────────────
  protected readonly heroActions: SectionHeroAction[] = [
    { id: 'exportar', label: 'Exportar Archivo', icon: 'download', primary: false },
    {
      id: 'activos',
      label: 'Ver Alumnos Activos',
      icon: 'users',
      primary: true,
      route: '/app/secretaria/alumnos',
    },
  ];

  protected readonly heroChips = computed<SectionHeroChip[]>(() => [
    { label: 'Historial Consolidado', style: 'default', icon: 'archive' },
    { label: `${this.facade.egresadosClaseB()} Egresados`, style: 'success', icon: 'circle-check' },
  ]);

  // ── Filtros locales ──────────────────────────────────────────────────────────
  protected readonly searchTerm = signal('');
  protected readonly filtroAnio = signal('');
  protected readonly filtroLicencia = signal('');

  // ── Lista filtrada (cliente) — solo Clase B ─────────────────────────────────
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
    if (this.filtroLicencia()) {
      results = results.filter((e: EgresadoTableRow) => e.licencia === this.filtroLicencia());
    }
    return results;
  });

  readonly yearSelectOptions = computed(() => [
    { label: 'Todos los años', value: '' },
    ...this.availableYears().map((y) => ({ label: y, value: y })),
  ]);

  readonly licenciaSelectOptions = computed(() => [
    { label: 'Todas las licencias', value: '' },
    ...this.availableLicencias().map((l) => ({ label: l, value: l })),
  ]);

  protected readonly availableYears = computed<string[]>(() => {
    const years = this.facade
      .egresadosClaseBList()
      .map((e: EgresadoTableRow) => e.anio)
      .filter((y): y is number => y !== null);
    return [...new Set(years)].sort((a: number, b: number) => Number(b) - Number(a)).map(String);
  });

  protected readonly availableLicencias = computed<string[]>(() =>
    [...new Set(this.facade.egresadosClaseBList().map((e: EgresadoTableRow) => e.licencia))].sort(),
  );

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

  ngOnInit(): void {
    void this.facade.loadEgresados();
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
    void this.router.navigate(['/app/secretaria/matricula'], {
      queryParams: { rut: egresado.rut },
    });
  }

  protected handleHeroAction(actionId: string): void {
    if (actionId === 'exportar') {
      // eslint-disable-next-line no-console
      console.log('[ExAlumnos] Exportando archivo histórico...');
    }
  }

  protected clearFilters(): void {
    this.searchTerm.set('');
    this.filtroAnio.set('');
    this.filtroLicencia.set('');
  }
}
