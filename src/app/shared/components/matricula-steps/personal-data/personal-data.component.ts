import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  linkedSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AsyncBtnComponent } from '@shared/components/async-btn/async-btn.component';
import { BranchSelectorComponent } from '@shared/components/branch-selector/branch-selector.component';
import type {
  EnrollmentPersonalData,
  CourseCategory,
  CourseOption,
  AgeAlertStatus,
  LicenseValidation,
} from '@core/models/ui/enrollment-personal-data.model';
import type { BranchOption } from '@core/models/ui/branch.model';
import { formatRut, validateRut, autocompleteRutDv } from '@core/utils/rut.utils';
import { validateEmail } from '@core/utils/email.utils';
import { calcAge, getAgeStatus } from '@core/utils/age.utils';
import { calcLicenseSeniority } from '@core/utils/license-seniority.utils';
import { todayIso } from '@core/utils/date.utils';
import { EmailInputComponent } from '@shared/components/email-input/email-input.component';
import { DateInputComponent } from '@shared/components/date-input/date-input.component';

interface CategoryMeta {
  value: CourseCategory;
  label: string;
  description: string;
  icon: string;
}

/**
 * Advertencia temprana (no bloqueante) de antigüedad de licencia clase B, estimada
 * contra la fecha de HOY — solo para dar feedback inmediato en este paso. El chequeo
 * definitivo (contra la fecha de inicio de la promoción elegida) ocurre en el Step 2
 * (fix-089).
 */
export function earlyLicenseWarningFn(
  category: CourseCategory | null,
  licenseDate: string | null,
): LicenseValidation | null {
  if (category !== 'professional') return null;
  return calcLicenseSeniority(licenseDate, todayIso());
}

/**
 * En categoría Profesional, "Licencia previa" y "Fecha de obtención licencia B" son
 * obligatorios (el curso profesional exige acreditar licencia B vigente). En las demás
 * categorías no aplican.
 */
export function hasRequiredProfessionalLicenseFn(
  category: CourseCategory | null,
  currentLicense: EnrollmentPersonalData['currentLicense'],
  licenseDate: string | null,
): boolean {
  if (category !== 'professional') return true;
  return !!currentLicense && currentLicense !== 'none' && !!licenseDate;
}

