// Enrollment Step 1 — Personal data, location, course selection

export type Gender = 'M' | 'F';

export type CourseCategory = 'non-professional' | 'professional' | 'singular';

export type CourseType =
  | 'class_b'
  | 'class_b_sence'
  | 'professional_a2'
  | 'professional_a3'
  | 'professional_a4'
  | 'professional_a5'
  | 'singular';

export type SingularCourseCode =
  | 'grua_horquilla'
  | 'retroexcavadora'
  | 'maquinaria_pesada'
  | 'manejo_defensivo'
  | 'carga_peligrosa';

export type CurrentLicenseType = 'B' | 'A2' | 'A3' | 'A4' | 'A5' | 'none';

export type ValidationBook = 'book_1' | 'book_2';

export type AgeAlertStatus =
  | 'ok'
  | 'under-17'
  | 'requires-authorization'
  | 'under-20-professional'
  | 'none';

export interface SingularCourseOption {
  code: SingularCourseCode;
  name: string;
  price: number;
}

export interface CourseOption {
  id: number;
  type: CourseType;
  category: CourseCategory;
  label: string;
  icon: string;
  color: 'brand' | 'info' | 'warning' | 'default';
  basePrice: number;
  durationWeeks: number | null;
  practicalHours: number | null;
  /** true = opción visual de convalidación simultánea (A2 conv. A4 / A5 conv. A3). */
  convalidation?: boolean;
}

export interface SenceCodeOption {
  code: string;
  label: string;
}

export interface HistoricalPromotion {
  id: string;
  code: string;
  label: string;
  year: number;
}

export interface EnrollmentPersonalData {
  rut: string;
  firstNames: string;
  paternalLastName: string;
  maternalLastName: string;
  email: string;
  phone: string;
  birthDate: string;
  gender: Gender;
  address: string;
  courseCategory: CourseCategory;
  courseType: CourseType;
  singularCourseCode: SingularCourseCode | null;
  senceCode: string | null;
  // Professional fields (only when courseCategory === 'professional')
  currentLicense: CurrentLicenseType | null;
  licenseDate: string | null;
  /** true = el alumno se matricula en A2 convalidando A4, o en A5 convalidando A3. */
  convalidatesSimultaneously: boolean;
  historicalPromotionId: string | null;
  validationBook: ValidationBook | null;
  // Display options (populated by smart component, not persisted)
  courses: CourseOption[];
}

export interface AgeValidation {
  status: AgeAlertStatus;
  age: number | null;
  message: string;
}

export interface LicenseValidation {
  valid: boolean;
  message: string;
  seniorityYears: number | null;
}
