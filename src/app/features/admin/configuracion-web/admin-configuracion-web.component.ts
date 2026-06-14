import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  computed,
  effect,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { WebsiteConfigFacade } from '@core/facades/website-config.facade';
import { CoursesFacade } from '@core/facades/courses.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ToastService } from '@core/services/ui/toast.service';
import type { SiteData } from '@core/models/dto/website-config.model';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { GeneralTabComponent } from './tabs/general-tab.component';
import { HeroTabComponent } from './tabs/hero-tab.component';
import { CursosTabComponent } from './tabs/cursos-tab.component';
import { PromoTabComponent } from './tabs/promo-tab.component';
import { ContactoTabComponent } from './tabs/contacto-tab.component';
import { FaqsTabComponent } from './tabs/faqs-tab.component';

type ConfigTab = 'general' | 'hero' | 'cursos' | 'promo' | 'contacto' | 'faqs';

@Component({
  selector: 'app-admin-configuracion-web',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    SectionHeroComponent,
    KpiCardVariantComponent,
    BentoGridLayoutDirective,
    IconComponent,
    CardHoverDirective,
    SkeletonBlockComponent,
    GeneralTabComponent,
    HeroTabComponent,
    CursosTabComponent,
    PromoTabComponent,
    ContactoTabComponent,
    FaqsTabComponent,
  ],
  template: `
    <div #bentoGrid class="bento-grid" appBentoGridLayout>
      <!-- Hero Section -->
      <app-section-hero
        class="bento-hero"
        title="Configuración Web"
        contextLine="Administración de Contenido y Precios"
        icon="globe"
        [actions]="heroActions()"
        (actionClick)="onHeroAction($event)"
      />

      <!-- KPIs -->
      <div class="bento-square">
        <div
          appCardHover
          class="bento-card flex flex-col gap-2 h-full"
          [class.card-accent]="promoActive()"
          [attr.data-color-variant]="promoActive() ? 'success' : 'default'"
          [attr.aria-busy]="facade.isLoading()"
        >
          @if (facade.isLoading()) {
            <div class="flex items-start justify-between gap-3">
              <app-skeleton-block variant="text" width="55%" height="12px" />
              <app-skeleton-block variant="rect" width="28px" height="28px" />
            </div>
            <app-skeleton-block variant="rect" width="70%" height="44px" />
          } @else {
            <div class="flex items-start justify-between gap-3 mb-1">
              <span
                class="text-[10px] uppercase font-bold tracking-wider"
                [style.color]="promoActive() ? 'var(--state-success)' : 'var(--color-primary)'"
                >Campaña Promo</span
              >
              <div
                class="flex items-center justify-center rounded-md w-7 h-7"
                [style.background]="
                  promoActive()
                    ? 'var(--state-success-bg, rgba(34, 197, 94, 0.1))'
                    : 'var(--color-primary-muted, rgba(14, 165, 233, 0.1))'
                "
                [style.color]="promoActive() ? 'var(--state-success)' : 'var(--color-primary)'"
              >
                <app-icon [name]="promoActive() ? 'tag' : 'ban'" [size]="14" />
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <p class="flex items-baseline gap-1 m-0 min-w-0 w-full overflow-hidden">
                <span
                  class="font-display font-bold align-baseline truncate leading-none"
                  class="text-text-primary"
                  [style.font-size]="'clamp(var(--text-2xl), 8vw, var(--text-4xl))'"
                  [title]="promoActive() ? 'Activa' : 'Inactiva'"
                >
                  {{ promoActive() ? 'Activa' : 'Inactiva' }}
                </span>
              </p>
            </div>
          }
        </div>
      </div>
      <div class="bento-square">
        <app-kpi-card-variant
          label="Cursos Activos"
          [value]="coursesCount()"
          [loading]="facade.isLoading()"
          icon="book-open"
          color="default"
        />
      </div>
      <div class="bento-square">
        <app-kpi-card-variant
          label="Preguntas Frecuentes"
          [value]="faqsCount()"
          [loading]="facade.isLoading()"
          icon="help-circle"
          color="warning"
        />
      </div>
      <div class="bento-square">
        <div
          appCardHover
          class="bento-card flex flex-col gap-2 h-full"
          [attr.aria-busy]="facade.isLoading()"
        >
          @if (facade.isLoading()) {
            <div class="flex items-start justify-between gap-3">
              <app-skeleton-block variant="text" width="55%" height="12px" />
              <app-skeleton-block variant="rect" width="28px" height="28px" />
            </div>
            <app-skeleton-block variant="rect" width="70%" height="44px" />
          } @else {
            <div class="flex items-start justify-between gap-3 mb-1">
              <span class="text-[10px] uppercase font-bold tracking-wider text-brand"
                >Dominio Web</span
              >
              <div
                class="flex items-center justify-center rounded-md w-7 h-7 text-brand"
                class="bg-brand-muted"
              >
                <app-icon name="globe" [size]="14" />
              </div>
            </div>
            <div class="flex flex-col gap-2">
              <p class="flex items-baseline gap-1 m-0 min-w-0 w-full overflow-hidden">
                <span
                  class="font-display font-bold align-baseline truncate leading-none"
                  class="text-text-primary"
                  [style.font-size]="'clamp(var(--text-lg), 4vw, var(--text-xl))'"
                  [title]="brandDomain()"
                >
                  {{ brandDomain() }}
                </span>
              </p>
            </div>
          }
        </div>
      </div>

      <!-- Main Editor Bento Card -->
      <div
        class="bento-banner card p-0 overflow-hidden"
        style="min-height: 500px; display: flex; flex-direction: column;"
      >
        <!-- Header with branch selection for Admin and Tabs Switcher -->
        <div class="flex flex-col border-b border-border-default bg-surface">
          <!-- Sede activa (solo secretaria — admin usa el selector global del topbar) -->
          @if (!isAdmin()) {
            <div class="flex items-center gap-2 px-4 py-2.5 border-b border-border-default">
              <app-icon name="building-2" [size]="14" class="text-text-muted" />
              <span class="text-xs text-text-muted">Sede:</span>
              <span class="text-xs font-semibold text-text-primary">{{ branchLabel() }}</span>
            </div>
          }

          <!-- Custom Tabs Switching (oculto si el admin no eligió sede aún) -->
          @if (!noBranchSelected()) {
            <div class="flex flex-wrap" role="tablist" aria-label="Secciones de configuración">
              @for (tab of tabs; track tab.id) {
                <button
                  role="tab"
                  class="flex-1 min-w-[120px] px-4 py-3.5 text-xs font-semibold uppercase tracking-wider transition-all border-b-2 cursor-pointer"
                  [style.border-color]="activeTab() === tab.id ? 'var(--ds-brand)' : 'transparent'"
                  [style.color]="activeTab() === tab.id ? 'var(--ds-brand)' : 'var(--text-muted)'"
                  [style.background]="
                    activeTab() === tab.id
                      ? 'color-mix(in srgb, var(--ds-brand) 4%, transparent)'
                      : 'transparent'
                  "
                  [attr.aria-selected]="activeTab() === tab.id"
                  (click)="activeTab.set(tab.id)"
                >
                  <div class="flex items-center justify-center gap-1.5">
                    <app-icon [name]="tab.icon" [size]="14" />
                    <span>{{ tab.label }}</span>
                  </div>
                </button>
              }
            </div>
          }
        </div>

        <!-- Form Content -->
        <form
          [formGroup]="form"
          (ngSubmit)="onSubmit()"
          class="flex-1 p-5 md:p-6 overflow-y-auto bg-surface"
        >
          @if (noBranchSelected()) {
            <!-- Empty state: admin sin sede seleccionada en topbar -->
            <div class="flex flex-col items-center justify-center gap-4 py-20 text-center">
              <app-icon name="building-2" [size]="40" class="text-text-muted" />
              <p class="text-sm font-semibold text-text-secondary">
                Seleccioná una sede en el menú superior
              </p>
              <p class="text-xs text-text-muted max-w-xs">
                Usá el selector de sede del topbar para elegir qué configuración web querés editar.
              </p>
            </div>
          } @else if (facade.isLoading()) {
            <!-- Skeletons loader -->
            <div class="flex flex-col gap-6">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="flex flex-col gap-2">
                  <app-skeleton-block variant="text" width="96px" height="16px" />
                  <app-skeleton-block variant="rect" width="100%" height="40px" />
                </div>
                <div class="flex flex-col gap-2">
                  <app-skeleton-block variant="text" width="96px" height="16px" />
                  <app-skeleton-block variant="rect" width="100%" height="40px" />
                </div>
              </div>
              <div class="flex flex-col gap-2">
                <app-skeleton-block variant="text" width="128px" height="16px" />
                <app-skeleton-block variant="rect" width="100%" height="128px" />
              </div>
            </div>
          } @else {
            <!-- TABS CONTENT -->

            @if (activeTab() === 'general') {
              <app-general-tab
                [brandGroup]="form.controls.brand"
                [socialGroup]="form.controls.social"
                [branchId]="effectiveBranchId()!"
              />
            }
            @if (activeTab() === 'hero') {
              <app-hero-tab
                [heroGroup]="form.controls.hero"
                [branchId]="effectiveBranchId()!"
              />
            }
            @if (activeTab() === 'cursos') {
              <app-cursos-tab
                [coursesArray]="coursesArray"
                [pricingFooterGroup]="form.controls.pricingFooter"
              />
            }
            @if (activeTab() === 'promo') {
              <app-promo-tab [promoGroup]="form.controls.promo" />
            }
            @if (activeTab() === 'contacto') {
              <app-contacto-tab
                [contactGroup]="form.controls.contact"
                [hoursArray]="hoursArray"
              />
            }
            @if (activeTab() === 'faqs') {
              <app-faqs-tab [faqsArray]="faqsArray" />
            }

            <!-- Persistent Form Save Area inside the Card body if invalid (highly accessible) -->
            <div class="flex items-center justify-between mt-8 pt-5 border-t border-border-subtle">
              <span class="text-xs">
                @if (form.invalid) {
                  <span class="font-medium text-error"
                    >⚠️ Existen errores de validación en el formulario.</span
                  >
                } @else {
                  <span class="text-text-muted"
                    >✓ El formulario de configuración está listo para guardarse.</span
                  >
                }
              </span>
              <button
                type="submit"
                class="btn-primary py-2.5 px-6 flex items-center gap-2 shadow-md cursor-pointer"
                [disabled]="facade.isSaving() || facade.isLoading() || form.invalid"
                data-llm-action="save-changes-footer"
              >
                @if (facade.isSaving()) {
                  <app-icon name="loader-2" [size]="16" class="animate-spin" />
                  <span>Guardando Cambios...</span>
                } @else {
                  <app-icon name="save" [size]="16" />
                  <span>Publicar Cambios Web</span>
                }
              </button>
            </div>
          }
        </form>
      </div>
    </div>
  `,
  styles: [
    `
      button:disabled {
        opacity: 0.55;
        cursor: not-allowed !important;
      }
      .field-label {
        display: block;
        font-size: var(--text-xs);
        font-weight: 700;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin-bottom: 4px;
      }
      .field-input {
        width: 100%;
        padding: 10px 12px;
        border-radius: var(--radius-md);
        border: 1px solid var(--border-default);
        background: var(--bg-base);
        color: var(--text-primary);
        font-size: var(--text-sm);
        outline: none;
        transition: border-color var(--duration-fast, 150ms) ease;
      }
      .field-input:focus {
        border-color: var(--ds-brand);
      }
      .btn-ghost {
        padding: 8px 16px;
        border-radius: var(--radius-md);
        background: transparent;
        color: var(--text-muted);
        font-size: var(--text-sm);
        font-weight: 500;
        border: none;
        cursor: pointer;
        transition: background-color var(--duration-fast, 150ms) ease;
      }
      .scrollbar-none::-webkit-scrollbar {
        display: none;
      }
      .scrollbar-none {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
      .category-pill {
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        transform: translateZ(0);
      }
      .category-pill:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      }
      .category-pill:active {
        transform: scale(0.95);
      }
      .category-scroll-container {
        mask-image: linear-gradient(to right, black 85%, transparent 100%);
        -webkit-mask-image: linear-gradient(to right, black 85%, transparent 100%);
      }

    `
  ],
})
export class AdminConfiguracionWebComponent implements AfterViewInit {
  protected readonly facade = inject(WebsiteConfigFacade);
  protected readonly coursesFacade = inject(CoursesFacade);
  protected readonly authFacade = inject(AuthFacade);
  protected readonly branchFacade = inject(BranchFacade);
  private readonly gsap = inject(GsapAnimationsService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  // Signals
  protected readonly activeTab = signal<ConfigTab>('general');

  // Tab definitions
  protected readonly tabs = [
    { id: 'general' as ConfigTab, label: 'General & Redes', icon: 'settings' },
    { id: 'hero' as ConfigTab, label: 'Sección Hero', icon: 'layout' },
    { id: 'cursos' as ConfigTab, label: 'Cursos & Precios', icon: 'book-open' },
    { id: 'promo' as ConfigTab, label: 'Campaña Promo', icon: 'tag' },
    { id: 'contacto' as ConfigTab, label: 'Contacto & Horas', icon: 'map-pin' },
    { id: 'faqs' as ConfigTab, label: 'Preguntas FAQs', icon: 'help-circle' },
  ];

  // Role Checks
  protected readonly isAdmin = computed(() => this.authFacade.currentUser()?.role === 'admin');

  /** Sede efectiva: para admin viene del selector global (puede ser null); para secretaria viene fija del user. */
  protected readonly effectiveBranchId = computed<number | null>(() => {
    const user = this.authFacade.currentUser();
    if (!user) return null;
    if (user.role === 'admin') return this.branchFacade.selectedBranchId();
    return user.branchId ?? null;
  });

  /** true cuando el admin no ha seleccionado una sede específica en el topbar. */
  protected readonly noBranchSelected = computed(
    () => this.isAdmin() && this.effectiveBranchId() === null,
  );

  /** Etiqueta dinámica de la sede activa (usa el catálogo de BranchFacade). */
  protected readonly branchLabel = computed(() => {
    const id = this.effectiveBranchId();
    if (!id) return '';
    return this.branchFacade.branches().find((b) => b.id === id)?.name ?? `Sede ${id}`;
  });

  // KPI Calculations
  protected readonly promoActive = computed(() => this.facade.config()?.promo?.active ?? false);
  protected readonly coursesCount = computed(() => this.facade.config()?.courses?.length ?? 0);
  protected readonly faqsCount = computed(() => this.facade.config()?.faqs?.length ?? 0);
  protected readonly brandDomain = computed(() => this.facade.config()?.brand?.domain ?? '—');

  // Hero Actions
  protected readonly heroActions = computed<SectionHeroAction[]>(() => [
    {
      id: 'guardar',
      label: 'Publicar Cambios',
      icon: 'save',
      primary: true,
      loading: this.facade.isSaving(),
      disabled: this.facade.isSaving() || this.facade.isLoading() || this.form.invalid,
    },
  ]);

  // Reactive Form
  protected readonly form = this.fb.group({
    brand: this.fb.group({
      name: ['', Validators.required],
      shortName: ['', Validators.required],
      slogan: ['', Validators.required],
      theme: ['azul' as 'azul' | 'roja', Validators.required],
      domain: ['', Validators.required],
      logo: [''],
      ogImage: [''],
      favicon: [''],
      branchId: [1],
    }),
    hero: this.fb.group({
      layoutType: ['center'],
      background: this.fb.group({
        type: ['none'],
        url: [''],
        color: ['var(--bg-surface)'],
        overlayOpacity: [40],
      }),
      media: this.fb.group({
        type: ['none'],
        url: [''],
      }),
      headline: ['', Validators.required],
      subheadline: ['', Validators.required],
      cta: this.fb.group({
        text: ['', Validators.required],
        whatsapp: ['', Validators.required],
      }),
      features: this.fb.array([
        this.fb.group({ icon: ['car'], text: [''] }),
        this.fb.group({ icon: ['file-text'], text: [''] }),
        this.fb.group({ icon: ['graduation-cap'], text: [''] }),
      ]),
      trustBadge: this.fb.group({
        text: [''],
        rating: [5],
        enabled: [false],
      }),
    }),
    promo: this.fb.group({
      active: [false],
      title: [''],
      description: [''],
      badge: [''],
    }),
    contact: this.fb.group({
      address: ['', Validators.required],
      city: ['Chillán', Validators.required],
      region: ['Ñuble', Validators.required],
      phone: ['', Validators.required],
      whatsapp: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      mapEmbedUrl: ['', Validators.required],
      geo: this.fb.group({
        lat: [-36.606709, Validators.required],
        lng: [-72.105436, Validators.required],
      }),
    }),
    hours: this.fb.array([
      this.fb.group({
        days: ['Lunes a Viernes', Validators.required],
        time: ['09:00 - 18:30', Validators.required],
      }),
      this.fb.group({
        days: ['Sábado', Validators.required],
        time: ['09:00 - 13:30', Validators.required],
      }),
    ]),
    social: this.fb.group({
      facebook: [''],
      instagram: [''],
      tiktok: [''],
    }),
    pricingFooter: this.fb.group({
      payment: this.fb.group({
        title: ['', [Validators.required, Validators.maxLength(100)]],
        description: ['', [Validators.required, Validators.maxLength(300)]],
      }),
      guarantee: this.fb.group({
        title: ['', [Validators.required, Validators.maxLength(100)]],
        description: ['', [Validators.required, Validators.maxLength(300)]],
      }),
    }),
    courses: this.fb.array([]),
    faqs: this.fb.array([]),
  });

  // Getters for arrays
  get heroFeatures(): FormArray {
    return this.form.controls.hero.controls.features as FormArray;
  }

  get coursesArray(): FormArray {
    return this.form.controls.courses as FormArray;
  }

  get faqsArray(): FormArray {
    return this.form.controls.faqs as FormArray;
  }

  get hoursArray(): FormArray {
    return this.form.controls.hours as FormArray;
  }

  constructor() {
    // 1. Reacciona al cambio de sede global (topbar) o al usuario autenticado
    effect(() => {
      const branchId = this.effectiveBranchId();
      if (!branchId) return; // admin sin sede seleccionada → empty state, no cargar
      void this.facade.loadConfig(branchId);
      void this.coursesFacade.loadAvailableCourses(branchId);
    });

    // 2. Reacting to Facade load to hydrate form
    effect(() => {
      const data = this.facade.config();
      if (data) {
        this.initForm(data);
      }
    });

    // 4. GSAP fade-in on tab change (replaces @keyframes fadeIn)
    effect(() => {
      this.activeTab(); // track
      setTimeout(() => {
        const grid = this.bentoGrid()?.nativeElement;
        if (!grid) return;
        grid.querySelectorAll<HTMLElement>('.animate-fade-in').forEach((el) => {
          this.gsap.fadeIn(el);
        });
      }, 0);
    });
  }

  ngAfterViewInit(): void {
    const grid = this.bentoGrid();
    if (grid) {
      this.gsap.animateBentoGrid(grid.nativeElement);
    }
  }

  // Hero Actions click
  protected onHeroAction(id: string): void {
    if (id === 'guardar') {
      void this.onSubmit();
    }
  }

  // Populate Form Fields safely
  private initForm(data: SiteData): void {
    // 1. Hydrate Cursos FormArray (spec 0004: shape nuevo con course_id FK)
    this.coursesArray.clear({ emitEvent: false });
    if (data.courses) {
      data.courses.forEach((c) => {
        this.coursesArray.push(
          this.fb.group({
            course_id: [c.course_id, Validators.required],
            description: [c.description, Validators.required],
            priceNote: [c.priceNote ?? ''],
            duration: [c.duration, Validators.required],
            highlighted: [c.highlighted],
            badge: [c.badge ?? ''],
            priceOverride: [c.priceOverride],
            displayOrder: [c.displayOrder],
            includes: [c.includes ? c.includes.join(', ') : '', Validators.required],
          }),
        );
      });
    }

    // 2. Hydrate FAQs FormArray
    this.faqsArray.clear({ emitEvent: false });
    if (data.faqs) {
      data.faqs.forEach((f) => {
        this.faqsArray.push(
          this.fb.group({
            question: [f.question, Validators.required],
            answer: [f.answer, Validators.required],
          }),
        );
      });
    }

    // 3. Hydrate Hours
    this.hoursArray.clear({ emitEvent: false });
    if (data.hours && data.hours.length > 0) {
      data.hours.forEach((h) => {
        this.hoursArray.push(
          this.fb.group({
            days: [h.days, Validators.required],
            time: [h.time, Validators.required],
          }),
        );
      });
    } else {
      this.hoursArray.push(
        this.fb.group({
          days: ['Lunes a Viernes', Validators.required],
          time: ['09:00 - 18:30', Validators.required],
        }),
      );
      this.hoursArray.push(
        this.fb.group({
          days: ['Sábado', Validators.required],
          time: ['09:00 - 13:30', Validators.required],
        }),
      );
    }

    // 4. Hydrate Features
    this.heroFeatures.clear({ emitEvent: false });
    if (data.hero?.features && data.hero.features.length > 0) {
      data.hero.features.forEach((f) => {
        this.heroFeatures.push(
          this.fb.group({
            icon: [f.icon || 'car'],
            text: [f.text || '', Validators.required],
          }),
        );
      });
    } else {
      this.heroFeatures.push(this.fb.group({ icon: ['car'], text: ['', Validators.required] }));
      this.heroFeatures.push(
        this.fb.group({ icon: ['file-text'], text: ['', Validators.required] }),
      );
      this.heroFeatures.push(
        this.fb.group({ icon: ['graduation-cap'], text: ['', Validators.required] }),
      );
    }

    // 5. Populate other fields safely
    this.form.patchValue(
      {
        brand: {
          name: data.brand?.name || '',
          shortName: data.brand?.shortName || '',
          slogan: data.brand?.slogan || '',
          theme: data.brand?.theme || (this.effectiveBranchId()! === 2 ? 'roja' : 'azul'),
          domain: data.brand?.domain || '',
          logo: data.brand?.logo || '',
          ogImage: data.brand?.ogImage || '',
          favicon: data.brand?.favicon || '',
          branchId: data.brand?.branchId || this.effectiveBranchId()!,
        },
        hero: {
          layoutType: data.hero?.layoutType || 'center',
          background: {
            type: data.hero?.background?.type || 'none',
            url: data.hero?.background?.url || '',
            color: data.hero?.background?.color || 'var(--bg-surface)',
            overlayOpacity: data.hero?.background?.overlayOpacity ?? 40,
          },
          media: {
            type: data.hero?.media?.type || 'none',
            url: data.hero?.media?.url || '',
          },
          headline: data.hero?.headline || '',
          subheadline: data.hero?.subheadline || '',
          cta: {
            text: data.hero?.cta?.text || '',
            whatsapp: data.hero?.cta?.whatsapp || '',
          },
          trustBadge: {
            text: data.hero?.trustBadge?.text || '',
            rating: data.hero?.trustBadge?.rating ?? 5,
            enabled: data.hero?.trustBadge?.enabled ?? false,
          },
        },
        promo: {
          active: data.promo?.active ?? false,
          title: data.promo?.title || '',
          description: data.promo?.description || '',
          badge: data.promo?.badge || '',
        },
        contact: {
          address: data.contact?.address || '',
          city: data.contact?.city || 'Chillán',
          region: data.contact?.region || 'Ñuble',
          phone: data.contact?.phone || '',
          whatsapp: data.contact?.whatsapp || '',
          email: data.contact?.email || '',
          mapEmbedUrl: data.contact?.mapEmbedUrl || '',
          geo: {
            lat: data.contact?.geo?.lat ?? -36.606709,
            lng: data.contact?.geo?.lng ?? -72.105436,
          },
        },
        social: {
          facebook: data.social?.facebook || '',
          instagram: data.social?.instagram || '',
          tiktok: data.social?.tiktok || '',
        },
        pricingFooter: {
          payment: {
            title: data.pricingFooter?.payment?.title || '',
            description: data.pricingFooter?.payment?.description || '',
          },
          guarantee: {
            title: data.pricingFooter?.guarantee?.title || '',
            description: data.pricingFooter?.guarantee?.description || '',
          },
        },
      },
      { emitEvent: false },
    );

    this.form.markAsPristine();
  }

  // Handle Form Submission
  protected async onSubmit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.toast.error(
        'Formulario inválido',
        'Existen campos requeridos con errores. Por favor revise cada pestaña.',
      );
      return;
    }

