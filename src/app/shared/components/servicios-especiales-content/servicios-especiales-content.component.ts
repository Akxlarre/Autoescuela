import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  AfterViewInit,
  ElementRef,
  viewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { MenuModule } from 'primeng/menu';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { SectionHeroAction, SectionHeroKpi } from '@core/models/ui/section-hero.model';
import type {
  ServicioEspecial,
  ServiciosEspecialesKpis,
  VentaServicio,
} from '@core/models/ui/servicios-especiales.model';

type ServicioColor = 'indigo' | 'orange' | 'green';

/**
 * ServiciosEspecialesContentComponent — Organismo Dumb (RF-037).
 * Catálogo de servicios e historial de ventas.
 * Delega los formularios de registro al LayoutDrawer a través de eventos.
 */
@Component({
  selector: 'app-servicios-especiales-content',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    IconComponent,
    SectionHeroComponent,
    BentoGridLayoutDirective,
    FormsModule,
    SelectModule,
    MenuModule,
  ],
  template: `
    <div class="bento-grid" appBentoGridLayout #bentoGrid>
      <!-- ── Hero ──────────────────────────────────────────────────────────────── -->
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="isLoading()"
        title="Servicios Especiales"
        subtitle="Punto de venta de servicios complementarios — alumnos y clientes externos"
        icon="receipt"
        [backRoute]="backRoute()"
        backLabel="Inicio"
        [kpis]="heroKpis()"
        [actions]="heroActions"
        (actionClick)="onHeroAction($event)"
      />

      <!-- ── Catálogo de Servicios ──────────────────────────────────────────────── -->
      <div class="bento-banner">
        <section class="card">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-lg font-semibold text-text-primary m-0">Catálogo de Servicios</h2>
            <button
              type="button"
              class="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-border-default text-text-secondary hover:bg-subtle transition-colors"
              data-llm-action="open-nuevo-servicio-drawer"
              (click)="requestNuevoServicio.emit()"
            >
              <app-icon name="plus" [size]="14" />
              Agregar servicio
            </button>
          </div>

          <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            @for (servicio of catalogo(); track servicio.id) {
              <div class="card flex flex-col gap-3">
                <div class="flex items-start justify-between">
                  <div
                    class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    [style]="getServiceIconStyle(servicio.color)"
                  >
                    <app-icon [name]="servicio.icono" [size]="18" />
                  </div>
                  <span
                    class="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full"
                    [style]="
                      servicio.activo
                        ? 'background:var(--state-success-bg,rgba(34,197,94,.1));color:var(--state-success)'
                        : 'background:var(--bg-subtle);color:var(--text-muted)'
                    "
                  >
                    {{ servicio.activo ? 'Activo' : 'Inactivo' }}
                  </span>
                </div>
                <div class="flex-1">
                  <h3 class="font-semibold text-text-primary text-sm m-0 mb-1">
                    {{ servicio.nombre }}
                  </h3>
                  <p class="text-xs text-text-muted m-0 leading-relaxed">
                    {{ servicio.descripcion }}
                  </p>
                </div>
                <div
                  class="flex items-center justify-between pt-3"
                  style="border-top:1px solid var(--border-subtle)"
                >
                  <span class="font-bold text-text-primary"
                    >\${{ servicio.precio.toLocaleString('es-CL') }}</span
                  >
                  <button
                    type="button"
                    class="cursor-pointer text-sm font-medium px-3 py-1.5 rounded-lg border border-border-default text-text-secondary hover:bg-subtle transition-colors"
                    [attr.data-llm-action]="'vender-' + servicio.id"
                    (click)="requestRegistrarVenta.emit(servicio)"
                  >
                    Vender
                  </button>
                </div>
              </div>
            }

            <!-- Tarjeta agregar nuevo servicio -->
            <button
              type="button"
              class="cursor-pointer flex flex-col items-center justify-center gap-2 rounded-xl min-h-45 text-text-muted transition-colors hover:bg-subtle/50 border-2 border-dashed border-border-default"
              data-llm-action="open-nuevo-servicio-drawer-card"
              (click)="requestNuevoServicio.emit()"
            >
              <app-icon name="plus" [size]="28" />
              <span class="text-sm font-medium">Agregar servicio</span>
              <span class="text-xs">Ej. "Uso de Simulador"</span>
            </button>
          </div>
        </section>
      </div>

      <!-- ── Historial de Ventas ────────────────────────────────────────────────── -->
      <div class="bento-banner">
        <section class="card">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-5">
            <h2 class="text-lg font-semibold text-text-primary m-0">Historial de Ventas</h2>
            <div class="flex items-center gap-2">
              <p-select
                [ngModel]="filtroServicio()"
                (ngModelChange)="filtroServicio.set($event)"
                [options]="filtroOptions()"
                optionLabel="label"
                optionValue="value"
                placeholder="Todos los servicios"
                styleClass="w-full h-10"
              />
              <div class="relative">
                <button
                  type="button"
                  class="btn-secondary h-10 px-4 flex items-center gap-2 disabled:opacity-60"
                  [disabled]="isExporting()"
                  (click)="exportMenuOpen.set(!exportMenuOpen())"
                >
                  @if (isExporting()) {
                    <app-icon name="loader-circle" [size]="16" class="animate-spin" />
                  } @else {
                    <app-icon name="download" [size]="16" />
                  }
                  Exportar
                  <app-icon name="chevron-down" [size]="14" />
                </button>

                @if (exportMenuOpen()) {
                  <div class="fixed inset-0 z-40" (click)="exportMenuOpen.set(false)"></div>
                  <div class="export-menu">
                    <button type="button" class="export-menu-item" (click)="onExport('excel')">
                      <app-icon name="table-2" [size]="16" />
                      Exportar como Excel
                    </button>
                    <button type="button" class="export-menu-item" (click)="onExport('pdf')">
                      <app-icon name="file-text" [size]="16" />
                      Exportar como PDF
                    </button>
                  </div>
                }
              </div>
            </div>
          </div>
          <!-- (Contenido de la tabla sigue igual...) -->

          <!-- Vista Desktop: Tabla (Visible en SM+) -->
          <div class="hidden sm:block overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr style="border-bottom:1px solid var(--border-subtle)">
                  <th
                    class="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-text-muted"
                  >
                    Cliente
                  </th>
                  <th
                    class="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-text-muted"
                  >
                    Servicio
                  </th>
                  <th
                    class="text-right py-3 px-4 text-xs font-semibold uppercase tracking-wide text-text-muted"
                  >
                    Monto
                  </th>
                  <th
                    class="text-center py-3 px-4 text-xs font-semibold uppercase tracking-wide text-text-muted"
                  >
                    Estado
                  </th>
                  <th
                    class="text-center py-3 px-4 text-xs font-semibold uppercase tracking-wide text-text-muted"
                  >
                    Cobro
                  </th>
                  <th
                    class="text-left py-3 px-4 text-xs font-semibold uppercase tracking-wide text-text-muted"
                  >
                    Fecha
                  </th>
                </tr>
              </thead>
              <tbody>
                @for (venta of ventasFiltradas(); track venta.id) {
                  <tr
                    class="transition-colors hover:bg-subtle/50"
                    style="border-bottom:1px solid var(--border-subtle)"
                  >
                    <td class="py-3 px-4">
                      <p class="font-medium text-text-primary m-0">{{ venta.cliente }}</p>
                      <p class="text-[10px] text-text-muted font-mono m-0 uppercase">
                        {{ venta.rut }}
                      </p>
                      @if (venta.resultado) {
                        <span
                          class="text-xs font-medium"
                          [style.color]="
                            venta.resultado === 'Apto'
                              ? 'var(--state-success)'
                              : 'var(--state-error)'
                          "
                        >
                          {{ venta.resultado === 'Apto' ? '✓' : '✗' }} {{ venta.resultado }}
                        </span>
                      }
                    </td>
                    <td class="py-3 px-4 text-text-secondary">{{ venta.servicio }}</td>
                    <td class="py-3 px-4 text-right font-semibold text-text-primary">
                      \${{ venta.precio.toLocaleString('es-CL') }}
                    </td>
                    <td class="py-3 px-4 text-center">
                      <span
                        class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                        [style]="
                          venta.estado === 'completado'
                            ? 'background:var(--state-success-bg);color:var(--state-success)'
                            : 'background:var(--state-warning-bg);color:var(--state-warning)'
                        "
                      >
                        {{ venta.estado === 'completado' ? 'Completado' : 'Pendiente' }}
                      </span>
                    </td>
                    <td class="py-3 px-4 text-center">
                      @if (venta.cobrado) {
                        <span
                          class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border bg-success-subtle text-success border-success"
                        >
                          Cobrado
                        </span>
                      } @else {
                        <button
                          type="button"
                          class="text-xs font-medium px-2.5 py-1 rounded border border-border-default text-text-secondary hover:bg-subtle transition-colors"
                          (click)="cobroRegistrado.emit(venta.id)"
                        >
                          Cobrar
                        </button>
                      }
                    </td>
                    <td class="py-3 px-4 text-text-muted">{{ venta.fecha }}</td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6" class="py-10 text-center text-text-muted text-sm">
                      No hay ventas registradas.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Vista Mobile: Card List (Visible solo en < SM) -->
          <div class="sm:hidden flex flex-col gap-4">
            @for (venta of ventasFiltradas(); track venta.id) {
              <div
                class="p-4 rounded-xl bg-surface border border-border-subtle flex flex-col gap-3"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="flex flex-col gap-0.5">
                    <span class="font-bold text-text-primary">{{ venta.cliente }}</span>
                    <span
                      class="text-[10px] text-text-muted font-mono uppercase tracking-tighter"
                      >{{ venta.rut }}</span
                    >
                  </div>
                  <span class="text-sm font-black text-text-primary"
                    >\${{ venta.precio.toLocaleString('es-CL') }}</span
                  >
                </div>

                <div class="flex items-center gap-2">
                  <span class="text-xs text-text-secondary px-2 py-1 rounded-md bg-subtle">{{
                    venta.servicio
                  }}</span>
                  <span class="text-[10px] text-text-muted">{{ venta.fecha }}</span>
                </div>

                <div
                  class="flex items-center justify-between pt-3 border-t border-border-subtle/50"
                >
                  <span
                    class="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                    [style]="
                      venta.estado === 'completado'
                        ? 'background:var(--state-success-bg);color:var(--state-success)'
                        : 'background:var(--state-warning-bg);color:var(--state-warning)'
                    "
                  >
                    {{ venta.estado }}
                  </span>

                  <div class="flex items-center gap-2">
                    @if (venta.cobrado) {
                      <span
                        class="text-[10px] font-bold text-success uppercase px-2 py-1 bg-success-subtle border border-success rounded"
                        >Pagado</span
                      >
                    } @else {
                      <button
                        type="button"
                        class="text-[10px] font-bold text-brand uppercase px-3 py-1 bg-brand/10 border border-brand/20 rounded-lg"
                        (click)="cobroRegistrado.emit(venta.id)"
                      >
                        Cobrar
                      </button>
                    }
                  </div>
                </div>
              </div>
            } @empty {
              <div class="py-10 text-center text-text-muted text-sm opacity-50">
                <app-icon name="search-x" [size]="40" class="mb-3 opacity-30" />
                <p>No hay ventas registradas.</p>
              </div>
            }
          </div>
        </section>
      </div>
    </div>
  `,
  styles: [
    `
      .export-menu {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        z-index: 50;
        min-width: 200px;
        background: var(--bg-surface);
        border: 1px solid var(--border-default);
        border-radius: var(--radius-lg);
        box-shadow: 0 8px 24px rgb(0 0 0 / 12%);
        overflow: hidden;
      }

      .export-menu-item {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 12px 16px;
        font-size: 14px;
        color: var(--text-primary);
        background: transparent;
        border: none;
        cursor: pointer;
        text-align: left;
        transition: background var(--duration-fast);
      }

      .export-menu-item:hover {
        background: var(--bg-elevated);
      }

      /* Alineación del selector */
      :host ::ng-deep .p-select {
        height: 2.5rem !important;
      }
    `,
  ],
})
export class ServiciosEspecialesContentComponent implements AfterViewInit {
  // ── Inputs ──────────────────────────────────────────────────────────────────
  readonly catalogo = input.required<ServicioEspecial[]>();
  readonly ventas = input.required<VentaServicio[]>();
  readonly kpis = input.required<ServiciosEspecialesKpis>();
  readonly isLoading = input<boolean>(false);
  readonly isExporting = input<boolean>(false);
  readonly backRoute = input<string>('/app/dashboard');

