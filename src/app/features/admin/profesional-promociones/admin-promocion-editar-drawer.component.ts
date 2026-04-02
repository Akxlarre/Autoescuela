import { ChangeDetectionStrategy, Component, effect, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { PromocionesFacade } from '@core/facades/promociones.facade';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AsyncBtnComponent } from '@shared/components/async-btn/async-btn.component';
import type { PromocionStatus } from '@core/models/ui/promocion-table.model';

const STATUS_OPTIONS = [
  { label: 'Planificada', value: 'planned' },
  { label: 'En curso', value: 'in_progress' },
  { label: 'Finalizada', value: 'finished' },
  { label: 'Cancelada', value: 'cancelled' },
];

@Component({
  selector: 'app-admin-promocion-editar-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, SelectModule, IconComponent, AsyncBtnComponent],
  template: `
    <div class="flex flex-col gap-6 p-1">
      <!-- ── Información general ───────────────────────────────────── -->
      <section>
        <h3 class="text-sm font-semibold mb-4" style="color: var(--text-primary)">
          Información general
        </h3>

        <!-- Nombre (auto-generado, no editable) -->
        <div class="mb-4">
          <label class="text-xs font-medium mb-1 block" style="color: var(--text-secondary)">
            Nombre de la promoción
          </label>
          <div
            class="form-input"
            style="background: var(--bg-elevated); cursor: default; color: var(--text-muted);"
          >
            {{ facade.selectedPromocion()?.name }}
          </div>
          <p class="text-[10px] mt-1" style="color: var(--text-muted)">
            El nombre se genera automáticamente a partir de la fecha de inicio
          </p>
        </div>

        <!-- Código (readonly) -->
        <div class="mb-4">
          <label class="text-xs font-medium mb-1 block" style="color: var(--text-secondary)">
            Código
          </label>
          <div
            class="form-input"
            style="background: var(--bg-elevated); cursor: default; color: var(--text-muted);"
          >
            {{ facade.selectedPromocion()?.code }}
          </div>
          <p class="text-[10px] mt-1" style="color: var(--text-muted)">
            El código no es modificable
          </p>
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
          [options]="statusOptions"
          [(ngModel)]="statusModel"
          optionLabel="label"
          optionValue="value"
          [style]="{ width: '100%' }"
          data-llm-description="Cambiar estado de la promoción"
        />

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
          (click)="saved.emit()"
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
  readonly saved = output();

  // ── Form state ────────────────────────────────────────────────────────────
  protected readonly status = signal<PromocionStatus>('planned');
  protected readonly statusOptions = STATUS_OPTIONS;

  protected get statusModel(): PromocionStatus {
    return this.status();
  }
  protected set statusModel(v: PromocionStatus) {
    this.status.set(v);
  }

  protected readonly canSave = signal(true);

  constructor() {
    // Pre-fill from selected promotion
    effect(() => {
      const p = this.facade.selectedPromocion();
      if (p) {
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
      status: this.status(),
    });

    if (success) {
      this.saved.emit();
    }
  }
}
