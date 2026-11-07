import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  computed,
  effect,
  untracked,
  viewChild,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  FormArray,
  type FormControlStatus,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { WebsiteConfigFacade } from '@core/facades/website-config.facade';
import { CoursesFacade } from '@core/facades/courses.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { getPrivacyPolicy } from '@core/models/ui/privacy-policy.model';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { IconComponent } from '@shared/components/icon/icon.component';
import { ToastService } from '@core/services/ui/toast.service';
import type { SiteData } from '@core/models/ui/website-config.model';
import type { SectionHeroAction, SectionHeroKpi } from '@core/models/ui/section-hero.model';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { GeneralTabComponent } from './tabs/general-tab.component';
import { HeroTabComponent } from './tabs/hero-tab.component';
import { CursosTabComponent } from './tabs/cursos-tab.component';
import { PromoTabComponent } from './tabs/promo-tab.component';
import { ContactoTabComponent } from './tabs/contacto-tab.component';
import { FaqsTabComponent } from './tabs/faqs-tab.component';
import { TabsComponent } from '@shared/components/tabs/tabs.component';
import { StableWidthDirective } from '@core/directives/stable-width.directive';
import { branchIdToTheme } from '@core/utils/sede-theme.utils';
import { NO_BRANCH_SCOPE, resolveBranchScope } from '@core/utils/branch-scope.utils';
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import type { HasUnsavedWebConfig } from '@core/guards/configuracion-web-unsaved.guard';
import {
  configTabsWithErrors,
  courseCardControls,
  domainValidator,
  googleMapsEmbedValidator,
  httpUrlValidator,
  promoTextValidator,
  whatsappValidator,
  whyUsToPublish,
} from '@core/utils/website-config.utils';

type ConfigTab = 'general' | 'hero' | 'cursos' | 'promo' | 'contacto' | 'faqs';