@Component({
  selector: 'app-personal-data-step',
  imports: [
    FormsModule,
    SelectModule,
    IconComponent,
    AsyncBtnComponent,
    EmailInputComponent,
    BranchSelectorComponent,
    DateInputComponent,
  ],
  templateUrl: './personal-data.component.html',
  styleUrl: './personal-data.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonalDataComponent {
  private _rutPrefillTimer: ReturnType<typeof setTimeout> | undefined;
  readonly genderOptions = [
    { label: 'Masculino', value: 'M' },
    { label: 'Femenino', value: 'F' },
  ];
  readonly currentLicenseOptions = [
    { label: 'Clase B', value: 'B' },
    { label: 'A2', value: 'A2' },
    { label: 'A3', value: 'A3' },
    { label: 'A4', value: 'A4' },
    { label: 'A5', value: 'A5' },
  ];

  data = input.required<EnrollmentPersonalData>();
  loading = input<boolean>(false);
  hiddenCategories = input<CourseCategory[]>([]);
  /** Sedes disponibles. Array vacío = modo secretaria (oculta el selector). */
  branches = input<BranchOption[]>([]);
  selectedBranchId = input<number | null>(null);


  dataChange = output<EnrollmentPersonalData>();
  next = output<void>();
  cancel = output<void>();
  branchChange = output<number | null>();
  /** Emite el RUT al perder el foco si es válido, para precargar un alumno existente (fix-020). */
  rutBlur = output<string>();

  // ── Category selection (local UI state) ───────────────────────────────────

  readonly selectedCategory = linkedSignal<CourseCategory | null>(
    () => this.data().courseCategory ?? null,
  );

  readonly categories: CategoryMeta[] = [
    {
      value: 'non-professional',
      label: 'No Profesional',
      description: 'Licencia Clase B',
      icon: 'car',
    },
    {
      value: 'professional',
      label: 'Profesional',
      description: 'Clases A2, A3, A4, A5',
      icon: 'truck',
    },
    { value: 'singular', label: 'Singular', description: 'Cursos especiales', icon: 'star' },
  ];

  /** Oculta categorías prohibidas para el rol/sucursal del usuario (decidido en el smart component). */
  readonly availableCategories = computed<CategoryMeta[]>(() => {
    const hidden = new Set(this.hiddenCategories());
    return this.categories.filter((c) => !hidden.has(c.value));
  });

  readonly filteredCourses = computed<CourseOption[]>(() => {
    const cat = this.selectedCategory();
    if (!cat) return [];
    return this.data().courses.filter((c) => c.category === cat);
  });

  // ── Validation signals ────────────────────────────────────────────────────

  readonly rutValid = computed(() => validateRut(this.data().rut));
  readonly emailValid = computed(() => validateEmail(this.data().email));

  readonly ageStatus = computed(
    (): AgeAlertStatus => getAgeStatus(this.data().birthDate, this.data().courseType),
  );

  /** Advertencia temprana de antigüedad de licencia B, estimada a hoy (fix-089). */
  readonly earlyLicenseWarning = computed<LicenseValidation | null>(() =>
    earlyLicenseWarningFn(this.selectedCategory(), this.data().licenseDate),
  );

  readonly courseMeta = computed<CourseOption | null>(
    () => this.data().courses.find((c) => c.type === this.data().courseType) ?? null,
  );

  readonly coursePriceLabel = computed(() => {
    const price = this.courseMeta()?.basePrice;
    if (!price) return '—';
    return '$' + price.toLocaleString('es-CL');
  });

  readonly canAdvance = computed(() => {
    const d = this.data();
    const courseIsValid = this.filteredCourses().some((c) => c.type === d.courseType);
    const age = this.ageStatus();
    return (
      this.rutValid() &&
      age !== 'under-17' &&
      age !== 'under-20-professional' &&
      d.firstNames.trim().length >= 2 &&
      d.paternalLastName.trim().length >= 2 &&
      this.emailValid() &&
      d.phone.trim().length >= 8 &&
      d.birthDate.length > 0 &&
      courseIsValid &&
      hasRequiredProfessionalLicenseFn(d.courseCategory, d.currentLicense, d.licenseDate)
    );
  });

  // ── Emit helpers ──────────────────────────────────────────────────────────

  onCategorySelect(cat: CourseCategory): void {
    this.selectedCategory.set(cat);
    // Solo emitimos la categoría; el courseType previo puede no pertenecer a esta categoría,
    // lo que hará que canAdvance=false hasta que el usuario elija un curso.
    this.dataChange.emit({ ...this.data(), courseCategory: cat });
  }

  onCourseSelect(course: CourseOption): void {
    this.dataChange.emit({
      ...this.data(),
      courseType: course.type,
      courseCategory: course.category,
      convalidatesSimultaneously: course.convalidation ?? false,
    });
  }

  onRutKeydown(event: KeyboardEvent): void {
    const allowed = ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Home', 'End'];
    if (allowed.includes(event.key)) return;
    if (event.ctrlKey || event.metaKey) return; // allow Ctrl+A/C/V/X
    if (/^\d$/.test(event.key)) return;
    if (event.key === 'k' || event.key === 'K') return;
    event.preventDefault();
  }

  onRutPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text') ?? '';
    const formatted = formatRut(pasted);
    this.dataChange.emit({ ...this.data(), rut: formatted });
  }

  onRutInput(raw: string): void {
    const formatted = formatRut(raw);
    this.dataChange.emit({ ...this.data(), rut: formatted });

    clearTimeout(this._rutPrefillTimer);
    if (validateRut(formatted)) {
      this._rutPrefillTimer = setTimeout(() => this.rutBlur.emit(formatted), 500);
    }
  }

  /**
   * Al perder el foco: autocompleta el DV (módulo 11, ASG-047) y cancela el timer
   * (ya se emitirá aquí si el RUT resultante es válido).
   */
  onRutBlur(): void {
    clearTimeout(this._rutPrefillTimer);
    const corrected = autocompleteRutDv(this.data().rut);
    if (corrected !== this.data().rut) {
      this.dataChange.emit({ ...this.data(), rut: corrected });
    }
    if (validateRut(corrected)) this.rutBlur.emit(corrected);
  }

  emitField<K extends keyof EnrollmentPersonalData>(
    field: K,
    value: EnrollmentPersonalData[K],
  ): void {
    this.dataChange.emit({ ...this.data(), [field]: value });
  }

  onNext(): void {
    if (!this.canAdvance()) return;
    this.next.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private calcAge(birthDate: string): number | null {
    return calcAge(birthDate);
  }
}
