/**
 * Modelos UI para la vista de Certificación Clase B.
 * Alumnos que completaron 12 clases prácticas y su estado de certificado.
 */

/** Fila de la tabla principal de certificación. */
export interface CertificacionAlumnoRow {
  enrollmentId: number;
  studentId: number;
  nombre: string;
  rut: string;
  curso: string;
  clasesCompletadas: number;
  clasesTotales: number;
  fechaTermino: string | null;
  /**
   * Porcentaje de asistencia a clases teóricas en las que el alumno fue inscrito.
   * null = sin sesiones teóricas registradas para este alumno.
   */
  pctAsistenciaTeoria: number | null;
  certificadoId: number | null;
  certificadoFolio: string | null;
  certificadoStatus: 'generado' | 'pendiente';
  /**
   * Ruta relativa en Storage del PDF generado (ej: "certificates/42/Certificado_Juan.pdf").
   * null = aún no generado. El facade genera una signed URL (TTL 1h) bajo demanda.
   */
  storagePath: string | null;
  emailEnviado: boolean;
}

/** KPIs de certificación. */
export interface CertificacionKpis {
  totalAlumnos: number;
  certificadosGenerados: number;
  pendientesGeneracion: number;
  pendientesEnvio: number;
}

/** Fila del historial de emisiones. */
export interface CertificacionLogRow {
  id: number;
  fecha: string;
  accion: 'generated' | 'email_sent' | 'downloaded' | 'printed';
  alumnoNombre: string;
  usuarioNombre: string;
}

/** Etiqueta legible para acciones del log. */
export const ACCION_LABELS: Record<string, string> = {
  generated: 'Generación',
  downloaded: 'Descarga PDF',
  email_sent: 'Envío Email',
  printed: 'Impresión',
};
