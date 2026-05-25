import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const siteCollection = defineCollection({
  // Use modern Astro v6 glob loader for JSON files
  loader: glob({ pattern: '**/[^_]*.json', base: './src/content/site' }),
  schema: z.object({
    brand: z.object({
      name: z.string(),
      shortName: z.string(),
      slogan: z.string(),
      theme: z.enum(['azul', 'roja']),
      domain: z.string(),
      logo: z.string(),
      ogImage: z.string(),
      favicon: z.string().optional(),
      branchId: z.number(),
    }),
    hero: z.object({
      layoutType: z.enum(['center', 'split-right', 'split-left']).optional(),
      background: z.object({
        type: z.enum(['color', 'image', 'video', 'none']),
        url: z.string().optional(),
        color: z.string().optional(),
        overlayOpacity: z.number().optional(),
      }).optional(),
      media: z.object({
        type: z.enum(['image', 'video', 'none']),
        url: z.string().optional(),
      }).optional(),
      headline: z.string(),
      subheadline: z.string(),
      cta: z.object({
        text: z.string(),
        whatsapp: z.string(),
      }),
      features: z.array(z.object({
        icon: z.string(),
        text: z.string(),
      })),
    }),
    // Spec 0004: el fallback estático ya viene como ResolvedCourse[]
    // (pre-resuelto), porque cuando Supabase falla no podemos hacer JOIN
    // contra el catálogo operacional.
    courses: z.array(z.object({
      courseId: z.number(),
      name: z.string(),
      licenseClass: z.string(),
      basePrice: z.number(),
      isCourseActive: z.boolean(),
      description: z.string(),
      priceNote: z.string().nullable().optional(),
      duration: z.string(),
      includes: z.array(z.string()),
      highlighted: z.boolean().default(false),
      badge: z.string().nullable().optional(),
      displayOrder: z.number(),
      priceOverride: z.number().nullable(),
      displayPrice: z.number(),
      displayPriceLabel: z.string(),
      isOverrideActive: z.boolean(),
    })),
    whyUs: z.array(z.object({
      icon: z.string(),
      title: z.string(),
      description: z.string(),
    })),
    faqs: z.array(z.object({
      question: z.string(),
      answer: z.string(),
    })),
    contact: z.object({
      address: z.string(),
      city: z.string(),
      region: z.string(),
      phone: z.string(),
      whatsapp: z.string(),
      email: z.string(),
      mapEmbedUrl: z.string(),
      geo: z.object({
        lat: z.number(),
        lng: z.number(),
      }),
    }),
    hours: z.array(z.object({
      days: z.string(),
      time: z.string(),
    })),
    promo: z.object({
      active: z.boolean(),
      title: z.string(),
      description: z.string(),
      badge: z.string().optional(),
    }).optional(),
    testimonials: z.array(z.object({
      name: z.string(),
      text: z.string(),
      rating: z.number().min(1).max(5),
      course: z.string().optional(),
    })).optional(),
    social: z.object({
      facebook: z.string().optional(),
      instagram: z.string().optional(),
      tiktok: z.string().optional(),
    }).optional(),
    pricingFooter: z.object({
      payment: z.object({
        title: z.string(),
        description: z.string(),
      }),
      guarantee: z.object({
        title: z.string(),
        description: z.string(),
      }),
    }).optional(),
  }),
});

export const collections = {
  site: siteCollection,
};