@Component({
  selector: 'app-admin-configuracion-web',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    SectionHeroComponent,
    BentoGridLayoutDirective,
    CardHoverDirective,
    IconComponent,
    SkeletonBlockComponent,
    GeneralTabComponent,
    HeroTabComponent,
    CursosTabComponent,
    PromoTabComponent,
    ContactoTabComponent,
    FaqsTabComponent,
    TabsComponent,
    StableWidthDirective,
  ],
  template: `
    <div #bentoGrid class="bento-grid bento-grid--fill-screen" appBentoGridLayout>
      <!-- Hero Section -->
      <app-section-hero
        density="slim"
        [animateOnInit]="false"
        [loading]="facade.isLoading()"
        title="Configuración Web"
        contextLine="Administración de Contenido y Precios"
        icon="globe"
        [actions]="heroActions()"
        [kpis]="heroKpis()"
        (actionClick)="onHeroAction($event)"
      />

      <!-- Main Editor Bento Card -->
      <div
        class="bento-banner bento-fill card p-0 overflow-hidden flex flex-col h-full"
        appCardHover
      >
        <!-- Header with branch selection for Admin and Tabs Switcher -->
        <div class="flex flex-col border-b border-border-default bg-base z-10">
          <!-- Sede activa (solo secretaria — admin usa el selector global del topbar) -->
          @if (!isAdmin() && !noBranchSelected()) {
            <div class="flex items-center gap-2 px-4 py-2.5 border-b border-border-default">
              <app-icon name="building-2" [size]="14" class="text-text-muted" />
              <span class="text-xs text-text-muted">Sede:</span>
              <span class="text-xs font-semibold text-text-primary">{{ branchLabel() }}</span>
            </div>
          }

          <!-- Custom Tabs Switching (oculto si el admin no eligió sede aún) -->
          @if (!noBranchSelected()) {
            <app-tabs
              [tabs]="tabsView()"
              [activeId]="activeTab()"
              variant="line"
              [uppercase]="true"
              (activeIdChange)="activeTab.set($any($event))"
            />
          }
        </div>

        <!-- Form Content -->
        <form
          [formGroup]="form"
          (ngSubmit)="onSubmit()"
          class="flex-1 p-6 md:p-8 overflow-y-auto bg-surface"
        >
          @if (noBranchSelected()) {
            <!-- Empty state: admin sin sede seleccionada en topbar -->
            <div class="flex flex-col items-center justify-center gap-4 py-20 text-center">
              <app-icon name="building-2" [size]="40" class="text-text-muted" />
              <p class="text-sm font-semibold text-text-secondary">
                Selecciona una sede en el menú superior
              </p>
              <p class="text-xs text-text-muted max-w-xs">
                Usa el selector de sede del topbar para elegir qué configuración web quieres editar.
              </p>
            </div>
          } @else if (facade.isLoading()) {
            <!-- Skeletons loader -->
            <div class="flex flex-col gap-6">
              <div class="bento-grid bento-grid--forms mt-4">
                <div class="flex flex-col gap-2 bento-wide">
                  <app-skeleton-block variant="text" width="96px" height="16px" />
                  <app-skeleton-block variant="rect" width="100%" height="40px" />
                </div>
                <div class="flex flex-col gap-2 bento-wide">
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
              <app-hero-tab [heroGroup]="form.controls.hero" [branchId]="effectiveBranchId()!" />
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
                [policy]="policyContact()"
              />
            }
            @if (activeTab() === 'faqs') {
              <app-faqs-tab [faqsArray]="faqsArray" />
            }

            <!-- Persistent Form Save Area inside the Card body if invalid (highly accessible) -->
            <div
              class="flex items-center justify-between mt-10 pt-6 pb-2 border-t border-border-subtle"
            >
              <!-- fix-492-m: dice en qué pestaña está el error, con ícono Lucide (antes emoji) -->
              <span class="text-xs flex items-center gap-1.5" aria-live="polite">
                @if (tabsWithErrors().length > 0) {
                  <app-icon name="circle-alert" [size]="14" class="text-error" />
                  <span class="font-medium text-error"
                    >Hay campos por corregir en: {{ tabsWithErrorsLabel() }}.</span
                  >
                } @else {
                  <app-icon name="circle-check" [size]="14" class="text-text-muted" />
                  <span class="text-text-muted"
                    >El formulario de configuración está listo para guardarse.</span
                  >
                }
              </span>
              <button
                type="submit"
                class="btn-primary py-2.5 px-6 flex items-center justify-center gap-2 shadow-md cursor-pointer hover:-translate-y-0.5 transition-transform"
                [disabled]="facade.isSaving() || facade.isLoading() || formStatus() === 'INVALID'"
                [appStableWidth]="facade.isSaving()"
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
        background: var(--input-bg);
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
    `,
  ],
})
export class AdminConfiguracionWebComponent implements AfterViewInit, HasUnsavedWebConfig {
  protected readonly facade = inject(WebsiteConfigFacade);
  protected readonly coursesFacade = inject(CoursesFacade);
  protected readonly authFacade = inject(AuthFacade);
  protected readonly branchFacade = inject(BranchFacade);
  private readonly gsap = inject(GsapAnimationsService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly confirmModal = inject(ConfirmModalService);

  private readonly bentoGrid = viewChild<ElementRef<HTMLElement>>('bentoGrid');

  // Signals
  protected readonly activeTab = signal<ConfigTab>('general');

  // Role Checks
  protected readonly isAdmin = computed(() => this.authFacade.currentUser()?.role === 'admin');

  // Tab definitions
  protected readonly tabs = [
    {
      id: 'general' as ConfigTab,
      label: 'General & Redes',
      shortLabel: 'General',
      icon: 'settings',
    },
    { id: 'hero' as ConfigTab, label: 'Sección Hero', shortLabel: 'Hero', icon: 'layout' },
    {
      id: 'cursos' as ConfigTab,
      label: 'Cursos & Precios',
      shortLabel: 'Cursos',
      icon: 'book-open',
    },
    { id: 'promo' as ConfigTab, label: 'Campaña Promo', shortLabel: 'Promo', icon: 'tag' },
    {
      id: 'contacto' as ConfigTab,
      label: 'Contacto & Horas',
      shortLabel: 'Contacto',
      icon: 'map-pin',
    },
    {
      id: 'faqs' as ConfigTab,
      label: 'Preguntas FAQs',
      shortLabel: 'FAQs',
      icon: 'help-circle',
    },
  ];

  /** Sede efectiva: para admin viene del selector global (puede ser null); para secretaria viene fija del user. */
  protected readonly effectiveBranchId = computed<number | null>(() => {
    const user = this.authFacade.currentUser();
    if (!user) return null;
    // fix-495-m: la regla única de sede. La secretaria con acceso a ambas sedes sigue su selector
    // (decisión D4); antes quedaba fija en su sede propia.
    const scope = resolveBranchScope(
      user.role,
      user.branchId,
      this.branchFacade.selectedBranchId(),
      user.canAccessBothBranches,
    );
    return scope === NO_BRANCH_SCOPE ? null : scope;
  });

  /** true cuando no hay una sede específica elegida (admin o secretaria multi-sede en "Todas"). */
  protected readonly noBranchSelected = computed(() => this.effectiveBranchId() === null);

  /** Sede cuya configuración está cargada en el formulario (fix-495-m). */
  private loadedBranchId: number | null = null;

  /** Cambios sin publicar en el formulario (para el guard de salida, fix-495-m). */
  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.facade.isSaving();
  }

