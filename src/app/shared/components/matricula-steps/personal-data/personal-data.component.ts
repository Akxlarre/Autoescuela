import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AsyncBtnComponent } from '@shared/components/async-btn/async-btn.component';
import type {
  EnrollmentPersonalData,
  CourseCategory,
  CourseOption,
  AgeAlertStatus,
} from '@core/models/ui/enrollment-personal-data.model';
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
  imports: [FormsModule, IconComponent, AsyncBtnComponent, EmailInputComponent],
  templateUrl: './personal-data.component.html',
  styleUrl: './personal-data.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PersonalDataComponent {
  data = input.required<EnrollmentPersonalData>();
  loading = input<boolean>(false);
  dataChange = output<EnrollmentPersonalData>();
  next = output<void>();
  cancel = output<void>();

  // ── Category selection (local UI state) ───────────────────────────────────

  readonly selectedCategory = signal<CourseCategory | null>(null);

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

  /** Siempre muestra las 3 categorías; el nivel 2 informa si no hay cursos disponibles. */
  readonly availableCategories = computed<CategoryMeta[]>(() => this.categories);

  readonly filteredCourses = computed<CourseOption[]>(() => {
    const cat = this.selectedCategory();
    if (!cat) return [];
    return this.data().courses.filter((c) => c.category === cat);
  });

  constructor() {
    // Inicializa selectedCategory desde los datos al cargar (re-edición o default)
    effect(() => {
      const cat = this.data().courseCategory;
      if (cat && !this.selectedCategory()) {
        this.selectedCategory.set(cat);
      }
    });
  }

  // ── Validation signals ────────────────────────────────────────────────────

  readonly rutValid = computed(() => validateRut(this.data().rut));
  readonly emailValid = computed(() => validateEmail(this.data().email));

  readonly ageStatus = computed((): AgeAlertStatus => {
    const age = this.calcAge(this.data().birthDate);
    if (age === null) return 'none';
    if (age < 17) return 'under-17';
    if (age < 18) return 'requires-authorization';
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
    return (
      this.rutValid() &&
      this.ageStatus() !== 'under-17' &&
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
