export type LicenseGroup = 'class_b' | 'professional';
export type CertificateState = 'locked' | 'enabled' | 'issued';
export type AttendanceSemaphore = 'green' | 'yellow' | 'red';

export interface StudentHomeHero {
  studentFirstName: string;
  enrollmentNumber: string;
  licenseGroup: LicenseGroup;
  branchName: string | null;
  courseStartDate: string | null;
  enrollmentStatus: string;
}

export interface StudentHomePractice {
  number: number;
  status: 'completed' | 'scheduled' | 'pending';
  date: string | null;
}

export interface StudentHomeProgress {
  practicesCompleted: number;
  practicesTotal: number;
  pctTheoryAttendance: number;
  pctOverall: number;
  practices: StudentHomePractice[];
}

export interface StudentHomeSession {
  id: string;
  date: string;
  kind: 'theory' | 'practice';
  status: 'present' | 'absent' | 'late';
  label: string;
}

export interface StudentHomeAttendance {
  consecutiveAbsences: number;
  semaphore: AttendanceSemaphore;
  recentSessions: StudentHomeSession[];
}

export interface StudentHomeModule {
  number: number;
  name: string;
  grade: number | null;
  passed: boolean | null;
  status: 'draft' | 'confirmed';
}

export interface StudentHomeGrades {
  finalExamGrade: number | null;
  finalExamDate: string | null;
  passed: boolean | null;
  modules: StudentHomeModule[];
  averageGrade: number | null;
}

export interface StudentHomeCertificate {
  state: CertificateState;
  folio: string | null;
  issuedDate: string | null;
  pdfUrl: string | null;
  blockingReason: string | null;
}

export interface StudentHomeNextClass {
  date: string;
  time: string;
  instructorName: string;
}

export interface StudentHomeSideWidgets {
  nextClass: StudentHomeNextClass | null;
  pendingBalance: number;
  totalPaid: number;
}

export interface StudentHomeSnapshot {
  hero: StudentHomeHero;
  progress: StudentHomeProgress;
  attendance: StudentHomeAttendance;
  grades: StudentHomeGrades;
  certificate: StudentHomeCertificate;
  side: StudentHomeSideWidgets;
}
