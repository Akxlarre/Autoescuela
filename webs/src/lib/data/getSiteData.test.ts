import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveCourses, type CourseRow } from './resolveCourses';
import type { CourseConfig } from '../types';

// getSiteData.ts importa 'astro:content' (módulo virtual que solo existe dentro
// del pipeline de Astro) — se mockea a nivel de archivo (hoisted) para poder
// importar el módulo real bajo Vitest puro, sin arrastrar todo Astro.
const getEntryMock = vi.fn();
vi.mock('astro:content', () => ({ getEntry: getEntryMock }));

/**
 * Test de integración de mapeo Admin → Astro.
 *
 * Objetivo: detectar dos clases de bug de forma automática, sin navegador:
 *  1. Errores tipográficos entre los campos que guarda el Admin (Angular) y
 *     los que lee/formatea getSiteData.ts — si el mock (tipado contra
 *     `SiteData`/`CourseConfig` de webs/src/lib/types.ts) no compila, hay un
 *     desface de forma en algún lado.
 *  2. Que `getSiteData()` no rompa cuando TODOS los campos vienen llenos
 *     (incluyendo los opcionales: trustBadge, badge, priceNote, promo,
 *     testimonials, social, pricingFooter) y formatee precios correctamente.
 */

describe('resolveCourses (lógica pura de getSiteData.ts)', () => {
  const catalog: CourseRow[] = [
    { id: 1, name: 'Clase B Full', license_class: 'B', base_price: 350000, active: true },
    { id: 2, name: 'Clase A2', license_class: 'A2', base_price: 280000, active: true },
    { id: 3, name: 'Curso Inactivo', license_class: 'B', base_price: 100000, active: false },
  ];

  it('formatea el precio en CLP cuando no hay priceOverride', () => {
    const cards: CourseConfig[] = [
      {
        course_id: 1,
        description: 'Curso completo',
        priceNote: null,
        duration: '4 a 6 semanas',
        includes: ['Clases teóricas', 'Clases prácticas'],
        highlighted: false,
        badge: null,
        priceOverride: null,
        displayOrder: 1,
      },
    ];
    const [resolved] = resolveCourses(cards, catalog);
    expect(resolved.displayPrice).toBe(350000);
    expect(resolved.displayPriceLabel).toBe('$350.000');
    expect(resolved.isOverrideActive).toBe(false);
  });

  it('usa priceOverride cuando está seteado, y muestra "Gratis" si es 0', () => {
    const cards: CourseConfig[] = [
      {
        course_id: 2,
        description: 'Promo de lanzamiento',
        priceNote: 'Cupos limitados',
        duration: '3 semanas',
        includes: ['Todo incluido'],
        highlighted: true,
        badge: 'Promo',
        priceOverride: 0,
        displayOrder: 2,
      },
    ];
    const [resolved] = resolveCourses(cards, catalog);
    expect(resolved.isOverrideActive).toBe(true);
    expect(resolved.displayPrice).toBe(0);
    expect(resolved.displayPriceLabel).toBe('Gratis');
    expect(resolved.badge).toBe('Promo');
    expect(resolved.priceNote).toBe('Cupos limitados');
  });

  it('descarta cards huérfanas (course_id sin match en el catálogo, ej. curso eliminado o de otra sede)', () => {
    const cards: CourseConfig[] = [
      {
        course_id: 999, // no existe en catalog
        description: 'x',
        priceNote: null,
        duration: 'x',
        includes: [],
        highlighted: false,
        badge: null,
        priceOverride: null,
        displayOrder: 1,
      },
    ];
    expect(resolveCourses(cards, catalog)).toEqual([]);
  });

  it('ordena por displayOrder ASC, desempatando por courseId ASC', () => {
    const cards: CourseConfig[] = [
      {
        course_id: 2,
        description: 'B',
        priceNote: null,
        duration: 'x',
        includes: [],
        highlighted: false,
        badge: null,
        priceOverride: null,
        displayOrder: 1,
      },
      {
        course_id: 1,
        description: 'A',
        priceNote: null,
        duration: 'x',
        includes: [],
        highlighted: false,
        badge: null,
        priceOverride: null,
        displayOrder: 1,
      },
    ];
    const resolved = resolveCourses(cards, catalog);
    expect(resolved.map((r) => r.courseId)).toEqual([1, 2]); // mismo displayOrder → desempata por courseId
  });
});

