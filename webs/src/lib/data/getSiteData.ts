import { getEntry } from 'astro:content';
import type { SiteData, CourseConfig, ResolvedCourse } from '../types';

/**
 * Catálogo operacional crudo (subset usado para resolver cards).
 * Mirror del shape devuelto por la query a `courses` (REST).
 */
interface CourseRow {
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
 * Función pura — testeable sin tocar Astro.
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

/**
 * Loads site data for the specified brand.
 *
 * Spec 0004: hace dos fetches paralelos contra Supabase REST:
 *  1. `website_config` → JSONB con cards editoriales (CourseConfig[])
 *  2. `courses` activos del branch → catálogo operacional
 * y produce `ResolvedCourse[]` ya listo para los componentes Astro.
 *
 * Fallback estático: si Supabase falla, lee `content/site/{brand}.json`
 * que ya viene con `courses` pre-resueltos (`ResolvedCourse[]`).
 */
export async function getSiteData(brand: string): Promise<SiteData> {
  const branchId = brand === 'roja' ? 2 : 1;
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
  const headers = { apikey: anonKey, Authorization: `Bearer ${anonKey}` };

  try {
    // Fetches paralelos: config + catálogo operacional
    const [configRes, coursesRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/website_config?branch_id=eq.${branchId}&select=config`, {
        headers,
      }),
      fetch(
        `${supabaseUrl}/rest/v1/courses?branch_id=eq.${branchId}&active=eq.true&select=id,name,license_class,base_price,active`,
        { headers },
      ),
    ]);

    if (configRes.ok && coursesRes.ok) {
      const configRows = await configRes.json();
      const catalog = (await coursesRes.json()) as CourseRow[];

      if (configRows && configRows.length > 0 && configRows[0].config) {
        const rawConfig = configRows[0].config as Omit<SiteData, 'courses'> & {
          courses: CourseConfig[];
        };

        const resolvedCourses = resolveCourses(rawConfig.courses ?? [], catalog);

        console.log(
          `[Astro SSR] ✅ Configuración cargada desde Supabase para branch ${branchId}. ` +
            `Cards resueltas: ${resolvedCourses.length}/${rawConfig.courses?.length ?? 0}`,
        );

        if (resolvedCourses.length > 0) {
          return { ...rawConfig, courses: resolvedCourses } as SiteData;
        } else {
          console.warn(
            `[Astro SSR] ⚠️ resolvedCourses es 0 para branch ${branchId}. Cayendo en fallback estático.`,
          );
        }
      }
    }
    console.warn(
      `[Astro SSR] ⚠️ Falló carga desde Supabase para branch ${branchId} o resolvedCourses está vacío. Usando fallback estático.`,
    );
  } catch (error) {
    console.error(`[Astro SSR] ❌ Error de red al consultar Supabase:`, error);
  }

  // Fallback: JSON estático local. Ya viene pre-resuelto como ResolvedCourse[].
  try {
    const entry = await getEntry('site', brand as any);
    if (!entry) {
      throw new Error(`Content collection entry not found for brand: ${brand}`);
    }
    return entry.data as unknown as SiteData;
  } catch (error) {
    console.error(`Error loading fallback site data for brand ${brand}:`, error);
    throw error;
  }
}
