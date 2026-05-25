import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { WebsiteConfigFacade } from './website-config.facade';
import { CoursesFacade, type CourseCatalogItem } from './courses.facade';
import { SupabaseService } from '@core/services/infrastructure/supabase.service';
import { ToastService } from '@core/services/ui/toast.service';
import type { SiteData, CourseConfig } from '@core/models/dto/website-config.model';

describe('WebsiteConfigFacade', () => {
  let facade: WebsiteConfigFacade;
  let supabaseSpy: any;
  let toastSpy: any;
  let coursesFacadeSpy: any;
  let coursesCatalogSignal: ReturnType<typeof signal<CourseCatalogItem[]>>;

  // ── Catálogo operacional mock (lo que CoursesFacade expone) ────────────────
  const mockCatalog: CourseCatalogItem[] = [
    { id: 1, name: 'Clase B', license_class: 'B', base_price: 350000, active: true },
    { id: 2, name: 'Clase B SENCE', license_class: 'B', base_price: 350000, active: true },
    { id: 9, name: 'Curso eliminado', license_class: 'X', base_price: 0, active: false },
  ];

  // ── Cards editoriales mock (lo que vive en website_config.config.courses) ──
  const mockCourseCards: CourseConfig[] = [
    {
      course_id: 1,
      description: 'Curso B',
      duration: '4 semanas',
      includes: ['Prácticas'],
      highlighted: true,
      badge: 'Popular',
      priceNote: null,
      priceOverride: null,
      displayOrder: 1,
    },
    {
      course_id: 2,
      description: 'Curso B SENCE',
      duration: '4 semanas',
      includes: ['Franquicia tributaria'],
      highlighted: false,
      badge: null,
      priceNote: null,
      priceOverride: 320000, // override activo
      displayOrder: 2,
    },
  ];

  const mockSiteConfig: SiteData = {
    brand: {
      name: 'Autoescuela Chillán',
      shortName: 'Autoescuela',
      slogan: 'Tu licencia en Chillán',
      theme: 'azul',
      domain: 'autoescuelachillan.cl',
      logo: '/logo.svg',
      ogImage: '/og.jpg',
      branchId: 1,
    },
    hero: {
      headline: 'Aprende a conducir',
      subheadline: 'Curso Clase B',
      cta: { text: 'WhatsApp', whatsapp: '+56912345678' },
      features: [{ icon: '🚗', text: 'Flota' }],
    },
    courses: mockCourseCards,
    whyUs: [{ icon: '👍', title: 'Calidad', description: 'Garantizada' }],
    faqs: [{ question: '¿Requisitos?', answer: 'Cédula' }],
    contact: {
      address: 'Av. Libertad 123',
      city: 'Chillán',
      region: 'Ñuble',
      phone: '+56422223344',
      whatsapp: '+56912345678',
      email: 'c@a.cl',
      mapEmbedUrl: 'https://maps.google.com',
      geo: { lat: -36.606, lng: -72.105 },
    },
    hours: [{ days: 'L-V', time: '09:00 - 18:30' }],
    promo: { active: true, title: 'Descuento', description: '10%', badge: 'Oferta' },
    social: { facebook: 'fb', instagram: 'ig' },
  };

  beforeEach(() => {
    supabaseSpy = { client: {} };
    toastSpy = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    coursesCatalogSignal = signal<CourseCatalogItem[]>(mockCatalog);
    coursesFacadeSpy = {
      availableCourses: coursesCatalogSignal,
      availableById: signal<Map<number, CourseCatalogItem>>(
        new Map(mockCatalog.map((c) => [c.id, c])),
      ),
      loadAvailableCourses: vi.fn().mockResolvedValue(undefined),
    };

    TestBed.configureTestingModule({
      providers: [
        WebsiteConfigFacade,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: CoursesFacade, useValue: coursesFacadeSpy },
      ],
    });

    facade = TestBed.inject(WebsiteConfigFacade);
  });

  it('debe crearse correctamente', () => {
    expect(facade).toBeTruthy();
  });

  it('estado inicial limpio', () => {
    expect(facade.config()).toBeNull();
    expect(facade.isLoading()).toBe(false);
    expect(facade.isSaving()).toBe(false);
    expect(facade.error()).toBeNull();
    expect(facade.resolvedCourses()).toEqual([]);
  });

  describe('loadConfig()', () => {
    it('carga config con cards CourseConfig y la expone vía config()', async () => {
      const maybeSingleSpy = vi
        .fn()
        .mockResolvedValue({ data: { config: mockSiteConfig }, error: null });
      const eqSpy = vi.fn().mockReturnValue({ maybeSingle: maybeSingleSpy });
      const selectSpy = vi.fn().mockReturnValue({ eq: eqSpy });
      supabaseSpy.client = { from: vi.fn().mockReturnValue({ select: selectSpy }) };

      await facade.loadConfig(1);

      expect(facade.config()).toEqual(mockSiteConfig);
      expect(facade.error()).toBeNull();
    });

    it('inicializa default config con courses: [] si no hay fila en BD', async () => {
      const maybeSingleSpy = vi.fn().mockResolvedValue({ data: null, error: null });
      const eqSpy = vi.fn().mockReturnValue({ maybeSingle: maybeSingleSpy });
      const selectSpy = vi.fn().mockReturnValue({ eq: eqSpy });
      supabaseSpy.client = { from: vi.fn().mockReturnValue({ select: selectSpy }) };

      await facade.loadConfig(2);

      const loaded = facade.config();
      expect(loaded).not.toBeNull();
      expect(loaded?.brand.branchId).toBe(2);
      expect(loaded?.courses).toEqual([]);
    });

    it('error de Supabase → toast.error y signal error()', async () => {
      const maybeSingleSpy = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Conn refused' },
      });
      const eqSpy = vi.fn().mockReturnValue({ maybeSingle: maybeSingleSpy });
      const selectSpy = vi.fn().mockReturnValue({ eq: eqSpy });
      supabaseSpy.client = { from: vi.fn().mockReturnValue({ select: selectSpy }) };

      await facade.loadConfig(1);

      expect(facade.error()).toBe('Conn refused');
      expect(toastSpy.error).toHaveBeenCalledWith('Error al cargar configuración', 'Conn refused');
    });
  });

  describe('resolvedCourses() — JOIN en memoria con CoursesFacade', () => {
    function seedConfig(courses: CourseConfig[]) {
      (facade as any)._config.set({ ...mockSiteConfig, courses });
    }

    it('AC7: combina CourseConfig con catalog → ResolvedCourse[] con name/basePrice/licenseClass heredados', () => {
      seedConfig(mockCourseCards);
      const resolved = facade.resolvedCourses();
      expect(resolved).toHaveLength(2);
      const r1 = resolved[0];
      expect(r1.courseId).toBe(1);
      expect(r1.name).toBe('Clase B');
      expect(r1.licenseClass).toBe('B');
      expect(r1.basePrice).toBe(350000);
      expect(r1.description).toBe('Curso B');
    });

    it('AC2: displayPrice hereda basePrice cuando priceOverride es null', () => {
      seedConfig([mockCourseCards[0]]);
      const r = facade.resolvedCourses()[0];
      expect(r.priceOverride).toBeNull();
      expect(r.displayPrice).toBe(350000);
      expect(r.isOverrideActive).toBe(false);
      expect(r.displayPriceLabel).toMatch(/350\.000/); // formato CLP es-CL
    });

    it('AC3: displayPrice = priceOverride cuando override está activo', () => {
      seedConfig([mockCourseCards[1]]);
      const r = facade.resolvedCourses()[0];
      expect(r.priceOverride).toBe(320000);
      expect(r.displayPrice).toBe(320000);
      expect(r.isOverrideActive).toBe(true);
      expect(r.displayPriceLabel).toMatch(/320\.000/);
    });

    it('AC-E3: displayPriceLabel === "Gratis" cuando priceOverride === 0', () => {
      seedConfig([{ ...mockCourseCards[0], priceOverride: 0 }]);
      const r = facade.resolvedCourses()[0];
      expect(r.displayPrice).toBe(0);
      expect(r.displayPriceLabel).toBe('Gratis');
      expect(r.isOverrideActive).toBe(true);
    });

    it('ordena por displayOrder ASC, desempate por courseId ASC', () => {
      const unordered: CourseConfig[] = [
        { ...mockCourseCards[1], displayOrder: 5, course_id: 2 },
        { ...mockCourseCards[0], displayOrder: 1, course_id: 1 },
      ];
      seedConfig(unordered);
      const ids = facade.resolvedCourses().map((r) => r.courseId);
      expect(ids).toEqual([1, 2]);
    });

    it('AC4: cards cuyo course_id no esté en availableCourses se marcan isCourseActive=false (no se filtran)', () => {
      const orphanCard: CourseConfig = {
        course_id: 999, // no existe en catálogo
        description: 'Card huérfana',
        duration: 'N/A',
        includes: [],
        highlighted: false,
        badge: null,
        priceNote: null,
        priceOverride: null,
        displayOrder: 99,
      };
      seedConfig([mockCourseCards[0], orphanCard]);

      const resolved = facade.resolvedCourses();
      const orphan = resolved.find((r) => r.courseId === 999);
      expect(orphan).toBeDefined();
      expect(orphan?.isCourseActive).toBe(false);
      // El name "fallback" puede ser una cadena vacía o "(curso no disponible)" — verificamos solo que existe
      expect(typeof orphan?.name).toBe('string');
    });

    it('cards cuyo course existe pero active=false → isCourseActive=false', () => {
      const inactiveCard: CourseConfig = {
        course_id: 9, // existe en mockCatalog pero active=false
        description: 'Curso desactivado',
        duration: 'N/A',
        includes: [],
        highlighted: false,
        badge: null,
        priceNote: null,
        priceOverride: null,
        displayOrder: 10,
      };
      seedConfig([inactiveCard]);
      const r = facade.resolvedCourses()[0];
      expect(r.isCourseActive).toBe(false);
      expect(r.name).toBe('Curso eliminado'); // sí toma el name del catálogo aunque esté inactivo
    });

    it('config null → resolvedCourses() retorna []', () => {
      (facade as any)._config.set(null);
      expect(facade.resolvedCourses()).toEqual([]);
    });
  });

  describe('saveConfig() — validación de course_id único (AC-E1)', () => {
    it('rechaza guardado si hay course_id duplicado en el array', async () => {
      const dupCards: CourseConfig[] = [
        mockCourseCards[0],
        { ...mockCourseCards[0] }, // mismo course_id=1
      ];
      const result = await facade.saveConfig(1, { ...mockSiteConfig, courses: dupCards });
      expect(result).toBe(false);
      expect(toastSpy.error).toHaveBeenCalledWith(
        'Error al guardar configuración',
        expect.stringContaining('duplicado'),
      );
    });

    it('guarda exitosamente cuando todos los course_id son únicos', async () => {
      const singleSpy = vi.fn().mockResolvedValue({
        data: { config: mockSiteConfig },
        error: null,
      });
      const selectSpy = vi.fn().mockReturnValue({ single: singleSpy });
      const upsertSpy = vi.fn().mockReturnValue({ select: selectSpy });
      supabaseSpy.client = { from: vi.fn().mockReturnValue({ upsert: upsertSpy }) };

      const result = await facade.saveConfig(1, mockSiteConfig);
      expect(result).toBe(true);
      expect(toastSpy.success).toHaveBeenCalled();
    });

    it('AC-E2: error de Supabase (trigger BD) se propaga al toast', async () => {
      const singleSpy = vi.fn().mockResolvedValue({
        data: null,
        error: {
          message: 'website_config.courses: course_id 99999 no existe en el catálogo operacional',
        },
      });
      const selectSpy = vi.fn().mockReturnValue({ single: singleSpy });
      const upsertSpy = vi.fn().mockReturnValue({ select: selectSpy });
      supabaseSpy.client = { from: vi.fn().mockReturnValue({ upsert: upsertSpy }) };

      const result = await facade.saveConfig(1, mockSiteConfig);
      expect(result).toBe(false);
      expect(toastSpy.error).toHaveBeenCalledWith(
        'Error al guardar configuración',
        expect.stringContaining('course_id 99999'),
      );
    });
  });
});