  /**
   * fix-502-m: dirección y correo de la política de privacidad de la sede vigente, para avisar
   * en la pestaña Contacto si la web dice otra cosa.
   */
  protected readonly policyContact = computed(() => {
    const id = this.effectiveBranchId();
    const slug = this.branchFacade.branches().find((b) => b.id === id)?.slug;
    const policy = getPrivacyPolicy(slug);
    return policy ? { address: policy.address, rightsEmail: policy.rightsEmail } : null;
  });

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

  protected readonly heroKpis = computed((): SectionHeroKpi[] => [
    {
      id: 'promo',
      label: 'Campaña Promo',
      value: this.promoActive() ? 'Activa' : 'Inactiva',
      icon: this.promoActive() ? 'tag' : 'ban',
      color: this.promoActive() ? 'success' : 'default',
    },
    {
      id: 'cursos',
      label: 'Cursos Activos',
      value: this.coursesCount(),
      icon: 'book-open',
    },
    {
      id: 'faqs',
      label: 'Preguntas Frecuentes',
      value: this.faqsCount(),
      icon: 'help-circle',
      color: 'warning',
    },
    {
      id: 'dominio',
      label: 'Dominio Web',
      value: this.brandDomain(),
      icon: 'globe',
    },
  ]);

  // Hero Actions
  protected readonly heroActions = computed<SectionHeroAction[]>(() => [
    {
      id: 'guardar',
      label: 'Publicar Cambios',
      icon: 'save',
      primary: true,
      loading: this.facade.isSaving(),
      // fix-492-m: el signal del estado; form.invalid no es reactivo y el botón no se enteraba.
      disabled:
        this.facade.isSaving() || this.facade.isLoading() || this.formStatus() === 'INVALID',
    },
  ]);

  /** Estado de validación del formulario como signal (fix-492-m). */
  protected readonly formStatus = signal<FormControlStatus>('VALID');

  /** Pestañas con algún campo por corregir. */
  protected readonly tabsWithErrors = computed(() => {
    this.formStatus();
    return configTabsWithErrors(this.form);
  });

  /** Las pestañas con error cambian su ícono por una alerta. */
  protected readonly tabsView = computed(() => {
    const withErrors = new Set<string>(this.tabsWithErrors());
    return this.tabs.map((t) => (withErrors.has(t.id) ? { ...t, icon: 'circle-alert' } : t));
  });

  /** Nombres de las pestañas con error, para el aviso del pie. */
  protected readonly tabsWithErrorsLabel = computed(() => {
    const withErrors = new Set<string>(this.tabsWithErrors());
    return this.tabs
      .filter((t) => withErrors.has(t.id))
      .map((t) => t.label)
      .join(', ');
  });

