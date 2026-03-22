export interface InstructorDashboardData {
  todayClasses: InstructorClassRow[];
  kpis: InstructorDashboardKpis;
}

export interface InstructorDashboardKpis {
  clasesHoy: number;
  alumnosActivos: number;
  horasMes: number;
  tasaAsistencia: number; // porcentaje 0-100
}

export interface InstructorClassRow {
  sessionId: number;
  classNumber: number; // 1-12
  scheduledAt: string; // ISO datetime
  startTime: string | null;
  endTime: string | null;
  durationMin: number;
  status: string; // scheduled, in_progress, completed, cancelled, no_show
  studentName: string; // derivado JOIN
  studentRut: string; // derivado JOIN
  enrollmentId: number;
  studentId: number;
  vehiclePlate: string; // derivado JOIN
  vehicleLabel: string; // marca + modelo derivado
  kmStart: number | null;
  kmEnd: number | null;
  evaluationGrade: number | null;
  notes: string | null;
  // Campos derivados
  timeLabel: string; // "09:00 - 09:45"
  statusLabel: string;
  statusColor: string; // 'success' | 'warning' | 'error' | 'info' | 'muted'
  canStart: boolean; // scheduled + dentro de ventana horaria
  canFinish: boolean; // in_progress
  canEvaluate: boolean; // completed + sin evaluación
}

// ── Alumnos ──
export interface InstructorStudentCard {
  studentId: number;
  enrollmentId: number;
  name: string;
  rut: string;
  phone: string | null;
  email: string | null;
  courseCode: string;
  courseName: string;
  practiceProgress: number; // 0-12 clases completadas
  totalSessions: number; // 12
  practicePercent: number; // derivado
  theoryPercent: number; // 0-100 asistencia teórica
  nextClassDate: string | null;
  status: 'active' | 'completed' | 'suspended';
  statusLabel: string;
  statusColor: string;
}

export interface InstructorStudentDetail {
  studentId: number;
  enrollmentId: number;
  name: string;
  rut: string;
  phone: string | null;
  email: string | null;
  courseName: string;
  courseCode: string;
  practiceProgress: number;
  totalSessions: number;
  theoryPercent: number;
  fichaTecnica: FichaTecnicaRow[];
}

export interface FichaTecnicaRow {
  sessionId: number;
  classNumber: number; // 1-12
  date: string | null;
  status: string;
  grade: number | null; // 1-5
  kmStart: number | null;
  kmEnd: number | null;
  instructorName: string; // por si hubo reemplazo
  vehiclePlate: string;
  notes: string | null;
  canEvaluate: boolean;
}

// ── Evaluación de Clase ──
export interface EvaluationFormData {
  sessionId: number;
  classNumber: number;
  studentName: string;
  kmStart: number | null;
  kmEnd: number | null;
  grade: number; // 1-5
  checklist: EvaluationChecklistItem[];
  observations: string;
  studentSignature: string | null; // base64 PNG
  instructorSignature: string | null;
}

export interface EvaluationChecklistItem {
  id: string;
  label: string;
  checked: boolean;
}

// Checklist estándar (7 aspectos del mock)
export const EVALUATION_CHECKLIST_ITEMS: Omit<EvaluationChecklistItem, 'checked'>[] = [
  { id: 'control_volante', label: 'Control del volante' },
  { id: 'uso_espejos', label: 'Uso de espejos' },
  { id: 'cambio_marcha', label: 'Cambio de marcha' },
  { id: 'frenado', label: 'Frenado suave y progresivo' },
  { id: 'senalizacion', label: 'Señalización correcta' },
  { id: 'distancia_seguridad', label: 'Distancia de seguridad' },
  { id: 'conciencia_trafico', label: 'Conciencia del tráfico' },
];

// ── Horario ──
export interface ScheduleBlock {
  dayOfWeek: number; // 0=Lun, 6=Dom
  hour: number; // 8-20
  minuteStart: number; // 0 o 45
  type: 'practica' | 'teoria' | 'libre' | 'no_disponible';
  label: string; // nombre alumno o "Teoría" o vacío
  sessionId: number | null;
  color: string; // derivado del type
}

export interface WeekSchedule {
  weekLabel: string; // "17 - 23 Mar 2026"
  weekStart: string; // ISO date del lunes
  blocks: ScheduleBlock[];
}

// ── Liquidación / Horas ──
export interface MonthlyHoursRow {
  period: string; // "2026-03"
  periodLabel: string; // "Marzo 2026"
  theorySessions: number;
  practicalSessions: number;
  totalEquivalentHours: number;
  theoryHours: number;
  practicalHours: number;
}

export interface LiquidacionKpis {
  horasTeoriaMes: number;
  horasPracticaMes: number;
  totalHorasMes: number;
  anticiposMes: number; // CLP
}

export interface SessionDetailRow {
  sessionId: number;
  date: string;
  type: 'teoria' | 'practica';
  typeLabel: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  studentName: string | null; // null para teoría
  status: string;
  statusLabel: string;
}

// ── Ensayos Teóricos ──
export interface ExamScoreRow {
  id: number;
  studentName: string;
  studentRut: string;
  enrollmentId: number;
  date: string;
  score: number; // 0-100
  passed: boolean;
  passedLabel: string;
  scoreColor: string;
}

export interface RegisterExamPayload {
  studentId: number;
  enrollmentId: number;
  date: string;
  score: number;
}

// ── Asistencia ──
export interface AttendanceClassRow extends InstructorClassRow {
  attendanceRecorded: boolean;
  practiceAttendanceId: number | null;
}

// ── Dashboard sidebar ──
export interface UpcomingDay {
  fecha: string; // "2026-03-23"
  fechaLabel: string; // "lun. 23 mar."
  cantidad: number;
}
