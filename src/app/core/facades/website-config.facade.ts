import { Injectable, computed, inject, signal } from '@angular/core';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import { CoursesFacade, type CourseCatalogItem } from '@core/facades/courses.facade';
import type { CourseConfig, SiteData, HeroConfig } from '@core/models/dto/website-config.model';
import type { ResolvedCourse } from '@core/models/ui/resolved-course.model';

const CLP_FORMATTER = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

function resolveSingleCourse(
  card: CourseConfig,
  catalogItem: CourseCatalogItem | undefined,
): ResolvedCourse {
  const basePrice = catalogItem?.base_price ?? 0;
  const displayPrice = card.priceOverride !== null ? card.priceOverride : basePrice;
  const displayPriceLabel = displayPrice === 0 ? 'Gratis' : CLP_FORMATTER.format(displayPrice);

  return {
    courseId: card.course_id,
    name: catalogItem?.name ?? '',
    licenseClass: catalogItem?.license_class ?? '',
    basePrice,
    isCourseActive: catalogItem != null && catalogItem.active !== false,
    description: card.description,
    priceNote: card.priceNote ?? null,
    duration: card.duration,
    includes: card.includes,
    highlighted: card.highlighted,
    badge: card.badge ?? null,
    displayOrder: card.displayOrder,
    priceOverride: card.priceOverride,
    displayPrice,
    displayPriceLabel,
    isOverrideActive: card.priceOverride !== null,
  };
}

/**
 * WebsiteConfigFacade — Fachada de dominio para gestionar la configuración web dinámica.
 *
 * Centraliza la carga y persistencia en caliente de la configuración del sitio
 * (brand, hero, cursos, precios, promobanner, FAQs) para cada sede.
 * Sigue el patrón estricto de fachada expuesto en signals.
 *
 * Spec 0004: refactor del JSONB de courses → FK al catálogo operacional.
 * Expone `resolvedCourses` computed que combina `_config.courses` (CourseConfig
 * editorial) con el catálogo de `CoursesFacade.availableCourses` para producir
 * `ResolvedCourse[]` con precio resuelto, labels formateados y flags de estado.
 */
@Injectable({ providedIn: 'root' })
export class WebsiteConfigFacade {
  private readonly supabase = inject(SupabaseService);
  private readonly toast = inject(ToastService);
  private readonly coursesFacade = inject(CoursesFacade);

  private readonly _config = signal<SiteData | null>(null);
  private readonly _isLoading = signal<boolean>(false);
  private readonly _isSaving = signal<boolean>(false);
  private readonly _error = signal<string | null>(null);
  private readonly _initialized = signal<boolean>(false);
  private _lastBranchId: number | null = null;

  // Signals expuestos de forma segura (Readonly)
  readonly config = this._config.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();
  readonly isSaving = this._isSaving.asReadonly();
  readonly error = this._error.asReadonly();

  /**
   * Resuelve `_config.courses` (CourseConfig editorial) contra el catálogo
   * operacional de `CoursesFacade` para producir `ResolvedCourse[]`.
   *
   * Reglas:
   *  - displayPrice = priceOverride ?? basePrice.
   *  - displayPriceLabel = "Gratis" si displayPrice === 0, sino CLP formato.
   *  - Cards con course_id no presente en el catálogo se marcan isCourseActive=false
   *    (NO se filtran — la UI decide si renderizarlas o mostrar warning).
   *  - Orden: displayOrder ASC; desempate courseId ASC.
   */
  readonly resolvedCourses = computed<ResolvedCourse[]>(() => {
    const config = this._config();
    if (!config) return [];

    const catalogById = this.coursesFacade.availableById();
    const resolved: ResolvedCourse[] = (config.courses ?? []).map((card) =>
      resolveSingleCourse(card, catalogById.get(card.course_id)),
    );

    return resolved.sort((a, b) => {
      if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
      return a.courseId - b.courseId;
    });
  });

  /**
   * Carga la configuración web de una sede específica.
   * Implementa el patrón SWR (Stale-While-Revalidate) para evitar skeletons molestos en re-visitas.
   */
  async loadConfig(branchId: number): Promise<void> {
    const isDifferentBranch = this._lastBranchId !== branchId;

    // Solo mostramos skeleton si es la primera inicialización global o si se cambia de sede
    if (!this._initialized() || isDifferentBranch) {
      this._isLoading.set(true);
    }

    this._error.set(null);
    this._lastBranchId = branchId;

    try {
      const { data, error } = await this.supabase.client
        .from('website_config')
        .select('config')
        .eq('branch_id', branchId)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (data?.config) {
        this._config.set(data.config as SiteData);
      } else {
        // AC-E1: Inicializar un JSON vacío estructurado según el modelo
        this._config.set(this.getDefaultConfig(branchId));
      }
      this._initialized.set(true);
    } catch (err: any) {
      const errMsg = err?.message || 'Error desconocido';
      this._error.set(errMsg);
      this.toast.error('Error al cargar configuración', errMsg);
    } finally {
      this._isLoading.set(false);
    }
  }

