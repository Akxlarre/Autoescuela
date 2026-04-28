import type {
  AttendanceSemaphore,
  CertificateState,
  StudentHomeGrades,
  StudentHomeSnapshot,
} from '@core/models/ui/student-home.model';

/** Pondera prácticas (60%) + asistencia teórica (40%) en un % global 0-100. */
export function computeOverallProgress(
  practicesCompleted: number,
  practicesTotal: number,
  pctTheory: number,
): number {
  if (practicesTotal === 0) return 0;
  const pctPractice = (practicesCompleted / practicesTotal) * 100;
  return Math.round(pctPractice * 0.6 + pctTheory * 0.4);
}

/** Semáforo de asistencia: 0 → green, 1 → yellow, ≥2 → red. */
export function computeSemaphore(consecutiveAbsences: number): AttendanceSemaphore {
  if (consecutiveAbsences >= 2) return 'red';
  if (consecutiveAbsences === 1) return 'yellow';
  return 'green';
}

/** Promedio de módulos profesionales con nota confirmada. null si ninguno tiene nota. */
export function computeAverageGrade(modules: StudentHomeGrades['modules']): number | null {
  const graded = modules.filter((m) => m.grade !== null && m.status === 'confirmed');
  if (graded.length === 0) return null;
  const sum = graded.reduce((acc, m) => acc + (m.grade ?? 0), 0);
  return Math.round((sum / graded.length) * 10) / 10;
}

/**
 * Razón de bloqueo del certificado.
 * Devuelve null si ya está emitido o habilitado (sin bloqueo).
 */
export function computeCertificateBlockingReason(snapshot: StudentHomeSnapshot): string | null {
  const { certificate, progress, hero } = snapshot;

  if (certificate.state !== 'locked') return null;

  if (hero.licenseGroup === 'class_b') {
    const remaining = progress.practicesTotal - progress.practicesCompleted;
    if (remaining > 0) {
      return `Te ${remaining === 1 ? 'falta 1 clase práctica' : `faltan ${remaining} clases prácticas`} para habilitar tu certificado`;
    }
    return 'Completa los requisitos del curso para habilitar tu certificado';
  }

  // Profesional
  const remaining = progress.practicesTotal - progress.practicesCompleted;
  if (remaining > 0) {
    return `Te ${remaining === 1 ? 'falta 1 sesión' : `faltan ${remaining} sesiones`} para completar el curso`;
  }
  return 'Cumple todos los requisitos de asistencia y notas para habilitar tu certificado';
}

/** Devuelve el estado del certificado a partir de los datos del enrollment y la tabla certificates. */
export function deriveCertificateState(params: {
  certificateEnabled: boolean;
  certificateIssued: boolean;
}): CertificateState {
  if (params.certificateIssued) return 'issued';
  if (params.certificateEnabled) return 'enabled';
  return 'locked';
}
