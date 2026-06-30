import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import { CardHoverDirective } from '@core/directives/card-hover.directive';

@Component({
  selector: 'app-admin-stats-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, CardHoverDirective],
  template: `
    <div
      class="bento-card bento-tall p-6 flex flex-col h-full bg-surface overflow-hidden"
      appCardHover
    >
      <div class="flex flex-col mb-6">
        <h3 class="text-base font-bold text-text-primary m-0">Tasas de Aprobación</h3>
        <span class="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-0.5"
          >Métricas de Éxito</span
        >
      </div>

      <div class="flex flex-col gap-6 flex-1">
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-text-muted uppercase tracking-wider"
              >Aprobación Municipal</span
            >
            <span class="text-sm font-black text-text-primary">{{ municipalRate() }}%</span>
          </div>
          <div class="progress-bar-track">
            <div class="progress-bar-fill bg-brand" [style.width.%]="municipalRate()"></div>
          </div>
          <p class="text-[10px] text-text-muted mt-2">
            Basado en {{ totalExams() }} exámenes este año.
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-text-muted uppercase tracking-wider"
              >Examen Psicotécnico</span
            >
            <span class="text-sm font-black text-info">{{ psychoRate() }}%</span>
          </div>
          <div class="progress-bar-track">
            <div class="progress-bar-fill bg-info" [style.width.%]="psychoRate()"></div>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-text-muted uppercase tracking-wider"
              >Licencia Obtenida</span
            >
            <span class="text-sm font-black text-warning">{{ successRate() }}%</span>
          </div>
          <div class="progress-bar-track">
            <div class="progress-bar-fill bg-warning" [style.width.%]="successRate()"></div>
          </div>
        </div>
      </div>

      <!-- Balance de Gestión del Año -->
      <div class="mt-8 pt-6 border-t border-border-subtle/50">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] m-0">
            Balance de Gestión Anual
          </h3>
          <div
            class="px-2 py-0.5 rounded-full bg-brand/10 border border-brand/20 text-[9px] font-bold text-brand uppercase"
          >
            Real-time
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4 mb-6">
          <div
            class="relative overflow-hidden p-4 rounded-2xl bg-elevated/10 border border-border-subtle/30 group hover:bg-elevated/20 transition-all duration-300"
          >
            <div
              class="absolute -right-2 -top-2 opacity-5 group-hover:opacity-10 transition-opacity"
            >
              <app-icon name="users" [size]="48" />
            </div>
            <span class="kpi-label block mb-1">Egresados</span>
            <span class="kpi-value">{{ egresadosTotal() }}</span>
          </div>

          <div
            class="relative overflow-hidden p-4 rounded-2xl bg-elevated/10 border border-border-subtle/30 group hover:bg-elevated/20 transition-all duration-300"
          >
            <div
              class="absolute -right-2 -top-2 opacity-5 group-hover:opacity-10 transition-opacity"
            >
              <app-icon name="award" [size]="48" />
            </div>
            <span class="kpi-label block mb-1">Licencias</span>
            <span class="kpi-value text-success">{{ licensesTotal() }}</span>
          </div>
        </div>

        <div class="effectiveness-card p-4 rounded-2xl relative overflow-hidden group">
          <div
            class="absolute inset-0 bg-gradient-to-br from-brand/20 via-brand/5 to-transparent opacity-50"
          ></div>
          <div class="relative flex items-center justify-between">
            <div class="flex flex-col">
              <span class="kpi-label mb-0.5">Tasa de Efectividad</span>
              <span class="text-[9px] text-text-muted font-medium pr-8"
                >Conversión de egresados a conductores licenciados.</span
              >
            </div>
            <div class="flex flex-col items-end">
              <span class="kpi-value text-brand leading-none">
                {{ successRate() }}<span class="text-lg opacity-40 ml-0.5">%</span>
              </span>
              <div class="mt-2 h-1 w-16 bg-subtle rounded-full overflow-hidden">
                <div
                  class="h-full bg-brand shadow-[0_0_8px_var(--ds-brand)] transition-all duration-1000 ease-out"
                  [style.width.%]="successRate() || 5"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .progress-bar-track {
      height: 7px;
      border-radius: 999px;
      background: var(--bg-subtle);
      overflow: hidden;
      width: 100%;
    }
    .progress-bar-fill {
      height: 100%;
      border-radius: 999px;
      transition: width 1s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .effectiveness-card {
      background: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
      box-shadow: 0 8px 32px -8px rgba(0, 0, 0, 0.2);
    }
  `,
})
export class AdminStatsPanelComponent {
  municipalRate = input<number>(0);
  psychoRate = input<number>(0);
  totalExams = input<number>(0);
  egresadosTotal = input<number>(0);
  licensesTotal = input<number>(0);
  successRate = input<number>(0);
}
