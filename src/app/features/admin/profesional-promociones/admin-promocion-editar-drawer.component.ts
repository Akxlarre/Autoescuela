import { chileToday, formatChileDate } from '@core/utils/chile-time.utils';
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
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AsyncBtnComponent } from '@shared/components/async-btn/async-btn.component';
import type { PromocionStatus, PromocionTableRow } from '@core/models/ui/promocion-table.model';
import { promotionCodeError, promotionNameForCode } from '@core/utils/promotion-code.utils';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';

@Component({
  selector: 'app-admin-promocion-editar-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    SelectModule,
    IconComponent,
    AsyncBtnComponent,
    SkeletonBlockComponent,
    DrawerContentLoaderComponent,
    DrawerFormComponent,
  ],
  template: `
    <app-drawer-form>
      <app-drawer-content-loader>
        <ng-template #skeletons>
          <div class="flex flex-col gap-5">
            <!-- Información general: header + nombre + código + fechas -->
            <section>
              <app-skeleton-block variant="text" width="45%" height="16px" />
              <div class="mt-4 mb-4">
                <app-skeleton-block variant="text" width="30%" height="12px" />
                <div class="mt-1">
                  <app-skeleton-block variant="rect" width="100%" height="40px" />
                </div>
              </div>
              <div class="mb-4">
                <app-skeleton-block variant="text" width="20%" height="12px" />
                <div class="mt-1">
                  <app-skeleton-block variant="rect" width="100%" height="40px" />
                </div>
              </div>
              <div class="grid grid-cols-2 gap-3 mb-4">
                <div>
                  <app-skeleton-block variant="text" width="50%" height="12px" />
                  <div class="mt-1">
                    <app-skeleton-block variant="rect" width="100%" height="40px" />
                  </div>
                </div>
                <div>
                  <app-skeleton-block variant="text" width="50%" height="12px" />
                  <div class="mt-1">
                    <app-skeleton-block variant="rect" width="100%" height="40px" />
                  </div>
                </div>
              </div>
              <app-skeleton-block variant="text" width="70%" height="10px" />
            </section>

            <!-- Estado de la promoción: header + select -->
            <section>
              <app-skeleton-block variant="text" width="45%" height="16px" />
              <div class="mt-3">
                <app-skeleton-block variant="rect" width="100%" height="40px" />
              </div>
            </section>
          </div>
        </ng-template>
        <ng-template #content>
          <!-- ── Información general ───────────────────────────────────── -->
          <section>
            <h3 class="item-title mb-4">Información general</h3>

            <!-- Nombre (editable) -->
            <div class="mb-4">
              <label class="text-xs font-medium mb-1 block text-text-secondary">
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

            <!-- Código: ID numérico MTT (editable) -->
            <div class="mb-4">
              <label class="text-xs font-medium mb-1 block text-text-secondary">
                Código (ID numérico MTT)
              </label>
              <input
                class="form-input"
                type="text"
                inputmode="numeric"
                [(ngModel)]="codeModel"
                placeholder="Ej: 156"
                data-llm-description="ID numérico MTT de la promoción; se propaga a sus cursos como {id}.{licencia}"
              />
              @if (codeError(); as message) {
                <p class="text-2xs mt-1 text-error">{{ message }}</p>
              }
            </div>

            <!-- Fechas (readonly) -->
            <div class="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label class="text-xs font-medium mb-1 block text-text-secondary">
                  Fecha inicio
                </label>
                <div class="form-input bg-elevated cursor-default text-text-muted">
                  {{ formatDate(facade.selectedPromocion()?.startDate ?? '') }}
                </div>
              </div>
              <div>
                <label class="text-xs font-medium mb-1 block text-text-secondary">
                  Fecha término
                </label>
                <div class="form-input bg-elevated cursor-default text-text-muted">
                  {{ formatDate(facade.selectedPromocion()?.endDate ?? '') }}
                </div>
              </div>
            </div>
            <p class="text-2xs text-text-muted">
              <app-icon name="info" [size]="10" />
              Las fechas de inicio y término no son modificables una vez creada la promoción.
            </p>
          </section>

          <!-- ── Estado ────────────────────────────────────────────────── -->
          <section>
            <h3 class="item-title mb-3">Estado de la promoción</h3>

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
                class="mt-3 rounded-lg p-3 flex items-start gap-2 bg-warning/8 border border-warning/20"
              >
                <app-icon name="clock" [size]="14" color="var(--state-warning)" />
                <p class="text-xs text-text-secondary">
                  La promoción aún no ha comenzado. Podrás cambiarla a
                  <strong>En curso</strong> a partir del
                  <strong>{{ formatDate(facade.selectedPromocion()?.startDate ?? '') }}</strong
                  >.
                </p>
              </div>
            }

            @if (showAskAdminNotice()) {
              <div
                class="mt-3 rounded-lg p-3 flex items-start gap-2 bg-warning/8 border border-warning/20"
                data-llm-description="aviso: solo el administrador puede eliminar una promoción creada por error"
              >
                <app-icon name="info" [size]="14" color="var(--state-warning)" />
                <p class="text-xs text-text-secondary">
                  ¿Esta promoción se creó por error? Pídele al administrador que la elimine.
                </p>
              </div>
            }
          </section>

          <!-- ── Eliminar (admin; planificada o cancelada, sin alumnos) ──── -->
          @if (canDelete()) {
            <section class="mt-3 rounded-lg p-4 bg-error/6 border border-error/20">
              <h3 class="item-title mb-1">Eliminar promoción</h3>
              <p class="text-xs text-text-secondary mb-3">
                Si se creó por error, puedes eliminarla: se borra con sus cursos y sesiones, y su
                lunes y su número quedan libres. No se puede deshacer.
              </p>
              <button
                type="button"
                class="btn-danger-ghost"
                [disabled]="facade.isSubmitting()"
                (click)="deletePromocion()"
                data-llm-action="eliminar-promocion"
              >
                <app-icon name="trash-2" [size]="13" />
                Eliminar promoción
              </button>
            </section>
          }
        </ng-template>
      </app-drawer-content-loader>

      <ng-container ngProjectAs="[drawer-form-footer]">
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
      </ng-container>
    </app-drawer-form>
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
  private readonly confirmModal = inject(ConfirmModalService);

  // ── Form state ────────────────────────────────────────────────────────────
  protected readonly name = signal('');
  protected readonly code = signal('');
  protected readonly status = signal<PromocionStatus>('planned');

  protected get nameModel(): string {
    return this.name();
  }
  protected set nameModel(v: string) {
    this.nameEditedByHand = true;
    this.name.set(v);
  }

  protected get codeModel(): string {
    return this.code();
  }
  /** El nombre automático sigue al número mientras no se haya escrito a mano (fix-346-m, D18). */
  protected set codeModel(v: string) {
    this.code.set(v);
    const p = this.facade.selectedPromocion();
    if (p && !this.nameEditedByHand) this.name.set(promotionNameForCode(p.name, p.code, v));
  }

  /** True desde que el usuario escribe en el campo Nombre; se limpia al cargar otra promoción. */
  private nameEditedByHand = false;
  /** Guardado o confirmación en curso: un segundo clic no vuelve a guardar (fix-346-m). */
  private saving = false;

  protected get statusModel(): PromocionStatus {
    return this.status();
  }
  protected set statusModel(v: PromocionStatus) {
    this.status.set(v);
  }

  /**
   * Opciones del selector incluyendo el estado actual como primera entrada.
   * Al seleccionar el estado actual, canSave permanece false (sin cambio real).
   *   planned     → Planificada | En curso (solo si start_date ≤ hoy)
   *   in_progress → En curso | Finalizada
   *   finished    → Finalizada  (sin más transiciones)
   *   cancelled   → Cancelada   (histórica; sin más transiciones)
   * "Cancelada" dejó de ser un destino: una promoción creada por error se elimina (fix-348-m,
   * D20). La secretaria no ve Finalizada como destino (fix-321-m, D5).
   */
  protected readonly availableStatusOptions = computed(() => {
    const current = this.facade.selectedPromocion()?.status;
    const options = this.statusOptionsFor();
    if (this.facade.canManageLifecycle()) return options;
    return options.filter((o) => o.value === current || o.value !== 'finished');
  });

  /**
   * El admin puede eliminar una promoción que no partió (planificada o cancelada) y no tiene
   * alumnos (fix-348-m, D20). La función de BD vuelve a validarlo: cuenta también las matrículas
   * de personas archivadas, que `totalEnrolled` no incluye.
   */
  protected readonly canDelete = computed(() => {
    const p = this.facade.selectedPromocion();
    return (
      !!p &&
      this.facade.canManageLifecycle() &&
      (p.status === 'planned' || p.status === 'cancelled') &&
      p.totalEnrolled === 0
    );
  });

  /** La secretaria no puede eliminar: si la promoción parece un error, se le dice a quién pedirlo. */
  protected readonly showAskAdminNotice = computed(() => {
    const p = this.facade.selectedPromocion();
    return (
      !!p && !this.facade.canManageLifecycle() && p.status === 'planned' && p.totalEnrolled === 0
    );
  });

  private statusOptionsFor(): { label: string; value: PromocionStatus }[] {
    const p = this.facade.selectedPromocion();
    if (!p) return [];

    const today = chileToday();

    switch (p.status) {
      case 'planned':
        return [
          { label: 'Planificada', value: 'planned' as PromocionStatus },
          ...(p.startDate <= today
            ? [{ label: 'En curso', value: 'in_progress' as PromocionStatus }]
            : []),
        ];
      case 'in_progress':
        return [
          { label: 'En curso', value: 'in_progress' as PromocionStatus },
          { label: 'Finalizada', value: 'finished' as PromocionStatus },
        ];
      case 'finished':
        return [{ label: 'Finalizada', value: 'finished' as PromocionStatus }];
      case 'cancelled':
        return [{ label: 'Cancelada', value: 'cancelled' as PromocionStatus }];
      default:
        return [];
    }
  }

  /** True cuando está planificada pero la fecha de inicio aún no llega. */
  protected readonly plannedButNotStarted = computed(() => {
    const p = this.facade.selectedPromocion();
    if (!p || p.status !== 'planned') return false;
    return p.startDate > chileToday();
  });

  /** Último número de promoción usado; null mientras carga (sin tope). fix-347-m, D19. */
  protected readonly maxExistingCode = signal<number | null>(null);

  /**
   * Mensaje de error del número, o null si sirve. El número que la promoción ya tiene guardado
   * siempre sirve: el tope es para números nuevos, no para invalidar uno histórico.
   */
  protected readonly codeError = computed(() => {
    const unchanged = this.code().trim() === this.facade.selectedPromocion()?.code;
    return promotionCodeError(this.code(), unchanged ? null : this.maxExistingCode());
  });

  /** El código es el ID numérico MTT: dígitos, mayor que 0 y sin adelantarse más del tope. */
  protected readonly codeIsValid = computed(() => this.codeError() === null);

  /**
   * Habilita guardar si algo cambió (nombre, número o una transición de estado válida) y el
   * formulario completo es válido: nombre no vacío y número solo dígitos. Hasta fix-323-m el
   * número solo se validaba cuando era lo único que cambiaba (S7).
   */
  protected readonly canSave = computed(() => {
    const p = this.facade.selectedPromocion();
    if (!p) return false;
    if (!this.name().trim() || !this.codeIsValid()) return false;
    const nameOrCodeChanged = this.name().trim() !== p.name || this.code().trim() !== p.code;
    const statusChanged =
      this.status() !== p.status &&
      this.availableStatusOptions().some((o) => o.value === this.status());
    return nameOrCodeChanged || statusChanged;
  });

  constructor() {
    this.facade.fetchMaxPromotionCode().then((max) => this.maxExistingCode.set(max));

    // Pre-fill al cambiar la promoción seleccionada
    effect(() => {
      const p = this.facade.selectedPromocion();
      if (p) {
        this.nameEditedByHand = false;
        this.name.set(p.name);
        this.code.set(p.code);
        this.status.set(p.status);
      }
    });
  }

  /** Elimina la promoción abierta tras confirmar (fix-348-m, D20). */
  protected async deletePromocion(): Promise<void> {
    const p = this.facade.selectedPromocion();
    if (!p || !this.canDelete() || this.saving) return;
    this.saving = true;
    try {
      const confirmed = await this.confirmModal.confirm({
        title: 'Eliminar promoción',
        message: `Se eliminará "${p.name}" con sus cursos y sesiones. Su lunes y su número quedarán libres. Esta acción no se puede deshacer.`,
        severity: 'danger',
        confirmLabel: 'Eliminar',
      });
      if (!confirmed) return;

      if (await this.facade.eliminarPromocion(p.id)) this.layoutDrawer.close();
    } finally {
      this.saving = false;
    }
  }

  protected formatDate(iso: string): string {
    if (!iso) return '';
    return formatChileDate(iso, { year: 'numeric', month: '2-digit', day: '2-digit' });
  }

  protected async submit(): Promise<void> {
    const p = this.facade.selectedPromocion();
    if (!p || this.saving) return;
    this.saving = true;
    try {
      await this.save(p);
    } finally {
      this.saving = false;
    }
  }

  private async save(p: PromocionTableRow): Promise<void> {
    // Finalizar pasa todas sus matrículas activas a completadas (trigger) y no se deshace desde
    // la app: se confirma antes, con el número de alumnos afectados (fix-324-m, D3b).
    if (this.status() === 'finished' && p.status !== 'finished') {
      const activos = await this.facade.countActiveEnrollments(p.id);
      const confirmed = await this.confirmModal.confirm({
        title: 'Finalizar promoción',
        message:
          (activos === 1
            ? '1 alumno con matrícula activa pasará a completado y dejará'
            : `${activos} alumnos con matrícula activa pasarán a completado y dejarán`) +
          ' de aparecer en la Base de Alumnos Profesional. Esta acción no se puede deshacer desde la app.',
        severity: 'danger',
        confirmLabel: 'Finalizar',
      });
      if (!confirmed) return;
    }

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
