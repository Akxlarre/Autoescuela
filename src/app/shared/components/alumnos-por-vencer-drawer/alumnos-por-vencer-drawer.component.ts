import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AdminAlumnosFacade } from '@core/facades/admin-alumnos.facade';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';

@Component({
  selector: 'app-alumnos-por-vencer-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    ButtonModule,
    TooltipModule,
    IconComponent,
    SkeletonBlockComponent,
    DrawerContentLoaderComponent,
  ],
  template: `
    <app-drawer-content-loader>
      <ng-template #skeletons>
        <div class="flex flex-col gap-3 p-1">
          @for (_ of [1, 2, 3]; track $index) {
            <div class="card p-3 flex items-center justify-between border-l-4 border-l-error/30">
              <div class="flex flex-col gap-1.5 flex-1 pr-4">
                <app-skeleton-block variant="text" width="70%" height="14px" />
                <app-skeleton-block variant="text" width="50%" height="12px" />
                <app-skeleton-block variant="text" width="40%" height="12px" />
              </div>
              <app-skeleton-block variant="circle" width="32px" height="32px" class="shrink-0" />
            </div>
          }
        </div>
      </ng-template>
      <ng-template #content>
        <div class="flex flex-col gap-4 p-1 flex-1">
          @for (item of facade.alumnosPorVencer(); track item.id) {
            <div
              class="card p-3 flex items-center justify-between hover:bg-subtle transition-all border-l-4 border-l-error"
            >
              <div class="flex flex-col gap-0.5">
                <span class="font-bold text-sm text-text-primary">
                  {{ item.nombre }} {{ item.apellido }}
                </span>
                <span class="text-xs text-text-muted font-mono">
                  {{ item.cursos[0]?.nombre ?? '—' }} — {{ item.nroExpedientes[0] }}
                </span>
                <span class="text-xs text-error font-medium">Vence: {{ item.vencimiento }}</span>
              </div>
              <button
                pButton
                class="p-button-rounded p-button-success p-button-text w-8 h-8 p-0 flex items-center justify-center"
                pTooltip="Contactar"
              >
                <app-icon name="message-circle" [size]="18" />
              </button>
            </div>
          }
        </div>
        <div
          class="w-full flex gap-2 mt-auto pt-4 border-t border-border-subtle sticky bottom-0 bg-surface"
        >
          <button
            pButton
            label="Descargar Reporte Mora"
            class="p-button-outlined p-button-secondary w-full"
          >
            <app-icon name="download" [size]="16" class="mr-2" />
          </button>
        </div>
      </ng-template>
    </app-drawer-content-loader>
  `,
})
export class AlumnosPorVencerDrawerComponent {
  readonly facade = inject(AdminAlumnosFacade);
}