  // Reactive Form
  protected readonly form = this.fb.group({
    brand: this.fb.group({
      name: ['', Validators.required],
      shortName: ['', Validators.required],
      slogan: ['', Validators.required],
      theme: [{ value: 'azul' as 'azul' | 'roja', disabled: true }, Validators.required],
      domain: ['', [Validators.required, domainValidator]],
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
        whatsapp: ['', [Validators.required, whatsappValidator]],
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
    // fix-493-m: con la promo activa, título, etiqueta y detalle son obligatorios.
    promo: this.fb.group(
      {
        active: [false],
        title: [''],
        description: [''],
        badge: [''],
      },
      { validators: promoTextValidator },
    ),
    contact: this.fb.group({
      address: ['', Validators.required],
      city: ['Chillán', Validators.required],
      region: ['Ñuble', Validators.required],
      phone: ['', Validators.required],
      whatsapp: ['', [Validators.required, whatsappValidator]],
      email: ['', [Validators.required, Validators.email]],
      mapEmbedUrl: ['', [Validators.required, googleMapsEmbedValidator]],
      geo: this.fb.group({
        lat: [-36.606709, [Validators.required, Validators.min(-90), Validators.max(90)]],
        lng: [-72.105436, [Validators.required, Validators.min(-180), Validators.max(180)]],
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
      facebook: ['', httpUrlValidator],
      instagram: ['', httpUrlValidator],
      tiktok: ['', httpUrlValidator],
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
    // fix-492-m: el estado de validación como signal para el hero, las pestañas y el pie.
    this.form.statusChanges
      .pipe(takeUntilDestroyed())
      .subscribe((status) => this.formStatus.set(status));

    // 1. Reacciona al cambio de sede global (topbar) o al usuario autenticado
    effect(() => {
      const branchId = this.effectiveBranchId();
      untracked(() => void this.onBranchChange(branchId));
    });

    // 2. Reacting to Facade load to hydrate form
    effect(() => {
      const data = this.facade.config();
      // fix-495-m: solo la config dispara el llenado. initForm lee effectiveBranchId(); sin
      // untracked, cambiar de sede repintaba el formulario y borraba lo escrito aunque el usuario
      // eligiera "Quedarse".
      if (data) untracked(() => this.initForm(data));
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
        // fix-493-m: mismos controles que al agregar una card nueva.
        this.coursesArray.push(this.fb.group(courseCardControls(c)));
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
          // hotfix-169-m: fijado por sede, no por lo guardado (sede 1 roja, sede 2 azul).
          theme: branchIdToTheme(this.effectiveBranchId()),
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
    // fix-492-m: el patch va con emitEvent: false, así que statusChanges no avisa.
    this.formStatus.set(this.form.status);
  }

  /**
   * fix-495-m: cambio de sede. Con cambios sin publicar pide confirmación; si el usuario se queda,
   * vuelve el selector a la sede anterior sin recargar (lo escrito sigue ahí).
   */
  private async onBranchChange(branchId: number | null): Promise<void> {
    const prev = this.loadedBranchId;
    if (branchId === prev) return;

    if (prev !== null && this.form.dirty) {
      const discard = await this.confirmModal.confirm({
        title: '¿Cambiar de sede sin publicar?',
        message:
          'Hay cambios en la configuración web de esta sede que no se han publicado. Si cambias de sede, se pierden.',
        severity: 'warn',
        confirmLabel: 'Cambiar sin publicar',
        cancelLabel: 'Quedarse',
      });
      if (!discard) {
        this.branchFacade.selectBranch(prev);
        return;
      }
    }

    this.loadedBranchId = branchId;
    if (branchId === null) return; // sin sede elegida → estado vacío, no cargar
    void this.facade.loadConfig(branchId);
    void this.coursesFacade.loadAvailableCourses(branchId);
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
        theme: branchIdToTheme(this.effectiveBranchId()),
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
        // fix-501-m: la web no tiene precio propio; el precio sale del catálogo.
        priceOverride: null,
        displayOrder: Number(c.displayOrder) || 1,
        includes: c.includes
          ? c.includes
              .split(',')
              .map((s: string) => s.trim())
              .filter(Boolean)
          : [],
      })),
      // fix-491-m: se publica lo que la sede ya tiene; antes se pisaba con textos fijos.
      whyUs: whyUsToPublish(this.facade.config()?.whyUs),
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