describe('getSiteData() — integración completa con todos los campos llenos', () => {
  const fullConfigRow = {
    brand: {
      name: 'Autoescuela Chillán',
      shortName: 'Chillán',
      slogan: 'Aprende a conducir con confianza',
      theme: 'azul' as const,
      domain: 'autoescuelachillan.cl',
      logo: '/azul/logo.svg',
      ogImage: '/azul/og-image.jpg',
      favicon: '/azul/favicon.ico',
      branchId: 1,
    },
    hero: {
      layoutType: 'split-right' as const,
      background: { type: 'image' as const, url: '/hero-bg.jpg', overlayOpacity: 50 },
      media: { type: 'image' as const, url: '/hero-media.jpg' },
      headline: 'Aprende a conducir',
      subheadline: 'Con los mejores instructores de Chillán',
      cta: { text: 'Escríbenos', whatsapp: '56912345678' },
      features: [{ icon: 'car', text: 'Vehículos modernos' }],
      trustBadge: { text: '+500 alumnos certificados', rating: 4.8, enabled: true },
    },
    courses: [
      {
        course_id: 1,
        description: 'Curso completo clase B',
        priceNote: 'Incluye examen',
        duration: '4 a 6 semanas',
        includes: ['Teoría', 'Práctica'],
        highlighted: true,
        badge: 'Más elegido',
        priceOverride: null,
        displayOrder: 1,
      },
    ],
    whyUs: [{ icon: 'shield', title: 'Seguridad', description: 'Instructores certificados' }],
    faqs: [{ question: '¿Cuánto dura el curso?', answer: '4 a 6 semanas' }],
    contact: {
      address: 'Av. Principal 123',
      city: 'Chillán',
      region: 'Ñuble',
      phone: '+56 42 234 5678',
      whatsapp: '56912345678',
      email: 'contacto@autoescuelachillan.cl',
      mapEmbedUrl: 'https://www.google.com/maps/embed?pb=xxx',
      geo: { lat: -36.6067, lng: -72.1034 },
    },
    hours: [{ days: 'Lun a Vie', time: '09:00 - 19:00' }],
    promo: {
      active: true,
      title: 'Promo de verano',
      description: '20% de descuento',
      badge: 'Nuevo',
    },
    testimonials: [{ name: 'Juan Pérez', text: 'Excelente escuela', rating: 5, course: 'Clase B' }],
    social: {
      facebook: 'https://facebook.com/x',
      instagram: 'https://instagram.com/x',
      tiktok: null,
    },
    pricingFooter: {
      payment: { title: 'Facilidades de pago', description: 'Paga en cuotas' },
      guarantee: { title: 'Garantía', description: 'Aprueba o repite gratis' },
    },
  };

  const catalogRow = [
    { id: 1, name: 'Clase B Full', license_class: 'B', base_price: 350000, active: true },
  ];

  beforeEach(() => {
    vi.stubEnv('PUBLIC_SUPABASE_URL', 'https://test-project.supabase.co');
    vi.stubEnv('PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('parsea la respuesta completa de Supabase y resuelve todos los campos sin romperse', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/rest/v1/website_config')) {
          return new Response(JSON.stringify([{ config: fullConfigRow }]), { status: 200 });
        }
        if (url.includes('/rest/v1/courses')) {
          return new Response(JSON.stringify(catalogRow), { status: 200 });
        }
        throw new Error(`URL no esperada en el mock: ${url}`);
      }),
    );

    const { getSiteData } = await import('./getSiteData');
    const siteData = await getSiteData('azul');

    // Campos simples pasan intactos
    expect(siteData.brand.name).toBe('Autoescuela Chillán');
    expect(siteData.hero.headline).toBe('Aprende a conducir');
    expect(siteData.contact.geo.lat).toBe(-36.6067);
    expect(siteData.promo?.active).toBe(true);
    expect(siteData.testimonials?.[0].name).toBe('Juan Pérez');
    expect(siteData.social?.facebook).toBe('https://facebook.com/x');
    expect(siteData.pricingFooter?.payment.title).toBe('Facilidades de pago');

    // Courses pasa por resolveCourses() — JOIN + formateo de precio
    expect(siteData.courses).toHaveLength(1);
    expect(siteData.courses[0].displayPriceLabel).toBe('$350.000');
    expect(siteData.courses[0].name).toBe('Clase B Full');
  });

  it('cae al fallback estático si el fetch a Supabase falla (sin explotar)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('Internal Server Error', { status: 500 })),
    );
    getEntryMock.mockResolvedValueOnce({ data: { brand: { name: 'Fallback JSON' } } });

    const { getSiteData } = await import('./getSiteData');
    const siteData = await getSiteData('azul');

    expect((siteData as any).brand.name).toBe('Fallback JSON');
  });
});
