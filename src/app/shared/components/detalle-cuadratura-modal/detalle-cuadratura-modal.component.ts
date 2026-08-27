import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { HistorialCuadraturasFacade } from '@core/facades/historial-cuadraturas.facade';
import { formatCLP } from '@core/utils/date.utils';
import { StableWidthDirective } from '@core/directives/stable-width.directive';

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface DenominacionRow {
  label: string;
  valor: number;
  qty: number;
  subtotal: number;
}

// ─── Componente ───────────────────────────────────────────────────────────────

@Component({
  selector: 'app-detalle-cuadratura-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, BadgeComponent, KpiCardVariantComponent, StableWidthDirective],
  template: `
    <div class="flex flex-col gap-6 p-1">
      @if (facade.cierreSeleccionado(); as d) {
        <!-- 1. Header Information (Non-numeric info in Bento-style cards) -->
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div class="card p-3 flex flex-col gap-1 bg-elevated">
            <span class="text-2xs font-bold text-text-muted uppercase tracking-wider">Cajero</span>
            <span class="item-title">{{ d.cajero }}</span>
          </div>
          <div class="card p-3 flex flex-col gap-1 bg-elevated">
            <span class="text-2xs font-bold text-text-muted uppercase tracking-wider"
              >Fecha Cierre</span
            >
            <span class="item-title">{{ fechaLabel() }}</span>
          </div>
          <div
            class="card p-3 flex flex-col gap-1 border-border-muted"
            [class.border-success]="d.estadoDiferencia === 'balanced'"
            [class.border-error]="d.estadoDiferencia === 'shortage'"
          >
            <span class="text-2xs font-bold text-text-muted uppercase tracking-wider">Estado</span>
            <div class="flex items-center gap-1.5">
              <div
                class="w-1.5 h-1.5 rounded-full"
                [class.bg-success]="d.estadoDiferencia === 'balanced'"
                [class.bg-warning]="d.estadoDiferencia === 'surplus'"
                [class.bg-error]="d.estadoDiferencia === 'shortage'"
              ></div>
              <span class="item-title">
                {{
                  d.estadoDiferencia === 'balanced'
                    ? 'Cuadrado'
                    : d.estadoDiferencia === 'surplus'
                      ? 'Sobrante'
                      : 'Descuadre'
                }}
              </span>
            </div>
          </div>
        </div>

        <!-- 2. Numeric KPIs — Fondo de apertura + Saldo físico contado.
             (fix-226-m: se restauró el Fondo de apertura, ahora que se persiste de verdad
             en cash_closings.opening_amount desde spec 0012-m. hotfix-002-i lo había quitado
             cuando el dato era un 50.000 hardcodeado y engañoso.) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          @if (d.fondoInicial !== null) {
            <app-kpi-card-variant
              label="Fondo de Apertura"
              [value]="d.fondoInicial"
              prefix="$"
              icon="wallet"
              color="default"
            />
          } @else {
            <div class="card p-3 flex flex-col gap-1 bg-elevated">
              <span class="text-2xs font-bold text-text-muted uppercase tracking-wider"
                >Fondo de Apertura</span
              >
              <span class="item-title text-text-muted">No registrado</span>
            </div>
          }
          <app-kpi-card-variant
            label="Saldo Físico"
            [value]="d.saldoFisico"
            prefix="$"
            icon="banknote"
            color="default"
          />
        </div>

        <!-- 3. Arqueo Details (Bento Feature) -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2 flex flex-col gap-5">
            <div
              class="card p-5 relative overflow-hidden bg-elevated border-border-muted shadow-sm"
            >
              <div
                class="absolute top-0 right-0 w-32 h-32 bg-brand/5 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none"
              ></div>

              <div class="flex flex-col gap-4">
                <div class="flex items-center justify-between border-b border-border-muted/50 pb-3">
                  <div class="flex items-center gap-2">
                    <app-icon name="calculator" [size]="18" class="text-brand" />
                    <h3 class="item-title">Conciliación Operativa</h3>
                  </div>
                  <span class="text-2xs font-black uppercase tracking-widest text-text-muted"
                    >Resumen Financiero</span
                  >
                </div>

                <!-- fix-226-m: libro de conciliación explícito. El arqueo solo cuenta EFECTIVO
                     (fondo + ingresos efectivo − egresos efectivo = saldo teórico); el egreso
                     pagado con tarjeta/transferencia se muestra aparte porque no toca la caja. -->
                <div class="flex flex-col gap-2 text-sm tabular-nums">
                  <div class="flex items-center justify-between">
                    <span class="text-text-secondary">Fondo de apertura</span>
                    @if (d.fondoInicial !== null) {
                      <span class="font-semibold text-text-primary">{{
                        formatAmt(d.fondoInicial)
                      }}</span>
                    } @else {
                      <span class="text-text-muted">No registrado</span>
                    }
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-text-secondary">Ingresos en efectivo</span>
                    <span class="font-semibold text-success"
                      >+ {{ formatAmt(d.ingresosEfectivo) }}</span
                    >
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-text-secondary">Egresos en efectivo</span>
                    <span class="font-semibold text-error">− {{ formatAmt(d.cashExpenses) }}</span>
                  </div>

                  <div class="border-t border-border-muted/50 my-1"></div>

                  <div class="flex items-center justify-between">
                    <span class="text-2xs font-bold text-text-muted uppercase tracking-wider"
                      >Saldo teórico (sistema)</span
                    >
                    <span class="font-black text-text-primary">{{
                      formatAmt(d.saldoSistema)
                    }}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-2xs font-bold text-text-muted uppercase tracking-wider"
                      >Saldo físico contado</span
                    >
                    <span class="font-black text-text-primary">{{ formatAmt(d.saldoFisico) }}</span>
                  </div>
                  <div
                    class="flex items-center justify-between p-3 rounded-xl bg-surface border border-border-muted/30 shadow-subtle mt-1"
                  >
                    <span class="text-2xs font-bold uppercase tracking-wider text-text-muted"
                      >Diferencia</span
                    >
                    <span
                      class="text-lg font-black tracking-tighter"
                      [class.text-error]="d.estadoDiferencia === 'shortage'"
                      [class.text-warning]="d.estadoDiferencia === 'surplus'"
                      [class.text-success]="d.estadoDiferencia === 'balanced'"
                    >
                      {{ d.diferencia > 0 ? '+ ' : d.diferencia < 0 ? '− ' : ''
                      }}{{ formatAmt(d.diferencia) }}
                    </span>
                  </div>
                  @if (facade.ajustesCierre().length > 0) {
                    <div class="flex items-center justify-between text-2xs text-text-muted mt-1">
                      <span>Saldo vigente (con ajustes)</span>
                      <span class="font-semibold">{{ formatAmt(facade.totalVigente()) }}</span>
                    </div>
                  }
                </div>

                <!-- Egreso total del día — contexto, no afecta el arqueo -->
                <div
                  class="flex flex-col gap-1 pt-3 border-t border-dashed border-border-muted/60 text-2xs text-text-muted"
                >
                  <div class="flex items-center justify-between">
                    <span class="uppercase tracking-wider font-semibold"
                      >Total egresos del día</span
                    >
                    <span class="tabular-nums font-semibold text-text-secondary">{{
                      formatAmt(d.totalEgresos)
                    }}</span>
                  </div>
                  @if (d.nonCashExpenses > 0) {
                    <p class="leading-relaxed">
                      {{ formatAmt(d.nonCashExpenses) }} pagados con tarjeta / transferencia — no
                      afectan el arqueo de caja.
                    </p>
                  }
                </div>
              </div>
            </div>

            @if (d.notes) {
              <div class="card p-5 bg-subtle/30 border-dashed border-border-muted">
                <div class="flex items-center gap-2 mb-2">
                  <app-icon name="info" [size]="14" class="text-text-muted" />
                  <h4 class="text-2xs font-black text-text-primary uppercase tracking-widest">
                    Observaciones
                  </h4>
                </div>
                <p class="text-sm italic text-text-secondary leading-relaxed whitespace-pre-wrap">
                  "{{ d.notes }}"
                </p>
              </div>
            }
          </div>

          <!-- Denominaciones sidebar -->
          <div class="flex flex-col gap-4">
            <div class="card p-0 overflow-hidden border-border-muted shadow-sm">
              <div
                class="px-4 py-3 bg-subtle border-b border-border-muted flex items-center justify-between"
              >
                <span class="text-2xs font-bold text-text-primary uppercase tracking-widest"
                  >Desglose Físico</span
                >
                <span
                  class="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center shrink-0"
                >
                  <app-icon name="coins" [size]="12" class="text-brand" />
                </span>
              </div>

              <div class="divide-y divide-border-muted/30 max-h-85 overflow-y-auto">
                @for (den of denominaciones(); track den.label) {
                  <div
                    class="px-4 py-2.5 flex items-center justify-between hover:bg-subtle/50 transition-colors"
                  >
                    <div class="flex flex-col">
                      <span class="text-2xs font-semibold text-text-secondary">{{
                        den.label
                      }}</span>
                      <span class="text-2xs text-text-muted">Cant: {{ den.qty }}</span>
                    </div>
                    <span class="text-xs font-bold tabular-nums text-text-primary">{{
                      formatAmt(den.subtotal)
                    }}</span>
                  </div>
                }
              </div>

              <div
                class="card-tinted border-t-2 border-brand/20 p-4 flex justify-between items-center mt-auto"
              >
                <span class="text-2xs font-black text-text-primary uppercase tracking-wider"
                  >Total Efectivo</span
                >
                <span class="text-xl font-black tabular-nums tracking-tighter text-brand">{{
                  formatAmt(d.saldoFisico)
                }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. Ajustes de cuadratura (spec 0002-i) -->
        <div class="card p-0 overflow-hidden border-border-muted shadow-sm">
          <div
            class="px-4 py-3 bg-subtle border-b border-border-muted flex items-center justify-between"
          >
            <div class="flex items-center gap-2">
              <span
                class="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center shrink-0"
              >
                <app-icon name="wrench" [size]="12" class="text-brand" />
              </span>
              <span class="text-2xs font-bold text-text-primary uppercase tracking-widest"
                >Ajustes</span
              >
            </div>
            @if (facade.isAdmin()) {
              <button
                type="button"
                class="flex items-center gap-1.5 text-2xs font-bold text-brand cursor-pointer"
                data-llm-action="registrar-ajuste-cuadratura"
                (click)="facade.abrirRegistrarAjusteDrawer()"
              >
                <app-icon name="plus" [size]="12" />
                Registrar ajuste
              </button>
            }
          </div>

          @if (facade.isLoadingAjustes()) {
            <div class="px-4 py-6 flex items-center justify-center">
              <app-icon name="loader-circle" [size]="16" class="animate-spin text-text-muted" />
            </div>
          } @else if (facade.ajustesCierre().length === 0) {
            <div class="px-4 py-6 text-center">
              <p class="text-2xs text-text-muted">Sin ajustes registrados sobre esta cuadratura.</p>
            </div>
          } @else {
            <div class="divide-y divide-border-muted/30">
              @for (ajuste of facade.ajustesCierre(); track ajuste.id) {
                <div class="px-4 py-3 flex items-start justify-between gap-3">
                  <div class="flex flex-col gap-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <app-badge
                        [variant]="ajuste.tipo === 'gasto_olvidado' ? 'warning' : 'neutral'"
                      >
                        {{ ajuste.tipoLabel }}
                      </app-badge>
                      <span class="text-2xs text-text-muted">{{ ajuste.fecha }}</span>
                    </div>
                    <span class="text-xs text-text-secondary truncate">{{ ajuste.motivo }}</span>
                    <span class="text-2xs text-text-muted"
                      >Registrado por {{ ajuste.autorNombre }}</span
                    >
                  </div>
                  <span
                    class="text-sm font-bold tabular-nums shrink-0"
                    [class.text-error]="ajuste.monto < 0"
                    [class.text-success]="ajuste.monto > 0"
                  >
                    {{ ajuste.monto >= 0 ? '+' : '' }}{{ formatAmt(ajuste.monto) }}
                  </span>
                </div>
              }
            </div>
          }
        </div>

        <!-- 5. Footer con exportación -->
        <div
          class="flex flex-col sm:flex-row items-center justify-end gap-3 pt-6 border-t border-border-muted mt-2"
        >
          <div class="relative w-full sm:w-auto">
            <button
              class="w-full sm:w-auto flex items-center justify-center gap-2 text-xs font-bold px-6 py-3.5 rounded-xl transition-all cursor-pointer border border-border-muted bg-surface text-text-secondary hover:bg-subtle"
              [disabled]="facade.isExporting()"
              [appStableWidth]="facade.isExporting()"
              (click)="exportMenuOpen.set(!exportMenuOpen())"
              data-llm-action="exportar-detalle-cuadratura"
            >
              @if (facade.isExporting()) {
                <app-icon name="loader-circle" [size]="15" class="animate-spin" />
                Generando...
              } @else {
                <app-icon name="download" [size]="15" />
                Exportar
                <app-icon name="chevron-up" [size]="13" />
              }
            </button>

            @if (exportMenuOpen()) {
              <div class="fixed inset-0 z-10" (click)="exportMenuOpen.set(false)"></div>
              <!-- fix-226-m: abre hacia ARRIBA (bottom-full) — el botón vive al fondo de un
                   drawer scrolleable, un menú top-full quedaba recortado bajo el borde. -->
              <div
                class="absolute bottom-full mb-2 right-0 z-20 min-w-50 bg-surface border border-border-muted rounded-lg shadow-[0_8px_24px_rgb(0_0_0/12%)] overflow-hidden"
              >
                <button
                  type="button"
                  class="flex items-center gap-2 w-full px-3.5 py-2.5 text-compact text-text-primary hover:bg-elevated transition-colors border-none bg-transparent cursor-pointer text-left"
                  (click)="requestExport('excel')"
                  data-llm-action="export-detalle-cuadratura-excel"
                >
                  <app-icon name="table-2" [size]="16" />
                  Exportar como Excel
                </button>
                <button
                  type="button"
                  class="flex items-center gap-2 w-full px-3.5 py-2.5 text-compact text-text-primary hover:bg-elevated transition-colors border-none bg-transparent cursor-pointer text-left"
                  (click)="requestExport('pdf')"
                  data-llm-action="export-detalle-cuadratura-pdf"
                >
                  <app-icon name="file-text" [size]="16" />
                  Exportar como PDF
                </button>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
})
export class DetalleCuadraturaModalComponent {
  protected readonly facade = inject(HistorialCuadraturasFacade);
  protected readonly abs = Math.abs;

  readonly fechaLabel = computed(() => {
    const d = this.facade.cierreSeleccionado();
    if (!d) return '';
    const [yyyy, mm, dd] = d.fecha.split('-');
    return `${dd}/${mm}/${yyyy}`;
  });

  readonly denominaciones = computed<DenominacionRow[]>(() => {
    const d = this.facade.cierreSeleccionado();
    if (!d) return [];

    const rows: { label: string; valor: number; key: keyof typeof d }[] = [
      { label: '$20.000', valor: 20000, key: 'qtyBill20000' },
      { label: '$10.000', valor: 10000, key: 'qtyBill10000' },
      { label: '$5.000', valor: 5000, key: 'qtyBill5000' },
      { label: '$2.000', valor: 2000, key: 'qtyBill2000' },
      { label: '$1.000', valor: 1000, key: 'qtyBill1000' },
      { label: '$500', valor: 500, key: 'qtyCoin500' },
      { label: '$100', valor: 100, key: 'qtyCoin100' },
      { label: '$50', valor: 50, key: 'qtyCoin50' },
      { label: '$10', valor: 10, key: 'qtyCoin10' },
    ];

    return rows
      .map((r) => ({
        label: r.label,
        valor: r.valor,
        qty: d[r.key] as number,
        subtotal: (d[r.key] as number) * r.valor,
      }))
      .filter((r) => r.qty > 0);
  });

  protected formatAmt(val: number): string {
    return formatCLP(val);
  }

  protected readonly exportMenuOpen = signal(false);

  protected requestExport(format: 'excel' | 'pdf'): void {
    this.exportMenuOpen.set(false);
    void this.facade.exportarCierre(format);
  }
}
