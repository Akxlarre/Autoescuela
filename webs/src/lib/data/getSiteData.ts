import { getEntry } from 'astro:content';
import type { SiteData, CourseConfig } from '../types';
import { resolveCourses, type CourseRow } from './resolveCourses';

export { resolveCourses };
export type { CourseRow };

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
