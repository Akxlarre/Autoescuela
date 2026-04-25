import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { IconComponent } from '@shared/components/icon/icon.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { ShortCurrencyPipe } from '@shared/pipes/short-currency.pipe';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';
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
    KpiCardVariantComponent,
    SectionHeroComponent,
    BentoGridLayoutDirective,
    ShortCurrencyPipe,
    FormsModule,
    SelectModule,
  ],
  template: `
    <!-- ── Hero ──────────────────────────────────────────────────────────────── -->
    <app-section-hero
      title="Servicios Especiales"
      subtitle="Punto de venta de servicios complementarios — alumnos y clientes externos"
      icon="receipt"
      [backRoute]="backRoute()"
      backLabel="Inicio"
      [actions]="heroActions"
      (actionClick)="onHeroAction($event)"
    />

    <!-- ── KPIs ───────────────────────────────────────────────────────────────── -->
    <div class="bento-grid mt-4 mb-6" appBentoGridLayout>
      <div class="bento-square">
        <app-kpi-card-variant
          [value]="kpis().ventasMes"
          label="Ventas del mes"
          [trendLabel]="mesActualLabel()"
          icon="receipt"
          [loading]="isLoading()"
        />
      </div>
      <div class="bento-square">
        <div class="bento-card card-tinted h-full flex flex-col gap-2">
          @if (isLoading()) {
            <div class="h-full flex items-center justify-center">
              <app-icon name="loader-2" [size]="24" class="animate-spin text-brand" />
            </div>
          } @else {
            <span class="kpi-label" style="color:var(--state-success)">Total recaudado</span>
            <p class="kpi-value m-0">{{ kpis().totalCobrado | shortCurrency }}</p>
            <p class="text-xs m-0 mt-auto" style="color:var(--text-muted)">
              {{ kpis().ventasCobradas }} ventas cobradas
            </p>
          }
        </div>
      </div>
      <div class="bento-square">
        <div class="bento-card h-full flex flex-col gap-2">
          @if (isLoading()) {
            <div class="h-full flex items-center justify-center">
              <app-icon name="loader-2" [size]="24" class="animate-spin text-brand" />
            </div>
          } @else {
            <span class="kpi-label" style="color:var(--state-warning)">Pendiente de cobro</span>
            <p class="kpi-value m-0" style="color:var(--state-warning)">
              {{ kpis().pendientesCobro | shortCurrency }}
            </p>
            <p class="text-xs m-0 mt-auto" style="color:var(--text-muted)">
              {{ kpis().ventasSinCobrar }} ventas sin cobrar
            </p>
          }
        </div>
      </div>
      <div class="bento-square">
        <app-kpi-card-variant
          [value]="kpis().totalRegistros"
          label="Total registros"
          trendLabel="Todos los servicios"
          icon="list-checks"
          [loading]="isLoading()"
        />
      </div>
    </div>

    <!-- ── Catálogo de Servicios ──────────────────────────────────────────────── -->
    <section class="card mb-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-text-primary m-0">Catálogo de Servicios</h2>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border border-border-default text-text-secondary hover:bg-bg-subtle transition-colors"
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
              <p class="text-xs text-text-muted m-0 leading-relaxed">{{ servicio.descripcion }}</p>
            </div>
            <div
              class="flex items-center justify-between pt-3"
              style="border-top:1px solid var(--border-subtle)"
            >
              <span class="text-base font-bold text-text-primary"
                >\${{ servicio.precio.toLocaleString('es-CL') }}</span
              >
              <button
                type="button"
                class="text-sm font-medium px-3 py-1.5 rounded-lg border border-border-default text-text-secondary hover:bg-bg-subtle transition-colors"
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
          class="flex flex-col items-center justify-center gap-2 rounded-xl min-h-[180px] text-text-muted transition-colors"
          style="border: 2px dashed var(--border-default)"
          data-llm-action="open-nuevo-servicio-drawer-card"
          (click)="requestNuevoServicio.emit()"
        >
          <app-icon name="plus" [size]="28" />
          <span class="text-sm font-medium">Agregar servicio</span>
          <span class="text-xs">Ej. "Uso de Simulador"</span>
        </button>
      </div>
    </section>

    <!-- ── Historial de Ventas ────────────────────────────────────────────────── -->
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
            styleClass="w-full"
          />
          <button
            type="button"
            class="h-9 px-3 text-sm font-medium rounded-lg border border-border-default text-text-secondary hover:bg-bg-subtle transition-colors"
            data-llm-action="exportar-historial"
            (click)="exportarHistorial.emit()"
          >
            Exportar
          </button>
        </div>
      </div>

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
              <th
                class="text-center py-3 px-4 text-xs font-semibold uppercase tracking-wide text-text-muted"
              >
                Acción
              </th>
            </tr>
          </thead>
          <tbody>
            @for (venta of ventasFiltradas(); track venta.id) {
              <tr
                class="transition-colors hover:bg-bg-subtle/50"
                style="border-bottom:1px solid var(--border-subtle)"
              >
                <td class="py-3 px-4">
                  <p class="font-medium text-text-primary m-0">{{ venta.cliente }}</p>
                  <p class="text-[10px] text-text-muted font-mono m-0 uppercase">{{ venta.rut }}</p>
                  @if (venta.resultado) {
                    <span
                      class="text-xs font-medium"
                      [style.color]="
                        venta.resultado === 'Apto' ? 'var(--state-success)' : 'var(--state-error)'
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
                      class="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border"
                      style="background:var(--state-success-bg);color:var(--state-success);border-color:var(--state-success)"
                    >
                      Cobrado
                    </span>
                  } @else {
                    <button
                      type="button"
                      class="text-xs font-medium px-2.5 py-1 rounded border border-border-default text-text-secondary hover:bg-bg-subtle transition-colors"
                      (click)="cobroRegistrado.emit(venta.id)"
                    >
                      Cobrar
                    </button>
                  }
                </td>
                <td class="py-3 px-4 text-text-muted">{{ venta.fecha }}</td>
                <td class="py-3 px-4 text-center">
                  <button
                    type="button"
                    class="text-xs font-medium text-text-muted hover:text-text-primary transition-colors"
                  >
                    Ver
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="py-10 text-center text-text-muted text-sm">
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
          <div class="p-4 rounded-xl bg-bg-surface border border-border-subtle flex flex-col gap-3">
            <div class="flex items-start justify-between gap-2">
              <div class="flex flex-col gap-0.5">
                <span class="font-bold text-text-primary">{{ venta.cliente }}</span>
                <span class="text-[10px] text-text-muted font-mono uppercase tracking-tighter">{{
                  venta.rut
                }}</span>
              </div>
              <span class="text-sm font-black text-text-primary"
                >\${{ venta.precio.toLocaleString('es-CL') }}</span
              >
            </div>

            <div class="flex items-center gap-2">
              <span class="text-xs text-text-secondary px-2 py-1 rounded-md bg-bg-subtle">{{
                venta.servicio
              }}</span>
              <span class="text-[10px] text-text-muted">{{ venta.fecha }}</span>
            </div>

            <div class="flex items-center justify-between pt-3 border-t border-border-subtle/50">
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
                    class="text-[10px] font-bold text-state-success uppercase px-2 py-1 bg-state-success-bg border border-state-success rounded"
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
  `,
})
export class ServiciosEspecialesContentComponent {
  // ── Inputs ──────────────────────────────────────────────────────────────────
  readonly catalogo = input.required<ServicioEspecial[]>();
  readonly ventas = input.required<VentaServicio[]>();
  readonly kpis = input.required<ServiciosEspecialesKpis>();
  readonly isLoading = input<boolean>(false);
  readonly backRoute = input<string>('/app/dashboard');

