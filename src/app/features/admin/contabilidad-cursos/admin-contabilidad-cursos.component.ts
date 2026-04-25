import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { CursosSingularesFacade } from '@core/facades/cursos-singulares.facade';
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
        bg: 'color-mix(in srgb, var(--state-success) 12%, transparent)',
        color: 'var(--state-success)',
      };
    case 'upcoming':
      return {
        bg: 'color-mix(in srgb, var(--state-warning) 12%, transparent)',
        color: 'var(--state-warning)',
      };
    case 'cancelled':
      return {
        bg: 'color-mix(in srgb, var(--state-error) 12%, transparent)',
        color: 'var(--state-error)',
      };
    default: // completed
      return {
        bg: 'color-mix(in srgb, var(--text-muted) 12%, transparent)',
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
        #heroRef
        title="Cursos Singulares"
        contextLine="Contabilidad"
        subtitle="RF-035 · Cobro simplificado de cursos SENCE, Grúa, Retroexcavadora"
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
          [value]="facade.kpis().ingresosEstimados"
          label="Ingresos Estimados"
          icon="dollar-sign"
          prefix="$"
          subValue="cursos activos + finalizados"
          color="success"
          [loading]="facade.isLoading()"
        />
      </div>

      <!-- Espacio reservado para completar la fila o KPI adicional -->
      <div class="bento-square opacity-0 pointer-events-none hidden lg:block"></div>

      <!-- ── Contenido Principal (Listado) ─────────────────────────────────── -->
      <div class="bento-banner">
        <section class="card pb-10" aria-label="Listado de cursos singulares">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div class="flex items-center gap-2">
              <app-icon name="list" [size]="18" color="var(--ds-brand)" />
              <h2 class="text-base font-bold" style="color: var(--text-primary)">
                Listado de Cursos
              </h2>
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
                <div
                  class="rounded-xl p-4 flex flex-col gap-3 border"
                  style="border-color: var(--border-muted)"
                >
                  <div
                    class="h-4 rounded w-3/4"
                    style="background: color-mix(in srgb, var(--text-muted) 14%, transparent)"
                  ></div>
                  <div
                    class="h-3 rounded w-1/2"
                    style="background: color-mix(in srgb, var(--text-muted) 10%, transparent)"
                  ></div>
                  <div
                    class="h-8 rounded w-full"
                    style="background: color-mix(in srgb, var(--text-muted) 8%, transparent)"
                  ></div>
                </div>
              }
            } @else if (cursosFiltrados().length === 0) {
              <div class="py-12 text-center">
                <p class="text-sm" style="color: var(--text-muted)">
                  No hay cursos que coincidan con los filtros seleccionados.
                </p>
              </div>
            } @else {
              @for (curso of cursosFiltrados(); track curso.id) {
                <div
                  class="rounded-xl border overflow-hidden"
                  style="border-color: var(--border-muted); background: var(--bg-surface)"
                >
                  <!-- Cabecera de card: nombre + badges -->
                  <div class="px-4 pt-4 pb-3 flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <p class="text-sm font-semibold truncate" style="color: var(--text-primary)">
                        {{ curso.nombre }}
                      </p>
                      <p class="text-xs mt-0.5" style="color: var(--text-muted)">
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
                  <div
                    class="grid grid-cols-3 divide-x px-0 border-t border-b"
                    style="border-color: var(--border-muted)"
                  >
                    <div class="py-3 px-4 flex flex-col gap-0.5">
                      <p
                        class="text-xs font-semibold uppercase tracking-wide"
                        style="color: var(--text-muted)"
                      >
                        Precio
                      </p>
                      <p class="text-sm font-bold" style="color: var(--text-primary)">
                        {{ formatCLP(curso.precio) }}
                      </p>
                    </div>
                    <div class="py-3 px-4 flex flex-col gap-0.5 text-center">
                      <p
                        class="text-xs font-semibold uppercase tracking-wide"
                        style="color: var(--text-muted)"
                      >
                        Inscritos
                      </p>
                      <p class="text-sm font-bold" style="color: var(--text-primary)">
                        {{ curso.inscritos
                        }}<span class="text-xs font-normal" style="color: var(--text-muted)"
                          >/{{ curso.cupos }}</span
                        >
                      </p>
                    </div>
                    <div class="py-3 px-4 flex flex-col gap-0.5 text-right">
                      <p
                        class="text-xs font-semibold uppercase tracking-wide"
                        style="color: var(--text-muted)"
                      >
                        Ingreso Est.
                      </p>
                      <p
                        class="text-sm font-bold"
                        [style.color]="
                          curso.estado !== 'upcoming' ? 'var(--state-success)' : 'var(--text-muted)'
                        "
                      >
                        {{ curso.estado !== 'upcoming' ? formatCLP(curso.ingresoEstimado) : '—' }}
                      </p>
                    </div>
                  </div>

                  <!-- Fila secundaria: Duración + Facturación -->
                  <div class="px-4 py-2 flex items-center gap-4">
                    <p class="text-xs" style="color: var(--text-muted)">
                      <span class="font-semibold" style="color: var(--text-secondary)"
                        >{{ curso.duracionHoras }} hrs</span
                      >
                      · {{ billingLabel(curso.billingType) }}
                    </p>
                  </div>

                  <!-- Footer: Acciones full-width -->
                  <div class="px-4 pb-4 flex gap-2">
                    <button
                      class="flex-1 flex items-center justify-center gap-2 h-9 rounded-full text-xs font-semibold border transition-colors"
                      style="border-color: var(--border-muted); color: var(--text-secondary)"
                      data-llm-action="view-curso-singular"
                      (click)="onVerDetalle(curso)"
                    >
                      <app-icon name="eye" [size]="14" />
                      Ver detalle
                    </button>
                    <button
                      class="flex-1 flex items-center justify-center gap-2 h-9 rounded-full text-xs font-semibold transition-colors"
                      style="background: color-mix(in srgb, var(--state-success) 12%, transparent); color: var(--state-success)"
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
                class="rounded-xl px-4 py-3 flex items-center justify-between border-t-2"
                style="background: var(--bg-surface); border-color: var(--border-muted)"
              >
                <span class="text-sm font-bold" style="color: var(--text-primary)">TOTAL</span>
                <div class="flex items-center gap-4">
                  <span class="text-xs" style="color: var(--text-muted)">
                    <strong style="color: var(--text-primary)">{{ totales().inscritos }}</strong>
                    inscritos
                  </span>
                  <span class="text-sm font-bold" style="color: var(--state-success)">
                    {{ formatCLP(totales().ingresos) }}
                  </span>
                </div>
              </div>
            }
          </div>

          <!-- ══ VISTA DESKTOP (≥ lg): tabla clásica ═══════════════════════════ -->
          <div class="hidden lg:block overflow-x-auto">
            <table class="w-full" role="table" aria-label="Cursos singulares">
              <thead>
                <tr class="border-b" style="border-color: var(--border-muted)">
                  @for (col of columnas; track col) {
                    <th
                      class="py-3 px-4 text-xs font-semibold uppercase tracking-wide"
                      [class.text-left]="col.align === 'left'"
                      [class.text-right]="col.align === 'right'"
                      [class.text-center]="col.align === 'center'"
                      style="color: var(--text-muted)"
                    >
                      {{ col.label }}
                    </th>
                  }
                </tr>
              </thead>

              <tbody class="divide-y" style="border-color: var(--border-muted)">
                @if (facade.isLoading()) {
                  @for (i of skeletonRows; track i) {
                    <tr>
                      @for (col of columnas; track col) {
                        <td class="py-3 px-4">
                          <div
                            class="h-4 rounded w-full"
                            style="background: color-mix(in srgb, var(--text-muted) 14%, transparent)"
                          ></div>
                        </td>
                      }
                    </tr>
                  }
                } @else if (cursosFiltrados().length === 0) {
                  <tr>
                    <td [attr.colspan]="columnas.length" class="py-12 text-center">
                      <p class="text-sm" style="color: var(--text-muted)">
                        No hay cursos que coincidan con los filtros seleccionados.
                      </p>
                    </td>
                  </tr>
                } @else {
                  @for (curso of cursosFiltrados(); track curso.id) {
                    <tr
                      class="transition-colors"
                      (mouseenter)="
                        $any($event.currentTarget)?.setAttribute(
                          'style',
                          'background:color-mix(in srgb,var(--color-primary) 4%,transparent)'
                        )
                      "
                      (mouseleave)="$any($event.currentTarget)?.setAttribute('style', '')"
                    >
                      <td class="py-3 px-4">
                        <p class="text-sm font-medium" style="color: var(--text-primary)">
                          {{ curso.nombre }}
                        </p>
                        <p class="text-xs mt-0.5" style="color: var(--text-muted)">
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
                        <span class="text-sm font-semibold" style="color: var(--text-primary)">{{
                          formatCLP(curso.precio)
                        }}</span>
                      </td>
                      <td class="py-3 px-4 text-center">
                        <span class="text-sm" style="color: var(--text-secondary)"
                          >{{ curso.duracionHoras }} hrs</span
                        >
                      </td>
                      <td class="py-3 px-4 text-center">
                        <span class="text-sm font-medium" style="color: var(--text-primary)">{{
                          curso.inscritos
                        }}</span>
                        <span class="text-xs" style="color: var(--text-muted)"
                          >/{{ curso.cupos }}</span
                        >
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
                            curso.estado !== 'upcoming'
                              ? 'var(--state-success)'
                              : 'var(--text-muted)'
                          "
                          >{{
                            curso.estado !== 'upcoming' ? formatCLP(curso.ingresoEstimado) : '—'
                          }}</span
                        >
                      </td>
                      <td class="py-3 px-4 text-center">
                        <div class="flex items-center justify-center gap-1">
                          <button
                            class="p-1.5 rounded transition-colors"
                            style="color: var(--text-muted)"
                            title="Ver detalle"
                            data-llm-action="view-curso-singular"
                            (mouseenter)="
                              $any($event.currentTarget).style.color = 'var(--color-primary)';
                              $any($event.currentTarget).style.background =
                                'color-mix(in srgb,var(--color-primary) 10%,transparent)'
                            "
                            (mouseleave)="
                              $any($event.currentTarget).style.color = 'var(--text-muted)';
                              $any($event.currentTarget).style.background = 'transparent'
                            "
                            (click)="onVerDetalle(curso)"
                          >
                            <app-icon name="eye" [size]="16" />
                          </button>
                          <button
                            class="p-1.5 rounded transition-colors"
                            style="color: var(--text-muted)"
                            title="Registrar cobro"
                            data-llm-action="registrar-cobro-singular"
                            (mouseenter)="
                              $any($event.currentTarget).style.color = 'var(--state-success)';
                              $any($event.currentTarget).style.background =
                                'color-mix(in srgb,var(--state-success) 10%,transparent)'
                            "
                            (mouseleave)="
                              $any($event.currentTarget).style.color = 'var(--text-muted)';
                              $any($event.currentTarget).style.background = 'transparent'
                            "
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
                  <tr
                    class="border-t-2"
                    style="border-color: var(--border-muted); background: var(--bg-surface)"
                  >
                    <td class="py-3 px-4 text-sm font-bold" style="color: var(--text-primary)">
                      TOTAL
                    </td>
                    <td colspan="3"></td>
                    <td
                      class="py-3 px-4 text-center text-sm font-bold"
                      style="color: var(--text-primary)"
                    >
                      {{ totales().inscritos }}
                    </td>
                    <td colspan="2"></td>
                    <td
                      class="py-3 px-4 text-right text-sm font-bold"
                      style="color: var(--state-success)"
                    >
                      {{ formatCLP(totales().ingresos) }}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              }
            </table>
          </div>

          <!-- Nota informativa -->
          <div
            class="mt-4 px-4 py-3 rounded-lg text-xs"
            style="
              background: color-mix(in srgb, var(--color-primary) 6%, transparent);
              color: var(--text-secondary);
              border: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent);
            "
          >
            <strong style="color: var(--color-primary)">SENCE:</strong>
            Los cursos SENCE se facturan directamente al organismo. El cobro al alumno es $0 si está
            100% financiado.&nbsp;&nbsp;
            <strong style="color: var(--text-primary)">Particular:</strong>
            Se emite boleta por el monto total al inscrito.
          </div>
        </section>
      </div>
    </div>
  `,
})
export class AdminContabilidadCursosComponent implements OnInit, AfterViewInit {
  protected readonly facade = inject(CursosSingularesFacade);
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
    { label: 'Ingreso Est.', align: 'right' as const },
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

  /** Totales de la fila footer de la tabla filtrada. */
  protected readonly totales = computed(() => {
    const lista = this.cursosFiltrados();
    return {
      inscritos: lista.reduce((s, c) => s + c.inscritos, 0),
      ingresos: lista
        .filter((c) => c.estado !== 'upcoming')
        .reduce((s, c) => s + c.ingresoEstimado, 0),
    };
  });

  // ── GSAP refs ─────────────────────────────────────────────────────────────
  private readonly heroRef = viewChild('heroRef', { read: ElementRef });
  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    void this.facade.initialize();
  }

  ngAfterViewInit(): void {
    const hero = this.heroRef();
    const grid = this.bentoGrid();

    if (hero) this.gsap.animateHero(hero.nativeElement);
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
