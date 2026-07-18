import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CuadraturaFacade } from '@core/facades/cuadratura.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SelectModule } from 'primeng/select';
import type { EgresoFormData } from '@core/models/ui/cuadratura.model';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';

/**
 * RegistrarEgresoDrawerComponent — Panel lateral para registrar un egreso/retiro.
 *
 * Renderizado vía `LayoutDrawerFacadeService.open()` como NgComponentOutlet.
 * Inyecta `CuadraturaFacade` directamente para persistir y refrescar datos.
 */
@Component({
  selector: 'app-registrar-egreso-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    IconComponent,
    SelectModule,
    SkeletonBlockComponent,
    DrawerContentLoaderComponent,
    DrawerFormComponent,
  ],
  template: `
    <app-drawer-form>
      <app-drawer-content-loader>
        <ng-template #skeletons>
          <div class="flex flex-col gap-5">
            <!-- Tipo de egreso (label + select) -->
            <div class="flex flex-col gap-1.5">
              <app-skeleton-block variant="text" width="35%" height="12px" />
              <app-skeleton-block variant="rect" width="100%" height="42px" />
            </div>
            <!-- Monto (label + input) -->
            <div class="flex flex-col gap-1.5">
              <app-skeleton-block variant="text" width="30%" height="12px" />
              <app-skeleton-block variant="rect" width="100%" height="42px" />
            </div>
            <!-- Descripción / Motivo (label + input) -->
            <div class="flex flex-col gap-1.5">
              <app-skeleton-block variant="text" width="45%" height="12px" />
              <app-skeleton-block variant="rect" width="100%" height="42px" />
            </div>
            <!-- Fecha (label + display box) -->
            <div class="flex flex-col gap-1.5">
              <app-skeleton-block variant="text" width="20%" height="12px" />
              <app-skeleton-block variant="rect" width="100%" height="42px" />
            </div>
          </div>
        </ng-template>
        <ng-template #content>
          <!-- ── Cuerpo con formulario ─────────────────────────────────────── -->
          <form [formGroup]="form" class="flex flex-col gap-5" (ngSubmit)="onSubmit()">
            <!-- Tipo de egreso -->
            <div class="flex flex-col gap-1.5">
              <label for="egr-tipo" class="field-label">
                TIPO DE EGRESO <span class="text-error">*</span>
              </label>
              <p-select
                formControlName="tipo"
                [options]="tipoOptions"
                optionLabel="label"
                optionValue="value"
                placeholder="Seleccionar tipo..."
                styleClass="w-full"
                data-llm-description="Selector del tipo de egreso: gasto varios o anticipo a instructor"
                [class.field-input--error]="isInvalid('tipo')"
              />
              @if (isInvalid('tipo')) {
                <span class="field-error">Seleccione un tipo de egreso.</span>
              }
            </div>

            <!-- Monto -->
            <div class="flex flex-col gap-1.5">
              <label for="egr-monto" class="field-label">
                MONTO (CLP) <span class="text-error">*</span>
              </label>
              <div class="input-prefix-wrapper">
                <span class="input-prefix">$</span>
                <input
                  id="egr-monto"
                  type="number"
                  min="1"
                  formControlName="monto"
                  class="field-input field-input--prefixed"
                  placeholder="0"
                  data-llm-description="Monto del egreso en pesos chilenos"
                  [class.field-input--error]="isInvalid('monto')"
                />
              </div>
              @if (form.get('monto')?.hasError('required') && form.get('monto')?.touched) {
                <span class="field-error">Ingrese el monto.</span>
              } @else if (form.get('monto')?.hasError('min') && form.get('monto')?.touched) {
                <span class="field-error">El monto debe ser mayor a 0.</span>
              }
            </div>

            <!-- Descripción / Motivo -->
            <div class="flex flex-col gap-1.5">
              <label for="egr-descripcion" class="field-label">
                {{ tipoLabel() }} <span class="text-error">*</span>
              </label>
              <input
                id="egr-descripcion"
                type="text"
                formControlName="descripcion"
                class="field-input"
                [placeholder]="tipoPlaceholder()"
                data-llm-description="Descripción o motivo del egreso"
                [class.field-input--error]="isInvalid('descripcion')"
              />
              @if (isInvalid('descripcion')) {
                <span class="field-error">Ingrese una descripción o motivo.</span>
              }
            </div>

            <!-- Fecha (display-only) -->
            <div class="flex flex-col gap-1.5">
              <label class="field-label">FECHA</label>
              <div
                class="flex items-center gap-2 text-sm px-3 py-2.5 rounded-lg bg-surface border border-border-muted text-text-muted"
              >
                <app-icon name="calendar" [size]="14" />
                {{ fechaHoy() }}
                <span class="text-xs ml-auto">(Hoy — no modificable)</span>
              </div>
            </div>

            <!-- Error global -->
            @if (saveError()) {
              <div class="flex items-start gap-2 p-3 rounded-lg bg-error/8">
                <app-icon name="circle-alert" [size]="15" color="var(--state-error)" />
                <p class="text-sm text-error">{{ saveError() }}</p>
              </div>
            }
          </form>
        </ng-template>
      </app-drawer-content-loader>

      <!-- ── Footer fijo ─────────────────────────────────────────────── -->
      <ng-container ngProjectAs="[drawer-form-footer]">
        <button
          type="button"
          class="btn-secondary"
          [disabled]="isSaving()"
          data-llm-action="cancelar-egreso-cuadratura"
          (click)="onCancel()"
        >
          Cancelar
        </button>
        <button
          type="button"
          class="btn-primary flex items-center gap-2"
          [disabled]="form.invalid || isSaving()"
          data-llm-action="guardar-egreso-cuadratura"
          (click)="onSubmit()"
        >
          @if (isSaving()) {
            <app-icon name="loader-2" [size]="14" class="animate-spin" />
            Guardando...
          } @else {
            <app-icon name="check" [size]="14" />
            Guardar Egreso
          }
        </button>
      </ng-container>
    </app-drawer-form>
  `,
  styles: `
    /* ── Fields ── */
    .field-label {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: var(--text-xs);
      font-weight: var(--font-semibold);
      letter-spacing: 0.06em;
      color: var(--ds-brand);
    }
    .field-input {
      width: 100%;
      padding: 8px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-primary);
      font-size: var(--text-sm);
      font-family: inherit;
      transition:
        border-color var(--duration-fast),
        box-shadow var(--duration-fast);
      outline: none;
    }
    .field-input:focus {
      border-color: var(--ds-brand);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--ds-brand) 12%, transparent);
    }
    .field-input--error {
      border-color: var(--state-error) !important;
    }
    .field-input--prefixed {
      padding-left: 28px;
    }
    .field-select {
      appearance: auto;
      cursor: pointer;
    }

    /* ── Prefix wrapper ── */
    .input-prefix-wrapper {
      position: relative;
    }
    .input-prefix {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      font-size: var(--text-sm);
      font-weight: 600;
      color: var(--text-muted);
      pointer-events: none;
    }

    /* ── Field error ── */
    .field-error {
      font-size: var(--text-xs);
      color: var(--state-error);
    }
  `,
})
export class RegistrarEgresoDrawerComponent {
  private readonly sanitizer = inject(ErrorSanitizerService);
  readonly tipoOptions = [
    { label: 'Gasto Varios', value: 'gasto' },
    { label: 'Anticipo a Instructor', value: 'anticipo' },
  ];

