/**
 * ResolvedCourse — Card de curso resuelta, lista para consumo de la UI.
 *
 * Combinación del JSONB editorial (`CourseConfig` en website_config) con los
 * datos heredados del catálogo operacional `courses` (name, basePrice,
 * licenseClass, active). La resolución la hace `WebsiteConfigFacade` vía
 * JOIN en memoria con la lista de cursos activos del branch.
 *
 * La UI nunca toca `CourseConfig` directo — siempre consume `ResolvedCourse[]`
 * para evitar tener que repetir la lógica de fallback de precio y formato CLP.
 *
 * Spec 0004 — refactor-website-config-courses-fk.
 */
export interface ResolvedCourse {
  // ── Identidad y datos heredados de courses ───────────────────────────────
  /** courses.id — FK al catálogo operacional. */
  courseId: number;
  /** courses.name — fuente de verdad del nombre comercial. */
  name: string;
  /** courses.license_class — 'B' | 'A2' | 'A3' | 'A4' | 'A5'. */
  licenseClass: string;
  /** courses.base_price en CLP — precio operacional. */
  basePrice: number;
  /** courses.active — si false, la card no debe renderizarse en la landing. */
  isCourseActive: boolean;

  // ── Capa editorial (del JSONB website_config) ────────────────────────────
  description: string;
  priceNote: string | null;
  duration: string;
  includes: string[];
  highlighted: boolean;
  badge: string | null;
  displayOrder: number;

  // ── Resolución de precio ─────────────────────────────────────────────────
  /** Override editorial. null = hereda basePrice. 0 = "Gratis". */
  priceOverride: number | null;
  /** Precio efectivo a mostrar: priceOverride ?? basePrice. */
  displayPrice: number;
  /** Precio efectivo ya formateado: "$320.000" o "Gratis" si es 0. */
  displayPriceLabel: string;
  /** true si priceOverride !== null (sirve para mostrar tachado del basePrice). */
  isOverrideActive: boolean;
}
