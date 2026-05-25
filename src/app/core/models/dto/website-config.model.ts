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
    whatsapp: string;
  };
  features: {
    icon: string;
    text: string;
  }[];
  trustBadge?: {
    text: string;
    rating: number;
    enabled: boolean;
  };
}

/**
 * CourseConfig — Card editorial de un curso en la landing.
 *
 * Refactor spec 0004: este shape ya NO duplica name/price/licenseClass del
 * catálogo operacional. Mantiene una FK lógica obligatoria a `courses.id`
 * (validada por trigger SQL) y permite override explícito del precio.
 *
 * Los campos heredados (name, basePrice, licenseClass) se resuelven en el
 * Facade vía JOIN con `courses` y se exponen como `ResolvedCourse` a la UI.
 */
export interface CourseConfig {
  course_id: number; // FK obligatoria a courses(id); mismo branch_id
  description: string; // editorial libre
  priceNote?: string | null; // editorial libre
  duration: string; // editorial libre humanizado (ej "4 a 6 semanas")
  includes: string[]; // editorial libre
  highlighted: boolean;
  badge?: string | null;
  priceOverride: number | null; // null = hereda courses.base_price; 0 = "Gratis"
  displayOrder: number; // orden numérico explícito (habilita drag-and-drop futuro)
}

export interface WhyUsConfig {
  icon: string;
  title: string;
  description: string;
}

export interface FAQConfig {
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

export interface HourConfig {
  days: string;
  time: string;
}

export interface PromoConfig {
  active: boolean;
  title: string;
  description: string;
  badge?: string | null;
}

export interface TestimonialConfig {
  name: string;
  text: string;
  rating: number;
  course?: string | null;
}

export interface SocialConfig {
  facebook?: string | null;
  instagram?: string | null;
  tiktok?: string | null;
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
  courses: CourseConfig[];
  whyUs: WhyUsConfig[];
  faqs: FAQConfig[];
  contact: ContactConfig;
  hours: HourConfig[];
  promo?: PromoConfig | null;
  testimonials?: TestimonialConfig[] | null;
  social?: SocialConfig | null;
  pricingFooter?: PricingFooterConfig | null;
}

export interface WebsiteConfig {
  id: number;
  branch_id: number;
  config: SiteData;
  created_at?: string;
  updated_at?: string;
}
