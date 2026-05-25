export interface BrandConfig {
  name: string;
  shortName: string;
  slogan: string;
  theme: 'azul' | 'roja';
  domain: string;
  logo: string;
  ogImage: string;
  favicon?: string;
  branchId: number;
}

export interface HeroFeature {
  icon: string;
  text: string;
}

export interface HeroMediaConfig {
  type: 'image' | 'video' | 'none';
  url?: string;
}

export interface HeroBackgroundConfig {
  type: 'color' | 'image' | 'video' | 'none';
  url?: string;
  color?: string;
  overlayOpacity?: number;
}

export interface HeroConfig {
  layoutType: 'center' | 'split-right' | 'split-left';
  background?: HeroBackgroundConfig;
  media?: HeroMediaConfig;
  headline: string;
  subheadline: string;
  cta: {
    text: string;
    whatsapp?: string;
  };
  features: HeroFeature[];
  trustBadge?: {
    text: string;
    rating: number;
    enabled: boolean;
  };
}

/**
 * CourseConfig — Mirror del DTO Angular post-refactor (spec 0004).
 * Shape del JSONB en website_config.config.courses[].
 * NO duplica name/price/licenseClass del catálogo operacional — los hereda
 * vía course_id. Mantiene solo los campos editoriales propios de la landing.
 */
export interface CourseConfig {
  course_id: number; // FK obligatoria a courses(id); mismo branch_id
  description: string; // editorial libre
  priceNote?: string; // editorial libre
  duration: string; // editorial libre humanizado
  includes: string[]; // editorial libre
  highlighted: boolean;
  badge?: string;
  priceOverride: number | null; // null = hereda courses.base_price; 0 = "Gratis"
  displayOrder: number; // orden numérico explícito
}

/**
 * ResolvedCourse — Card resuelta lista para render.
 *
 * Producto del JOIN en memoria que hace `getSiteData()` entre el JSONB
 * editorial (CourseConfig) y el catálogo operacional (Course).
 *
 * Los componentes Astro (Pricing.astro, Services.astro) consumen esto;
 * nunca el CourseConfig crudo.
 */
export interface ResolvedCourse {
  // Identidad + datos heredados de courses
  courseId: number;
  name: string;
  licenseClass: string;
  basePrice: number;
  isCourseActive: boolean;

  // Capa editorial
  description: string;
  priceNote: string | null;
  duration: string;
  includes: string[];
  highlighted: boolean;
  badge: string | null;
  displayOrder: number;

  // Resolución de precio
  priceOverride: number | null;
  displayPrice: number; // priceOverride ?? basePrice
  displayPriceLabel: string; // "$320.000" o "Gratis" si === 0
  isOverrideActive: boolean; // priceOverride !== null
}

export interface WhyUsItem {
  icon: string;
  title: string;
  description: string;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface ContactConfig {
  address: string;
  city: string;
  region: string;
  phone: string;
  whatsapp: string;
  email: string;
  mapEmbedUrl: string;
  geo: {
    lat: number;
    lng: number;
  };
}

export interface HourItem {
  days: string;
  time: string;
}

export interface PromoConfig {
  active: boolean;
  title: string;
  description: string;
  badge?: string;
}

export interface TestimonialItem {
  name: string;
  text: string;
  rating: number;
  course?: string;
}

export interface SocialConfig {
  facebook?: string;
  instagram?: string;
  tiktok?: string;
}

export interface PricingFooterItem {
  title: string;
  description: string;
}

export interface PricingFooterConfig {
  payment: PricingFooterItem;
  guarantee: PricingFooterItem;
}

export interface SiteData {
  brand: BrandConfig;
  hero: HeroConfig;
  /**
   * Courses ya resueltos por `getSiteData()` (JOIN con catálogo operacional).
   * Los componentes consumen ResolvedCourse[], no CourseConfig[] crudo.
   */
  courses: ResolvedCourse[];
  whyUs: WhyUsItem[];
  faqs: FAQItem[];
  contact: ContactConfig;
  hours: HourItem[];
  promo?: PromoConfig;
  testimonials?: TestimonialItem[];
  social?: SocialConfig;
  pricingFooter?: PricingFooterConfig;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}
