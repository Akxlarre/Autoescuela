import type { CourseType } from './enrollment-personal-data.model';
import type { SedeTheme } from '@core/utils/sede-theme.utils';

/**
 * Contexto de inscripción para el banner del flujo público (spec 0009).
 *
 * Reúne, ya resuelto por el Facade, lo que el alumno está comprando (curso + escuela + precio)
 * para mostrarlo **antes** del primer campo del formulario (AC3) y mantener el precio visible
 * desde el inicio del wizard (AC5). No persiste: se deriva de `courses` + `branches` + el tema
 * de sede. Reutiliza `CourseType` (DTO/UI de matrícula) y `SedeTheme` (util de tema) — sin duplicar.
 */
export interface PublicEnrollmentContext {
  /** Nombre legible del curso (ej: "Clase B"). */
  courseName: string;
  /** Tipo de curso para iconografía/lógica de presentación. */
  courseType: CourseType;
  /** Nombre de la escuela/sede (tenant). */
  branchName: string;
  /** Dirección de la sede para el subtítulo del banner. */
  branchAddress: string;
  /** Tema visual de la sede (azul / roja). */
  theme: SedeTheme;
  /** Precio formateado para mostrar (ej: "$180.000"). */
  priceLabel: string;
  /** Precio bruto en CLP (ej: 180000) para cálculos/comparaciones. */
  price: number;
}
