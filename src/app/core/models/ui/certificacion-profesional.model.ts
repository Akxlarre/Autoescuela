/**
 * Modelos UI para la vista de Certificación Clase Profesional.
 * Alumnos en promociones finalizadas y su estado de certificado.
 */

/** Opción para el selector de promociones finalizadas. */
export interface PromocionCertOption {
  id: number;
  code: string;
  name: string;
  startDate: string; // ISO date string — para ordenación
  /** Etiqueta formateada para el p-select. */
  label: string;
}

/** Opción para el selector de cursos dentro de una promoción. */
export interface CursoCertOption {
  /** promotion_course_id */
  id: number;
  courseName: string;
  licenseClass: string;
  /** Etiqueta formateada para el p-select. */
  label: string;
}

/** Condiciones de elegibilidad para el certificado profesional. */
export interface ElegibilidadCertProf {
  /** Promoción con status = 'finished'. */
  promocion: boolean;
  /** Asistencia teórica >= 75 %. */
  teoria: boolean;
  /** Asistencia práctica = 100 % (flexible: warning si < 100). */
  practica: boolean;
  /** Saldo pendiente <= 0. */
  pago: boolean;
  /** Promedio de módulos >= 75 (escala MTT 10-100). */
  nota: boolean;
}

/** Fila de la tabla principal de certificación profesional. */
export interface CertificacionProfesionalAlumnoRow {
  enrollmentId: number;
  studentId: number;
  nombre: string;
  rut: string;
  curso: string;
  /** Código de clase: 'A2' | 'A3' | 'A4' | 'A5'. Usado en el PDF. */
  licenseClass: string;
  promocion: string;
  fechaInicio: string | null;
  fechaTermino: string | null;
  // ── Criterios ──
  pctAsistenciaTeoria: number | null;
  pctAsistenciaPractica: number | null;
  pagoCorrecto: boolean;
  notaPromedio: number | null;
  elegibilidad: ElegibilidadCertProf;
  /**
   * true = cumple teoría + pago + nota (puede tener práctica < 100 con confirmación).
   * Controla si el botón "Generar" está habilitado.
   */
  elegible: boolean;
  // ── Certificado ──
  certificadoId: number | null;
  certificadoFolio: string | null;
  certificadoStatus: 'generado' | 'pendiente';
  /**
   * Path relativo en Storage del PDF.
   * null = aún no generado. Facade genera signed URL (TTL 1h) bajo demanda.
   */
  storagePath: string | null;
  emailEnviado: boolean;
}

/** KPIs de certificación profesional. */
export interface CertificacionProfesionalKpis {
  totalAlumnos: number;
  certificadosGenerados: number;
  pendientesGeneracion: number;
  pendientesEnvio: number;
}

/** Fila del historial de emisiones. */
export interface CertificacionProfesionalLogRow {
  id: number;
  fecha: string;
  accion: 'generated' | 'email_sent' | 'downloaded' | 'printed';
  alumnoNombre: string;
  usuarioNombre: string;
}

/** Etiquetas legibles para acciones del log. */
export const ACCION_LABELS_PROF: Record<string, string> = {
  generated: 'Generación',
  downloaded: 'Descarga PDF',
  email_sent: 'Envío Email',
  printed: 'Impresión',
};