  // ── Outputs ─────────────────────────────────────────────────────────────────
  readonly requestRegistrarVenta = output<ServicioEspecial | undefined>();
  readonly requestNuevoServicio = output<void>();
  readonly cobroRegistrado = output<number>();
  readonly exportarHistorial = output<void>();

  // ── Estado interno ──────────────────────────────────────────────────────────
  protected readonly filtroServicio = signal('todos');

  // ── Computed ────────────────────────────────────────────────────────────────
  protected readonly filtroOptions = computed(() => [
    { label: 'Todos los servicios', value: 'todos' },
    ...this.catalogo().map((s) => ({ label: s.nombre, value: String(s.id) })),
  ]);

  protected readonly ventasFiltradas = computed(() => {
    const filtro = this.filtroServicio();
    const all = this.ventas();
    return filtro === 'todos' ? all : all.filter((v) => String(v.servicioId) === filtro);
  });

  protected readonly mesActualLabel = computed(() => {
    const fecha = new Date();
    return fecha.toLocaleString('es-CL', { month: 'long', year: 'numeric' });
  });

  // ── Hero config ─────────────────────────────────────────────────────────────
  protected readonly heroActions: SectionHeroAction[] = [
    { id: 'registrar-venta', label: 'Registrar Venta', icon: 'plus', primary: true },
  ];

  // ── Handlers ───────────────────────────────────────────────────────────────
  protected onHeroAction(actionId: string): void {
    if (actionId === 'registrar-venta') this.requestRegistrarVenta.emit(undefined);
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
}