    const raw = this.form.getRawValue();

    // Map includes from string to array, and numbers safely
    const formattedData: SiteData = {
      brand: {
        name: raw.brand.name!,
        shortName: raw.brand.shortName!,
        slogan: raw.brand.slogan!,
        theme:
          (raw.brand.theme as 'azul' | 'roja') ||
          (Number(this.effectiveBranchId()!) === 2 ? 'roja' : 'azul'),
        domain: raw.brand.domain!,
        logo: raw.brand.logo || '',
        ogImage: raw.brand.ogImage || '',
        favicon: raw.brand.favicon || '',
        branchId: Number(this.effectiveBranchId()!),
      },
      hero: {
        layoutType: (raw.hero.layoutType as 'center' | 'split-right' | 'split-left') || 'center',
        background: {
          type: (raw.hero.background?.type as 'color' | 'image' | 'video' | 'none') || 'none',
          url: raw.hero.background?.url || '',
          color: raw.hero.background?.color || 'var(--bg-surface)',
          overlayOpacity:
            raw.hero.background?.overlayOpacity != null
              ? Number(raw.hero.background.overlayOpacity)
              : 40,
        },
        media: {
          type: (raw.hero.media?.type as 'image' | 'video' | 'none') || 'none',
          url: raw.hero.media?.url || '',
        },
        headline: raw.hero.headline!,
        subheadline: raw.hero.subheadline!,
        cta: {
          text: raw.hero.cta.text!,
          whatsapp: raw.hero.cta.whatsapp || '',
        },
        features: raw.hero.features.map((f: any) => ({
          icon: f.icon || '',
          text: f.text || '',
        })),
        trustBadge: {
          text: raw.hero.trustBadge?.text || '',
          rating: raw.hero.trustBadge?.rating != null ? Number(raw.hero.trustBadge.rating) : 5,
          enabled: !!raw.hero.trustBadge?.enabled,
        },
      },
      courses: raw.courses.map((c: any) => ({
        course_id: Number(c.course_id),
        description: c.description!,
        priceNote: c.priceNote || null,
        duration: c.duration!,
        highlighted: !!c.highlighted,
        badge: c.badge || null,
        priceOverride: c.priceOverride != null ? Number(c.priceOverride) : null,
        displayOrder: Number(c.displayOrder) || 1,
        includes: c.includes
          ? c.includes
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean)
          : [],
      })),
      whyUs: [
        {
          icon: 'shield-check',
          title: 'Seguridad Primero',
          description: 'Pedaleras de doble comando homologadas para tu total seguridad.',
        },
        {
          icon: 'target',
          title: 'Alta Aprobación',
          description:
            'Métodos prácticos diseñados para aprobar a la primera en la Dirección de Tránsito de Chillán.',
        },
        {
          icon: 'map-pin',
          title: 'Cerca del Examen',
          description:
            'Nuestras clases de conducción cubren los recorridos y calles de examen habituales.',
        },
        {
          icon: 'calendar',
          title: 'Horarios Flexibles',
          description:
            'Programamos tus horas prácticas de lunes a sábado en bloques que se acomodan a ti.',
        },
        {
          icon: 'car',
          title: 'Flota Moderna',
          description:
            'Vehículos nuevos y confortables, garantizando un aprendizaje ameno y seguro.',
        },
        {
          icon: 'credit-card',
          title: 'Facilidades de Pago',
          description: 'Paga con tarjeta de crédito, débito o transferencia electrónica.',
        },
      ],
      faqs: raw.faqs.map((f: any) => ({
        question: f.question!,
        answer: f.answer!,
      })),
      contact: {
        address: raw.contact.address!,
        city: raw.contact.city!,
        region: raw.contact.region!,
        phone: raw.contact.phone || '',
        whatsapp: raw.contact.whatsapp || '',
        email: raw.contact.email!,
        mapEmbedUrl: raw.contact.mapEmbedUrl!,
        geo: {
          lat: Number(raw.contact.geo.lat),
          lng: Number(raw.contact.geo.lng),
        },
      },
      hours: raw.hours.map((h: any) => ({
        days: h.days!,
        time: h.time!,
      })),
      promo: {
        active: !!raw.promo.active,
        title: raw.promo.title || '',
        description: raw.promo.description || '',
        badge: raw.promo.badge || null,
      },
      social: {
        facebook: raw.social.facebook || null,
        instagram: raw.social.instagram || null,
        tiktok: raw.social.tiktok || null,
      },
      pricingFooter: {
        payment: {
          title: raw.pricingFooter.payment.title || '',
          description: raw.pricingFooter.payment.description || '',
        },
        guarantee: {
          title: raw.pricingFooter.guarantee.title || '',
          description: raw.pricingFooter.guarantee.description || '',
        },
      },
      testimonials: this.facade.config()?.testimonials || [],
    };

    const ok = await this.facade.saveConfig(this.effectiveBranchId()!, formattedData);
    if (ok) {
      this.form.markAsPristine();
    }
  }
}
