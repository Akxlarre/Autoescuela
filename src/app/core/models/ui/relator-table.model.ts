export interface RelatorCursoAsignado {
  id: number; // promotion_course_lecturers.id
  role: 'theory' | 'practice' | 'both' | null;
  promotionCourseId: number;
  promotionName: string;
  promotionCode: string;
  courseName: string;
  courseCode: string; // 'A2' | 'A3' | 'A4' | 'A5'
  status: 'planned' | 'in_progress' | 'finished' | 'cancelled' | 'active' | 'inactive' | null;
  enrolledStudents: number;
  maxStudents: number;
}

export interface RelatorTableRow {
  id: number;
  rut: string;
  nombre: string;
  firstName: string;
  paternalLastName: string;
  maternalLastName: string;
  email: string;
  phone: string;
  specializations: string[];
  estado: 'activo' | 'inactivo';
  registrationDate: string | null;
  initials: string;
}
