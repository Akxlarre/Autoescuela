import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { PromocionesFacade } from '@core/facades/promociones.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AsyncBtnComponent } from '@shared/components/async-btn/async-btn.component';
import type { PromocionStatus } from '@core/models/ui/promocion-table.model';

@Component({
  selector: 'app-admin-promocion-editar-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectModule, IconComponent, AsyncBtnComponent],
  template: `
    <div class="flex flex-col gap-6 p-1">
      <!-- ── Información general ───────────────────────────────────── -->
      <section>
        <h3 class="text-sm font-semibold mb-4" style="color: var(--text-primary)">
          Información general
        </h3>

        <!-- Nombre (editable) -->
        <div class="mb-4">
          <label class="text-xs font-medium mb-1 block" style="color: var(--text-secondary)">
            Nombre de la promoción
          </label>
          <input
            class="form-input"
            type="text"
            [(ngModel)]="nameModel"
            placeholder="Ej: Promoción 30 de Marzo 2026"
            data-llm-description="Nombre editable de la promoción"
          />
        </div>

        <!-- Código (editable) -->
        <div class="mb-4">
          <label class="text-xs font-medium mb-1 block" style="color: var(--text-secondary)">
            Código
          </label>
          <input
            class="form-input"
            type="text"
            [(ngModel)]="codeModel"
            placeholder="Ej: PROM-2026-03"
            data-llm-description="Código editable de la promoción"
          />
        </div>

        <!-- Fechas (readonly) -->
        <div class="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label class="text-xs font-medium mb-1 block" style="color: var(--text-secondary)">
              Fecha inicio
            </label>
            <div
              class="form-input"
              style="background: var(--bg-elevated); cursor: default; color: var(--text-muted);"
            >
              {{ formatDate(facade.selectedPromocion()?.startDate ?? '') }}
            </div>
          </div>
          <div>
            <label class="text-xs font-medium mb-1 block" style="color: var(--text-secondary)">
              Fecha término
            </label>
            <div
              class="form-input"
              style="background: var(--bg-elevated); cursor: default; color: var(--text-muted);"
            >
              {{ formatDate(facade.selectedPromocion()?.endDate ?? '') }}
            </div>
          </div>
        </div>
        <p class="text-[10px]" style="color: var(--text-muted)">
          <app-icon name="info" [size]="10" />
          Las fechas de inicio y término no son modificables una vez creada la promoción.
        </p>
      </section>

      <!-- ── Estado ────────────────────────────────────────────────── -->
      <section>
        <h3 class="text-sm font-semibold mb-3" style="color: var(--text-primary)">
          Estado de la promoción
        </h3>

        <p-select
          [options]="availableStatusOptions()"
          [(ngModel)]="statusModel"
          optionLabel="label"
          optionValue="value"
          [style]="{ width: '100%' }"
          data-llm-description="Cambiar estado de la promoción"
        />

        @if (plannedButNotStarted()) {
          <div
            class="mt-3 rounded-lg p-3 flex items-start gap-2"
            style="
              background: color-mix(in srgb, var(--state-warning) 8%, transparent);
              border: 1px solid color-mix(in srgb, var(--state-warning) 20%, transparent);
            "
          >
            <app-icon name="clock" [size]="14" color="var(--state-warning)" />
            <p class="text-xs" style="color: var(--text-secondary)">
              La promoción aún no ha comenzado. Podrás cambiarla a
              <strong>En curso</strong> a partir del
              <strong>{{ formatDate(facade.selectedPromocion()?.startDate ?? '') }}</strong
              >.
            </p>
          </div>
        }

        @if (status() === 'cancelled') {
          <div
            class="mt-3 rounded-lg p-3 flex items-start gap-2"
            style="
              background: color-mix(in srgb, var(--state-error) 6%, transparent);
              border: 1px solid color-mix(in srgb, var(--state-error) 20%, transparent);
            "
          >
            <app-icon name="circle-alert" [size]="14" color="var(--state-error)" />
            <p class="text-xs" style="color: var(--text-secondary)">
              Cancelar una promoción es una acción irreversible. Los alumnos inscritos deberán ser
              reasignados manualmente.
            </p>
          </div>
        }
      </section>

      <!-- ── Acciones ──────────────────────────────────────────────── -->
      <div class="flex items-center gap-3 pt-4" style="border-top: 1px solid var(--border-subtle);">
        <button
          class="btn-secondary"
          (click)="layoutDrawer.close()"
          data-llm-action="cancelar-editar-promocion"
        >
          Cancelar
        </button>
        <app-async-btn
          label="Guardar cambios"
          icon="save"
          [loading]="facade.isSubmitting()"
          [disabled]="!canSave()"
          (click)="submit()"
          data-llm-action="submit-editar-promocion"
        />
      </div>
    </div>
  `,
  styles: `
    .form-input {
      width: 100%;
      padding: 9px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-primary);
      font-size: var(--text-sm);
      font-family: inherit;
      outline: none;
    }
    .form-input:focus {
      border-color: var(--ds-brand);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ds-brand) 12%, transparent);
    }

    .btn-secondary {
      padding: 9px 18px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-secondary);
      font-size: var(--text-sm);
      font-family: inherit;
      cursor: pointer;
      transition: all var(--duration-fast);
    }
    .btn-secondary:hover {
      border-color: var(--ds-brand);
      color: var(--ds-brand);
    }
  `,
})
export class AdminPromocionEditarDrawerComponent {
  protected readonly facade = inject(PromocionesFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  // ── Form state ────────────────────────────────────────────────────────────
  protected readonly name = signal('');
  protected readonly code = signal('');
  protected readonly status = signal<PromocionStatus>('planned');

  protected get nameModel(): string {
    return this.name();
  }
  protected set nameModel(v: string) {
    this.name.set(v);
  }

  protected get codeModel(): string {
    return this.code();
  }
  protected set codeModel(v: string) {
    this.code.set(v);
  }

  protected get statusModel(): PromocionStatus {
    return this.status();
  }
  protected set statusModel(v: PromocionStatus) {
    this.status.set(v);
  }

  /**
   * Opciones del selector incluyendo el estado actual como primera entrada.
   * Al seleccionar el estado actual, canSave permanece false (sin cambio real).
   *   planned     → Planificada | En curso (solo si start_date ≤ hoy) | Cancelada
   *   in_progress → En curso | Finalizada | Cancelada
   *   finished    → Finalizada  (sin más transiciones)
   *   cancelled   → Cancelada   (sin más transiciones)
   */
  protected readonly availableStatusOptions = computed(() => {
    const p = this.facade.selectedPromocion();
    if (!p) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(p.startDate + 'T00:00:00');

    switch (p.status) {
      case 'planned':
        return [
          { label: 'Planificada', value: 'planned' as PromocionStatus },
          ...(startDate <= today
            ? [{ label: 'En curso', value: 'in_progress' as PromocionStatus }]
            : []),
          { label: 'Cancelada', value: 'cancelled' as PromocionStatus },
        ];
      case 'in_progress':
        return [
          { label: 'En curso', value: 'in_progress' as PromocionStatus },
          { label: 'Finalizada', value: 'finished' as PromocionStatus },
          { label: 'Cancelada', value: 'cancelled' as PromocionStatus },
        ];
      case 'finished':
        return [{ label: 'Finalizada', value: 'finished' as PromocionStatus }];
      case 'cancelled':
        return [{ label: 'Cancelada', value: 'cancelled' as PromocionStatus }];
      default:
        return [];
    }
  });

  /** True cuando está planificada pero la fecha de inicio aún no llega. */
  protected readonly plannedButNotStarted = computed(() => {
    const p = this.facade.selectedPromocion();
    if (!p || p.status !== 'planned') return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(p.startDate + 'T00:00:00') > today;
  });

  /** Habilita guardar si nombre/código cambiaron O si el nuevo estado es una transición válida. */
  protected readonly canSave = computed(() => {
    const p = this.facade.selectedPromocion();
    if (!p) return false;
    const nameOrCodeChanged = this.name().trim() !== p.name || this.code().trim() !== p.code;
    const statusChanged =
      this.status() !== p.status &&
      this.availableStatusOptions().some((o) => o.value === this.status());
    return nameOrCodeChanged || statusChanged;
  });

  constructor() {
    // Pre-fill al cambiar la promoción seleccionada
    effect(() => {
      const p = this.facade.selectedPromocion();
      if (p) {
        this.name.set(p.name);
        this.code.set(p.code);
        this.status.set(p.status);
      }
    });
  }

  protected formatDate(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso + 'T12:00:00');
    return d.toLocaleDateString('es-CL', { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  protected async submit(): Promise<void> {
    const p = this.facade.selectedPromocion();
    if (!p) return;

    const success = await this.facade.editarPromocion(p.id, {
      name: this.name().trim(),
      code: this.code().trim(),
      status: this.status(),
    });

    if (success) {
      this.layoutDrawer.close();
      this.facade.initialize();
    }
  }
}
