import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { CursosSingularesFacade } from '@core/facades/cursos-singulares.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import type { CursoSingularRow } from '@core/models/ui/cursos-singulares.model';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { IconComponent } from '@shared/components/icon/icon.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { formatCLP, formatChileanDate } from '@core/utils/date.utils';
import { AdminCursoSingularDetalleDrawerComponent } from './admin-curso-singular-detalle-drawer.component';
import { AdminCursoSingularCobroDrawerComponent } from './admin-curso-singular-cobro-drawer.component';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { AdminCursoSingularCrearDrawerComponent } from './admin-curso-singular-crear-drawer.component';

// ── Helpers de presentación ────────────────────────────────────────────────────

/** Devuelve estilos semánticos CSS para el badge de tipo. */
function getTipoStyle(tipo: 'sence' | 'particular'): { bg: string; color: string } {
  if (tipo === 'sence') {
    return {
      bg: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
      color: 'var(--color-primary)',
    };
  }
  return {
    bg: 'color-mix(in srgb, var(--color-purple) 12%, transparent)',
    color: 'var(--color-purple)',
  };
}

/** Devuelve estilos semánticos CSS para el badge de estado. */
function getEstadoStyle(estado: string): { bg: string; color: string } {
  switch (estado) {
    case 'active':
      return {
        bg: 'var(--state-success-bg)',
        color: 'var(--state-success)',
      };
    case 'upcoming':
      return {
        bg: 'var(--state-warning-bg)',
        color: 'var(--state-warning)',
      };
    case 'cancelled':
      return {
        bg: 'var(--state-error-bg)',
        color: 'var(--state-error)',
      };
    default: // completed
      return {
        bg: 'var(--bg-elevated)',
        color: 'var(--text-muted)',
      };
  }
}

const ESTADO_LABEL: Record<string, string> = {
  active: 'Activo',
  upcoming: 'Próximo',
  completed: 'Finalizado',
  cancelled: 'Cancelado',
};

const BILLING_LABEL: Record<string, string> = {
  sence_franchise: 'SENCE',
  boleta: 'Boleta',
  factura: 'Factura',
};

