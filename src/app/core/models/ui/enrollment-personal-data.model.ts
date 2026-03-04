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

export type AgeAlertStatus = 'ok' | 'under-17' | 'requires-authorization' | 'none';

export interface RegionOption {
  code: string;
  name: string;
}

export interface CommuneOption {
  value: string;
  label: string;
  regionCode: string;
}

export interface SingularCourseOption {
  code: SingularCourseCode;
  name: string;
  price: number;
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
  lastNames: string;
  email: string;
  phone: string;
  birthDate: string;
  gender: Gender;
  address: string;
  regionCode: string;
  communeValue: string;
  courseCategory: CourseCategory;
  courseType: CourseType;
  singularCourseCode: SingularCourseCode | null;
  senceCode: string | null;
  // Professional fields (only when courseCategory === 'professional')
  currentLicense: CurrentLicenseType | null;
  licenseDate: string | null;
  validationA2A4: boolean;
  historicalPromotionId: string | null;
  validationBook: ValidationBook | null;
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
