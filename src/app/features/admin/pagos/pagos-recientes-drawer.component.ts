import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { PagosFacade } from '@core/facades/pagos.facade';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { formatCLP, formatChileanDate } from '@core/utils/date.utils';

/**
 * PagosRecientesDrawerComponent — Historial de pagos recientes + Métodos de Pago del mes.
 *
 * Abierto vía LayoutDrawerFacadeService.open() desde el botón "Pagos Recientes" del hero
 * de AdminPagosComponent/SecretariaPagosComponent (fix-132-m). Reemplaza el bloque que antes
 * vivía apilado en la página: en un viewport típico (900px de alto) esa fila no tenía espacio
 * real para mostrar ninguna fila de pago (header + footer ya consumían todo el alto disponible
 * del bento-fill) — un drawer con scroll nativo no tiene ese límite.
 */
@Component({
  selector: 'app-pagos-recientes-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    SelectModule,
    IconComponent,
    BadgeComponent,
    SkeletonBlockComponent,
    DrawerFormComponent,
  ],
  template: `
    <app-drawer-form [hasFooter]="false">
      <div class="flex flex-col gap-5">
        <!-- ── Métodos de Pago ──────────────────────────────────────────────────── -->
        <div class="card p-4 flex flex-col gap-3">
          <h3 class="item-title">Métodos de Pago ({{ mesActual() }})</h3>

          @if (facade.isLoading()) {
            @for (i of [1, 2, 3]; track i) {
              <div class="flex flex-col gap-1.5">
                <app-skeleton-block variant="text" width="60%" height="12px" />
                <app-skeleton-block variant="rect" width="100%" height="6px" />
              </div>
            }
          } @else {
            @for (metodo of facade.metodosPagoMes(); track metodo.metodo) {
              <div class="flex flex-col gap-1.5">
                <div class="flex items-center justify-between">
                  <span
                    class="flex items-center gap-1.5 text-xs font-medium"
                    [style.color]="metodo.color"
                  >
                    <app-icon [name]="metodo.icono" [size]="12" />
                    {{ metodo.metodo }}
                  </span>
                  <span class="text-xs font-semibold text-text-primary"
                    >{{ metodo.porcentaje }}%</span
                  >
                </div>
                <div class="h-1.5 rounded-full overflow-hidden bg-border-muted">
                  <div
                    class="h-full rounded-full"
                    [style.width.%]="metodo.porcentaje"
                    [style.background]="metodo.color"
                  ></div>
                </div>
              </div>
            } @empty {
              <div class="flex flex-col items-center gap-1.5 py-4 text-center">
                <app-icon name="pie-chart" [size]="22" color="var(--text-muted)" />
                <p class="text-xs text-text-muted">Sin pagos registrados este mes.</p>
              </div>
            }
          }
        </div>

        <!-- ── Buscador + filtros ───────────────────────────────────────────────── -->
        <div class="flex flex-col gap-3">
          <h3 class="item-title">Pagos Recientes</h3>
          <div class="relative">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <app-icon name="search" [size]="16" color="var(--text-muted)" />
            </div>
            <input
              type="search"
              placeholder="Buscar por alumno o N° boleta..."
              class="w-full text-sm pl-10 pr-4 py-2.5 rounded-lg transition-colors focus:outline-none bg-base hover:border-text-muted focus:border-brand border border-border-muted text-text-primary"
              (input)="onSearch($event)"
            />
          </div>
          <div class="flex flex-col sm:flex-row gap-3">
            <p-select
              [options]="estadoOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Todos los estados"
              [ngModel]="filtroEstado()"
              (ngModelChange)="filtroEstado.set($event)"
              styleClass="w-full"
              data-llm-description="filter payments by status"
            />
            <p-select
              [options]="metodoOptions"
              optionLabel="label"
              optionValue="value"
              placeholder="Todos los métodos"
              [ngModel]="filtroMetodo()"
              (ngModelChange)="filtroMetodo.set($event)"
              styleClass="w-full"
              data-llm-description="filter payments by payment method"
            />
          </div>
        </div>

        <!-- ── Lista de pagos ───────────────────────────────────────────────────── -->
        <div class="card p-0 overflow-hidden">
          @if (facade.isLoading()) {
            <div class="rows-divider">
              @for (row of [1, 2, 3, 4, 5]; track row) {
                <div class="p-3 flex flex-col gap-2">
                  <app-skeleton-block variant="text" width="60%" height="14px" />
                  <app-skeleton-block variant="text" width="90%" height="12px" />
                </div>
              }
            </div>
          } @else if (pagosFiltrados().length === 0) {
            <div class="px-4 py-10 flex flex-col items-center gap-2 text-center">
              <app-icon name="search" [size]="28" color="var(--text-muted)" />
              <p class="text-sm text-text-muted">
                No se encontraron pagos con los filtros seleccionados.
              </p>
            </div>
          } @else {
            <div class="rows-divider">
              @for (pago of pagosFiltrados(); track pago.id) {
                <div class="p-3 flex flex-col gap-1.5">
                  <div class="flex items-center justify-between gap-2">
                    <span class="item-title truncate" [title]="pago.alumno">{{ pago.alumno }}</span>
                    <app-badge [variant]="estadoVariant(pago.estado)" class="shrink-0">
                      @if (pago.estado === 'completado') {
                        <app-icon name="check" [size]="10" />
                      }
                      {{ estadoLabel(pago.estado) }}
                    </app-badge>
                  </div>
                  <div class="flex items-center justify-between gap-2 text-xs text-text-muted">
                    <span class="truncate"
                      >{{ fechaCorta(pago.fecha) }} · {{ pago.concepto ?? '—' }}</span
                    >
                    <span class="font-semibold text-text-primary shrink-0">{{
                      clp(pago.monto)
                    }}</span>
                  </div>
                  <div class="flex items-center gap-1.5 text-xs text-text-secondary">
                    <app-icon [name]="pago.metodoIcono" [size]="12" />
                    {{ pago.metodo }}
                    <span
                      class="font-mono px-1.5 py-0.5 rounded text-text-muted bg-surface border border-border-muted"
                    >
                      {{ pago.nroDocumento ?? '—' }}
                    </span>
                  </div>
                </div>
              }
            </div>
            <div class="px-4 py-3 flex items-center justify-between border-t border-border-muted">
              <span class="text-xs text-text-muted"
                >{{ pagosFiltrados().length }} de {{ facade.pagosRecientes().length }} pagos</span
              >
            </div>
          }
        </div>
      </div>
    </app-drawer-form>
  `,
  styles: `
    .rows-divider > * + * {
      border-top: 1px solid var(--border-muted);
    }
  `,
})
export class PagosRecientesDrawerComponent {
  protected readonly facade = inject(PagosFacade);

