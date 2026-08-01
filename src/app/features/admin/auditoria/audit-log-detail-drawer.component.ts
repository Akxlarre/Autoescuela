import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { AuditoriaFacade } from '@core/facades/auditoria.facade';
import { IconComponent } from '@shared/components/icon/icon.component';
import { StatBoxComponent } from '@shared/components/stat-box/stat-box.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';

@Component({
  selector: 'app-audit-log-detail-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, IconComponent, StatBoxComponent, DrawerFormComponent],
  template: `
    @if (facade.selectedLog(); as log) {
      <app-drawer-form [hasFooter]="false">
        <div class="flex flex-col gap-4 mb-6">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-text-muted">Información</h3>
          <div class="grid grid-cols-2 gap-3">
            <app-stat-box
              label="Fecha/Hora"
              [value]="(log.fechaHora | date: 'dd/MM/yyyy HH:mm:ss') ?? '—'"
              variant="surface"
              [compact]="true"
              icon="calendar"
            />
            <app-stat-box
              label="Acción"
              [value]="log.accion"
              variant="surface"
              [compact]="true"
              icon="pencil"
            />
            <app-stat-box
              label="Módulo"
              [value]="log.modulo"
              variant="surface"
              [compact]="true"
              icon="layout-grid"
            />
            <app-stat-box
              label="Sede"
              [value]="log.sedeNombre"
              variant="surface"
              [compact]="true"
              icon="map-pin"
            />
            <app-stat-box
              label="IP"
              [value]="log.ip"
              variant="surface"
              [compact]="true"
              icon="globe"
            />
          </div>
        </div>

        <div class="flex flex-col gap-2 mb-6">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-text-muted">Usuario</h3>
          <div
            class="flex flex-col gap-0.5 p-3 rounded-xl border border-border-subtle bg-elevated/50"
          >
            <span class="text-sm font-semibold text-text-primary">{{ log.usuarioNombre }}</span>
            <a [href]="'mailto:' + log.usuarioEmail" class="text-xs brand-link">
              {{ log.usuarioEmail }}
            </a>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <h3 class="text-xs font-semibold uppercase tracking-wide text-text-muted">
            Detalle completo
          </h3>
          <div
            class="flex items-start gap-2 p-3 rounded-xl border border-border-subtle bg-elevated/50"
          >
            <app-icon
              name="file-text"
              [size]="15"
              color="var(--text-muted)"
              class="mt-0.5 shrink-0"
            />
            <p
              class="text-sm leading-relaxed text-text-primary whitespace-pre-wrap wrap-break-word"
            >
              {{ log.detalle }}
            </p>
          </div>
        </div>
      </app-drawer-form>
    }
  `,
  styles: `
    .brand-link {
      color: var(--ds-brand);
      text-decoration: none;
    }
  `,
})
export class AuditLogDetailDrawerComponent {
  protected readonly facade = inject(AuditoriaFacade);
}
