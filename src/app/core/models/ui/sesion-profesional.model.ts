export type SesionTipo = 'theory' | 'practice';
export type SesionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
export type AsistenciaStatus = 'present' | 'absent' | 'excused';

export interface SesionProfesional {
  id: number;
  tipo: SesionTipo;
  date: string;
  status: SesionStatus;
  statusLabel: string;
  promotionCourseId: number;
  courseCode: string;
  /** Cantidad de alumnos con asistencia registrada */
  attendanceCount: number;
  /** Cantidad de alumnos inscritos en el curso */
  enrolledCount: number;
  notes: string | null;
  zoomLink: string | null;
}

export interface SesionAlumnoAsistencia {
  attendanceId: number | null;
  enrollmentId: number;
  studentId: number;
  nombre: string;
  rut: string;
  initials: string;
  status: AsistenciaStatus | null;
  justification: string | null;
}

export interface PromocionOption {
  id: number;
  name: string;
  code: string;
  status: string;
}

export interface CursoOption {
  id: number;
  courseCode: string;
  courseName: string;
}

export interface ResumenAlumnoAsistencia {
  studentId: number;
  nombre: string;
  rut: string;
  initials: string;
  teoriaAsistida: number;
  teoriaTotal: number;
  practicaAsistida: number;
  practicaTotal: number;
  totalAsistida: number;
  totalSesiones: number;
  pctTeoria: number;
  pctPractica: number;
  pctAsistencia: number;
}

export interface WeekDay {
  date: string;
  label: string;
  dayLabel: string;
  isToday: boolean;
  theory: SesionProfesional | null;
  practice: SesionProfesional | null;
}

export interface AlumnoFirmaSemana {
  enrollmentId: number;
  studentId: number;
  nombre: string;
  rut: string;
  initials: string;
  /** null = no ha firmado esta semana */
  signatureId: number | null;
  /** ISO timestamp del momento en que se registró la firma */
  signedAt: string | null;
  /** % de sesiones teóricas completadas en la semana visible */
  pctTeoriaSemana: number;
}