  protected readonly clp = formatCLP;

  protected readonly searchQuery = signal('');
  protected readonly filtroEstado = signal<string | null>(null);
  protected readonly filtroMetodo = signal<string | null>(null);

  readonly estadoOptions = [
    { label: 'Completado', value: 'completado' },
    { label: 'Pendiente', value: 'pendiente' },
  ];

  readonly metodoOptions = [
    { label: 'Transferencia', value: 'Transferencia' },
    { label: 'Efectivo', value: 'Efectivo' },
    { label: 'Débito/Crédito', value: 'Débito/Crédito' },
    { label: 'WebPay', value: 'WebPay' },
    { label: 'Mixto', value: 'Mixto' },
  ];

  protected readonly pagosFiltrados = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const estado = this.filtroEstado();
    const metodo = this.filtroMetodo();

    return this.facade.pagosRecientes().filter((p) => {
      const matchSearch =
        !q ||
        p.alumno.toLowerCase().includes(q) ||
        (p.nroDocumento ?? '').toLowerCase().includes(q);
      const matchEstado = !estado || p.estado === estado;
      const matchMetodo = !metodo || p.metodo === metodo;
      return matchSearch && matchEstado && matchMetodo;
    });
  });

  protected readonly mesActual = computed(() => {
    const now = new Date();
    const mes = now.toLocaleDateString('es-Cl', { month: 'long' });
    return mes.charAt(0).toUpperCase() + mes.slice(1);
  });

  protected onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  protected fechaCorta(fecha: string | null): string {
    if (!fecha) return '—';
    return formatChileanDate(fecha, { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  protected estadoVariant(estado: string | null): 'success' | 'warning' | 'neutral' {
    switch (estado) {
      case 'completado':
        return 'success';
      case 'pendiente':
        return 'warning';
      default:
        return 'neutral';
    }
  }

  protected estadoLabel(estado: string | null): string {
    switch (estado) {
      case 'completado':
        return 'Completado';
      case 'pendiente':
        return 'Pendiente';
      default:
        return estado ? 'Pendiente' : '—';
    }
  }
}