  // ── Injections ───────────────────────────────────────────────────────────────
  protected readonly facade = inject(CuadraturaFacade);
  private readonly fb = inject(FormBuilder);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  // ── Estado local ─────────────────────────────────────────────────────────────
  protected readonly isSaving = signal(false);
  protected readonly saveError = signal<string | null>(null);

  // ── Formulario reactivo ──────────────────────────────────────────────────────
  protected readonly form = this.fb.group({
    tipo: ['', Validators.required],
    monto: [null as number | null, [Validators.required, Validators.min(1)]],
    descripcion: ['', [Validators.required, Validators.minLength(3)]],
  });

  // ── Computed ─────────────────────────────────────────────────────────────────
  protected readonly tipoLabel = computed(() => {
    const tipo = this.form.get('tipo')?.value;
    return tipo === 'anticipo' ? 'Motivo del anticipo' : 'Descripción / Motivo';
  });

  protected readonly tipoPlaceholder = computed(() => {
    const tipo = this.form.get('tipo')?.value;
    return tipo === 'anticipo'
      ? 'Ej: Anticipo por combustible...'
      : 'Ej: Compra insumos oficina...';
  });

  protected readonly fechaHoy = computed(() =>
    new Date().toLocaleDateString('es-CL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
  );

  // ── Helpers de template ──────────────────────────────────────────────────────
  protected isInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!(ctrl?.invalid && ctrl.touched);
  }

  // ── Handlers ────────────────────────────────────────────────────────────────
  protected onCancel(): void {
    this.layoutDrawer.close();
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.saveError.set(null);

    try {
      const { tipo, monto, descripcion } = this.form.getRawValue();
      const datos: EgresoFormData = {
        tipo: tipo as 'gasto' | 'anticipo',
        monto: Number(monto),
        descripcion: descripcion ?? '',
      };

      const ok = await this.facade.registrarEgreso(datos);
      if (ok) {
        this.layoutDrawer.close();
      }
    } catch (err) {
      this.saveError.set(
        err instanceof Error
          ? this.sanitizer.sanitize(err).message
          : 'Error al guardar. Intenta de nuevo.',
      );
    } finally {
      this.isSaving.set(false);
    }
  }
}
