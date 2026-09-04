import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { IconComponent } from '@shared/components/icon/icon.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { ServiciosEspecialesFacade } from '@core/facades/servicios-especiales.facade';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { ToastService } from '@core/services/ui/toast.service';
import { StableWidthDirective } from '@core/directives/stable-width.directive';
import { PeriodSelectorComponent } from '@shared/components/period-selector/period-selector.component';
import type { VentaServicio } from '@core/models/ui/servicios-especiales.model';
import {
  DEFAULT_PERIOD_WINDOW,
  applyPeriodWindow,
  type PeriodWindow,
} from '@core/utils/period-window.utils';

/**
 * HistorialVentasDrawerComponent — Historial de ventas de Servicios Especiales en side-drawer
 * (fix-239-m). Antes vivía como segunda mitad del bento junto al catálogo; se movió a un
 * drawer abierto desde la acción "Ver Historial" del Hero para que el catálogo pueda ocupar
 * todo el ancho. Self-sufficient (mismo espíritu que `AdminExAlumnosTasasDrawerComponent`):
 * inyecta `ServiciosEspecialesFacade` directo, sin inputs — importado también por
 * `SecretariaServiciosEspecialesComponent` vía la Facade (que resuelve el drawer a abrir).
 *
 * Estilo de lista calcado de `PagosRecientesDrawerComponent` (mismo tipo de contenido:
 * historial paginado de un drawer) — card grande + filas divididas (`rows-divider`), SIN
 * componente de paginación: a diferencia de la tabla de la página principal (que sí necesita
 * `p-table[paginator]` para acotar el DOM, spec 0039-b), un drawer con scroll nativo no tiene
 * ese límite — el propio `Pagos Recientes` tampoco pagina, solo muestra un contador al pie.
 */
@Component({
  selector: 'app-historial-ventas-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    SelectModule,
    IconComponent,
    DrawerFormComponent,
    StableWidthDirective,
    PeriodSelectorComponent,
  ],
  template: `
    <app-drawer-form [hasFooter]="false">
      <div class="flex flex-col gap-5">
        <!-- ── Filtros ──────────────────────────────────────────────────────────── -->
        <div class="card p-4 flex flex-col gap-3">
          <div class="flex items-center justify-between gap-2">
            <h3 class="item-title">Filtrar Historial</h3>
            <div class="relative shrink-0">
              <button
                type="button"
                class="btn-secondary h-9 flex items-center justify-center gap-2 disabled:opacity-60"
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
          <div class="flex flex-col sm:flex-row gap-3">
            <p-select
              [ngModel]="filtroServicio()"
              (ngModelChange)="onFiltroServicioChange($event)"
              [options]="filtroOptions()"
              optionLabel="label"
              optionValue="value"
              placeholder="Todos los servicios"
              [showClear]="true"
              styleClass="w-full"
              data-llm-description="filter ventas by service"
            />
            <app-period-selector
              [window]="periodWindow()"
              (windowChange)="onPeriodWindowChange($event)"
              ariaLabel="Período del historial de ventas"
            />
          </div>
        </div>

        <!-- ── Lista de ventas ──────────────────────────────────────────────────── -->
        <div class="card p-0 overflow-hidden">
          @if (ventasFiltradas().length === 0) {
            <div class="px-4 py-10 flex flex-col items-center gap-2 text-center">
              <app-icon name="search-x" [size]="28" color="var(--text-muted)" />
              <p class="text-sm text-text-muted">
                No se encontraron ventas con los filtros seleccionados.
              </p>
            </div>
          } @else {
            <div class="rows-divider">
              @for (venta of ventasFiltradas(); track venta.id) {
                <div class="p-3 flex flex-col gap-1.5">
                  <div class="flex items-center justify-between gap-2">
                    <span class="item-title truncate" [title]="venta.cliente">{{
                      venta.cliente
                    }}</span>
                    <div class="flex items-center gap-2 shrink-0">
                      <span class="font-semibold text-text-primary"
                        >\${{ venta.precio.toLocaleString('es-CL') }}</span
                      >
                      <button
                        type="button"
                        class="cursor-pointer text-text-muted hover:text-error transition-colors p-1 rounded-lg hover:bg-error/10"
                        [attr.data-llm-action]="'borrar-venta-' + venta.id"
                        [attr.aria-label]="'Borrar venta de ' + venta.cliente"
                        (click)="onBorrar(venta)"
                      >
                        <app-icon name="trash-2" [size]="14" />
                      </button>
                    </div>
                  </div>
                  <div class="flex items-center justify-between gap-2 text-xs text-text-muted">
                    <span class="truncate font-mono uppercase">{{ venta.rut }}</span>
                    @if (venta.resultado) {
                      <span
                        class="font-medium shrink-0"
                        [style.color]="
                          venta.resultado === 'Apto' ? 'var(--state-success)' : 'var(--state-error)'
                        "
                      >
                        {{ venta.resultado === 'Apto' ? '✓' : '✗' }} {{ venta.resultado }}
                      </span>
                    }
                  </div>
                  <div class="flex items-center gap-1.5 text-xs text-text-secondary">
                    {{ venta.servicio }} · {{ venta.fecha }}
                    @if (venta.documentNumber) {
                      <span
                        class="font-mono px-1.5 py-0.5 rounded text-text-muted bg-surface border border-border-muted"
                      >
                        {{ venta.documentNumber }}
                      </span>
                    }
                  </div>
                </div>
              }
            </div>
            <div class="px-4 py-3 flex items-center justify-between border-t border-border-muted">
              <span class="text-xs text-text-muted"
                >{{ ventasFiltradas().length }} de {{ facade.ventas().length }} ventas</span
              >
            </div>
          }
        </div>
      </div>
    </app-drawer-form>
  `,
  styles: [
    `
      .rows-divider > * + * {
        border-top: 1px solid var(--border-muted);
      }

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
    `,
  ],
})
export class HistorialVentasDrawerComponent {
  protected readonly facade = inject(ServiciosEspecialesFacade);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly toast = inject(ToastService);