  /**
   * Guarda los cambios de configuración web para una sede en Supabase.
   * Protegido por RLS en backend.
   */
  async saveConfig(branchId: number, configData: SiteData): Promise<boolean> {
    // AC-E1: validar course_id único antes de ir a Supabase
    const courseIds = (configData.courses ?? []).map((c) => c.course_id);
    const uniqueIds = new Set(courseIds);
    if (uniqueIds.size < courseIds.length) {
      const dupId = courseIds.find((id, idx) => courseIds.indexOf(id) !== idx);
      const errMsg = `Este curso (course_id ${dupId}) ya está publicado en otra card. Cada curso solo puede aparecer una vez en la landing (duplicado).`;
      this._error.set(errMsg);
      this.toast.error('Error al guardar configuración', errMsg);
      return false;
    }

    this._isSaving.set(true);
    this._error.set(null);

    try {
      const { data, error } = await this.supabase.client
        .from('website_config')
        .upsert(
          {
            branch_id: branchId,
            config: configData,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'branch_id' },
        )
        .select('config')
        .single();

      if (error) {
        throw error;
      }

      if (data?.config) {
        this._config.set(data.config as SiteData);
      } else {
        this._config.set(configData);
      }

      this.toast.success(
        'Configuración guardada',
        'Los cambios en la web se reflejarán de inmediato.',
      );
      return true;
    } catch (err: any) {
      const errMsg = err?.message || 'Error desconocido';
      this._error.set(errMsg);
      this.toast.error('Error al guardar configuración', errMsg);
      return false;
    } finally {
      this._isSaving.set(false);
    }
  }

  /**
   * Sube un asset (logo o imagen OG) al bucket público 'website-public' de Supabase
   * y retorna la URL pública del archivo.
   */
  async uploadAsset(branchId: number, file: File, type: 'logo' | 'ogImage' | 'hero' | 'favicon'): Promise<string> {
    const fileExt = file.name.split('.').pop() || '';
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const filePath = `website-assets/branch-${branchId}/${type}-${Date.now()}-${cleanFileName}.${fileExt}`;

    try {
      const { error: uploadError } = await this.supabase.client.storage
        .from('website-public')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data } = this.supabase.client.storage.from('website-public').getPublicUrl(filePath);

      if (!data?.publicUrl) {
        throw new Error('No se pudo generar la URL pública del archivo');
      }

      return data.publicUrl;
    } catch (err: any) {
      const errMsg = err?.message || 'Error en la subida del archivo';
      this.toast.error('Error al subir imagen', errMsg);
      throw err;
    }
  }

  /**
   * Genera una configuración semilla estructurada por defecto para evitar nulls (AC-E1).
   */
  private getDefaultConfig(branchId: number): SiteData {
    const isRoja = branchId === 2;
    return {
      brand: this.getDefaultBrandConfig(branchId, isRoja),
      hero: this.getDefaultHeroConfig(isRoja),
      courses: [],
      whyUs: [
        {
          icon: '🛡️',
          title: 'Seguridad Primero',
          description: 'Pedaleras de doble comando homologadas para tu total seguridad.',
        },
        {
          icon: '🎯',
          title: 'Alta Aprobación',
          description:
            'Métodos prácticos diseñados para aprobar a la primera en la Dirección de Tránsito de Chillán.',
        },
      ],
      faqs: [],
      contact: this.getDefaultContactConfig(),
      hours: [
        { days: 'Lunes a Viernes', time: '09:00 - 18:30' },
        { days: 'Sábado', time: '09:00 - 13:30' },
      ],
      promo: {
        active: false,
        title: '',
        description: '',
        badge: '',
      },
      social: { facebook: '', instagram: '', tiktok: '' },
    };
  }

  private getDefaultBrandConfig(branchId: number, isRoja: boolean) {
    const cdnUrl =
      'https://skvekggejikzxhzsjmkz.supabase.co/storage/v1/object/public/website-public/seeds';
    return {
      name: isRoja ? 'Conductores Chillán' : 'Autoescuela Chillán',
      shortName: isRoja ? 'Conductores' : 'Autoescuela',
      slogan: isRoja
        ? 'Tu licencia profesional y particular en Chillán'
        : 'Tu licencia en Chillán, más cerca y fácil',
      theme: (isRoja ? 'roja' : 'azul') as 'roja' | 'azul',
      domain: isRoja ? 'conductoreschillan.cl' : 'autoescuelachillan.cl',
      logo: isRoja ? `${cdnUrl}/roja-logo.svg` : `${cdnUrl}/azul-logo.svg`,
      ogImage: isRoja ? `${cdnUrl}/roja-og-image.jpg` : `${cdnUrl}/azul-og-image.jpg`,
      favicon: '',
      branchId: branchId,
    };
  }

  private getDefaultHeroConfig(isRoja: boolean): HeroConfig {
    return {
      layoutType: 'center',
      headline: isRoja
        ? 'Formando conductores profesionales en Chillán'
        : 'Aprende a conducir con confianza en Chillán',
      subheadline: isRoja
        ? 'Cursos teóricos y prácticos con instructores de primer nivel. Especialistas en licencias profesionales A2, A3, A4, A5 y Clase B.'
        : 'Escuela de conductores autorizada. Cursos prácticos y teóricos online diseñados para que apruebes tu licencia Clase B a la primera.',
      cta: {
        text: 'Consultar Cursos por WhatsApp',
        whatsapp: '',
      },
      features: [
        { icon: '🚗', text: 'Flota Moderna' },
        { icon: '📝', text: 'Teórico Online' },
        { icon: '🎓', text: 'Instructores Certificados' },
      ],
      background: {
        type: 'none',
        url: '',
        color: 'var(--bg-surface)',
        overlayOpacity: 40,
      },
      media: {
        type: 'none',
        url: '',
      },
      trustBadge: {
        text: '',
        rating: 5,
        enabled: false,
      },
    };
  }

  private getDefaultContactConfig() {
    return {
      address: '',
      city: 'Chillán',
      region: 'Ñuble',
      phone: '',
      whatsapp: '',
      email: '',
      mapEmbedUrl: '',
      geo: { lat: -36.606709, lng: -72.105436 },
    };
  }
}
