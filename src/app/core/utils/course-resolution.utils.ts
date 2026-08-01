import type { Course } from '@core/models/dto/course.model';

/**
 * Resuelve un curso por `license_class`, opcionalmente acotado a una sede y a
 * variante SENCE. Único punto de esta búsqueda — evita que cada consumidor
 * repita el filtro (y se olvide de acotar por `branch_id`).
 */
export function findCourseByLicenseClass(
  courses: Course[],
  licenseClass: string,
  options?: { branchId?: number; isSence?: boolean },
): Course | undefined {
  const { branchId, isSence = false } = options ?? {};

  return courses.find((c) => {
    if (c.license_class !== licenseClass) return false;
    if (branchId != null && c.branch_id !== branchId) return false;
    const codeIsSence = c.code?.toLowerCase().includes('sence') ?? false;
    return isSence ? codeIsSence : !codeIsSence;
  });
}
