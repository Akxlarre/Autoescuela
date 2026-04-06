import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { SecretariasFacade } from '@core/facades/secretarias.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AdminSecretariasEditarDrawerComponent } from './admin-secretarias-editar-drawer.component';

@Component({
  selector: 'app-admin-secretarias-ver-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, IconComponent],
  template: `
    @if (facade.selectedSecretaria(); as sec) {
      <!-- Avatar + nombre -->
      <div
        class="flex flex-col items-center gap-3 pb-6 mb-6"
        style="border-bottom: 1px solid var(--border-subtle);"
      >
        <div
          class="flex items-center justify-center w-16 h-16 rounded-full text-xl font-bold"
          style="background: var(--color-primary-tint); color: var(--color-primary);"
        >
          {{ sec.initials }}
        </div>
        <div class="text-center">
          <p class="text-base font-semibold" style="color: var(--text-primary)">{{ sec.nombre }}</p>
          <a
            [href]="'mailto:' + sec.email"
            class="text-sm"
            style="color: var(--ds-brand); text-decoration: none;"
          >
            {{ sec.email }}
          </a>
        </div>

        <!-- Badge estado -->
        @if (sec.estado === 'activa') {
          <span
            class="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full"
            style="background: color-mix(in srgb, var(--state-success) 12%, transparent); color: var(--state-success);"
          >
            <app-icon name="check-circle" [size]="12" />
            Activa
          </span>
        } @else {
          <span
            class="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full"
            style="background: var(--bg-elevated); color: var(--text-muted);"
          >
            <app-icon name="circle" [size]="12" />
            Inactiva
          </span>
        }
      </div>

      <!-- Datos de contacto y acceso -->
      <div class="flex flex-col gap-4 mb-6">
        <h3 class="text-xs font-semibold uppercase tracking-wide" style="color: var(--text-muted)">
          Información
        </h3>

        <div class="detail-row">
          <app-icon name="id-card" [size]="15" />
          <div>
            <p class="detail-label">RUT</p>
            <p class="detail-value">{{ sec.rut }}</p>
          </div>
        </div>

        <div class="detail-row">
          <app-icon name="map-pin" [size]="15" />
          <div>
            <p class="detail-label">Sede asignada</p>
            <p class="detail-value">{{ sec.sede }}</p>
          </div>
        </div>

        <div class="detail-row">
          <app-icon name="clock" [size]="15" />
          <div>
            <p class="detail-label">Último acceso</p>
            <p class="detail-value">
              @if (sec.ultimoAcceso) {
                {{ sec.ultimoAcceso | date: 'dd/MM/yyyy HH:mm' }}
              } @else {
                Sin registros
              }
            </p>
          </div>
        </div>

        @if (sec.phone) {
          <div class="detail-row">
            <app-icon name="phone" [size]="15" />
            <div>
              <p class="detail-label">Teléfono</p>
              <p class="detail-value">{{ sec.phone }}</p>
            </div>
          </div>
        }

        @if (sec.aliasPublico) {
          <div class="detail-row">
            <app-icon name="at-sign" [size]="15" />
            <div>
              <p class="detail-label">Alias público</p>
              <p class="detail-value">{{ sec.aliasPublico }}</p>
            </div>
          </div>
        }
      </div>

      <!-- Rol y permisos -->
      <div
        class="rounded-lg p-4 mb-6"
        style="background: color-mix(in srgb, var(--ds-brand) 6%, transparent); border: 1px solid color-mix(in srgb, var(--ds-brand) 20%, transparent);"
      >
        <div class="flex items-center gap-2 mb-2">
          <app-icon name="shield-check" [size]="15" color="var(--ds-brand)" />
          <span class="text-sm font-semibold" style="color: var(--ds-brand)">Rol: Secretaria</span>
        </div>
        <p class="text-xs leading-relaxed" style="color: var(--ds-brand)">
          Gestión de matrículas, pagos, agenda y alumnos.
        </p>
      </div>

      <!-- Acciones -->
      <div class="flex items-center gap-3 pt-4" style="border-top: 1px solid var(--border-subtle);">
        <button
          class="edit-btn"
          (click)="editar()"
          data-llm-action="editar-secretaria-desde-ver"
        >
          <app-icon name="edit" [size]="15" />
          Editar secretaria
        </button>
      </div>
    }
  `,
  styles: `
    .detail-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      color: var(--text-muted);
    }

    .detail-label {
      font-size: 11px;
      color: var(--text-muted);
      margin-bottom: 2px;
    }

    .detail-value {
      font-size: var(--text-sm);
      color: var(--text-primary);
      font-weight: 500;
    }

    .edit-btn {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 9px 0;
      border-radius: var(--radius-md);
      border: none;
      background: var(--ds-brand);
      color: white;
      font-size: var(--text-sm);
      font-family: inherit;
      font-weight: 500;
      cursor: pointer;
      transition: opacity var(--duration-fast);
    }
    .edit-btn:hover {
      opacity: 0.85;
    }
  `,
})
export class AdminSecretariasVerDrawerComponent {
  protected readonly facade = inject(SecretariasFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  protected editar(): void {
    this.layoutDrawer.open(AdminSecretariasEditarDrawerComponent, 'Editar Secretaria', 'edit');
  }
}