  private readonly gsap = inject(GsapAnimationsService);
  private readonly bentoGrid = viewChild<ElementRef>('bentoGrid');

  // ── Outputs ─────────────────────────────────────────────────────────────────
  readonly requestRegistrarVenta = output<ServicioEspecial | undefined>();
  readonly requestNuevoServicio = output<void>();
  readonly cobroRegistrado = output<number>();
  readonly exportarHistorial = output<'excel' | 'pdf'>();

  // ── Estado interno ──────────────────────────────────────────────────────────
  protected readonly filtroServicio = signal<string | null>(null);
  protected readonly exportMenuOpen = signal(false);

  // ── Computed ────────────────────────────────────────────────────────────────
  protected readonly filtroOptions = computed(() =>
    this.catalogo().map((s) => ({ label: s.nombre, value: String(s.id) })),
  );

  protected readonly ventasFiltradas = computed(() => {
    const filtro = this.filtroServicio();
    const all = this.ventas();
    return !filtro ? all : all.filter((v) => String(v.servicioId) === filtro);
  });

  protected readonly mesActualLabel = computed(() => {
    const fecha = new Date();
    return fecha.toLocaleString('es-CL', { month: 'long', year: 'numeric' });
  });

  // ── Hero config ─────────────────────────────────────────────────────────────
  protected readonly heroActions: SectionHeroAction[] = [
    { id: 'registrar-venta', label: 'Registrar Venta', icon: 'plus', primary: true },
  ];

