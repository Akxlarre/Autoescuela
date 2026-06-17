/**
 * Functional Core del aterrizaje de evaluaciones profesionales.
 *
 * Ensambla la estructura "promoción-padre → cursos (con resumen vivo)" a partir
 * de filas crudas de Supabase. Puro (Data In → Data Out), testeable al instante
 * y sin dependencias de Angular.
 *
 * Solo se procesan promociones activas (el facade ya filtra `planned`/`in_progress`).
 */
import type {
  CursoEstado,
  CursoResumen,
  PromocionConCursos,
} from '@core/models/ui/evaluaciones-profesional.model';
import { GRADE_PASS, MODULE_COUNT } from './professional-modules';

/** Promoción cruda (objeto padre). */
export interface PromotionLite {
  id: number;
  name: string;
  code: string;
  status: string;
}

/** Curso de una promoción (`promotion_courses` + `courses`). */
export interface CourseLite {
  promotionCourseId: number;
  promotionId: number;
  courseCode: string;
  courseName: string;
}

/** Matrícula activa de un curso. */
export interface EnrollmentLite {
  id: number;
  promotionCourseId: number;
}

/** Nota registrada de un alumno. */
export interface GradeLite {
  enrollmentId: number;
  grade: number;
  status: 'draft' | 'confirmed';
}

/** Redondea a un decimal (consistente con `roundGrade`). */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Construye el resumen de un curso a partir de sus matrículas y notas.
 * - `estado`: `confirmada` si alguna nota está confirmada; `sin_iniciar` si no hay
 *   ninguna nota; si no, `en_edicion`.
 * - `promedio`: media de los promedios individuales (consistente con el KPI de la grilla).
 */
export function buildCursoResumen(
  course: CourseLite,
  enrollments: EnrollmentLite[],
  grades: GradeLite[],
): CursoResumen {
  const enrollmentIds = new Set(enrollments.map((e) => e.id));
  const courseGrades = grades.filter((g) => enrollmentIds.has(g.enrollmentId));

  // Agrupar notas por alumno.
  const porAlumno = new Map<number, number[]>();
  let algunaConfirmada = false;
  for (const g of courseGrades) {
    if (g.status === 'confirmed') algunaConfirmada = true;
    const arr = porAlumno.get(g.enrollmentId) ?? [];
    arr.push(g.grade);
    porAlumno.set(g.enrollmentId, arr);
  }

  const alumnosConNotas = porAlumno.size;
  let alumnosCompletos = 0;
  const promediosIndividuales: number[] = [];
  for (const notas of porAlumno.values()) {
    if (notas.length >= MODULE_COUNT) alumnosCompletos++;
    promediosIndividuales.push(notas.reduce((s, n) => s + n, 0) / notas.length);
  }

  const promedio =
    promediosIndividuales.length > 0
      ? round1(promediosIndividuales.reduce((s, p) => s + p, 0) / promediosIndividuales.length)
      : null;

  let estado: CursoEstado;
  if (algunaConfirmada) estado = 'confirmada';
  else if (alumnosConNotas === 0) estado = 'sin_iniciar';
  else estado = 'en_edicion';

  return {
    promotionCourseId: course.promotionCourseId,
    courseCode: course.courseCode,
    courseName: course.courseName,
    totalAlumnos: enrollments.length,
    alumnosConNotas,
    alumnosCompletos,
    promedio,
    estado,
  };
}

/**
 * Ensambla el aterrizaje completo: cada promoción con sus cursos resumidos y
 * los totales del grupo. Preserva el orden de `promotions` (más recientes primero).
 */
export function buildLanding(
  promotions: PromotionLite[],
  courses: CourseLite[],
  enrollments: EnrollmentLite[],
  grades: GradeLite[],
): PromocionConCursos[] {
  return promotions.map((promo) => {
    const cursosDeLaPromo = courses.filter((c) => c.promotionId === promo.id);

    const cursos = cursosDeLaPromo.map((course) => {
      const enrollmentsDelCurso = enrollments.filter(
        (e) => e.promotionCourseId === course.promotionCourseId,
      );
      return buildCursoResumen(course, enrollmentsDelCurso, grades);
    });

    const totalAlumnos = cursos.reduce((s, c) => s + c.totalAlumnos, 0);
    const cursosConfirmados = cursos.filter((c) => c.estado === 'confirmada').length;

    return {
      id: promo.id,
      name: promo.name,
      code: promo.code,
      status: promo.status,
      cursos,
      totalAlumnos,
      cursosConfirmados,
    };
  });
}

/** Helper de presentación: ¿el promedio del curso aprueba? (para color de la tarjeta) */
export function cursoPromedioAprueba(resumen: CursoResumen): boolean | null {
  if (resumen.promedio === null) return null;
  return resumen.promedio >= GRADE_PASS;
}
