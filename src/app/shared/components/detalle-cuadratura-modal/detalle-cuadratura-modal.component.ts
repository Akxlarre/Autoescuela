import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { HistorialCuadraturasFacade } from '@core/facades/historial-cuadraturas.facade';
import { formatCLP } from '@core/utils/date.utils';

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
  imports: [IconComponent, KpiCardVariantComponent],
  template: `
    <div class="flex flex-col gap-6 p-1">
      @if (facade.cierreSeleccionado(); as d) {
        <!-- 1. Header Information (Non-numeric info in Bento-style cards) -->
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div class="card p-3 flex flex-col gap-1 bg-bg-surface-elevated">
            <span class="text-[10px] font-bold text-text-muted uppercase tracking-wider">Cajero</span>
            <span class="text-sm font-bold text-text-primary">{{ d.cajero }}</span>
          </div>
          <div class="card p-3 flex flex-col gap-1 bg-bg-surface-elevated">
            <span class="text-[10px] font-bold text-text-muted uppercase tracking-wider">Fecha Cierre</span>
            <span class="text-sm font-bold text-text-primary">{{ fechaLabel() }}</span>
          </div>
          <div class="card p-3 flex flex-col gap-1 border-border-muted"
               [class.border-state-success]="d.estadoDiferencia === 'balanced'"
               [class.border-state-error]="d.estadoDiferencia === 'shortage'">
            <span class="text-[10px] font-bold text-text-muted uppercase tracking-wider">Estado</span>
            <div class="flex items-center gap-1.5">
               <div class="w-1.5 h-1.5 rounded-full"
                    [class.bg-state-success]="d.estadoDiferencia === 'balanced'"
                    [class.bg-state-warning]="d.estadoDiferencia === 'surplus'"
                    [class.bg-state-error]="d.estadoDiferencia === 'shortage'"></div>
               <span class="text-sm font-bold text-text-primary">
                 {{ d.estadoDiferencia === 'balanced' ? 'Cuadrado' : d.estadoDiferencia === 'surplus' ? 'Sobrante' : 'Descuadre' }}
               </span>
            </div>
          </div>
        </div>

        <!-- 2. Numeric KPIs -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <app-kpi-card-variant
            label="Saldo Sistema"
            [value]="d.saldoSistema"
            prefix="$"
            icon="monitor"
            color="default"
          />
          <app-kpi-card-variant
            label="Saldo Físico"
            [value]="d.saldoFisico"
            prefix="$"
            icon="banknote"
            color="default"
          />
          <app-kpi-card-variant
            label="Diferencia"
            [value]="abs(d.diferencia)"
            [prefix]="d.diferencia >= 0 ? '$' : '-$'"
            [icon]="d.estadoDiferencia === 'balanced' ? 'check-circle' : 'alert-circle'"
            [color]="d.estadoDiferencia === 'balanced' ? 'success' : d.estadoDiferencia === 'surplus' ? 'warning' : 'error'"
          />
          <app-kpi-card-variant
            label="Reg ID"
            [value]="d.id"
            icon="hash"
            color="default"
          />
        </div>

        <!-- 3. Arqueo Details (Bento Feature) -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div class="lg:col-span-2 flex flex-col gap-5">
             <div class="card p-5 relative overflow-hidden bg-bg-surface-elevated border-border-muted shadow-sm">
                <div class="absolute top-0 right-0 w-32 h-32 bg-brand/5 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none"></div>

                <div class="flex flex-col gap-4">
                   <div class="flex items-center justify-between border-b border-border-muted/50 pb-3">
                      <div class="flex items-center gap-2">
                        <app-icon name="calculator" [size]="18" class="text-brand" />
                        <h3 class="text-sm font-bold text-text-primary">Conciliación Operativa</h3>
                      </div>
                      <span class="text-[10px] font-black uppercase tracking-widest text-text-muted">Resumen Financiero</span>
                   </div>

                   <div class="grid grid-cols-2 gap-x-8 gap-y-4">
                      <div class="flex flex-col">
                         <span class="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">Fondo Inicial</span>
                         <span class="text-lg font-black tabular-nums tracking-tight text-text-primary">{{ formatAmt(d.fondoInicial) }}</span>
                      </div>
                      <div class="flex flex-col">
                         <span class="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">Ingresos Registrados</span>
                         <span class="text-lg font-black tabular-nums tracking-tight text-state-success">+ {{ formatAmt(d.totalIngresos) }}</span>
                      </div>
                      <div class="flex flex-col">
                         <span class="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">Egresos / Gastos</span>
                         <span class="text-lg font-black tabular-nums tracking-tight text-state-error">- {{ formatAmt(d.totalEgresos) }}</span>
                      </div>
                      <div class="flex flex-col p-3 rounded-xl bg-bg-surface border border-border-muted/30 shadow-subtle">
                         <span class="text-[11px] font-semibold text-text-muted uppercase tracking-wider mb-1">Cierre Total</span>
                         <span class="text-xl font-black tabular-nums tracking-tighter"
                               [class.text-state-error]="d.estadoDiferencia === 'shortage'"
                               [class.text-state-warning]="d.estadoDiferencia === 'surplus'"
                               [class.text-state-success]="d.estadoDiferencia === 'balanced'">
                           {{ formatAmt(d.saldoFisico) }}
                         </span>
                      </div>
                   </div>
                </div>
             </div>

             @if (d.notes) {
                <div class="card p-5 bg-bg-subtle/30 border-dashed border-border-muted">
                   <div class="flex items-center gap-2 mb-2">
                      <app-icon name="info" [size]="14" class="text-text-muted" />
                      <h4 class="text-[10px] font-black text-text-primary uppercase tracking-widest">Observaciones</h4>
                   </div>
                   <p class="text-sm italic text-text-secondary leading-relaxed whitespace-pre-wrap">"{{ d.notes }}"</p>
                </div>
             }
          </div>

          <!-- Denominaciones sidebar -->
          <div class="flex flex-col gap-4">
             <div class="card p-0 overflow-hidden border-border-muted shadow-sm">
                <div class="px-4 py-3 bg-bg-subtle border-b border-border-muted flex items-center justify-between">
                   <span class="text-[10px] font-bold text-text-primary uppercase tracking-widest">Desglose Físico</span>
                   <app-icon name="coins" [size]="13" class="text-text-muted" />
                </div>
                
                <div class="divide-y divide-border-muted/30 max-h-[340px] overflow-y-auto">
                   @for (den of denominaciones(); track den.label) {
                      <div class="px-4 py-2.5 flex items-center justify-between hover:bg-bg-subtle/50 transition-colors">
                         <div class="flex flex-col">
                            <span class="text-[11px] font-semibold text-text-secondary">{{ den.label }}</span>
                            <span class="text-[10px] text-text-muted">Cant: {{ den.qty }}</span>
                         </div>
                         <span class="text-xs font-bold tabular-nums text-text-primary">{{ formatAmt(den.subtotal) }}</span>
                      </div>
                   }
                </div>

                <div class="p-4 bg-bg-surface-elevated border-t border-border-muted flex justify-between items-center mt-auto">
                   <span class="text-[11px] font-black text-text-primary uppercase">Total Efectivo</span>
                   <span class="text-base font-black text-brand tabular-nums tracking-tight">{{ formatAmt(d.saldoFisico) }}</span>
                </div>
             </div>
          </div>
        </div>

        <!-- 4. Footer -->
        <div class="flex flex-col sm:flex-row items-center justify-end gap-3 pt-6 border-t border-border-muted mt-2">
           <button
             class="w-full sm:w-auto flex items-center justify-center gap-2 text-xs font-bold px-6 py-3.5 rounded-xl transition-all cursor-pointer border border-border-muted bg-bg-surface text-text-secondary hover:bg-bg-subtle"
             (click)="imprimir()"
             data-llm-action="imprimir-detalle-cuadratura"
           >
             <app-icon name="printer" [size]="15" />
             Generar Comprobante
           </button>
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

  protected imprimir(): void {
    window.print();
  }
}
