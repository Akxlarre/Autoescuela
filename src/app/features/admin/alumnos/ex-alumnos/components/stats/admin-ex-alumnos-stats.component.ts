import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';

@Component({
  selector: 'app-admin-stats-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="bento-card bento-tall p-6 flex flex-col h-full bg-bg-surface overflow-hidden">
      <div class="flex flex-col mb-6">
        <h3 class="text-base font-bold text-text-primary m-0">Tasas de Aprobación</h3>
        <span class="text-[10px] text-text-muted font-bold uppercase tracking-widest mt-0.5">Métricas de Éxito</span>
      </div>

      <div class="flex flex-col gap-6 flex-1">
        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-text-muted uppercase tracking-wider">Aprobación Municipal</span>
            <span class="text-sm font-black text-text-primary">{{ municipalRate }}%</span>
          </div>
          <div class="progress-bar-track">
            <div class="progress-bar-fill bg-brand" [style.width.%]="municipalRate"></div>
          </div>
          <p class="text-[10px] text-text-muted mt-2">Basado en {{ totalExams }} exámenes este año.</p>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-text-muted uppercase tracking-wider">Examen Psicotécnico</span>
            <span class="text-sm font-black text-cyan-400">{{ psychoRate }}%</span>
          </div>
          <div class="progress-bar-track">
            <div class="progress-bar-fill bg-cyan-400" [style.width.%]="psychoRate"></div>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-bold text-text-muted uppercase tracking-wider">Licencia Obtenida</span>
            <span class="text-sm font-black text-amber-500">{{ successRate }}%</span>
          </div>
          <div class="progress-bar-track">
            <div class="progress-bar-fill bg-amber-500" [style.width.%]="successRate"></div>
          </div>
        </div>
      </div>

      <!-- Balance de Gestión del Año -->
      <div class="mt-8 pt-6 border-t border-border-subtle/50">
        <div class="flex items-center justify-between mb-6">
           <h3 class="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] m-0">Balance de Gestión Anual</h3>
           <div class="px-2 py-0.5 rounded-full bg-brand/10 border border-brand/20 text-[9px] font-bold text-brand uppercase">Real-time</div>
        </div>
        
        <div class="grid grid-cols-2 gap-4 mb-6">
           <div class="relative overflow-hidden p-4 rounded-2xl bg-bg-elevated/10 border border-border-subtle/30 group hover:bg-bg-elevated/20 transition-all duration-300">
              <div class="absolute -right-2 -top-2 opacity-5 group-hover:opacity-10 transition-opacity">
                 <app-icon name="users" [size]="48" />
              </div>
              <span class="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-1">Egresados</span>
              <span class="text-3xl font-display font-black text-text-primary tracking-tighter">{{ egresadosTotal }}</span>
           </div>

           <div class="relative overflow-hidden p-4 rounded-2xl bg-bg-elevated/10 border border-border-subtle/30 group hover:bg-bg-elevated/20 transition-all duration-300">
              <div class="absolute -right-2 -top-2 opacity-5 group-hover:opacity-10 transition-opacity">
                 <app-icon name="award" [size]="48" />
              </div>
              <span class="text-[9px] font-black text-text-muted uppercase tracking-widest block mb-1">Licencias</span>
              <span class="text-3xl font-display font-black text-state-success tracking-tighter">{{ licensesTotal }}</span>
           </div>
        </div>

        <div class="effectiveness-card p-4 rounded-2xl relative overflow-hidden group">
           <div class="absolute inset-0 bg-gradient-to-br from-brand/20 via-brand/5 to-transparent opacity-50"></div>
           <div class="relative flex items-center justify-between">
              <div class="flex flex-col">
                 <span class="text-[10px] font-black text-text-primary uppercase tracking-wider mb-0.5">Tasa de Efectividad</span>
                 <span class="text-[9px] text-text-muted font-medium pr-8">Conversión de egresados a conductores licenciados.</span>
              </div>
              <div class="flex flex-col items-end">
                 <span class="text-4xl font-display font-black text-brand tracking-tighter leading-none">
                    {{ successRate }}<span class="text-lg opacity-40 ml-0.5">%</span>
                 </span>
                 <div class="mt-2 h-1 w-16 bg-bg-subtle rounded-full overflow-hidden">
                    <div class="h-full bg-brand shadow-[0_0_8px_var(--ds-brand)] transition-all duration-1000 ease-out" [style.width.%]="successRate || 5"></div>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    :host { display: block; height: 100%; }
    .progress-bar-track { height: 7px; border-radius: 999px; background: var(--bg-subtle); overflow: hidden; width: 100%; }
    .progress-bar-fill { height: 100%; border-radius: 999px; transition: width 1s cubic-bezier(0.34, 1.56, 0.64, 1); }
    
    .effectiveness-card {
      background: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
      box-shadow: 0 8px 32px -8px rgba(0,0,0,0.2);
    }
  `
})
export class AdminStatsPanelComponent {
  @Input() municipalRate: number = 0;
  @Input() psychoRate: number = 0;
  @Input() totalExams: number = 0;
  @Input() egresadosTotal: number = 0;
  @Input() licensesTotal: number = 0;
  @Input() successRate: number = 0;
}
