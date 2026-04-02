import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  linkedSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AsyncBtnComponent } from '@shared/components/async-btn/async-btn.component';
import { BranchSelectorComponent } from '@shared/components/branch-selector/branch-selector.component';
import type {
  EnrollmentPersonalData,
  CourseCategory,
  CourseOption,
  AgeAlertStatus,
} from '@core/models/ui/enrollment-personal-data.model';
import type { BranchOption } from '@core/models/ui/branch.model';
import { formatRut, validateRut } from '@core/utils/rut.utils';
import { validateEmail } from '@core/utils/email.utils';
import { EmailInputComponent } from '@shared/components/email-input/email-input.component';

interface CategoryMeta {
  value: CourseCategory;
  label: string;
  description: string;
  icon: string;
}

@Component({
  selector: 'app-personal-data-step',
  imports: [
    FormsModule,
    IconComponent,
    AsyncBtnComponent,
    EmailInputComponent,
    BranchSelectorComponent,
  ],
  templateUrl: './personal-data.component.html',
  styleUrl: './personal-data.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonalDataComponent {
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

  readonly ageStatus = computed((): AgeAlertStatus => {
    const age = this.calcAge(this.data().birthDate);
    if (age === null) return 'none';
    if (age < 17) return 'under-17';
    if (age < 18) return 'requires-authorization';
    if (this.data().courseCategory === 'professional' && age < 20) return 'under-20-professional';
    return 'ok';
  });

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
      courseIsValid
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
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
  }
}