  protected readonly isExporting = this.facade.isExporting;

  protected readonly filtroServicio = signal<string | null>(null);
  protected readonly exportMenuOpen = signal(false);
  protected readonly periodWindow = signal<PeriodWindow>(DEFAULT_PERIOD_WINDOW);

  protected readonly filtroOptions = computed(() =>
    this.facade.catalogo().map((s) => ({ label: s.nombre, value: String(s.id) })),
  );

  protected readonly ventasFiltradas = computed(() => {
    const filtro = this.filtroServicio();
    const all = this.facade.ventas();
    const porServicio = !filtro ? all : all.filter((v) => String(v.servicioId) === filtro);

    return applyPeriodWindow(porServicio, {
      window: this.periodWindow(),
      hasActiveSearch: false,
      dateOf: (v) => v.fecha,
    });
  });

  protected onFiltroServicioChange(value: string | null): void {
    this.filtroServicio.set(value);
  }

  protected onPeriodWindowChange(value: PeriodWindow): void {
    this.periodWindow.set(value);
  }

  protected onExport(format: 'excel' | 'pdf'): void {
    this.exportMenuOpen.set(false);
    void this.facade.exportarHistorial(format);
  }

  protected async onBorrar(venta: VentaServicio): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: 'Borrar venta',
      message: `¿Borrar la venta de "${venta.servicio}" a ${venta.cliente}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Sí, borrar',
      cancelLabel: 'Cancelar',
      severity: 'danger',
    });

    if (!confirmed) return;

    const { success, blockedReason } = await this.facade.borrarVenta(venta.id);
    if (success) {
      this.toast.success('Venta borrada');
    } else if (blockedReason) {
      this.toast.warning('No se pudo borrar', blockedReason);
    } else {
      this.toast.error('No se pudo borrar la venta');
    }
  }
}
