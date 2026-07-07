import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CoursesFacade } from '@core/facades/courses.facade';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { SelectModule } from 'primeng/select';

@Component({
  selector: 'app-cursos-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SelectModule, IconComponent, SkeletonBlockComponent],
  template: `
    <div class="flex flex-col gap-6 animate-fade-in">
      <div class="flex items-center justify-between border-b pb-2 mb-2 border-border-subtle">
        <h3 class="text-base font-bold text-text-primary">Gestión de Cursos y Licencias</h3>
        @if (coursesFacade.availableCourses().length > 0) {
          <button
            type="button"
            class="btn-primary py-1.5 px-3 text-xs cursor-pointer flex items-center gap-1"
            (click)="addCourse()"
            data-llm-action="add-website-course"
          >
            <app-icon name="plus" [size]="14" />
            <span>Agregar Curso</span>
          </button>
        }
      </div>

      @if (coursesFacade.isLoading()) {
        <div class="flex flex-col gap-3">
          <app-skeleton-block variant="rect" width="100%" height="80px" />
          <app-skeleton-block variant="rect" width="100%" height="80px" />
        </div>
      } @else if (coursesFacade.availableCourses().length === 0) {
        <div
          class="p-8 text-center border rounded-xl border-dashed flex flex-col items-center gap-3 border-warning bg-warning/5"
        >
          <app-icon name="alert-triangle" [size]="28" />
          <p class="text-text-primary text-sm font-semibold">
            Este branch no tiene cursos operacionales activos
          </p>
          <p class="text-text-muted text-xs max-w-sm">
            Primero creá cursos en el Catálogo Operacional antes de configurar las cards de la
            landing.
          </p>
        </div>
      } @else {
        <div class="flex flex-col gap-6">
          @if (coursesArray().length === 0) {
            <div
              class="p-8 text-center border rounded-xl border-dashed border-border-subtle bg-elevated"
            >
              <p class="text-text-muted text-sm">
                No hay cards de cursos. Hacé clic en "Agregar Curso" para crear una.
              </p>
            </div>
          }

          @for (courseCtrl of coursesArray().controls; track $index) {
            @let courseId = courseCtrl.get('course_id')?.value;
            @let catalogItem = getCatalogItem(courseId);
            @let isOrphan = courseId != null && catalogItem == null;
            @let isInactive = catalogItem != null && !catalogItem.active;
            <div
              [formGroup]="asFormGroup(courseCtrl)"
              class="p-4 md:p-5 rounded-xl border flex flex-col gap-4 transition-all bg-elevated"
              [style.border-color]="
                isOrphan
                  ? 'var(--state-danger)'
                  : isInactive
                    ? 'var(--state-warning)'
                    : 'var(--border-default)'
              "
            >
              <!-- Card header -->
              <div
                class="flex items-center justify-between border-b pb-2 mb-1 border-border-subtle"
              >
                <span class="text-sm font-bold text-text-primary">
                  Card #{{ $index + 1 }}:
                  {{
                    catalogItem?.name ??
                      (courseId ? '(curso no disponible)' : 'Sin curso seleccionado')
                  }}
                </span>
                <div class="flex items-center gap-2">
                  @if (isOrphan) {
                    <span
                      class="text-2xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 text-error bg-error/12"
                    >
                      <app-icon name="x-circle" [size]="11" />
                      Curso no existe
                    </span>
                  } @else if (isInactive) {
                    <span
                      class="text-2xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 text-warning bg-warning/12"
                    >
                      <app-icon name="alert-triangle" [size]="11" />
                      Curso inactivo — no visible en web
                    </span>
                  }
                  <button
                    type="button"
                    class="btn-ghost py-1 px-2 text-xs flex items-center gap-1 rounded cursor-pointer text-error"
                    (click)="removeCourse($index)"
                    data-llm-action="remove-website-course"
                  >
                    <app-icon name="trash-2" [size]="13" />
                    <span>Eliminar</span>
                  </button>
                </div>
              </div>

              <!-- Fila 1: Dropdown de curso + datos heredados + displayOrder -->
              <div class="bento-grid bento-grid--forms bento-grid--forms">
                <div class="flex flex-col gap-1.5" data-col-span-md="4" data-col-span="6">
                  <label class="field-label">Curso del Catálogo Operacional *</label>
                  <p-select
                    formControlName="course_id"
                    [options]="courseOptions()"
                    optionLabel="label"
                    optionValue="id"
                    styleClass="w-full"
                    placeholder="— Seleccionar curso —"
                    data-llm-action="select-website-course"
                    data-llm-description="dropdown to link a course card to an operational course from the catalog"
                  />
                </div>
                <div class="flex flex-col gap-1.5" data-col-span-md="2" data-col-span="3">
                  <label class="field-label">Precio Base (heredado)</label>
                  <div
                    class="field-input flex items-center text-text-muted text-xs bg-base cursor-default"
                  >
                    {{ catalogItem ? formatCLP(catalogItem.base_price) : '—' }}
                  </div>
                </div>
                <div class="flex flex-col gap-1.5" data-col-span-md="2" data-col-span="3">
                  <label class="field-label">Orden de visualización</label>
                  <input
                    type="number"
                    formControlName="displayOrder"
                    class="field-input"
                    min="1"
                    data-llm-description="display order for this course card on the landing page"
                  />
                </div>
              </div>

              <!-- Fila 2: Override de precio -->
              <div
                class="flex flex-col gap-2 p-4 rounded-xl border border-solid border-border-default bg-surface"
              >
                <label class="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    class="accent-[var(--color-primary)] w-4 h-4"
                    [checked]="courseCtrl.get('priceOverride')?.value != null"
                    (change)="
                      courseCtrl
                        .get('priceOverride')
                        ?.setValue($any($event.target).checked ? 0 : null)
                    "
                  />
                  <span class="text-xs font-semibold text-text-primary"
                    >Personalizar precio para promo</span
                  >
                  @if (courseCtrl.get('priceOverride')?.value != null) {
                    <span
                      class="text-2xs font-bold px-2 py-0.5 rounded-full flex items-center gap-1 text-brand bg-brand/12"
                    >
                      <app-icon name="tag" [size]="10" />
                      Override activo
                    </span>
                  }
                </label>
                @if (courseCtrl.get('priceOverride')?.value != null) {
                  <div class="flex flex-col gap-1.5 mt-1">
                    <label class="field-label">Precio Override (CLP) — 0 = "Gratis"</label>
                    <div class="input-prefix-wrapper">
                      <span class="input-prefix">$</span>
                      <input
                        type="number"
                        formControlName="priceOverride"
                        class="field-input pl-8"
                        placeholder="320000"
                        min="0"
                        data-llm-description="override price for promotional purposes; 0 means free"
                      />
                    </div>
                    @if (catalogItem) {
                      <span class="text-xs text-text-muted">
                        {{
                          getOverridePreview(
                            courseCtrl.get('priceOverride')?.value,
                            catalogItem.base_price ?? 0
                          )
                        }}
                      </span>
                    }
                  </div>
                }
              </div>

              <!-- Fila 3: Campos editoriales -->
              <div class="bento-grid bento-grid--forms bento-grid--forms">
                <div class="flex flex-col gap-1.5" data-col-span-md="4" data-col-span="6">
                  <label class="field-label">Duración del Curso *</label>
                  <input
                    type="text"
                    formControlName="duration"
                    class="field-input"
                    placeholder="Ej: 4 a 6 semanas"
                    data-llm-description="human-readable course duration displayed on the landing card"
                  />
                </div>
                <div class="flex flex-col gap-1.5" data-col-span-md="4" data-col-span="6">
                  <label class="field-label">Nota de Pago</label>
                  <input
                    type="text"
                    formControlName="priceNote"
                    class="field-input"
                    placeholder="Ej: Matrícula costo cero"
                    data-llm-description="optional payment note shown below the price on the landing card"
                  />
                </div>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="field-label">Breve Descripción *</label>
                <textarea
                  formControlName="description"
                  rows="2"
                  class="field-input resize-none"
                  placeholder="Descripción resumida del curso"
                  data-llm-description="editorial course description displayed on the landing card"
                ></textarea>
              </div>

              <div class="bento-grid bento-grid--forms bento-grid--forms">
                <div class="flex flex-col gap-3 justify-center" data-col-span-md="4" data-col-span="4">
                  <label class="flex items-center gap-2 cursor-pointer py-1">
                    <input
                      type="checkbox"
                      formControlName="highlighted"
                      class="accent-[var(--color-primary)] w-4 h-4"
                    />
                    <span class="text-xs font-semibold text-text-primary"
                      >Destacar Curso en Web</span
                    >
                  </label>
                </div>
                <div class="flex flex-col gap-1.5" data-col-span-md="4" data-col-span="8">
                  <label class="field-label">Badge Destacado (ej: '¡Más Popular!')</label>
                  <input
                    type="text"
                    formControlName="badge"
                    class="field-input"
                    placeholder="Opcional"
                    [attr.disabled]="courseCtrl.get('highlighted')?.value ? null : true"
                    data-llm-description="badge text shown on highlighted course cards"
                  />
                </div>
              </div>

              <div class="flex flex-col gap-1.5">
                <label class="field-label"
                  >¿Qué incluye el curso? (Lista separada por comas) *</label
                >
                <textarea
                  formControlName="includes"
                  rows="2"
                  class="field-input resize-none"
                  placeholder="Ej: Doble comando homologado, Cursos prácticos garantizados, Material de estudio digital"
                  data-llm-description="comma-separated list of course inclusions shown as checkmarks on landing"
                ></textarea>
                <span class="text-xs text-text-muted">
                  Ingrese cada beneficio separado por una coma (,). Esto dibujará checkmarks en la
                  landing.
                </span>
              </div>
            </div>
          }
        </div>
      }

      <div [formGroup]="pricingFooterGroup()" class="flex flex-col gap-6">
        <h3
          class="text-base font-bold text-text-primary border-b pb-2 mt-6 mb-2 border-border-subtle"
        >
          Términos de Pago y Garantía (Precios)
        </h3>
        <div class="bento-grid bento-grid--forms bento-grid--forms">
          <!-- Pago Directo -->
          <div
            formGroupName="payment"
            class="flex flex-col gap-4 p-4 rounded-xl border border-border-default bg-elevated"
            data-col-span-md="4"
            data-col-span="6"
          >
            <span class="text-xs font-bold uppercase tracking-wider text-text-primary"
              >Facilidades de Pago</span
            >
            <div class="flex flex-col gap-1.5">
              <label class="field-label">Título *</label>
              <input
                type="text"
                formControlName="title"
                class="field-input"
                placeholder="Facilidades de Pago Directo"
              />
              @if (
                pricingFooterGroup().get('payment.title')?.touched &&
                pricingFooterGroup().get('payment.title')?.invalid
              ) {
                <span class="text-xs mt-1 text-error">
                  @if (pricingFooterGroup().get('payment.title')?.errors?.['required']) {
                    El título es requerido.
                  }
                  @if (pricingFooterGroup().get('payment.title')?.errors?.['maxlength']) {
                    Máximo 100 caracteres.
                  }
                </span>
              }
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="field-label">Descripción *</label>
              <textarea
                formControlName="description"
                class="field-input min-h-[60px] resize-y"
                placeholder="Puedes reservar tu cupo con un pie inicial..."
              ></textarea>
              @if (
                pricingFooterGroup().get('payment.description')?.touched &&
                pricingFooterGroup().get('payment.description')?.invalid
              ) {
                <span class="text-xs mt-1 text-error">
                  @if (pricingFooterGroup().get('payment.description')?.errors?.['required']) {
                    La descripción es requerida.
                  }
                  @if (pricingFooterGroup().get('payment.description')?.errors?.['maxlength']) {
                    Máximo 300 caracteres.
                  }
                </span>
              }
            </div>
          </div>

          <!-- Garantía -->
          <div
            formGroupName="guarantee"
            class="flex flex-col gap-4 p-4 rounded-xl border border-border-default bg-elevated"
            data-col-span-md="4"
            data-col-span="6"
          >
            <span class="text-xs font-bold uppercase tracking-wider text-text-primary"
              >Garantía de Aprendizaje</span
            >
            <div class="flex flex-col gap-1.5">
              <label class="field-label">Título *</label>
              <input
                type="text"
                formControlName="title"
                class="field-input"
                placeholder="Garantía de Aprendizaje"
              />
              @if (
                pricingFooterGroup().get('guarantee.title')?.touched &&
                pricingFooterGroup().get('guarantee.title')?.invalid
              ) {
                <span class="text-xs mt-1 text-error">
                  @if (pricingFooterGroup().get('guarantee.title')?.errors?.['required']) {
                    El título es requerido.
                  }
                  @if (pricingFooterGroup().get('guarantee.title')?.errors?.['maxlength']) {
                    Máximo 100 caracteres.
                  }
                </span>
              }
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="field-label">Descripción *</label>
              <textarea
                formControlName="description"
                class="field-input min-h-[60px] resize-y"
                placeholder="Todo el material teórico e instructores certificados..."
              ></textarea>
              @if (
                pricingFooterGroup().get('guarantee.description')?.touched &&
                pricingFooterGroup().get('guarantee.description')?.invalid
              ) {
                <span class="text-xs mt-1 text-error">
                  @if (pricingFooterGroup().get('guarantee.description')?.errors?.['required']) {
                    La descripción es requerida.
                  }
                  @if (pricingFooterGroup().get('guarantee.description')?.errors?.['maxlength']) {
                    Máximo 300 caracteres.
                  }
                </span>
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    .field-label {
      display: block;
      font-size: var(--text-xs);
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    .field-input {
      width: 100%;
      padding: 10px 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--border-default);
      background: var(--bg-base);
      color: var(--text-primary);
      font-size: var(--text-sm);
      outline: none;
      transition: border-color var(--duration-fast, 150ms) ease;
    }
    .field-input:focus {
      border-color: var(--ds-brand);
    }
    .input-prefix-wrapper {
      position: relative;
    }
    .input-prefix {
      position: absolute;
      left: 10px;
      top: 50%;
      transform: translateY(-50%);
      color: var(--text-muted);
      font-size: var(--text-sm);
      font-weight: 600;
      pointer-events: none;
    }
  `,
})
export class CursosTabComponent {
  protected readonly coursesFacade = inject(CoursesFacade);
  private readonly fb = inject(FormBuilder);

