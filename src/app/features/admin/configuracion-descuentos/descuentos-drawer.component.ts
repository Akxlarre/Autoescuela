import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { DiscountsFacade } from '@core/facades/discounts.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import type {
  DiscountApplicableTo,
  DiscountFormValue,
  DiscountType,
  DiscountUi,
} from '@core/models/ui/discount.model';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';

const APPLICABLE_TO_LABEL: Record<DiscountApplicableTo, string> = {
  all: 'Todos los cursos',
  class_b: 'Clase B',
  professional: 'Clase Profesional',
};

@Component({
  selector: 'app-descuentos-drawer',
  standalone: true,
  imports: [
    FormsModule,
    IconComponent,
    BadgeComponent,
    SkeletonBlockComponent,
    DrawerFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .field-input {
      width: 100%;
      padding: 9px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--input-bg);
      color: var(--text-primary);
      font-size: var(--text-sm);
      outline: none;
    }
    .field-input:focus {
      border-color: var(--ds-brand);
    }
    .field-input--prefixed {
      padding-left: 28px;
    }
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
  `,
  template: `
    <div class="flex h-full flex-col overflow-hidden">
      <!-- Header -->
      <div class="shrink-0 border-b border-border-subtle p-5 mb-4">
        <h2 class="text-lg font-bold text-text-primary">Descuentos Predefinidos</h2>
        <p class="mt-1 text-sm text-text-muted">
          Descuentos disponibles para seleccionar durante el pago de una matrícula.
        </p>
      </div>

      <app-drawer-form>
        @if (mode() === 'list') {
          <div class="space-y-4">
            <button
              type="button"
              class="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-brand/50 rounded-lg text-brand text-xs font-semibold hover:bg-brand-muted transition-colors cursor-pointer"
              data-llm-action="crear-descuento"
              (click)="openCreateForm()"
            >
              <app-icon name="plus" [size]="14" />
              Nuevo Descuento
            </button>

            @if (facade.isLoading()) {
              <app-skeleton-block variant="rect" width="100%" height="72px" />
              <app-skeleton-block variant="rect" width="100%" height="72px" />
            } @else if (facade.discounts().length === 0) {
              <div
                class="text-center py-8 border border-dashed border-border-default rounded-xl bg-base"
              >
                <app-icon name="tag" [size]="24" class="text-text-muted mx-auto mb-2 opacity-50" />
                <p class="text-sm text-text-muted">Aún no hay descuentos predefinidos.</p>
              </div>
            } @else {
              <div class="space-y-3">
                @for (d of facade.discounts(); track d.id) {
                  <div class="p-3.5 rounded-xl border border-border-default bg-base space-y-2">
                    <div class="flex items-start justify-between gap-2">
                      <div>
                        <p class="item-title">{{ d.name }}</p>
                        <p class="text-xs text-text-muted mt-0.5">
                          {{ formatValue(d) }} · {{ scopeLabel(d) }}
                        </p>
                        <p class="text-xs text-text-muted">
                          {{ d.branchName ?? 'Todas las sedes' }}
                        </p>
                      </div>
                      <app-badge [variant]="d.status === 'active' ? 'success' : 'neutral'">
                        {{ d.status === 'active' ? 'Activo' : 'Inactivo' }}
                      </app-badge>
                    </div>
                    <div class="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        class="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-border-default bg-surface text-xs font-semibold text-text-primary hover:bg-subtle transition-colors cursor-pointer"
                        data-llm-action="editar-descuento"
                        (click)="openEditForm(d)"
                      >
                        <app-icon name="pencil" [size]="12" />
                        Editar
                      </button>
                      <button
                        type="button"
                        class="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors cursor-pointer"
                        [class.border-border-default]="d.status === 'active'"
                        [class.bg-surface]="d.status === 'active'"
                        [class.text-text-primary]="d.status === 'active'"
                        [class.hover:bg-subtle]="d.status === 'active'"
                        [class.border-success/40]="d.status !== 'active'"
                        [class.bg-success/10]="d.status !== 'active'"
                        [class.text-success]="d.status !== 'active'"
                        [disabled]="togglingId() !== null"
                        data-llm-action="alternar-estado-descuento"
                        (click)="toggleStatus(d)"
                      >
                        @if (togglingId() === d.id) {
                          <app-icon name="loader-circle" [size]="12" class="animate-spin" />
                          Procesando...
                        } @else {
                          <app-icon
                            [name]="d.status === 'active' ? 'circle-x' : 'circle-check'"
                            [size]="12"
                          />
                          {{ d.status === 'active' ? 'Desactivar' : 'Reactivar' }}
                        }
                      </button>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        } @else {
          <!-- Form: crear/editar -->
          <div class="space-y-4">
            <div>
              <label class="text-xs font-semibold text-text-muted mb-1 block">Nombre</label>
              <input
                type="text"
                class="field-input"
                [(ngModel)]="formName"
                placeholder="Ej: Descuento Referido"
                data-llm-description="input for the discount name"
              />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs font-semibold text-text-muted mb-1 block">Tipo</label>
                <select
                  class="field-input cursor-pointer"
                  [(ngModel)]="formDiscountType"
                  data-llm-description="select for the discount type: percentage or fixed amount"
                >
                  <option value="percentage">Porcentaje (%)</option>
                  <option value="fixed_amount">Monto Fijo ($)</option>
                </select>
              </div>
              <div>
                <label class="text-xs font-semibold text-text-muted mb-1 block">Valor</label>
                <div class="input-prefix-wrapper">
                  @if (formDiscountType() === 'fixed_amount') {
                    <span class="input-prefix">$</span>
                  }
                  <input
                    type="number"
                    class="field-input"
                    [class.field-input--prefixed]="formDiscountType() === 'fixed_amount'"
                    [(ngModel)]="formValue"
                    placeholder="0"
                    min="0"
                    [max]="formDiscountType() === 'percentage' ? 100 : null"
                    data-llm-description="input for the discount value"
                  />
                </div>
                @if (percentageOutOfRange()) {
                  <p class="text-xs text-error mt-1">Un porcentaje no puede superar 100%.</p>
                }
              </div>
            </div>

            <div>
              <label class="text-xs font-semibold text-text-muted mb-1 block">Sede</label>
              <select
                class="field-input cursor-pointer"
                [(ngModel)]="formBranchId"
                data-llm-description="select for which branch this discount applies to"
              >
                <option [ngValue]="null">Todas las sedes</option>
                @for (branch of branchFacade.branches(); track branch.id) {
                  <option [ngValue]="branch.id">{{ branch.name }}</option>
                }
              </select>
            </div>

            <div>
              <label class="text-xs font-semibold text-text-muted mb-1 block">Aplicable a</label>
              <select
                class="field-input cursor-pointer"
                [(ngModel)]="formApplicableTo"
                data-llm-description="select for which course type this discount applies to"
              >
                <option value="all">Todos los cursos</option>
                <option value="class_b">Clase B</option>
                <option value="professional">Clase Profesional</option>
              </select>
            </div>

            @if (formApplicableTo() === 'professional') {
              <div>
                <label class="text-xs font-semibold text-text-muted mb-1 block">
                  Curso de Clase Profesional
                </label>
                <select
                  class="field-input cursor-pointer"
                  [(ngModel)]="formCourseId"
                  data-llm-description="select for a specific professional course, including CONV courses, or general"
                >
                  <option [ngValue]="null">General (todos los cursos profesionales)</option>
                  @for (course of facade.professionalCourses(); track course.id) {
                    <option [ngValue]="course.id">{{ course.name }}</option>
                  }
                </select>
              </div>
            }

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-xs font-semibold text-text-muted mb-1 block"
                  >Vigente desde</label
                >
                <input
                  type="date"
                  class="field-input"
                  [ngModel]="formValidFrom()"
                  (ngModelChange)="formValidFrom.set($event)"
                  data-llm-description="input for the discount valid-from date"
                />
              </div>
              <div>
                <label class="text-xs font-semibold text-text-muted mb-1 block"
                  >Vigente hasta (opcional)</label
                >
                <input
                  type="date"
                  class="field-input"
                  [ngModel]="formValidUntil()"
                  (ngModelChange)="formValidUntil.set($event)"
                  data-llm-description="input for the discount valid-until date, optional"
                />
              </div>
            </div>
          </div>
        }

        <!-- Footer -->
        <ng-container ngProjectAs="[drawer-form-footer]">
          @if (mode() === 'list') {
            <button type="button" class="btn-secondary" (click)="close()">Cerrar</button>
          } @else {
            <button
              type="button"
              class="btn-secondary"
              (click)="cancelForm()"
              [disabled]="facade.isSaving()"
              data-llm-action="cancelar-formulario-descuento"
            >
              Cancelar
            </button>
            <button
              type="button"
              class="btn-primary flex items-center gap-2"
              [disabled]="!canSave()"
              (click)="save()"
              data-llm-action="guardar-descuento"
            >
              <app-icon name="save" [size]="14" />
              {{ facade.isSaving() ? 'Guardando...' : 'Guardar' }}
            </button>
          }
        </ng-container>
      </app-drawer-form>
    </div>
  `,
})
export class DescuentosDrawerComponent {
  protected readonly facade = inject(DiscountsFacade);
  protected readonly branchFacade = inject(BranchFacade);
  protected readonly layoutDrawer = inject(LayoutDrawerFacadeService);

  protected readonly mode = signal<'list' | 'form'>('list');
  protected readonly editingId = signal<number | null>(null);
  protected readonly togglingId = signal<number | null>(null);

  protected readonly formName = signal('');
  protected readonly formDiscountType = signal<DiscountType>('percentage');
  protected readonly formValue = signal<number | null>(null);
  protected readonly formApplicableTo = signal<DiscountApplicableTo>('all');
  protected readonly formBranchId = signal<number | null>(null);
  protected readonly formCourseId = signal<number | null>(null);
  protected readonly formValidFrom = signal(this.today());
  protected readonly formValidUntil = signal<string | null>(null);

  protected readonly percentageOutOfRange = computed(
    () => this.formDiscountType() === 'percentage' && (this.formValue() ?? 0) > 100,
  );

  protected readonly canSave = computed(
    () =>
      this.formName().trim().length > 0 &&
      (this.formValue() ?? 0) > 0 &&
      !this.percentageOutOfRange() &&
      !this.facade.isSaving(),
  );

  constructor() {
    void this.facade.loadDiscounts();

    // Recarga el picker de cursos profesionales al cambiar de sede o al elegir "Clase Profesional".
    effect(() => {
      const branchId = this.formBranchId();
      if (this.mode() === 'form' && this.formApplicableTo() === 'professional') {
        void this.facade.loadProfessionalCourses(branchId);
      }
    });

    // Un descuento "curso específico" solo tiene sentido bajo Clase Profesional.
    effect(
      () => {
        if (this.formApplicableTo() !== 'professional' && this.formCourseId() !== null) {
          this.formCourseId.set(null);
        }
      },
      { allowSignalWrites: true },
    );
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  protected scopeLabel(d: DiscountUi): string {
    if (d.courseId !== null) {
      return d.courseName ?? APPLICABLE_TO_LABEL[d.applicableTo];
    }
    return APPLICABLE_TO_LABEL[d.applicableTo];
  }

  protected formatValue(d: DiscountUi): string {
    return d.discountType === 'percentage'
      ? `${d.value}%`
      : d.value.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' });
  }

  protected openCreateForm(): void {
    this.editingId.set(null);
    this.formName.set('');
    this.formDiscountType.set('percentage');
    this.formValue.set(null);
    this.formApplicableTo.set('all');
    this.formBranchId.set(null);
    this.formCourseId.set(null);
    this.formValidFrom.set(this.today());
    this.formValidUntil.set(null);
    this.mode.set('form');
  }

  protected openEditForm(d: DiscountUi): void {
    this.editingId.set(d.id);
    this.formName.set(d.name);
    this.formDiscountType.set(d.discountType);
    this.formValue.set(d.value);
    this.formApplicableTo.set(d.applicableTo);
    this.formBranchId.set(d.branchId);
    this.formCourseId.set(d.courseId);
    this.formValidFrom.set(d.validFrom);
    this.formValidUntil.set(d.validUntil);
    this.mode.set('form');
  }

  protected cancelForm(): void {
    this.mode.set('list');
  }

  protected async toggleStatus(d: DiscountUi): Promise<void> {
    this.togglingId.set(d.id);
    await this.facade.toggleStatus(d.id, d.status);
    this.togglingId.set(null);
  }

  protected async save(): Promise<void> {
    if (!this.canSave()) return;

    const payload: DiscountFormValue = {
      name: this.formName().trim(),
      discountType: this.formDiscountType(),
      value: this.formValue() ?? 0,
      validFrom: this.formValidFrom(),
      validUntil: this.formValidUntil() || null,
      applicableTo: this.formApplicableTo(),
      branchId: this.formBranchId(),
      courseId: this.formApplicableTo() === 'professional' ? this.formCourseId() : null,
    };

    const id = this.editingId();
    const success = id
      ? await this.facade.updateDiscount(id, payload)
      : await this.facade.createDiscount(payload);

    if (success) {
      this.mode.set('list');
    }
  }

  protected close(): void {
    this.layoutDrawer.back();
  }
}