  protected readonly heroKpis = computed((): SectionHeroKpi[] => {
    const k = this.kpis();
    return [
      {
        id: 'ventas-mes',
        label: 'Ventas del mes',
        value: k.ventasMes,
        icon: 'receipt',
        trendLabel: this.mesActualLabel(),
      },
      {
        id: 'total-cobrado',
        label: 'Total recaudado',
        value: this.formatCLP(k.totalCobrado),
        color: 'success',
        trendLabel: `${k.ventasCobradas} cobradas`,
      },
      {
        id: 'pend-cobro',
        label: 'Pend. de cobro',
        value: this.formatCLP(k.pendientesCobro),
        color: 'warning',
        trendLabel: `${k.ventasSinCobrar} sin cobrar`,
      },
      { id: 'total-reg', label: 'Total registros', value: k.totalRegistros, icon: 'list-checks' },
    ];
  });

  private formatCLP(value: number): string {
    return `$ ${value.toLocaleString('es-CL')}`;
  }

  // ── Handlers ───────────────────────────────────────────────────────────────
  protected onHeroAction(actionId: string): void {
    if (actionId === 'registrar-venta') this.requestRegistrarVenta.emit(undefined);
  }

  protected onExport(format: 'excel' | 'pdf'): void {
    this.exportMenuOpen.set(false);
    this.exportarHistorial.emit(format);
  }

  protected getServiceIconStyle(color: ServicioColor): string {
    const map: Record<ServicioColor, string> = {
      indigo: 'background:color-mix(in srgb,var(--ds-brand) 12%,transparent);color:var(--ds-brand)',
      orange:
        'background:var(--state-warning-bg,rgba(234,179,8,.12));color:var(--state-warning,#ca8a04)',
      green:
        'background:var(--state-success-bg,rgba(34,197,94,.12));color:var(--state-success,#16a34a)',
    };
    return map[color];
  }

  ngAfterViewInit(): void {
    const grid = this.bentoGrid();
    if (grid) this.gsap.animateBentoGrid(grid.nativeElement);
  }
}
