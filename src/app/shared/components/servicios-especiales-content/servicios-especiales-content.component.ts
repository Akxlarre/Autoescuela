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
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { EliminarServicioModalComponent } from '@shared/components/eliminar-servicio-modal/eliminar-servicio-modal.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { SectionHeroAction, SectionHeroKpi } from '@core/models/ui/section-hero.model';
import type {
  ServicioEspecial,
  ServiciosEspecialesKpis,
  VentaServicio,
} from '@core/models/ui/servicios-especiales.model';
import { StableWidthDirective } from '@core/directives/stable-width.directive';
import { PeriodSelectorComponent } from '@shared/components/period-selector/period-selector.component';
import {
  DEFAULT_PERIOD_WINDOW,
  applyPeriodWindow,
  type PeriodWindow,
} from '@core/utils/period-window.utils';

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
    BadgeComponent,
    SectionHeroComponent,
    BentoGridLayoutDirective,
    FormsModule,
    SelectModule,
    MenuModule,
    StableWidthDirective,
    PeriodSelectorComponent,
    EliminarServicioModalComponent,
  ],
  template: `
    <div class="bento-grid bento-grid--fill-screen-2" appBentoGridLayout #bentoGrid>
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
      <div
        class="bento-banner bento-fill flex flex-col h-full"
        style="container-type:inline-size; container-name:svc-catalogo"
      >
        <section class="card flex flex-col h-full min-h-0">
          <div class="flex items-center justify-between mb-4 shrink-0 flex-wrap gap-2">
            <h2 class="text-lg font-semibold text-text-primary m-0">Catálogo de Servicios</h2>
            <div class="flex items-center gap-3 flex-wrap">
              <label
                class="flex items-center gap-2 text-xs font-medium text-text-secondary cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  class="w-4 h-4 rounded text-brand focus:ring-brand"
                  [checked]="mostrarInactivos()"
                  (change)="mostrarInactivos.set($any($event.target).checked)"
                  data-llm-action="toggle-mostrar-inactivos"
                />
                Mostrar inactivos
              </label>
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
          </div>

          <div class="grid grid-cols-1 svc-catalogo-grid gap-4 flex-1 min-h-0 overflow-y-auto">
            @for (servicio of serviciosVisibles(); track servicio.id) {
              <div class="card flex flex-col gap-3" [class.opacity-60]="!servicio.activo">
                <div class="flex items-start justify-between">
                  <div
                    class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    [style]="getServiceIconStyle(servicio.color)"
                  >
                    <app-icon [name]="servicio.icono" [size]="18" />
                  </div>
                  <div class="flex items-center gap-1">
                    <app-badge [variant]="servicio.activo ? 'success' : 'neutral'">
                      {{ servicio.activo ? 'Activo' : 'Inactivo' }}
                    </app-badge>
                    <button
                      type="button"
                      class="cursor-pointer text-text-muted hover:text-error transition-colors p-1 rounded-lg hover:bg-error/10"
                      [attr.data-llm-action]="'borrar-servicio-' + servicio.id"
                      [attr.aria-label]="'Borrar servicio ' + servicio.nombre"
                      (click)="onBorrarServicio(servicio)"
                    >
                      <app-icon name="trash-2" [size]="13" />
                    </button>
                  </div>
                </div>
                <div class="flex-1">
                  <h3 class="item-title m-0 mb-1">
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
                  @if (servicio.activo) {
                    <button
                      type="button"
                      class="cursor-pointer text-sm font-medium px-3 py-1.5 rounded-lg border border-border-default text-text-secondary hover:bg-subtle transition-colors"
                      [attr.data-llm-action]="'vender-' + servicio.id"
                      (click)="requestRegistrarVenta.emit(servicio)"
                    >
                      Vender
                    </button>
                  } @else {
                    <div class="flex items-center gap-2">
                      <button
                        type="button"
                        class="cursor-pointer text-xs font-medium px-2 py-1.5 rounded-lg text-error hover:bg-error/10 transition-colors"
                        [attr.data-llm-action]="'eliminar-definitivo-servicio-' + servicio.id"
                        (click)="onEliminarDefinitivo(servicio)"
                      >
                        Eliminar definitivamente
                      </button>
                      <button
                        type="button"
                        class="cursor-pointer text-sm font-medium px-3 py-1.5 rounded-lg border border-brand/30 text-brand hover:bg-brand/10 transition-colors"
                        [attr.data-llm-action]="'reactivar-servicio-' + servicio.id"
                        (click)="onReactivarServicio(servicio)"
                      >
                        Reactivar
                      </button>
                    </div>
                  }
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
      <div
        class="bento-banner bento-fill flex flex-col h-full"
        style="container-type:inline-size; container-name:svc-historial"
      >
        <section class="card flex flex-col h-full min-h-0">
          <div class="flex flex-wrap items-center justify-between gap-3 mb-5 shrink-0">
            <h2 class="text-lg font-semibold text-text-primary m-0">Historial de Ventas</h2>
            <div class="flex items-center gap-2 flex-wrap">
              <p-select
                [ngModel]="filtroServicio()"
                (ngModelChange)="filtroServicio.set($event)"
                [options]="filtroOptions()"
                optionLabel="label"
                optionValue="value"
                placeholder="Todos los servicios"
                styleClass="w-full h-10"
                class="min-w-0"
              />

              <app-period-selector
                [window]="periodWindow()"
                (windowChange)="periodWindow.set($event)"
                ariaLabel="Período del historial de ventas"
              />
              <div class="relative shrink-0">
                <button
                  type="button"
                  class="btn-secondary h-10 px-4 flex items-center justify-center gap-2 disabled:opacity-60"
                  [disabled]="isExporting()"
                  [appStableWidth]="isExporting()"
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

          <!-- Vista Desktop: Tabla (Visible en SM+ del CONTENEDOR, no del viewport) -->
          <div class="svc-table-view overflow-x-auto flex-1 min-h-0 overflow-y-auto">
            <table class="w-full text-sm">
              <thead>
                <tr style="border-bottom:1px solid var(--border-subtle)">
                  <th class="micro-label text-left py-3 px-4">Cliente</th>
                  <th class="micro-label text-left py-3 px-4">Servicio</th>
                  <th class="micro-label text-right py-3 px-4">Monto</th>
                  <th class="micro-label text-left py-3 px-4">N° Boleta</th>
                  <th class="micro-label text-left py-3 px-4">Fecha</th>
                  <th class="micro-label text-center py-3 px-4">Acciones</th>
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
                      <p class="text-2xs text-text-muted font-mono m-0 uppercase">
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
                    <td class="py-3 px-4 text-text-muted">
                      {{ venta.documentNumber ?? '—' }}
                    </td>
                    <td class="py-3 px-4 text-text-muted">{{ venta.fecha }}</td>
                    <td class="py-3 px-4 text-center">
                      <button
                        type="button"
                        class="cursor-pointer text-text-muted hover:text-error transition-colors p-1.5 rounded-lg hover:bg-error/10"
                        [attr.data-llm-action]="'borrar-venta-' + venta.id"
                        [attr.aria-label]="'Borrar venta de ' + venta.cliente"
                        (click)="onBorrar(venta)"
                      >
                        <app-icon name="trash-2" [size]="15" />
                      </button>
                    </td>
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

          <!-- Vista Mobile: Card List (Visible cuando el CONTENEDOR es angosto) -->
          <div class="svc-mobile-view flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto">
            @for (venta of ventasFiltradas(); track venta.id) {
              <div
                class="p-4 rounded-xl bg-surface border border-border-subtle flex flex-col gap-3"
              >
                <div class="flex items-start justify-between gap-2">
                  <div class="flex flex-col gap-0.5">
                    <span class="font-bold text-text-primary">{{ venta.cliente }}</span>
                    <span class="text-2xs text-text-muted font-mono uppercase tracking-tighter">{{
                      venta.rut
                    }}</span>
                  </div>
                  <span class="text-sm font-black text-text-primary"
                    >\${{ venta.precio.toLocaleString('es-CL') }}</span
                  >
                </div>

                <div class="flex items-center gap-2">
                  <span class="text-xs text-text-secondary px-2 py-1 rounded-md bg-subtle">{{
                    venta.servicio
                  }}</span>
                  <span class="text-2xs text-text-muted">{{ venta.fecha }}</span>
                  @if (venta.documentNumber) {
                    <span class="text-2xs text-text-muted font-mono"
                      >· Boleta {{ venta.documentNumber }}</span
                    >
                  }
                </div>

                <div class="flex items-center justify-end pt-3 border-t border-border-subtle/50">
                  <button
                    type="button"
                    class="cursor-pointer text-text-muted hover:text-error transition-colors p-1.5 rounded-lg hover:bg-error/10"
                    [attr.data-llm-action]="'borrar-venta-mobile-' + venta.id"
                    [attr.aria-label]="'Borrar venta de ' + venta.cliente"
                    (click)="onBorrar(venta)"
                  >
                    <app-icon name="trash-2" [size]="15" />
                  </button>
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

    <!-- fix-024-i: modal de confirmación por texto para el borrado definitivo -->
    <app-eliminar-servicio-modal
      [visible]="servicioAEliminarDefinitivo() !== null"
      [servicioNombre]="servicioAEliminarDefinitivo()?.nombre ?? ''"
      [isDeleting]="isEliminandoDefinitivo()"
      (confirmado)="onConfirmarEliminarDefinitivo()"
      (cancelado)="servicioAEliminarDefinitivo.set(null)"
    />
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

      /* Catálogo y switch tabla/mobile del Historial: por CONTENEDOR, no por
         viewport (fix-021-i). Con el drawer de LayoutDrawer abierto, el ancho
         visual de estas celdas se reduce pero el viewport del navegador no
         cambia — los breakpoints sm:/lg: de Tailwind (@media) no reaccionan,
         mientras que @container sí, porque mide el propio elemento. */
      .svc-catalogo-grid {
        grid-template-columns: repeat(1, 1fr);
      }
      @container svc-catalogo (min-width: 480px) {
        .svc-catalogo-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @container svc-catalogo (min-width: 720px) {
        .svc-catalogo-grid {
          grid-template-columns: repeat(3, 1fr);
        }
      }

      .svc-table-view {
        display: none;
      }
      .svc-mobile-view {
        display: flex;
      }
      @container svc-historial (min-width: 640px) {
        .svc-table-view {
          display: block;
        }
        .svc-mobile-view {
          display: none;
        }
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
  /**
   * Ruta del botón "volver". Sin default a propósito: un default con segmento de rol
   * (`/app/dashboard`) era un 404 que cada consumidor heredaba en silencio (fix-202-m).
   */
  readonly backRoute = input.required<string>();

  private readonly gsap = inject(GsapAnimationsService);
  private readonly bentoGrid = viewChild<ElementRef>('bentoGrid');
  private readonly confirmModal = inject(ConfirmModalService);

  // ── Outputs ─────────────────────────────────────────────────────────────────
  readonly requestRegistrarVenta = output<ServicioEspecial | undefined>();
  readonly requestNuevoServicio = output<void>();
  readonly exportarHistorial = output<'excel' | 'pdf'>();
  readonly ventaBorrada = output<number>();
  readonly servicioBorrado = output<number>();
  readonly servicioReactivado = output<number>();
  readonly servicioEliminadoDefinitivo = output<number>();

  // ── Estado interno ──────────────────────────────────────────────────────────
  protected readonly filtroServicio = signal<string | null>(null);
  protected readonly exportMenuOpen = signal(false);
  protected readonly mostrarInactivos = signal(false);
  // fix-024-i: servicio objetivo del modal de borrado definitivo (null = modal cerrado).
  protected readonly servicioAEliminarDefinitivo = signal<ServicioEspecial | null>(null);
  protected readonly isEliminandoDefinitivo = signal(false);

  // ── Computed ────────────────────────────────────────────────────────────────
  protected readonly filtroOptions = computed(() =>
    this.catalogo().map((s) => ({ label: s.nombre, value: String(s.id) })),
  );

  protected readonly serviciosVisibles = computed(() =>
    this.mostrarInactivos() ? this.catalogo() : this.catalogo().filter((s) => s.activo),
  );

  /**
   * Ventana de período del historial (fix-147-b). Filtro de renderizado: el dataset completo
   * sigue en `ventas()`, y el export corre server-side (Edge Function `export-special-services`,
   * que solo recibe `format` y `branch_id`), así que nunca queda truncado por esta ventana.
   */
  protected readonly periodWindow = signal<PeriodWindow>(DEFAULT_PERIOD_WINDOW);

  protected readonly ventasFiltradas = computed(() => {
    const filtro = this.filtroServicio();
    const all = this.ventas();
    const porServicio = !filtro ? all : all.filter((v) => String(v.servicioId) === filtro);

    // Esta vista no tiene buscador de texto libre — solo el filtro por tipo de servicio, que
    // es una faceta independiente. Si alguna vez gana un buscador, pasar aquí `hasActiveSearch`
    // para que el término no quede atrapado por la ventana (ver period-window.utils.ts).
    return applyPeriodWindow(porServicio, {
      window: this.periodWindow(),
      hasActiveSearch: false,
      dateOf: (v) => v.fecha,
    });
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

  protected async onBorrar(venta: VentaServicio): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: 'Borrar venta',
      message: `¿Borrar la venta de "${venta.servicio}" a ${venta.cliente}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Sí, borrar',
      cancelLabel: 'Cancelar',
      severity: 'danger',
    });

    if (confirmed) {
      this.ventaBorrada.emit(venta.id);
    }
  }

  protected async onBorrarServicio(servicio: ServicioEspecial): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: 'Borrar servicio',
      message: `¿Borrar "${servicio.nombre}" del catálogo? Si ya tiene ventas registradas, se desactivará en vez de borrarse.`,
      confirmLabel: 'Sí, borrar',
      cancelLabel: 'Cancelar',
      severity: 'danger',
    });

    if (confirmed) {
      this.servicioBorrado.emit(servicio.id);
    }
  }

  protected onReactivarServicio(servicio: ServicioEspecial): void {
    this.servicioReactivado.emit(servicio.id);
  }

  protected onEliminarDefinitivo(servicio: ServicioEspecial): void {
    this.servicioAEliminarDefinitivo.set(servicio);
  }

  protected onConfirmarEliminarDefinitivo(): void {
    const servicio = this.servicioAEliminarDefinitivo();
    if (!servicio) return;
    this.servicioAEliminarDefinitivo.set(null);
    this.servicioEliminadoDefinitivo.emit(servicio.id);
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