  coursesArray = input.required<FormArray>();
  pricingFooterGroup = input.required<FormGroup>();

  protected readonly courseOptions = computed(() =>
    this.coursesFacade.availableCourses().map((c) => ({
      id: c.id,
      label: `${c.name} (${c.license_class})`,
    })),
  );

  protected asFormGroup(ctrl: AbstractControl): FormGroup {
    return ctrl as FormGroup;
  }

  protected getCatalogItem(courseId: number | null) {
    if (courseId == null) return undefined;
    return this.coursesFacade.availableById().get(courseId);
  }

  protected formatCLP(amount: number | null | undefined): string {
    if (amount == null) return '—';
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  protected getOverridePreview(overrideVal: number | null, basePrice: number): string {
    const label = overrideVal === 0 ? 'Gratis' : this.formatCLP(overrideVal);
    return `La landing mostrará ${label} con tachado de ${this.formatCLP(basePrice)}`;
  }

  protected addCourse(): void {
    const nextOrder = this.coursesArray().length + 1;
    this.coursesArray().push(
      this.fb.group({
        course_id: [null as number | null, Validators.required],
        description: ['', Validators.required],
        priceNote: [''],
        duration: ['', Validators.required],
        highlighted: [false],
        badge: [''],
        priceOverride: [null as number | null],
        displayOrder: [nextOrder],
        includes: ['', Validators.required],
      }),
    );
    this.coursesArray().markAsDirty();
  }

  protected removeCourse(index: number): void {
    this.coursesArray().removeAt(index);
    this.coursesArray().markAsDirty();
  }
}
