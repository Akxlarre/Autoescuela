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
import { TableModule } from 'primeng/table';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { EliminarServicioModalComponent } from '@shared/components/eliminar-servicio-modal/eliminar-servicio-modal.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import type { SectionHeroAction, SectionHeroKpi } from '@core/models/ui/section-hero.model';
import type {
  ServicioEspecial,
  ServiciosEspecialesKpis,
} from '@core/models/ui/servicios-especiales.model';

type ServicioColor = 'indigo' | 'orange' | 'green';

/**
 * ServiciosEspecialesContentComponent — Organismo Dumb (RF-037).
 * Catálogo de servicios. El Historial de Ventas se movió a un drawer aparte (fix-239-m,
 * abierto desde la acción "Ver Historial" del Hero) para que el catálogo ocupe todo el bento.
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
    EmptyStateComponent,
    SectionHeroComponent,
    BentoGridLayoutDirective,
    CardHoverDirective,
    FormsModule,
    TableModule,
    EliminarServicioModalComponent,
  ],
  template: `
    <div class="bento-grid bento-grid--fill-screen" appBentoGridLayout #bentoGrid>
      <!-- ── Hero ──────────────────────────────────────────────────────────────── -->
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="isLoading()"
        title="Servicios Especiales"
        subtitle="Punto de venta de servicios complementarios — alumnos y clientes externos"
        icon="receipt"
        [kpis]="heroKpis()"
        [actions]="heroActions"
        (actionClick)="onHeroAction($event)"
      />

      <!-- ── Catálogo de Servicios ──────────────────────────────────────────────── -->
      <div
        class="bento-banner bento-fill card p-0 overflow-hidden flex flex-col w-full h-full dual-viewport-container"
        appCardHover
      >
        <!-- Toolbar -->
        <div class="flex flex-wrap items-center gap-3 p-4 border-b border-border-default">
          <h2 class="text-lg font-semibold text-text-primary m-0 mr-auto">Catálogo de Servicios</h2>
          <label
            class="flex items-center gap-2 text-xs font-medium text-text-secondary cursor-pointer select-none"
          >
            <input
              type="checkbox"
              class="w-4 h-4 rounded text-brand focus:ring-brand cursor-pointer"
              [checked]="mostrarInactivos()"
              (change)="mostrarInactivos.set($any($event.target).checked)"
              data-llm-action="toggle-mostrar-inactivos"
            />
            Mostrar inactivos
          </label>
          <button
            type="button"
            class="btn-secondary btn-sm flex items-center gap-1.5"
            data-llm-action="open-nuevo-servicio-drawer"
            (click)="requestNuevoServicio.emit()"
          >
            <app-icon name="plus" [size]="14" />
            Agregar servicio
          </button>
        </div>

        <!-- VISTA Desktop: Tabla con paginación (mismo patrón que
             app-admin-profesional-promociones / app-alumnos-list-content) -->
        <div class="desktop-view hide-on-squeeze flex flex-col flex-1 min-h-0 h-full w-full">
          <p-table
            [value]="serviciosVisibles()"
            [rows]="10"
            [paginator]="true"
            [scrollable]="true"
            scrollHeight="flex"
            styleClass="p-datatable-sm h-full flex flex-col"
            [showCurrentPageReport]="true"
            currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} servicios"
          >
            <ng-template pTemplate="header">
              <tr class="micro-label text-left">
                <th class="pl-6 py-4">Servicio</th>
                <th class="text-right">Precio</th>
                <th class="text-center">Estado</th>
                <th class="pr-6 text-right">Acciones</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-servicio>
              <tr
                class="list-item-hover transition-colors border-b border-border-subtle"
                [class.opacity-60]="!servicio.activo"
              >
                <td class="pl-6 py-3">
                  <div class="flex items-center gap-3">
                    <div
                      class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      [style]="getServiceIconStyle(servicio.color)"
                    >
                      <app-icon [name]="servicio.icono" [size]="16" />
                    </div>
                    <div class="flex flex-col min-w-0">
                      <span class="item-title truncate">{{ servicio.nombre }}</span>
                      <span class="text-xs text-text-muted truncate">{{
                        servicio.descripcion
                      }}</span>
                    </div>
                  </div>
                </td>
                <td class="text-right font-bold text-text-primary">
                  \${{ servicio.precio.toLocaleString('es-CL') }}
                </td>
                <td class="text-center">
                  <app-badge [variant]="servicio.activo ? 'success' : 'neutral'">
                    {{ servicio.activo ? 'Activo' : 'Inactivo' }}
                  </app-badge>
                </td>
                <td class="pr-6 text-right">
                  <div class="inline-flex items-center justify-end gap-2">
                    <button
                      type="button"
                      class="cursor-pointer text-text-muted hover:text-brand transition-colors p-1.5 rounded-lg hover:bg-brand/10"
                      [attr.data-llm-action]="'editar-servicio-' + servicio.id"
                      [attr.aria-label]="'Editar servicio ' + servicio.nombre"
                      (click)="requestEditarServicio.emit(servicio)"
                    >
                      <app-icon name="edit" [size]="15" />
                    </button>
                    @if (servicio.activo) {
                      <button
                        type="button"
                        class="btn-secondary btn-sm"
                        [attr.data-llm-action]="'vender-' + servicio.id"
                        (click)="requestRegistrarVenta.emit(servicio)"
                      >
                        Vender
                      </button>
                      <button
                        type="button"
                        class="cursor-pointer text-text-muted hover:text-error transition-colors p-1.5 rounded-lg hover:bg-error/10"
                        [attr.data-llm-action]="'borrar-servicio-' + servicio.id"
                        [attr.aria-label]="'Borrar servicio ' + servicio.nombre"
                        (click)="onBorrarServicio(servicio)"
                      >
                        <app-icon name="trash-2" [size]="15" />
                      </button>
                    } @else {
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
                        class="btn-secondary btn-sm"
                        [attr.data-llm-action]="'reactivar-servicio-' + servicio.id"
                        (click)="onReactivarServicio(servicio)"
                      >
                        Reactivar
                      </button>
                    }
                  </div>
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="4" class="p-0">
                  <app-empty-state
                    icon="receipt"
                    message="Todavía no hay servicios en el catálogo"
                    subtitle="Agrega un servicio para empezar a vender."
                    actionLabel="Agregar servicio"
                    actionIcon="plus"
                    (action)="requestNuevoServicio.emit()"
                  />
                </td>
              </tr>
            </ng-template>
          </p-table>
        </div>

        <!-- VISTA Mobile: Tarjetas apiladas (visible cuando el CONTENEDOR se comprime) -->
        <div class="mobile-view show-on-squeeze p-4 space-y-4 overflow-y-auto">
          @for (servicio of serviciosVisibles(); track servicio.id) {
            <div class="card flex flex-col gap-3" [class.opacity-60]="!servicio.activo">
              <div class="flex items-start justify-between">
                <div class="flex items-center gap-3 min-w-0">
                  <div
                    class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    [style]="getServiceIconStyle(servicio.color)"
                  >
                    <app-icon [name]="servicio.icono" [size]="18" />
                  </div>
                  <div class="flex flex-col min-w-0">
                    <h3 class="item-title m-0 truncate">{{ servicio.nombre }}</h3>
                    <p class="text-xs text-text-muted m-0 truncate">{{ servicio.descripcion }}</p>
                  </div>
                </div>
                <app-badge [variant]="servicio.activo ? 'success' : 'neutral'" class="shrink-0">
                  {{ servicio.activo ? 'Activo' : 'Inactivo' }}
                </app-badge>
              </div>
              <div
                class="flex items-center justify-between pt-3"
                style="border-top:1px solid var(--border-subtle)"
              >
                <span class="font-bold text-text-primary"
                  >\${{ servicio.precio.toLocaleString('es-CL') }}</span
                >
                @if (servicio.activo) {
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="cursor-pointer text-text-muted hover:text-brand transition-colors p-1.5 rounded-lg hover:bg-brand/10"
                      [attr.data-llm-action]="'editar-servicio-mobile-' + servicio.id"
                      [attr.aria-label]="'Editar servicio ' + servicio.nombre"
                      (click)="requestEditarServicio.emit(servicio)"
                    >
                      <app-icon name="edit" [size]="15" />
                    </button>
                    <button
                      type="button"
                      class="cursor-pointer text-text-muted hover:text-error transition-colors p-1.5 rounded-lg hover:bg-error/10"
                      [attr.data-llm-action]="'borrar-servicio-mobile-' + servicio.id"
                      [attr.aria-label]="'Borrar servicio ' + servicio.nombre"
                      (click)="onBorrarServicio(servicio)"
                    >
                      <app-icon name="trash-2" [size]="15" />
                    </button>
                    <button
                      type="button"
                      class="btn-secondary btn-sm"
                      [attr.data-llm-action]="'vender-mobile-' + servicio.id"
                      (click)="requestRegistrarVenta.emit(servicio)"
                    >
                      Vender
                    </button>
                  </div>
                } @else {
                  <div class="flex items-center gap-2">
                    <button
                      type="button"
                      class="cursor-pointer text-xs font-medium px-2 py-1.5 rounded-lg text-error hover:bg-error/10 transition-colors"
                      [attr.data-llm-action]="'eliminar-definitivo-servicio-mobile-' + servicio.id"
                      (click)="onEliminarDefinitivo(servicio)"
                    >
                      Eliminar definitivamente
                    </button>
                    <button
                      type="button"
                      class="btn-secondary btn-sm"
                      [attr.data-llm-action]="'reactivar-servicio-mobile-' + servicio.id"
                      (click)="onReactivarServicio(servicio)"
                    >
                      Reactivar
                    </button>
                  </div>
                }
              </div>
            </div>
          } @empty {
            <app-empty-state
              icon="receipt"
              message="Todavía no hay servicios en el catálogo"
              subtitle="Agrega un servicio para empezar a vender."
              actionLabel="Agregar servicio"
              actionIcon="plus"
              (action)="requestNuevoServicio.emit()"
            />
          }
        </div>
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
      /* Dual-viewport por CONTENEDOR (fix-021-i / fix-239-m) — idéntico a
         app-admin-profesional-relatores y app-admin-profesional-promociones para
         consistencia entre listados. */
      .dual-viewport-container {
        container-type: inline-size;
        container-name: svcContainer;
      }

      .show-on-squeeze {
        display: none;
      }

      @container svcContainer (max-width: 850px) {
        .hide-on-squeeze {
          display: none !important;
        }
        .show-on-squeeze {
          display: block !important;
        }
      }
    `,
  ],
})
export class ServiciosEspecialesContentComponent implements AfterViewInit {
  // ── Inputs ──────────────────────────────────────────────────────────────────
  readonly catalogo = input.required<ServicioEspecial[]>();
  readonly kpis = input.required<ServiciosEspecialesKpis>();
  readonly isLoading = input<boolean>(false);

  private readonly gsap = inject(GsapAnimationsService);
  private readonly bentoGrid = viewChild<ElementRef>('bentoGrid');
  private readonly confirmModal = inject(ConfirmModalService);

  // ── Outputs ─────────────────────────────────────────────────────────────────
  readonly requestRegistrarVenta = output<ServicioEspecial | undefined>();
  readonly requestNuevoServicio = output<void>();
  readonly requestVerHistorial = output<void>();
  readonly requestEditarServicio = output<ServicioEspecial>();
  readonly servicioBorrado = output<number>();
  readonly servicioReactivado = output<number>();
  readonly servicioEliminadoDefinitivo = output<number>();

  // ── Estado interno ──────────────────────────────────────────────────────────
  protected readonly mostrarInactivos = signal(false);
  // fix-024-i: servicio objetivo del modal de borrado definitivo (null = modal cerrado).
  protected readonly servicioAEliminarDefinitivo = signal<ServicioEspecial | null>(null);
  protected readonly isEliminandoDefinitivo = signal(false);

  // ── Computed ────────────────────────────────────────────────────────────────
  protected readonly serviciosVisibles = computed(() =>
    this.mostrarInactivos() ? this.catalogo() : this.catalogo().filter((s) => s.activo),
  );

  protected readonly mesActualLabel = computed(() => {
    const fecha = new Date();
    return fecha.toLocaleString('es-CL', { month: 'long', year: 'numeric' });
  });

  // ── Hero config ─────────────────────────────────────────────────────────────
  protected readonly heroActions: SectionHeroAction[] = [
    { id: 'ver-historial', label: 'Ver Historial', icon: 'history', primary: false },
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
      // fix-239-m: "Total registros" no dejaba claro que cuenta ventas individuales, no
      // servicios del catálogo — confuso al lado de un catálogo con 1 solo servicio.
      // hotfix-099-m: junto a "Ventas del mes" (agrupa los dos conteos de ventas).
      {
        id: 'ventas-totales',
        label: 'Ventas Totales',
        value: k.totalRegistros,
        icon: 'list-checks',
      },
      {
        id: 'recaudacion-mes',
        label: 'Recaudación del mes',
        value: this.formatCLP(k.recaudacionMes),
        color: 'success',
        trendLabel: this.mesActualLabel(),
      },
      {
        id: 'recaudacion-total',
        label: 'Recaudación Total',
        value: this.formatCLP(k.totalCobrado),
        color: 'success',
        trendLabel: `${k.ventasCobradas} cobradas`,
      },
    ];
  });

  private formatCLP(value: number): string {
    return `$ ${value.toLocaleString('es-CL')}`;
  }

  // ── Handlers ───────────────────────────────────────────────────────────────
  protected onHeroAction(actionId: string): void {
    if (actionId === 'registrar-venta') this.requestRegistrarVenta.emit(undefined);
    if (actionId === 'ver-historial') this.requestVerHistorial.emit();
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