@Component({
  selector: 'app-admin-contabilidad-cursos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    SelectModule,
    SectionHeroComponent,
    KpiCardVariantComponent,
    IconComponent,
    BentoGridLayoutDirective,
  ],
  template: `
    <div
      class="bento-grid"
      appBentoGridLayout
      #bentoGrid
      [class.force-compact]="layoutDrawer.isOpen()"
    >
      <!-- ── Hero ──────────────────────────────────────────────────────────── -->
      <app-section-hero
        class="bento-hero"
        title="Cursos Singulares"
        contextLine="Contabilidad"
        subtitle="Cobro simplificado de cursos SENCE, Grúa, Retroexcavadora"
        icon="graduation-cap"
        [actions]="heroActions"
        (actionClick)="onHeroAction($event)"
      />

      <!-- ── KPIs Bento ─────────────────────────────────────────────────────── -->
      <div class="bento-square">
        <app-kpi-card-variant
          [value]="facade.kpis().cursosActivos"
          label="Cursos Activos"
          icon="graduation-cap"
          [trendLabel]="'de ' + facade.kpis().totalCursos + ' totales'"
          [loading]="facade.isLoading()"
          [accent]="true"
        />
      </div>

      <div class="bento-square">
        <app-kpi-card-variant
          [value]="facade.kpis().totalInscritos"
          label="Total Inscritos"
          icon="users"
          trendLabel="en todos los cursos"
          [loading]="facade.isLoading()"
        />
      </div>

      <div class="bento-square">
        <app-kpi-card-variant
          [value]="facade.kpis().ingresosCobrados"
          label="Ingresos Cobrados"
          icon="dollar-sign"
          prefix="$"
          subValue="dinero recibido real"
          color="success"
          [loading]="facade.isLoading()"
        />
      </div>

      <div class="bento-square">
        <app-kpi-card-variant
          [value]="facade.kpis().porCobrar"
          label="Por Cobrar"
          icon="clock"
          prefix="$"
          subValue="saldos pendientes"
          [color]="facade.kpis().porCobrar > 0 ? 'warning' : 'default'"
          [loading]="facade.isLoading()"
        />
      </div>

      <!-- ── Contenido Principal (Listado) ─────────────────────────────────── -->
      <div class="bento-banner">
        <section class="card pb-10" aria-label="Listado de cursos singulares">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div class="flex items-center gap-2">
              <app-icon name="list" [size]="18" color="var(--ds-brand)" />
              <h2 class="font-bold text-text-primary">Listado de Cursos</h2>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              <p-select
                [options]="tipoOptions"
                optionLabel="label"
                optionValue="value"
                [ngModel]="_filtroTipo()"
                (ngModelChange)="_filtroTipo.set($event)"
                styleClass="flex-1 min-w-36"
                data-llm-description="Filtro por tipo de curso: SENCE o Particular"
              />
              <p-select
                [options]="estadoOptions"
                optionLabel="label"
                optionValue="value"
                [ngModel]="_filtroEstado()"
                (ngModelChange)="_filtroEstado.set($event)"
                styleClass="flex-1 min-w-36"
                data-llm-description="Filtro por estado del curso: Activo, Próximo, Finalizado, Cancelado"
              />
            </div>
          </div>

          <!-- ══ VISTA MOBILE (< lg): cards apiladas ══════════════════════════════ -->
          <div class="lg:hidden flex flex-col gap-3">
            @if (facade.isLoading()) {
              @for (i of skeletonRows; track i) {
                <div class="rounded-xl p-4 flex flex-col gap-3 border border-border-muted">
                  <div class="h-4 rounded w-3/4 bg-text-muted/14"></div>
                  <div class="h-3 rounded w-1/2 bg-text-muted/10"></div>
                  <div class="h-8 rounded w-full bg-text-muted/8"></div>
                </div>
              }
            } @else if (cursosFiltrados().length === 0) {
              <div class="py-12 text-center">
                <p class="text-sm text-text-muted">
                  No hay cursos que coincidan con los filtros seleccionados.
                </p>
              </div>
            } @else {
              @for (curso of cursosFiltrados(); track curso.id) {
                <div class="rounded-xl border overflow-hidden border-border-muted bg-surface">
                  <!-- Cabecera de card: nombre + badges -->
                  <div class="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="text-sm font-semibold truncate text-text-primary">
                        {{ curso.nombre }}
                      </p>
                      <p class="text-xs mt-0.5 text-text-muted">
                        Inicio: {{ formatChileanDate(curso.inicio) }}
                      </p>
                    </div>
                    <div class="shrink-0 flex items-center gap-1.5">
                      <!-- Badge tipo -->
                      <span
                        class="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold"
                        [style.background]="getTipoStyle(curso.tipo).bg"
                        [style.color]="getTipoStyle(curso.tipo).color"
                      >
                        {{ curso.tipo === 'sence' ? 'SENCE' : 'Part.' }}
                      </span>
                      <!-- Badge estado -->
                      <span
                        class="inline-flex px-2 py-0.5 rounded-full text-xs font-medium"
                        [style.background]="getEstadoStyle(curso.estado).bg"
                        [style.color]="getEstadoStyle(curso.estado).color"
                      >
                        {{ estadoLabel(curso.estado) }}
                      </span>
                    </div>
                  </div>

                  <!-- Grid de datos clave (3 cols) -->
                  <div class="grid grid-cols-3 divide-x px-0 border-t border-b border-border-muted">
                    <div class="py-3 px-4 flex flex-col gap-0.5">
                      <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">
                        Precio
                      </p>
                      <p class="text-sm font-bold text-text-primary">
                        {{ formatCLP(curso.precio) }}
                      </p>
                    </div>
                    <div class="py-3 px-4 flex flex-col gap-0.5 text-center">
                      <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">
                        Inscritos
                      </p>
                      <p class="text-sm font-bold text-text-primary">
                        {{ curso.inscritos
                        }}<span class="text-xs font-normal text-text-muted"
                          >/{{ curso.cupos }}</span
                        >
                      </p>
                    </div>
                    <div class="py-3 px-4 flex flex-col gap-0.5 text-right">
                      <p class="text-xs font-semibold uppercase tracking-wide text-text-muted">
                        Cobrado
                      </p>
                      <p
                        class="text-sm font-bold"
                        [style.color]="
                          curso.ingresoCobrado > 0 ? 'var(--state-success)' : 'var(--text-muted)'
                        "
                      >
                        {{ formatCLP(curso.ingresoCobrado) }}
                      </p>
                      @if (curso.porCobrar > 0) {
                        <p class="text-xs" [style.color]="'var(--state-warning)'">
                          {{ formatCLP(curso.porCobrar) }} pendiente
                        </p>
                      }
                    </div>
                  </div>

                  <!-- Fila secundaria: Duración + Facturación -->
                  <div class="px-4 py-2 flex items-center gap-4">
                    <p class="text-xs text-text-muted">
                      <span class="font-semibold text-text-secondary"
                        >{{ curso.duracionHoras }} hrs</span
                      >
                      · {{ billingLabel(curso.billingType) }}
                    </p>
                  </div>

                  <!-- Footer: Acciones full-width -->
                  <div class="px-4 pb-4 flex gap-2">
                    <button
                      class="flex-1 flex items-center justify-center gap-2 h-9 rounded-full text-xs font-semibold border transition-colors cursor-pointer border-border-muted text-text-secondary"
                      data-llm-action="view-curso-singular"
                      (click)="onVerDetalle(curso)"
                    >
                      <app-icon name="eye" [size]="14" />
                      Ver detalle
                    </button>
                    <button
                      class="flex-1 flex items-center justify-center gap-2 h-9 rounded-full text-xs font-semibold transition-colors cursor-pointer text-success bg-success/12"
                      data-llm-action="registrar-cobro-singular"
                      (click)="onRegistrarCobro(curso)"
                    >
                      <app-icon name="dollar-sign" [size]="14" />
                      Registrar cobro
                    </button>
                  </div>
                </div>
              }

              <!-- Totales móvil -->
              <div
                class="rounded-xl px-4 py-3 flex items-center justify-between border-t-2 bg-surface border-border-muted"
              >
                <span class="text-sm font-bold text-text-primary">TOTAL</span>
                <div class="flex items-center gap-4">
                  <span class="text-xs text-text-muted">
                    <strong class="text-text-primary">{{ totales().inscritos }}</strong>
                    inscritos
                  </span>
                  <span class="text-sm font-bold text-success">
                    {{ formatCLP(totales().cobrado) }}
                  </span>
                </div>
              </div>
            }
          </div>

          <!-- ══ VISTA DESKTOP (≥ lg): tabla clásica ═══════════════════════════ -->
          <div class="hidden lg:block overflow-x-auto">
            <table class="w-full" role="table" aria-label="Cursos singulares">
              <thead>
                <tr class="border-b border-border-muted">
                  @for (col of columnas; track col) {
                    <th
                      class="py-3 px-4 text-xs font-semibold uppercase tracking-wide"
                      [class.text-left]="col.align === 'left'"
                      [class.text-right]="col.align === 'right'"
                      [class.text-center]="col.align === 'center'"
                      class="text-text-muted"
                    >
                      {{ col.label }}
                    </th>
                  }
                </tr>
              </thead>

              <tbody class="divide-y border-border-muted">
                @if (facade.isLoading()) {
                  @for (i of skeletonRows; track i) {
                    <tr>
                      @for (col of columnas; track col) {
                        <td class="py-3 px-4">
                          <div class="h-4 rounded w-full bg-text-muted/14"></div>
                        </td>
                      }
                    </tr>
                  }
                } @else if (cursosFiltrados().length === 0) {
                  <tr>
                    <td [attr.colspan]="columnas.length" class="py-12 text-center">
                      <p class="text-sm text-text-muted">
                        No hay cursos que coincidan con los filtros seleccionados.
                      </p>
                    </td>
                  </tr>
                } @else {
                  @for (curso of cursosFiltrados(); track curso.id) {
                    <tr class="curso-row transition-colors">
                      <td class="py-3 px-4">
                        <p class="text-sm font-medium text-text-primary">
                          {{ curso.nombre }}
                        </p>
                        <p class="text-xs mt-0.5 text-text-muted">
                          Inicio: {{ formatChileanDate(curso.inicio) }}
                        </p>
                      </td>
                      <td class="py-3 px-4 text-center">
                        <span
                          class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                          [style.background]="getTipoStyle(curso.tipo).bg"
                          [style.color]="getTipoStyle(curso.tipo).color"
                          >{{ curso.tipo === 'sence' ? 'SENCE' : 'Particular' }}</span
                        >
                      </td>
                      <td class="py-3 px-4 text-right">
                        <span class="text-sm font-semibold text-text-primary">{{
                          formatCLP(curso.precio)
                        }}</span>
                      </td>
                      <td class="py-3 px-4 text-center">
                        <span class="text-sm text-text-secondary"
                          >{{ curso.duracionHoras }} hrs</span
                        >
                      </td>
                      <td class="py-3 px-4 text-center">
                        <span class="text-sm font-medium text-text-primary">{{
                          curso.inscritos
                        }}</span>
                        <span class="text-xs text-text-muted">/{{ curso.cupos }}</span>
                      </td>
                      <td class="py-3 px-4 text-center">
                        <span
                          class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium"
                          [style.background]="getEstadoStyle(curso.estado).bg"
                          [style.color]="getEstadoStyle(curso.estado).color"
                          >{{ estadoLabel(curso.estado) }}</span
                        >
                      </td>
                      <td class="py-3 px-4 text-center">
                        <span
                          class="text-xs font-medium"
                          [style.color]="
                            curso.tipo === 'sence' ? 'var(--color-primary)' : 'var(--text-muted)'
                          "
                          >{{ billingLabel(curso.billingType) }}</span
                        >
                      </td>
                      <td class="py-3 px-4 text-right">
                        <span
                          class="text-sm font-bold"
                          [style.color]="
                            curso.ingresoCobrado > 0 ? 'var(--state-success)' : 'var(--text-muted)'
                          "
                          >{{ formatCLP(curso.ingresoCobrado) }}</span
                        >
                        @if (curso.porCobrar > 0) {
                          <p class="text-xs" [style.color]="'var(--state-warning)'">
                            {{ formatCLP(curso.porCobrar) }} pend.
                          </p>
                        }
                      </td>
                      <td class="py-3 px-4 text-center">
                        <div class="flex items-center justify-center gap-1">
                          <button
                            class="accion-btn accion-btn--ver p-1.5 rounded transition-colors cursor-pointer text-text-muted"
                            title="Ver detalle"
                            data-llm-action="view-curso-singular"
                            (click)="onVerDetalle(curso)"
                          >
                            <app-icon name="eye" [size]="16" />
                          </button>
                          <button
                            class="accion-btn accion-btn--cobro p-1.5 rounded transition-colors cursor-pointer text-text-muted"
                            title="Registrar cobro"
                            data-llm-action="registrar-cobro-singular"
                            (click)="onRegistrarCobro(curso)"
                          >
                            <app-icon name="dollar-sign" [size]="16" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  }
                }
              </tbody>

              @if (!facade.isLoading() && cursosFiltrados().length > 0) {
                <tfoot>
                  <tr class="border-t-2 border-border-muted bg-surface">
                    <td class="py-3 px-4 text-sm font-bold text-text-primary">TOTAL</td>
                    <td colspan="3"></td>
                    <td class="py-3 px-4 text-center text-sm font-bold text-text-primary">
                      {{ totales().inscritos }}
                    </td>
                    <td colspan="2"></td>
                    <td class="py-3 px-4 text-right text-sm font-bold text-success">
                      {{ formatCLP(totales().cobrado) }}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              }
            </table>
          </div>

          <!-- Nota informativa -->
          <div
            class="mt-4 px-4 py-3 rounded-lg text-xs text-text-secondary bg-brand/6 border border-brand/20"
          >
            <strong class="text-brand">SENCE:</strong>
            Los cursos SENCE se facturan directamente al organismo. El cobro al alumno es $0 si está
            100% financiado.&nbsp;&nbsp;
            <strong class="text-text-primary">Particular:</strong>
            Se emite boleta por el monto total al inscrito.
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [
    `
      .curso-row:hover {
        background: color-mix(in srgb, var(--color-primary) 4%, transparent);
      }
      .accion-btn--ver:hover {
        color: var(--color-primary);
        background: color-mix(in srgb, var(--color-primary) 10%, transparent);
      }
      .accion-btn--cobro:hover {
        color: var(--state-success);
        background: color-mix(in srgb, var(--state-success) 10%, transparent);
      }
    `,
  ],
})
export class AdminContabilidadCursosComponent implements OnInit, AfterViewInit {
  protected readonly facade = inject(CursosSingularesFacade);
  private readonly branchFacade = inject(BranchFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly gsap = inject(GsapAnimationsService);

  // ── Helpers expuestos al template ──────────────────────────────────────────
  protected readonly formatCLP = formatCLP;
  protected readonly formatChileanDate = formatChileanDate;
  protected readonly getTipoStyle = getTipoStyle;
  protected readonly getEstadoStyle = getEstadoStyle;

  // ── Columnas de tabla ──────────────────────────────────────────────────────
  protected readonly columnas = [
    { label: 'Curso', align: 'left' as const },
    { label: 'Tipo', align: 'center' as const },
    { label: 'Precio', align: 'right' as const },
    { label: 'Duración', align: 'center' as const },
    { label: 'Inscritos', align: 'center' as const },
    { label: 'Estado', align: 'center' as const },
    { label: 'Facturación', align: 'center' as const },
    { label: 'Cobrado', align: 'right' as const },
    { label: 'Acciones', align: 'center' as const },
  ];

  protected readonly skeletonRows = [1, 2, 3, 4];

  // ── Filtros ────────────────────────────────────────────────────────────────
  protected readonly _filtroTipo = signal<string>('');

  readonly tipoOptions = [
    { label: 'Todos los tipos', value: '' },
    { label: 'SENCE', value: 'sence' },
    { label: 'Particular', value: 'particular' },
  ];

  readonly estadoOptions = [
    { label: 'Todos los estados', value: '' },
    { label: 'Activo', value: 'active' },
    { label: 'Próximo', value: 'upcoming' },
    { label: 'Finalizado', value: 'completed' },
    { label: 'Cancelado', value: 'cancelled' },
  ];

  protected readonly _filtroEstado = signal<string>('');

  /** Cursos filtrados según los selects activos. */
  protected readonly cursosFiltrados = computed<CursoSingularRow[]>(() => {
    const tipo = this._filtroTipo();
    const estado = this._filtroEstado();
    return this.facade.cursos().filter((c) => {
      if (tipo && c.tipo !== tipo) return false;
      if (estado && c.estado !== estado) return false;
      return true;
    });
  });

  /** Totales de la fila footer de la tabla filtrada — mismo criterio que los KPIs. */
  protected readonly totales = computed(() => {
    const lista = this.cursosFiltrados();
    return {
      inscritos: lista.reduce((s, c) => s + c.inscritos, 0),
      cobrado: lista.reduce((s, c) => s + c.ingresoCobrado, 0),
      porCobrar: lista.reduce((s, c) => s + c.porCobrar, 0),
    };
  });

  // ── GSAP refs ─────────────────────────────────────────────────────────────
  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  constructor() {
    // Reactividad de sede: el initialize() del facade detecta el cambio de
    // branch (_lastBranchId) y recarga la lista con skeleton (facades.md §7).
    effect(() => {
      this.branchFacade.selectedBranchId(); // tracking
      void this.facade.initialize();
    });
  }

  ngOnInit(): void {
    void this.facade.initialize();
  }

  ngAfterViewInit(): void {
    const grid = this.bentoGrid();
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }

  // ── Hero actions ───────────────────────────────────────────────────────────
  protected readonly heroActions: SectionHeroAction[] = [
    {
      id: 'nuevo-curso',
      label: 'Nuevo Curso',
      icon: 'plus',
      primary: true,
    },
  ];

  protected onHeroAction(actionId: string): void {
    if (actionId === 'nuevo-curso') {
      this.layoutDrawer.open(
        AdminCursoSingularCrearDrawerComponent,
        'Nuevo Curso Especial',
        'graduation-cap',
      );
    }
  }

  protected onVerDetalle(curso: CursoSingularRow): void {
    void this.facade.selectCurso(curso);
    this.layoutDrawer.open(
      AdminCursoSingularDetalleDrawerComponent,
      curso.nombre,
      'graduation-cap',
    );
  }

  protected onRegistrarCobro(curso: CursoSingularRow): void {
    void this.facade.selectCurso(curso);
    this.layoutDrawer.open(
      AdminCursoSingularCobroDrawerComponent,
      'Registrar Cobro',
      'dollar-sign',
    );
  }

  // ── Helpers de label ───────────────────────────────────────────────────────

  protected estadoLabel(estado: string): string {
    return ESTADO_LABEL[estado] ?? estado;
  }

  protected billingLabel(bt: string): string {
    return BILLING_LABEL[bt] ?? bt;
  }
}
