import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Button } from 'primeng/button';
import { RouterLink } from '@angular/router';
import { IconComponent } from '@shared/components/icon/icon.component';
import { StatBoxComponent } from '@shared/components/stat-box/stat-box.component';
import type { PagoUI } from '@core/models/ui/alumno-detalle.model';

@Component({
  selector: 'app-admin-historial-pagos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, Button, RouterLink, IconComponent, StatBoxComponent],
  template: `
    <div class="bento-card !p-0 flex flex-col h-full w-full overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between p-5 border-b border-border-subtle bg-bg-elevated/30">
        <div class="flex flex-col">
          <h2 class="text-base font-bold text-text-primary m-0">Estado Financiero</h2>
          <span class="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-0.5">Control de Pagos</span>
        </div>
        <div class="w-8 h-8 rounded-full bg-state-success/10 flex items-center justify-center text-state-success">
          <app-icon name="dollar-sign" [size]="18" />
        </div>
      </div>

      <!-- Content -->
      <div class="flex flex-col gap-5 p-5 flex-1 min-h-0">
        <!-- Totals Section -->
        <div class="grid grid-cols-1 gap-4">
          <app-stat-box
            label="TOTAL PAGADO"
            [value]="'$' + totalPagado().toLocaleString('es-CL')"
            variant="success"
          />

          <app-stat-box
            label="SALDO PENDIENTE"
            [value]="'$' + saldoPendiente().toLocaleString('es-CL')"
            variant="warning"
          />
        </div>

        <div class="h-px bg-border-subtle w-full my-1"></div>

        <!-- History List -->
        <div class="flex flex-col gap-3 flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1">
          @if (pagos().length === 0) {
            <div class="flex flex-col items-center justify-center gap-3 py-8 opacity-40">
              <app-icon name="receipt" [size]="32" />
              <p class="text-xs font-medium text-center">No hay pagos registrados</p>
            </div>
          }

          @for (pago of pagos(); track pago.id) {
            <div class="flex flex-col gap-1.5 p-3 rounded-xl bg-bg-elevated/50 border border-border-subtle shadow-sm transition-all hover:bg-bg-elevated">
              <div class="flex items-start justify-between gap-2">
                <span class="text-xs font-bold text-text-primary line-clamp-1 truncate pr-2">{{ pago.concepto }}</span>
                <span class="text-xs font-bold text-text-primary shrink-0">\${{ pago.monto.toLocaleString('es-CL') }}</span>
              </div>
              
              <div class="flex items-center justify-between mt-1">
                <div class="flex items-center gap-2">
                   <span class="text-[10px] text-text-muted font-medium">{{ pago.fecha }}</span>
                   @if (pago.metodo) {
                     <span class="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-bg-subtle text-text-muted border border-border-subtle">
                        {{ pago.metodo }}
                     </span>
                   }
                </div>
                <span class="inas-badge !px-2 !py-0.5 !text-[9px]" 
                      [class.inas-badge--approved]="pago.estado === 'Pagado'"
                      [class.inas-badge--pending]="pago.estado === 'Pendiente'">
                  {{ pago.estado }}
                </span>
              </div>
            </div>
          }
        </div>

        <!-- Footer -->
        <p-button
          label="Ver todo el historial"
          icon="pi pi-external-link"
          size="small"
          [text]="true"
          class="mt-auto w-full pt-2"
          routerLink="/app/admin/pagos"
        />
      </div>
    </div>
  `,
  styles: `
    .inas-badge {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      padding: 2px 8px;
      border-radius: var(--radius-full);
      font-size: var(--text-xs);
      font-weight: var(--font-medium);
      color: var(--text-muted);
      background: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
    }
    .inas-badge--pending {
      color: var(--state-warning);
      background: var(--state-warning-bg);
      border-color: var(--state-warning-border);
    }
    .inas-badge--approved {
      color: var(--state-success);
      background: var(--state-success-bg);
      border-color: var(--state-success-border);
    }

    .custom-scrollbar::-webkit-scrollbar {
      width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: var(--border-default);
      border-radius: 10px;
    }
  `
})
export class AdminHistorialPagosComponent {
  pagos = input.required<PagoUI[]>();
  totalPagado = input.required<number>();
  saldoPendiente = input.required<number>();
}
