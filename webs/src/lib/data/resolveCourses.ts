import type { CourseConfig, ResolvedCourse } from '../types';

/**
 * Catálogo operacional crudo (subset usado para resolver cards).
 * Mirror del shape devuelto por la query a `courses` (REST).
 */
export interface CourseRow {
  id: number;
  name: string;
  license_class: string;
  base_price: number;
  active: boolean;
}

const CLP_FORMATTER = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

/**
 * Resuelve un array de `CourseConfig` (JSONB editorial) en `ResolvedCourse[]`
 * haciendo JOIN en memoria contra el catálogo operacional.
 *
 * Reglas (spec 0004):
 *  - Cards cuyo `course_id` no esté en el catálogo activo se descartan
 *    (curso eliminado, desactivado, o de otra sede).
 *  - `displayPrice = priceOverride ?? basePrice`.
 *  - `displayPriceLabel = "Gratis"` si `displayPrice === 0`, sino CLP formato es-CL.
 *  - Orden: `displayOrder` ASC; desempate `courseId` ASC.
 *
 * Función pura — testeable sin tocar Astro (extraída de getSiteData.ts para
 * poder importarla desde tests sin arrastrar el import a `astro:content`).
 */
export function resolveCourses(rawCourses: CourseConfig[], catalog: CourseRow[]): ResolvedCourse[] {
  const catalogById = new Map<number, CourseRow>();
  for (const c of catalog) catalogById.set(c.id, c);

  const resolved: ResolvedCourse[] = [];
  for (const card of rawCourses) {
    const course = catalogById.get(card.course_id);
    // Filtramos huérfanos (sin match en catálogo activo) → no se renderizan
    if (!course) continue;

    const priceOverride = card.priceOverride ?? null;
    const isOverrideActive = priceOverride !== null;
    const basePrice = course.base_price != null ? course.base_price : 0;
    const displayPrice = isOverrideActive ? (priceOverride as number) : basePrice;
    const displayPriceLabel = displayPrice === 0 ? 'Gratis' : CLP_FORMATTER.format(displayPrice);

    resolved.push({
      courseId: course.id,
      name: course.name ?? '',
      licenseClass: course.license_class ?? '',
      basePrice,
      isCourseActive: course.active,
      description: card.description,
      priceNote: card.priceNote ?? null,
      duration: card.duration,
      includes: card.includes,
      highlighted: card.highlighted,
      badge: card.badge ?? null,
      displayOrder: card.displayOrder,
      priceOverride,
      displayPrice,
      displayPriceLabel,
      isOverrideActive,
    });
  }

  resolved.sort((a, b) => {
    if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
    return a.courseId - b.courseId;
  });

  return resolved;
}
