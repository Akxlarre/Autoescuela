export type StudentSessionStatus =
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'absent'
  | 'cancelled'
  | 'no_show';

// ─── Clase B ────────────────────────────────────────────────────────────────

export interface StudentPracticeSessionRow {
  id: number;
  /** Número de clase en la secuencia (1..12). */
  classNumber: number;
  scheduledAt: string; // ISO datetime
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  durationMin: number;
  status: StudentSessionStatus;
  isPast: boolean;
}

export interface StudentTheorySessionRow {
  id: string;
  scheduledAt: string; // ISO datetime
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  attendanceStatus: 'present' | 'absent' | 'late' | 'justified';
}

// ─── Profesional ─────────────────────────────────────────────────────────────

export interface StudentProfSessionRow {
  id: string;
  date: string; // YYYY-MM-DD (sin hora — las sesiones prof son por día)
  kind: 'theory' | 'practice';
  attendanceStatus: 'present' | 'absent' | 'late' | 'justified' | null;
}

// ─── Snapshot completo ────────────────────────────────────────────────────────

export interface StudentClasesKpis {
  completedPractices: number;
  totalPractices: number;
  scheduledUpcoming: number;
  theoryPct: number;
}

export interface StudentClasesData {
  licenseGroup: 'class_b' | 'professional';
  kpis: StudentClasesKpis;
  // Clase B
  practiceSessions: StudentPracticeSessionRow[];
  theorySessions: StudentTheorySessionRow[];
  // Profesional
  profSessions: StudentProfSessionRow[];
}
