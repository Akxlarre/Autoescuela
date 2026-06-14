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
  HostListener,
  untracked,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, FormArray } from '@angular/forms';
import { SectionHeroComponent } from '@shared/components/section-hero/section-hero.component';
import { KpiCardVariantComponent } from '@shared/components/kpi-card/kpi-card-variant.component';
import { WebsiteConfigFacade } from '@core/facades/website-config.facade';
import { CoursesFacade, type CourseCatalogItem } from '@core/facades/courses.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { GsapAnimationsService } from '@core/services/ui/gsap-animations.service';
import { BentoGridLayoutDirective } from '@core/directives/bento-grid-layout.directive';
import { IconComponent } from '@shared/components/icon/icon.component';
import { LUCIDE_ALL_ICONS } from '@shared/components/icon/lucide-all-icons';
import { ToastService } from '@core/services/ui/toast.service';
import type { SiteData } from '@core/models/dto/website-config.model';
import type { SectionHeroAction } from '@core/models/ui/section-hero.model';
import { CardHoverDirective } from '@core/directives/card-hover.directive';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { optimizeImage } from '@core/utils/image-optimizer';
import { MediaUploadControlComponent } from '@shared/components/media-upload-control/media-upload-control.component';
import { SelectModule } from 'primeng/select';

const TEMA_OPTIONS = [
  { value: 'azul', label: 'Azul (Sky/Indigo)' },
  { value: 'roja', label: 'Roja (Red/Orange)' },
];

type ConfigTab = 'general' | 'hero' | 'cursos' | 'promo' | 'contacto' | 'faqs';

@Component({
  selector: 'app-admin-configuracion-web',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    SelectModule,
    SectionHeroComponent,
    KpiCardVariantComponent,
    BentoGridLayoutDirective,
    IconComponent,
    CardHoverDirective,
    SkeletonBlockComponent,
    MediaUploadControlComponent,
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

            <!-- Tab 1: General -->
            @if (activeTab() === 'general') {
              <div class="flex flex-col gap-6 animate-fade-in">
                <div formGroupName="brand" class="flex flex-col gap-6">
                  <h3
                    class="text-base font-bold text-text-primary border-b pb-2 mb-2 border-border-subtle"
                  >
                    Identidad y Metadatos SEO
                  </h3>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div class="flex flex-col gap-1.5">
                      <label class="field-label">Nombre Comercial *</label>
                      <input
                        type="text"
                        formControlName="name"
                        class="field-input"
                        placeholder="Ej: Autoescuela Chillán"
                      />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <label class="field-label">Nombre Corto *</label>
                      <input
                        type="text"
                        formControlName="shortName"
                        class="field-input"
                        placeholder="Ej: Autoescuela"
                      />
                    </div>
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <label class="field-label">Eslogan Principal (SEO) *</label>
                    <input
                      type="text"
                      formControlName="slogan"
                      class="field-input"
                      placeholder="Ej: Tu licencia en Chillán, más cerca y fácil"
                    />
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div class="flex flex-col gap-1.5">
                      <label class="field-label">Dominio Web *</label>
                      <input
                        type="text"
                        formControlName="domain"
                        class="field-input"
                        placeholder="Ej: autoescuelachillan.cl"
                      />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <label class="field-label">Tema Visual</label>
                      <p-select
                        formControlName="theme"
                        [options]="temaOptions"
                        optionLabel="label"
                        optionValue="value"
                        styleClass="w-full opacity-80"
                        [disabled]="true"
                      />
                      <span class="text-xs text-text-muted mt-1"
                        >El tema visual está fijado para cada sede.</span
                      >
                    </div>
                  </div>

                  <!-- Recursos Gráficos del Sitio (Logo y SEO) -->
                  <h3
                    class="text-base font-bold text-text-primary border-b pb-2 mt-4 mb-2 border-border-subtle"
                  >
                    Recursos Gráficos del Sitio (Logo y SEO)
                  </h3>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- Tarjeta Logo -->
                    <div
                      class="p-4 rounded-xl border flex flex-col gap-4 border-border-default bg-elevated"
                    >
                      <div class="flex flex-col gap-1">
                        <span class="text-xs font-bold uppercase tracking-wider text-text-primary"
                          >Logo de la Escuela</span
                        >
                        <span class="text-[11px] text-text-muted"
                          >Se muestra en el menú y pie de página. Soporta formatos SVG, PNG y
                          WebP.</span
                        >
                      </div>

                      <app-media-upload-control
                        formControlName="logo"
                        label="Ruta o URL del Logo"
                        buttonLabel="Adjuntar Logo"
                        [isUploading]="isUploadingLogo()"
                        (fileSelected)="onLogoSelected($event)"
                      />
                    </div>

                    <!-- Tarjeta Imagen OG (SEO) -->
                    <div
                      class="p-4 rounded-xl border flex flex-col gap-4 border-border-default bg-elevated"
                    >
                      <div class="flex flex-col gap-1">
                        <span class="text-xs font-bold uppercase tracking-wider text-text-primary"
                          >Imagen Open Graph (SEO / Redes)</span
                        >
                        <span class="text-[11px] text-text-muted"
                          >Vista previa compartida en WhatsApp/Facebook. Medida ideal:
                          1200x630px.</span
                        >
                      </div>

                      <app-media-upload-control
                        formControlName="ogImage"
                        label="Ruta o URL de la Imagen"
                        buttonLabel="Adjuntar OG"
                        [isUploading]="isUploadingOgImage()"
                        (fileSelected)="onOgSelected($event)"
                      />
                    </div>

                    <!-- Tarjeta Favicon -->
                    <div
                      class="p-4 rounded-xl border flex flex-col gap-4 border-border-default bg-elevated"
                    >
                      <div class="flex flex-col gap-1">
                        <span class="text-xs font-bold uppercase tracking-wider text-text-primary"
                          >Favicon (Pestaña del Navegador)</span
                        >
                        <span class="text-[11px] text-text-muted"
                          >Icono pequeño para la pestaña del navegador. Soporta .ico, .png,
                          .svg.</span
                        >
                      </div>

                      <app-media-upload-control
                        formControlName="favicon"
                        label="Ruta o URL del Favicon"
                        buttonLabel="Adjuntar Favicon"
                        accept="image/png, image/svg+xml, image/x-icon"
                        [isUploading]="isUploadingFavicon()"
                        (fileSelected)="onFaviconSelected($event)"
                      />
                    </div>
                  </div>
                </div>

                <div formGroupName="social" class="flex flex-col gap-6">
                  <h3
                    class="text-base font-bold text-text-primary border-b pb-2 mt-4 mb-2 border-border-subtle"
                  >
                    Redes Sociales
                  </h3>
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div class="flex flex-col gap-1.5">
                      <label class="field-label">Enlace Facebook</label>
                      <input
                        type="url"
                        formControlName="facebook"
                        class="field-input"
                        placeholder="https://facebook.com/..."
                      />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <label class="field-label">Enlace Instagram</label>
                      <input
                        type="url"
                        formControlName="instagram"
                        class="field-input"
                        placeholder="https://instagram.com/..."
                      />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <label class="field-label">Enlace TikTok</label>
                      <input
                        type="url"
                        formControlName="tiktok"
                        class="field-input"
                        placeholder="https://tiktok.com/@..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            }

            <!-- Tab 2: Hero (Config Studio) -->
            @if (activeTab() === 'hero') {
              <div formGroupName="hero" class="hero-studio-container animate-fade-in">
                <!-- Cabecera de la Pestaña -->
                <div
                  class="flex items-center justify-between border-b pb-3 mb-4 flex-wrap gap-3 border-border-subtle"
                >
                  <div class="flex flex-col">
                    <h3 class="text-base font-bold text-text-primary m-0">
                      Sección Hero (Config Studio)
                    </h3>
                    <span class="text-xs text-text-muted mt-0.5"
                      >Diseña y previsualiza la cabecera principal en tiempo real.</span
                    >
                  </div>
                </div>

                <!-- Rejilla Principal de Trabajo -->
                <div class="studio-workspace">
                  <div class="studio-controls">
                    <!-- 1. Layout / Disposición -->
                    <div class="studio-card span-full">
                      <label class="field-label !mb-0">1. Disposición / Layout de Pantalla</label>
                      <span class="text-[11px] text-text-muted"
                        >Elige cómo se organizarán las columnas en pantallas grandes.</span
                      >

                      <div class="layout-selector-grid">
                        <!-- Centrado -->
                        <div
                          class="layout-selector-card"
                          [class.active]="form.get('hero.layoutType')?.value === 'center'"
                          (click)="
                            form.get('hero.layoutType')?.setValue('center'); form.markAsDirty()
                          "
                        >
                          <div class="layout-mockup-icon layout-mockup-center">
                            <div class="mock-line mock-title"></div>
                            <div class="mock-line mock-lead"></div>
                            <div class="mock-btn"></div>
                          </div>
                          <span class="layout-label">Centrado (Full screen)</span>
                        </div>

                        <!-- Dividido Izq / Media Der -->
                        <div
                          class="layout-selector-card"
                          [class.active]="form.get('hero.layoutType')?.value === 'split-right'"
                          (click)="
                            form.get('hero.layoutType')?.setValue('split-right'); form.markAsDirty()
                          "
                        >
                          <div class="layout-mockup-icon layout-mockup-split-right">
                            <div class="mock-col-text">
                              <div class="mock-line mock-title"></div>
                              <div class="mock-line mock-lead"></div>
                              <div class="mock-btn"></div>
                            </div>
                            <div class="mock-col-media">
                              <app-icon name="image" [size]="16" class="text-text-muted" />
                            </div>
                          </div>
                          <span class="layout-label">Texto Izq / Media Der</span>
                        </div>

                        <!-- Dividido Media Izq / Texto Der -->
                        <div
                          class="layout-selector-card"
                          [class.active]="form.get('hero.layoutType')?.value === 'split-left'"
                          (click)="
                            form.get('hero.layoutType')?.setValue('split-left'); form.markAsDirty()
                          "
                        >
                          <div class="layout-mockup-icon layout-mockup-split-left">
                            <div class="mock-col-media">
                              <app-icon name="image" [size]="16" class="text-text-muted" />
                            </div>
                            <div class="mock-col-text">
                              <div class="mock-line mock-title"></div>
                              <div class="mock-line mock-lead"></div>
                              <div class="mock-btn"></div>
                            </div>
                          </div>
                          <span class="layout-label">Media Izq / Texto Der</span>
                        </div>
                      </div>
                    </div>

                    <!-- 2. Fondo de la Sección (Background) -->
                    <div formGroupName="background" class="studio-card">
                      <span class="studio-card-title">2. Fondo de la Sección (Background)</span>

                      <!-- Tipo de Fondo Selector -->
                      <div class="flex flex-col gap-1.5 mt-2">
                        <label class="field-label">Tipo de Fondo</label>
                        <div class="media-type-pills">
                          <button
                            type="button"
                            class="media-pill"
                            [class.active]="form.get('hero.background.type')?.value === 'none'"
                            (click)="
                              form.get('hero.background.type')?.setValue('none'); form.markAsDirty()
                            "
                          >
                            <app-icon name="palette" [size]="13" />
                            <span>Tema (Degradado)</span>
                          </button>
                          <button
                            type="button"
                            class="media-pill"
                            [class.active]="form.get('hero.background.type')?.value === 'color'"
                            (click)="
                              form.get('hero.background.type')?.setValue('color');
                              form.markAsDirty()
                            "
                          >
                            <app-icon name="pipette" [size]="13" />
                            <span>Color Personalizado</span>
                          </button>
                          <button
                            type="button"
                            class="media-pill"
                            [class.active]="form.get('hero.background.type')?.value === 'image'"
                            (click)="
                              form.get('hero.background.type')?.setValue('image');
                              form.markAsDirty()
                            "
                          >
                            <app-icon name="image" [size]="13" />
                            <span>Imagen</span>
                          </button>
                          <button
                            type="button"
                            class="media-pill"
                            [class.active]="form.get('hero.background.type')?.value === 'video'"
                            (click)="
                              form.get('hero.background.type')?.setValue('video');
                              form.markAsDirty()
                            "
                          >
                            <app-icon name="video" [size]="13" />
                            <span>Video (MP4)</span>
                          </button>
                        </div>
                      </div>

                      @if (form.get('hero.background.type')?.value === 'color') {
                        <div class="flex flex-col gap-1.5 mt-4">
                          <label class="field-label">Color Sólido *</label>
                          <div class="flex items-center gap-3">
                            <div
                              class="relative w-12 h-10 p-1 rounded border cursor-pointer flex items-center justify-center overflow-hidden border-border-default bg-elevated"
                            >
                              <div
                                class="w-full h-full rounded-sm shadow-inner"
                                [style.background-color]="
                                  form.get('hero.background.color')?.value || '#000000'
                                "
                              ></div>
                              <input
                                type="color"
                                formControlName="color"
                                class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                title="Seleccionar color"
                              />
                            </div>
                            <input
                              type="text"
                              formControlName="color"
                              class="field-input flex-1 font-mono"
                              placeholder="#000000 o var(--color)"
                            />
                          </div>
                        </div>
                      } @else if (form.get('hero.background.type')?.value === 'none') {
                        <!-- Sin Fondo Warning -->
                        <div
                          class="p-3.5 rounded-lg border border-dashed text-center mt-3 flex flex-col items-center gap-1.5 bg-subtle border-brand-muted"
                        >
                          <app-icon name="palette" [size]="20" class="text-brand" />
                          <span class="text-xs font-semibold text-text-primary"
                            >Tema Sólido / Degradado Activo</span
                          >
                          <p class="text-[11px] text-text-muted m-0 max-w-xs">
                            Se mostrará un degradado animado acorde al tema visual (<strong>{{
                              form.get('brand.theme')?.value === 'roja'
                                ? 'Rojo profesional'
                                : 'Azul particular'
                            }}</strong
                            >).
                          </p>
                        </div>
                      }

                      @if (
                        form.get('hero.background.type')?.value === 'image' ||
                        form.get('hero.background.type')?.value === 'video'
                      ) {
                        <div class="flex flex-col gap-1.5 mt-4">
                          <label class="field-label">Recurso de Fondo *</label>
                          <app-media-upload-control
                            formControlName="url"
                            label="URL del Recurso"
                            [buttonLabel]="
                              form.get('hero.background.type')?.value === 'image'
                                ? 'Subir Imagen'
                                : 'Subir Video'
                            "
                            [buttonIcon]="
                              form.get('hero.background.type')?.value === 'image'
                                ? 'image'
                                : 'video'
                            "
                            [accept]="
                              form.get('hero.background.type')?.value === 'image'
                                ? 'image/*'
                                : 'video/mp4'
                            "
                            [previewType]="
                              form.get('hero.background.type')?.value === 'video'
                                ? 'video'
                                : 'image'
                            "
                            [isUploading]="isUploadingBackground()"
                            (fileSelected)="onBackgroundMediaSelected($event)"
                          />
                        </div>

                        <!-- Opacidad Visual Range Slider -->
                        <div class="flex flex-col gap-2 mt-4">
                          <div class="flex justify-between items-center">
                            <label class="field-label !mb-0"
                              >Opacidad de Capa Oscura:
                              <strong
                                >{{ form.get('hero.background.overlayOpacity')?.value }}%</strong
                              ></label
                            >

                            <!-- Opacity Badge dinámico según legibilidad -->
                            @let opacityVal =
                              form.get('hero.background.overlayOpacity')?.value ?? 40;
                            <span
                              class="opacity-legibility-badge"
                              [class.poor]="opacityVal < 20 || opacityVal > 80"
                              [class.medium]="
                                (opacityVal >= 20 && opacityVal < 30) ||
                                (opacityVal > 60 && opacityVal <= 80)
                              "
                              [class.optimal]="opacityVal >= 30 && opacityVal <= 60"
                            >
                              @if (opacityVal < 20) {
                                ⚠️ Texto poco legible
                              } @else if (opacityVal >= 20 && opacityVal < 30) {
                                ⚠️ Contraste bajo
                              } @else if (opacityVal >= 30 && opacityVal <= 60) {
                                ✨ Legibilidad óptima
                              } @else {
                                ⚠️ Fondo muy oscuro
                              }
                            </span>
                          </div>
                          <input
                            type="range"
                            formControlName="overlayOpacity"
                            min="0"
                            max="100"
                            class="studio-range-slider"
                          />
                        </div>
                      }
                    </div>

                    <!-- 3. Multimedia Lateral (Solo para Layout Split) -->
                    @if (form.get('hero.layoutType')?.value !== 'center') {
                      <div formGroupName="media" class="studio-card animate-fade-in">
                        <span class="studio-card-title">3. Multimedia Lateral (Media)</span>

                        <div class="flex flex-col gap-1.5 mt-2">
                          <label class="field-label">Tipo de Multimedia</label>
                          <div class="media-type-pills">
                            <button
                              type="button"
                              class="media-pill"
                              [class.active]="form.get('hero.media.type')?.value === 'none'"
                              (click)="
                                form.get('hero.media.type')?.setValue('none'); form.markAsDirty()
                              "
                            >
                              <app-icon name="x-circle" [size]="13" />
                              <span>Ninguno</span>
                            </button>
                            <button
                              type="button"
                              class="media-pill"
                              [class.active]="form.get('hero.media.type')?.value === 'image'"
                              (click)="
                                form.get('hero.media.type')?.setValue('image'); form.markAsDirty()
                              "
                            >
                              <app-icon name="image" [size]="13" />
                              <span>Imagen Lateral</span>
                            </button>
                            <button
                              type="button"
                              class="media-pill"
                              [class.active]="form.get('hero.media.type')?.value === 'video'"
                              (click)="
                                form.get('hero.media.type')?.setValue('video'); form.markAsDirty()
                              "
                            >
                              <app-icon name="video" [size]="13" />
                              <span>Video Lateral</span>
                            </button>
                          </div>
                        </div>

                        @if (form.get('hero.media.type')?.value === 'none') {
                          <div
                            class="mt-4 p-4 rounded-xl border border-dashed flex flex-col items-center justify-center text-center gap-2 border-border-default"
                            class="bg-black/[0.02]"
                          >
                            <app-icon
                              name="layout"
                              [size]="20"
                              class="text-text-muted opacity-50"
                            />
                            <span class="text-sm font-medium text-text-primary"
                              >Sin elemento lateral</span
                            >
                            <span class="text-xs text-text-muted max-w-[280px]">
                              El layout dividido mostrará una tarjeta limpia y desenfocada sin
                              contenido, dándole más protagonismo al texto.
                            </span>
                          </div>
                        } @else {
                          <div class="flex flex-col gap-1.5 mt-4">
                            <label class="field-label">Recurso Lateral *</label>

                            <!-- Micro-copy Contextual -->
                            <div
                              class="mb-2 p-3 rounded-lg flex gap-3 items-start bg-elevated border border-border-subtle"
                            >
                              @if (form.get('hero.media.type')?.value === 'image') {
                                <app-icon name="sparkles" [size]="16" class="text-brand mt-0.5" />
                                <div class="flex flex-col">
                                  <span class="text-[11px] font-semibold text-text-primary"
                                    >Efecto Auto-Glow</span
                                  >
                                  <span class="text-[11px] text-text-muted leading-tight mt-0.5"
                                    >Las imágenes con formato vertical (Portrait) generarán un
                                    desenfoque de luz ambiental automático a su alrededor.</span
                                  >
                                </div>
                              } @else {
                                <app-icon name="film" [size]="16" class="text-brand mt-0.5" />
                                <div class="flex flex-col">
                                  <span class="text-[11px] font-semibold text-text-primary"
                                    >Optimización Recomendada</span
                                  >
                                  <span class="text-[11px] text-text-muted leading-tight mt-0.5"
                                    >Sube videos en bucle menores a 5MB, idealmente sin sonido para
                                    no interrumpir al usuario. Formato MP4.</span
                                  >
                                </div>
                              }
                            </div>

                            <app-media-upload-control
                              formControlName="url"
                              label="URL del Recurso"
                              [buttonLabel]="
                                form.get('hero.media.type')?.value === 'image'
                                  ? 'Subir Imagen'
                                  : 'Subir Video'
                              "
                              [buttonIcon]="
                                form.get('hero.media.type')?.value === 'image' ? 'image' : 'video'
                              "
                              [accept]="
                                form.get('hero.media.type')?.value === 'image'
                                  ? 'image/*'
                                  : 'video/mp4'
                              "
                              [previewType]="
                                form.get('hero.media.type')?.value === 'video' ? 'video' : 'image'
                              "
                              [isUploading]="isUploadingHero()"
                              (fileSelected)="onHeroMediaSelected($event)"
                            />
                          </div>
                        }
                      </div>
                    }

                    <!-- 4. Headline y Subheadline -->
                    <div class="studio-card">
                      <div class="flex flex-col gap-1.5">
                        <label class="field-label">Título Principal (Headline) *</label>
                        <input
                          type="text"
                          formControlName="headline"
                          class="field-input"
                          placeholder="Título de alto impacto"
                        />
                      </div>

                      <div class="flex flex-col gap-1.5">
                        <label class="field-label">Subtítulo Descriptivo (Subheadline) *</label>
                        <textarea
                          formControlName="subheadline"
                          rows="3"
                          class="field-input resize-none"
                          placeholder="Propuesta de valor detallada sobre los cursos..."
                        ></textarea>
                      </div>
                    </div>

                    <!-- 4. Prueba Social -->
                    <div formGroupName="trustBadge" class="studio-card">
                      <div class="flex items-center justify-between">
                        <span class="studio-card-title !mb-0">4. Prueba Social / Trust Badge</span>
                        <!-- Switch Toggle Premium -->
                        <label class="premium-switch">
                          <input type="checkbox" formControlName="enabled" />
                          <span class="switch-slider"></span>
                        </label>
                      </div>

                      <div
                        class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 transition-all duration-300"
                        [style.opacity]="form.get('hero.trustBadge.enabled')?.value ? '1' : '0.3'"
                        [style.pointer-events]="
                          form.get('hero.trustBadge.enabled')?.value ? 'auto' : 'none'
                        "
                      >
                        <div class="flex flex-col gap-1.5">
                          <label class="field-label">Texto del Badge</label>
                          <input
                            type="text"
                            formControlName="text"
                            class="field-input"
                            placeholder="Ej: 4.9/5 en Google Reviews"
                          />
                        </div>
                        <div class="flex flex-col gap-1.5">
                          <label class="field-label">Rating (Estrellas)</label>
                          <input
                            type="number"
                            formControlName="rating"
                            class="field-input"
                            min="1"
                            max="5"
                            step="0.1"
                          />
                        </div>
                      </div>
                    </div>

                    <!-- 5. CTA -->
                    <div formGroupName="cta" class="studio-card">
                      <span class="studio-card-title">5. Llamado a la Acción (CTA de Ventas)</span>
                      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        <div class="flex flex-col gap-1.5">
                          <label class="field-label">Texto del Botón CTA *</label>
                          <input
                            type="text"
                            formControlName="text"
                            class="field-input"
                            placeholder="Ej: Consultar Cursos por WhatsApp"
                          />
                        </div>
                        <div class="flex flex-col gap-1.5">
                          <label class="field-label">WhatsApp (Nº con código país) *</label>
                          <input
                            type="text"
                            formControlName="whatsapp"
                            class="field-input"
                            placeholder="Ej: 56912345678"
                          />
                        </div>
                      </div>
                    </div>

                    <!-- 6. Pilares / Características -->
                    <div class="studio-card span-full">
                      <span class="studio-card-title">6. Pilares Destacados (Máximo 3)</span>

                      <div formArrayName="features" class="flex flex-col gap-3.5 mt-2">
                        @for (featGroup of heroFeatures.controls; track $index) {
                          <div
                            [formGroupName]="$index"
                            class="grid grid-cols-1 md:grid-cols-12 gap-3 p-3 rounded-xl border border-solid border-border-subtle bg-subtle"
                          >
                            <div class="md:col-span-3 flex flex-col gap-1 icon-dropdown-container">
                              <label
                                class="text-[10px] font-bold uppercase tracking-wider text-text-muted"
                                >Icono</label
                              >
                              <div class="relative">
                                <button
                                  type="button"
                                  class="field-input py-1.5 px-2.5 w-full flex items-center justify-between bg-surface cursor-pointer h-[34px]"
                                  (click)="toggleIconDropdown($index, $event)"
                                >
                                  <div class="flex items-center gap-2">
                                    @if (featGroup.get('icon')?.value) {
                                      <app-icon
                                        [name]="featGroup.get('icon')?.value"
                                        [size]="16"
                                        class="text-brand"
                                      />
                                    } @else {
                                      <span class="text-[11px] text-text-muted">Opcional</span>
                                    }
                                  </div>
                                  <app-icon
                                    name="chevron-down"
                                    [size]="14"
                                    class="text-text-muted"
                                  />
                                </button>

                                @if (showIconDropdown[$index]) {
                                  <div
                                    class="absolute left-0 w-64 bg-surface border rounded-lg shadow-xl p-2.5 z-50 flex flex-col gap-1.5"
                                    [class.top-full]="$index === 0"
                                    [class.mt-1]="$index === 0"
                                    [class.bottom-full]="$index > 0"
                                    [class.mb-1]="$index > 0"
                                    class="border-border-subtle"
                                    (click)="$event.stopPropagation()"
                                  >
                                    <!-- Buscador de icono -->
                                    <div class="relative w-full">
                                      <input
                                        type="text"
                                        placeholder="Buscar icono..."
                                        class="field-input py-1 px-2.5 text-xs w-full pr-7 h-[30px]"
                                        [value]="iconSearchQuery()"
                                        (input)="onIconSearch($event)"
                                        (click)="$event.stopPropagation()"
                                        autofocus
                                      />
                                      @if (iconSearchQuery()) {
                                        <button
                                          type="button"
                                          class="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary cursor-pointer border-none bg-transparent"
                                          (click)="clearIconSearch($event)"
                                        >
                                          <app-icon name="x" [size]="10" />
                                        </button>
                                      }
                                    </div>

                                    <!-- Categorías Wrap -->
                                    <div class="flex flex-wrap gap-1 mb-1 mt-0.5 w-full">
                                      @for (cat of iconCategories; track cat.id) {
                                        <button
                                          type="button"
                                          class="category-pill flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide transition-all cursor-pointer border-none"
                                          [style.background]="
                                            selectedCategory() === cat.id
                                              ? 'var(--color-primary-muted, rgba(14, 165, 233, 0.12))'
                                              : 'var(--bg-subtle)'
                                          "
                                          [style.color]="
                                            selectedCategory() === cat.id
                                              ? 'var(--color-primary)'
                                              : 'var(--text-muted)'
                                          "
                                          (click)="selectCategory(cat.id)"
                                        >
                                          <app-icon [name]="cat.icon" [size]="9" />
                                          <span>{{ cat.label }}</span>
                                        </button>
                                      }
                                    </div>

                                    <!-- Rejilla de iconos compacta -->
                                    <div
                                      class="grid grid-cols-6 gap-1 max-h-32 overflow-y-auto pr-1"
                                    >
                                      <button
                                        type="button"
                                        class="col-span-6 flex items-center justify-center gap-1 py-1 rounded hover:bg-muted text-[9px] text-text-muted transition-colors cursor-pointer border-none"
                                        (click)="
                                          featGroup.get('icon')?.setValue('');
                                          showIconDropdown[$index] = false
                                        "
                                      >
                                        <app-icon name="x" [size]="10" />
                                        <span>Ocultar Icono</span>
                                      </button>

                                      @for (iconName of renderedIcons(); track iconName) {
                                        <button
                                          type="button"
                                          class="flex flex-col items-center justify-center p-1 rounded hover:bg-brand-muted hover:text-brand transition-colors border border-transparent hover:border-brand/20 cursor-pointer h-7"
                                          [title]="iconName"
                                          (click)="
                                            featGroup.get('icon')?.setValue(iconName);
                                            showIconDropdown[$index] = false
                                          "
                                        >
                                          <app-icon [name]="iconName" [size]="14" />
                                        </button>
                                      }
                                    </div>
                                  </div>
                                }
                              </div>
                            </div>

                            <div class="md:col-span-9 flex flex-col gap-1">
                              <label
                                class="text-[10px] font-bold uppercase tracking-wider text-text-muted"
                                >Texto Descriptivo Pilar {{ $index + 1 }}</label
                              >
                              <input
                                type="text"
                                formControlName="text"
                                class="field-input py-1.5 text-xs h-[34px]"
                                placeholder="Ej: Flota Moderna de Vehículos"
                              />
                            </div>
                          </div>
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            }

            <!-- Tab 3: Cursos -->
            @if (activeTab() === 'cursos') {
              <div class="flex flex-col gap-6 animate-fade-in">
                <div
                  class="flex items-center justify-between border-b pb-2 mb-2 border-border-subtle"
                >
                  <h3 class="text-base font-bold text-text-primary">
                    Gestión de Cursos y Licencias
                  </h3>
                  @if (coursesFacade.availableCourses().length > 0) {
                    <button
                      type="button"
                      class="btn-primary py-1.5 px-3 text-xs cursor-pointer flex items-center gap-1"
                      (click)="addCourse()"
                      data-llm-action="add-website-course"
                    >
                      <app-icon name="plus" [size]="14" />
                      <span>Agregar Curso</span>
                    </button>
                  }
                </div>

                <!-- AC-E4: empty state when branch has no operational courses -->
                @if (coursesFacade.isLoading()) {
                  <div class="flex flex-col gap-3">
                    <app-skeleton-block variant="rect" width="100%" height="80px" />
                    <app-skeleton-block variant="rect" width="100%" height="80px" />
                  </div>
                } @else if (coursesFacade.availableCourses().length === 0) {
                  <div
                    class="p-8 text-center border rounded-xl border-dashed flex flex-col items-center gap-3 border-warning bg-warning/5"
                  >
                    <app-icon name="alert-triangle" [size]="28" />
                    <p class="text-text-primary text-sm font-semibold">
                      Este branch no tiene cursos operacionales activos
                    </p>
                    <p class="text-text-muted text-xs max-w-sm">
                      Primero creá cursos en el Catálogo Operacional antes de configurar las cards
                      de la landing.
                    </p>
                  </div>
                } @else {
                  <div formArrayName="courses" class="flex flex-col gap-6">
                    @if (coursesArray.length === 0) {
                      <div
                        class="p-8 text-center border rounded-xl border-dashed border-border-subtle bg-elevated"
                      >
                        <p class="text-text-muted text-sm">
                          No hay cards de cursos. Hacé clic en "Agregar Curso" para crear una.
                        </p>
                      </div>
                    }

                    @for (courseGroup of coursesArray.controls; track $index) {
                      @let courseId = courseGroup.get('course_id')?.value;
                      @let catalogItem = getCatalogItem(courseId);
                      @let isOrphan = courseId != null && catalogItem == null;
                      @let isInactive = catalogItem != null && !catalogItem.active;
                      <div
                        [formGroupName]="$index"
                        class="p-4 md:p-5 rounded-xl border flex flex-col gap-4 transition-all"
                        [style.border-color]="
                          isOrphan
                            ? 'var(--state-danger)'
                            : isInactive
                              ? 'var(--state-warning)'
                              : 'var(--border-default)'
                        "
                        class="bg-elevated"
                      >
                        <!-- Card header -->
                        <div
                          class="flex items-center justify-between border-b pb-2 mb-1 border-border-subtle"
                        >
                          <span class="text-sm font-bold text-text-primary">
                            Card #{{ $index + 1 }}:
                            {{
                              catalogItem?.name ??
                                (courseId ? '(curso no disponible)' : 'Sin curso seleccionado')
                            }}
                          </span>
                          <div class="flex items-center gap-2">
                            @if (isOrphan) {
                              <span
                                class="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 text-error bg-error/12"
                              >
                                <app-icon name="x-circle" [size]="11" />
                                Curso no existe
                              </span>
                            } @else if (isInactive) {
                              <span
                                class="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 text-warning bg-warning/12"
                              >
                                <app-icon name="alert-triangle" [size]="11" />
                                Curso inactivo — no visible en web
                              </span>
                            }
                            <button
                              type="button"
                              class="btn-ghost py-1 px-2 text-xs flex items-center gap-1 rounded cursor-pointer text-error"
                              (click)="removeCourse($index)"
                            >
                              <app-icon name="trash-2" [size]="13" />
                              <span>Eliminar</span>
                            </button>
                          </div>
                        </div>

                        <!-- Fila 1: Dropdown de curso + datos heredados readonly + displayOrder -->
                        <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
                          <div class="md:col-span-6 flex flex-col gap-1.5">
                            <label class="field-label">Curso del Catálogo Operacional *</label>
                            <p-select
                              formControlName="course_id"
                              [options]="courseOptions()"
                              optionLabel="label"
                              optionValue="id"
                              styleClass="w-full"
                              placeholder="— Seleccionar curso —"
                              data-llm-action="select-website-course"
                              data-llm-description="dropdown to link a course card to an operational course from the catalog"
                            />
                          </div>
                          <div class="md:col-span-3 flex flex-col gap-1.5">
                            <label class="field-label">Precio Base (heredado)</label>
                            <div
                              class="field-input flex items-center text-text-muted text-xs bg-base cursor-default"
                            >
                              {{ catalogItem ? formatCLP(catalogItem.base_price) : '—' }}
                            </div>
                          </div>
                          <div class="md:col-span-3 flex flex-col gap-1.5">
                            <label class="field-label">Orden de visualización</label>
                            <input
                              type="number"
                              formControlName="displayOrder"
                              class="field-input"
                              min="1"
                              data-llm-description="display order for this course card on the landing page"
                            />
                          </div>
                        </div>

                        <!-- Fila 2: Override de precio -->
                        <div
                          class="flex flex-col gap-2 p-3 rounded-lg border border-dashed border-border-subtle"
                        >
                          <label class="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              class="accent-[var(--color-primary)] w-4 h-4"
                              [checked]="courseGroup.get('priceOverride')?.value != null"
                              (change)="
                                courseGroup
                                  .get('priceOverride')
                                  ?.setValue($any($event.target).checked ? 0 : null)
                              "
                            />
                            <span class="text-xs font-semibold text-text-primary"
                              >Personalizar precio para promo</span
                            >
                            @if (courseGroup.get('priceOverride')?.value != null) {
                              <span
                                class="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 text-brand bg-brand/12"
                              >
                                <app-icon name="tag" [size]="10" />
                                Override activo
                              </span>
                            }
                          </label>
                          @if (courseGroup.get('priceOverride')?.value != null) {
                            <div class="flex flex-col gap-1.5 mt-1">
                              <label class="field-label"
                                >Precio Override (CLP) — 0 = "Gratis"</label
                              >
                              <div class="input-prefix-wrapper">
                                <span class="input-prefix">$</span>
                                <input
                                  type="number"
                                  formControlName="priceOverride"
                                  class="field-input pl-8"
                                  placeholder="320000"
                                  min="0"
                                  data-llm-description="override price for promotional purposes; 0 means free"
                                />
                              </div>
                              @if (catalogItem) {
                                <span class="text-xs text-text-muted">
                                  {{
                                    getOverridePreview(
                                      courseGroup.get('priceOverride')?.value,
                                      catalogItem.base_price ?? 0
                                    )
                                  }}
                                </span>
                              }
                            </div>
                          }
                        </div>

                        <!-- Fila 3: Campos editoriales -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div class="flex flex-col gap-1.5">
                            <label class="field-label">Duración del Curso *</label>
                            <input
                              type="text"
                              formControlName="duration"
                              class="field-input"
                              placeholder="Ej: 4 a 6 semanas"
                              data-llm-description="human-readable course duration displayed on the landing card"
                            />
                          </div>
                          <div class="flex flex-col gap-1.5">
                            <label class="field-label">Nota de Pago</label>
                            <input
                              type="text"
                              formControlName="priceNote"
                              class="field-input"
                              placeholder="Ej: Matrícula costo cero"
                              data-llm-description="optional payment note shown below the price on the landing card"
                            />
                          </div>
                        </div>

                        <div class="flex flex-col gap-1.5">
                          <label class="field-label">Breve Descripción *</label>
                          <textarea
                            formControlName="description"
                            rows="2"
                            class="field-input resize-none"
                            placeholder="Descripción resumida del curso"
                            data-llm-description="editorial course description displayed on the landing card"
                          ></textarea>
                        </div>

                        <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
                          <div class="md:col-span-4 flex flex-col gap-3 justify-center">
                            <label class="flex items-center gap-2 cursor-pointer py-1">
                              <input
                                type="checkbox"
                                formControlName="highlighted"
                                class="accent-[var(--color-primary)] w-4 h-4"
                              />
                              <span class="text-xs font-semibold text-text-primary"
                                >Destacar Curso en Web</span
                              >
                            </label>
                          </div>
                          <div class="md:col-span-8 flex flex-col gap-1.5">
                            <label class="field-label">Badge Destacado (ej: '¡Más Popular!')</label>
                            <input
                              type="text"
                              formControlName="badge"
                              class="field-input"
                              placeholder="Opcional"
                              [attr.disabled]="courseGroup.get('highlighted')?.value ? null : true"
                              data-llm-description="badge text shown on highlighted course cards"
                            />
                          </div>
                        </div>

                        <div class="flex flex-col gap-1.5">
                          <label class="field-label"
                            >¿Qué incluye el curso? (Lista separada por comas) *</label
                          >
                          <textarea
                            formControlName="includes"
                            rows="2"
                            class="field-input resize-none"
                            placeholder="Ej: Doble comando homologado, Cursos prácticos garantizados, Material de estudio digital"
                            data-llm-description="comma-separated list of course inclusions shown as checkmarks on landing"
                          ></textarea>
                          <span class="text-xs text-text-muted">
                            Ingrese cada beneficio separado por una coma (,). Esto dibujará
                            checkmarks en la landing.
                          </span>
                        </div>
                      </div>
                    }
                  </div>
                }

                <div formGroupName="pricingFooter" class="flex flex-col gap-6">
                  <h3
                    class="text-base font-bold text-text-primary border-b pb-2 mt-6 mb-2 border-border-subtle"
                  >
                    Términos de Pago y Garantía (Precios)
                  </h3>
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <!-- Pago Directo Group -->
                    <div
                      formGroupName="payment"
                      class="flex flex-col gap-4 p-4 rounded-xl border border-border-default bg-elevated"
                    >
                      <span class="text-xs font-bold uppercase tracking-wider text-text-primary"
                        >Facilidades de Pago</span
                      >
                      <div class="flex flex-col gap-1.5">
                        <label class="field-label">Título *</label>
                        <input
                          type="text"
                          formControlName="title"
                          class="field-input"
                          placeholder="Facilidades de Pago Directo"
                        />
                        @if (
                          form.get('pricingFooter.payment.title')?.touched &&
                          form.get('pricingFooter.payment.title')?.invalid
                        ) {
                          <span class="text-xs mt-1 text-error">
                            @if (form.get('pricingFooter.payment.title')?.errors?.['required']) {
                              El título es requerido.
                            }
                            @if (form.get('pricingFooter.payment.title')?.errors?.['maxlength']) {
                              Máximo 100 caracteres.
                            }
                          </span>
                        }
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <label class="field-label">Descripción *</label>
                        <textarea
                          formControlName="description"
                          class="field-input min-h-[60px] resize-y"
                          placeholder="Puedes reservar tu cupo con un pie inicial..."
                        ></textarea>
                        @if (
                          form.get('pricingFooter.payment.description')?.touched &&
                          form.get('pricingFooter.payment.description')?.invalid
                        ) {
                          <span class="text-xs mt-1 text-error">
                            @if (
                              form.get('pricingFooter.payment.description')?.errors?.['required']
                            ) {
                              La descripción es requerida.
                            }
                            @if (
                              form.get('pricingFooter.payment.description')?.errors?.['maxlength']
                            ) {
                              Máximo 300 caracteres.
                            }
                          </span>
                        }
                      </div>
                    </div>
                    <!-- Garantía Group -->
                    <div
                      formGroupName="guarantee"
                      class="flex flex-col gap-4 p-4 rounded-xl border border-border-default bg-elevated"
                    >
                      <span class="text-xs font-bold uppercase tracking-wider text-text-primary"
                        >Garantía de Aprendizaje</span
                      >
                      <div class="flex flex-col gap-1.5">
                        <label class="field-label">Título *</label>
                        <input
                          type="text"
                          formControlName="title"
                          class="field-input"
                          placeholder="Garantía de Aprendizaje"
                        />
                        @if (
                          form.get('pricingFooter.guarantee.title')?.touched &&
                          form.get('pricingFooter.guarantee.title')?.invalid
                        ) {
                          <span class="text-xs mt-1 text-error">
                            @if (form.get('pricingFooter.guarantee.title')?.errors?.['required']) {
                              El título es requerido.
                            }
                            @if (form.get('pricingFooter.guarantee.title')?.errors?.['maxlength']) {
                              Máximo 100 caracteres.
                            }
                          </span>
                        }
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <label class="field-label">Descripción *</label>
                        <textarea
                          formControlName="description"
                          class="field-input min-h-[60px] resize-y"
                          placeholder="Todo el material teórico e instructores certificados..."
                        ></textarea>
                        @if (
                          form.get('pricingFooter.guarantee.description')?.touched &&
                          form.get('pricingFooter.guarantee.description')?.invalid
                        ) {
                          <span class="text-xs mt-1 text-error">
                            @if (
                              form.get('pricingFooter.guarantee.description')?.errors?.['required']
                            ) {
                              La descripción es requerida.
                            }
                            @if (
                              form.get('pricingFooter.guarantee.description')?.errors?.['maxlength']
                            ) {
                              Máximo 300 caracteres.
                            }
                          </span>
                        }
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            }

            <!-- Tab 4: Promociones -->
            @if (activeTab() === 'promo') {
              <div formGroupName="promo" class="flex flex-col gap-6 animate-fade-in">
                <div
                  class="flex items-center justify-between border-b pb-2 mb-2 border-border-subtle"
                >
                  <h3 class="text-base font-bold text-text-primary">
                    Campaña y Banner Promocional Global
                  </h3>
                  <label
                    class="flex items-center gap-2 cursor-pointer bg-base py-1.5 px-3 rounded-lg border border-border-subtle"
                  >
                    <input
                      type="checkbox"
                      formControlName="active"
                      class="accent-[var(--color-primary)] w-4 h-4"
                    />
                    <span class="text-xs font-bold uppercase tracking-wider text-text-primary"
                      >Activar Banner Promo</span
                    >
                  </label>
                </div>

                @if (form.get('promo.active')?.value) {
                  <div
                    class="grid grid-cols-1 md:grid-cols-3 gap-5 p-4 rounded-xl border border-solid border-success bg-success/4"
                  >
                    <div class="md:col-span-2 flex flex-col gap-1.5">
                      <label class="field-label">Título de la Oferta / Promoción *</label>
                      <input
                        type="text"
                        formControlName="title"
                        class="field-input"
                        placeholder="Ej: 15% Descuento Matriculándote en Parejas"
                      />
                    </div>
                    <div class="md:col-span-1 flex flex-col gap-1.5">
                      <label class="field-label">Etiqueta Oferta (Badge) *</label>
                      <input
                        type="text"
                        formControlName="badge"
                        class="field-input"
                        placeholder="Ej: 🔥 Oferta Otoño"
                      />
                    </div>
                    <div class="md:col-span-3 flex flex-col gap-1.5">
                      <label class="field-label">Detalle / Subtexto de la Oferta *</label>
                      <textarea
                        formControlName="description"
                        rows="3"
                        class="field-input resize-none"
                        placeholder="Detalla los términos o limitaciones de la oferta."
                      ></textarea>
                    </div>
                  </div>
                } @else {
                  <div
                    class="p-8 text-center border rounded-xl border-dashed animate-fade-in border-border-subtle bg-elevated"
                  >
                    <app-icon name="ban" [size]="32" class="text-text-muted mx-auto mb-2" />
                    <h4 class="text-sm font-bold text-text-secondary">
                      El Banner Promocional está Apagado
                    </h4>
                    <p class="text-xs text-text-muted max-w-md mx-auto mt-1">
                      Ninguna promoción o cinta superior de urgencia será renderizada en la landing
                      page. Enciende el interruptor arriba para crear una campaña.
                    </p>
                  </div>
                }
              </div>
            }

            <!-- Tab 5: Contacto -->
            @if (activeTab() === 'contacto') {
              <div class="flex flex-col gap-6 animate-fade-in">
                <h3
                  class="text-base font-bold text-text-primary border-b pb-2 mb-2 border-border-subtle"
                >
                  Datos de Sucursal y Geolocalización SEO
                </h3>

                <div formGroupName="contact" class="flex flex-col gap-5">
                  <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div class="md:col-span-2 flex flex-col gap-1.5">
                      <label class="field-label">Dirección Física de la Escuela *</label>
                      <input
                        type="text"
                        formControlName="address"
                        class="field-input"
                        placeholder="Ej: Calle Arturo Prat 123"
                      />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <label class="field-label">Ciudad *</label>
                      <input
                        type="text"
                        formControlName="city"
                        class="field-input"
                        placeholder="Chillán"
                      />
                    </div>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div class="flex flex-col gap-1.5">
                      <label class="field-label"
                        >WhatsApp de Soporte/Matrículas (Código país + número) *</label
                      >
                      <input
                        type="text"
                        formControlName="whatsapp"
                        class="field-input"
                        placeholder="Ej: 56912345678"
                      />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <label class="field-label">Teléfono de Llamadas Fijo/Móvil *</label>
                      <input
                        type="text"
                        formControlName="phone"
                        class="field-input"
                        placeholder="Ej: +56 42 222 3344"
                      />
                    </div>
                  </div>

                  <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div class="flex flex-col gap-1.5">
                      <label class="field-label">Correo Electrónico de Contacto *</label>
                      <input
                        type="email"
                        formControlName="email"
                        class="field-input"
                        placeholder="ejemplo@autoescuela.cl"
                      />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <label class="field-label">Región *</label>
                      <input
                        type="text"
                        formControlName="region"
                        class="field-input"
                        placeholder="Ñuble"
                      />
                    </div>
                  </div>

                  <div class="flex flex-col gap-1.5">
                    <label class="field-label">URL de Embed Google Maps *</label>
                    <textarea
                      formControlName="mapEmbedUrl"
                      rows="2"
                      class="field-input"
                      placeholder="Pegue la URL provista en el iframe src de Google Maps Compartir"
                    ></textarea>
                  </div>

                  <h4 class="text-xs font-bold uppercase tracking-wider text-text-secondary mt-2">
                    Coordenadas de Ubicación (Google Schema.org SEO)
                  </h4>
                  <div formGroupName="geo" class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div class="flex flex-col gap-1.5">
                      <label class="field-label">Latitud *</label>
                      <input
                        type="number"
                        step="any"
                        formControlName="lat"
                        class="field-input"
                        placeholder="-36.606709"
                      />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <label class="field-label">Longitud *</label>
                      <input
                        type="number"
                        step="any"
                        formControlName="lng"
                        class="field-input"
                        placeholder="-72.105436"
                      />
                    </div>
                  </div>
                </div>

                <div
                  class="flex items-center justify-between border-b pb-2 mt-4 mb-2 border-border-subtle"
                >
                  <h3 class="text-base font-bold text-text-primary">Horarios de Atención</h3>
                  <button
                    type="button"
                    class="btn-primary py-1.5 px-3 text-xs cursor-pointer flex items-center gap-1"
                    (click)="addHour()"
                  >
                    <app-icon name="plus" [size]="14" />
                    <span>Agregar Horario</span>
                  </button>
                </div>

                <div formArrayName="hours" class="flex flex-col gap-4">
                  @if (hoursArray.length === 0) {
                    <div
                      class="p-8 text-center border rounded-xl border-dashed border-border-subtle bg-elevated"
                    >
                      <p class="text-text-muted text-sm">
                        No hay horarios configurados. Haz clic en "Agregar Horario" para crear uno.
                      </p>
                    </div>
                  }

                  @for (hourGroup of hoursArray.controls; track $index) {
                    <div
                      [formGroupName]="$index"
                      class="p-4 rounded-xl border flex flex-col gap-3 border-border-default bg-elevated"
                    >
                      <div
                        class="flex items-center justify-between border-b pb-1 mb-1 border-border-subtle"
                      >
                        <span class="text-xs font-bold text-text-secondary"
                          >Bloque #{{ $index + 1 }}</span
                        >
                        <button
                          type="button"
                          class="btn-ghost py-1 px-2 text-xs flex items-center gap-1 rounded cursor-pointer text-error"
                          (click)="removeHour($index)"
                        >
                          <app-icon name="trash-2" [size]="13" />
                          <span>Eliminar</span>
                        </button>
                      </div>

                      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div class="flex flex-col gap-1.5">
                          <label class="field-label">Días de Atención *</label>
                          <input
                            type="text"
                            formControlName="days"
                            class="field-input"
                            placeholder="Ej: Lunes a Viernes"
                          />
                          @if (hourGroup.get('days')?.touched && hourGroup.get('days')?.invalid) {
                            <span class="text-xs mt-1 text-error"
                              >Los días de atención son requeridos.</span
                            >
                          }
                        </div>
                        <div class="flex flex-col gap-1.5">
                          <label class="field-label">Rango de Horas *</label>
                          <input
                            type="text"
                            formControlName="time"
                            class="field-input"
                            placeholder="Ej: 09:00 - 18:30"
                          />
                          @if (hourGroup.get('time')?.touched && hourGroup.get('time')?.invalid) {
                            <span class="text-xs mt-1 text-error"
                              >El rango de horas es requerido.</span
                            >
                          }
                        </div>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Tab 6: FAQs -->
            @if (activeTab() === 'faqs') {
              <div class="flex flex-col gap-6 animate-fade-in">
                <div
                  class="flex items-center justify-between border-b pb-2 mb-2 border-border-subtle"
                >
                  <h3 class="text-base font-bold text-text-primary">
                    Preguntas Frecuentes (SEO FAQPage)
                  </h3>
                  <button
                    type="button"
                    class="btn-primary py-1.5 px-3 text-xs cursor-pointer flex items-center gap-1"
                    (click)="addFaq()"
                  >
                    <app-icon name="plus" [size]="14" />
                    <span>Agregar Pregunta</span>
                  </button>
                </div>

                <div formArrayName="faqs" class="flex flex-col gap-4">
                  @if (faqsArray.length === 0) {
                    <div
                      class="p-8 text-center border rounded-xl border-dashed border-border-subtle bg-elevated"
                    >
                      <p class="text-text-muted text-sm">
                        No hay preguntas configuradas. Haz clic en "Agregar Pregunta" para crear
                        una.
                      </p>
                    </div>
                  }

                  @for (faqGroup of faqsArray.controls; track $index) {
                    <div
                      [formGroupName]="$index"
                      class="p-4 rounded-xl border flex flex-col gap-3 border-border-default bg-elevated"
                    >
                      <div
                        class="flex items-center justify-between border-b pb-1 mb-1 border-border-subtle"
                      >
                        <span class="text-xs font-bold text-text-secondary"
                          >Pregunta #{{ $index + 1 }}</span
                        >
                        <button
                          type="button"
                          class="btn-ghost py-1 px-2 text-xs flex items-center gap-1 rounded cursor-pointer text-error"
                          (click)="removeFaq($index)"
                        >
                          <app-icon name="trash-2" [size]="13" />
                          <span>Eliminar</span>
                        </button>
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <label class="field-label">Pregunta *</label>
                        <input
                          type="text"
                          formControlName="question"
                          class="field-input"
                          placeholder="Ej: ¿Cuáles son los requisitos mínimos para inscribirse?"
                        />
                      </div>
                      <div class="flex flex-col gap-1.5">
                        <label class="field-label">Respuesta *</label>
                        <textarea
                          formControlName="answer"
                          rows="3"
                          class="field-input resize-none"
                          placeholder="Respuesta completa y explicativa."
                        ></textarea>
                      </div>
                    </div>
                  }
                </div>
              </div>
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

      /* === HERO CONFIG STUDIO === */
      .hero-studio-container {
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        width: 100%;
      }

      .mobile-tabs-switcher {
        display: none;
      }

      .studio-workspace {
        display: flex;
        flex-direction: column;
        gap: 2rem;
      }

      .studio-controls {
        display: grid;
        grid-template-columns: 1fr;
        gap: 1.5rem;
      }

      @media (min-width: 768px) {
        .studio-controls {
          grid-template-columns: repeat(2, 1fr);
        }
      }

      @media (min-width: 1200px) {
        .studio-controls {
          grid-template-columns: repeat(3, 1fr);
        }
      }

      .studio-card.span-full {
        grid-column: 1 / -1;
      }

      @media (min-width: 768px) {
        .studio-card.span-2 {
          grid-column: span 2;
        }
      }

      .studio-preview-canvas {
        display: block;
      }

      .preview-canvas-sticky-wrapper {
        position: sticky;
        top: 2rem;
        z-index: 10;
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
      }

      .studio-card {
        padding: 1.25rem;
        border-radius: 16px;
        border: 1px solid var(--border-subtle);
        background: var(--bg-elevated);
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .studio-card-title {
        font-size: 0.875rem;
        font-weight: 700;
        color: var(--text-primary);
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }

      /* Layout Selector cards */
      .layout-selector-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.75rem;
        width: 100%;
      }

      .layout-selector-card {
        border: 1.5px solid var(--border-subtle);
        background: var(--bg-surface);
        border-radius: 12px;
        padding: 0.75rem;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        user-select: none;
      }

      .layout-selector-card:hover {
        border-color: var(--color-primary-muted, var(--ds-brand));
        background: var(--bg-subtle);
        transform: translateY(-1px);
      }

      .layout-selector-card.active {
        border-color: var(--ds-brand);
        box-shadow:
          0 0 0 1px var(--ds-brand),
          var(--shadow-sm);
        background: color-mix(in srgb, var(--ds-brand) 5%, var(--bg-surface));
      }

      .layout-selector-card.active .layout-label {
        color: var(--ds-brand);
        font-weight: 700;
      }

      .layout-mockup-icon {
        width: 100%;
        height: 60px;
        background: var(--bg-subtle);
        border-radius: 6px;
        border: 1px solid var(--border-subtle);
        padding: 6px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        gap: 4px;
        position: relative;
        overflow: hidden;
      }

      .layout-mockup-center {
        align-items: center;
      }

      .layout-mockup-split-right {
        flex-direction: row;
        align-items: center;
        gap: 6px;
      }

      .layout-mockup-split-left {
        flex-direction: row;
        align-items: center;
        gap: 6px;
      }

      .mock-col-text {
        flex: 1.2;
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
      }

      .mock-col-media {
        flex: 1;
        height: 100%;
        background: var(--bg-elevated);
        border: 1px dashed var(--border-subtle);
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .mock-line {
        height: 4px;
        background: var(--text-muted);
        border-radius: 2px;
        opacity: 0.3;
      }

      .layout-mockup-icon .mock-title {
        width: 70%;
        height: 6px;
        opacity: 0.6;
      }

      .layout-mockup-center .mock-title {
        width: 60%;
      }

      .layout-mockup-icon .mock-lead {
        width: 90%;
        opacity: 0.3;
      }

      .layout-mockup-icon.layout-mockup-center .mock-lead {
        width: 80%;
      }

      .layout-mockup-icon .mock-btn {
        width: 30%;
        height: 6px;
        background: var(--ds-brand);
        border-radius: 2px;
        opacity: 0.8;
      }

      .layout-label {
        font-size: 10px;
        font-weight: 600;
        color: var(--text-secondary);
        text-align: center;
      }

      /* Media pills selectors */
      .media-type-pills {
        display: flex;
        background: var(--bg-subtle);
        border-radius: 10px;
        padding: 3px;
        border: 1px solid var(--border-subtle);
        width: 100%;
      }

      .media-pill {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 0.375rem;
        padding: 0.5rem 0.25rem;
        font-size: 11px;
        font-weight: 600;
        border-radius: 8px;
        background: transparent;
        color: var(--text-muted);
        border: none;
        cursor: pointer;
        transition: all 0.15s ease;
      }

      .media-pill:hover {
        color: var(--text-primary);
      }

      .media-pill.active {
        background: var(--bg-surface);
        color: var(--color-primary);
        box-shadow: var(--shadow-sm);
      }

      /* Dropzone Upload */
      .media-dropzone {
        border: 2px dashed var(--border-subtle);
        border-radius: 12px;
        background: var(--bg-subtle);
        padding: 1.5rem;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
        gap: 0.5rem;
        transition: all 0.25s ease;
      }

      .media-dropzone:hover {
        border-color: var(--color-primary);
        background: color-mix(in srgb, var(--color-primary) 2%, var(--bg-subtle));
      }

      .media-dropzone.uploading {
        cursor: not-allowed;
        border-color: var(--ds-brand);
      }

      .dropzone-text {
        font-size: 11px;
        font-weight: 700;
        color: var(--text-primary);
      }

      .dropzone-text.uploading {
        color: var(--ds-brand);
        animation: pulse 1.5s infinite;
      }

      .dropzone-subtext {
        font-size: 9px;
        color: var(--text-muted);
      }

      /* Range Slider */
      .studio-range-slider {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 6px;
        border-radius: 3px;
        background: var(--border-subtle);
        outline: none;
        margin: 0.5rem 0;
      }

      .studio-range-slider::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--ds-brand);
        cursor: pointer;
        border: 2px solid var(--bg-surface);
        box-shadow: var(--shadow-sm);
        transition: transform 0.1s ease;
      }

      .studio-range-slider::-webkit-slider-thumb:hover {
        transform: scale(1.15);
      }

      .opacity-legibility-badge {
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        padding: 2px 6px;
        border-radius: 4px;
      }

      .opacity-legibility-badge.optimal {
        background: color-mix(in srgb, var(--state-success) 12%, transparent);
        color: var(--state-success);
      }

      .opacity-legibility-badge.medium {
        background: color-mix(in srgb, var(--state-warning) 12%, transparent);
        color: var(--state-warning);
      }

      .opacity-legibility-badge.poor {
        background: color-mix(in srgb, var(--state-danger) 12%, transparent);
        color: var(--state-danger);
      }

      /* Premium Switch */
      .premium-switch {
        position: relative;
        display: inline-block;
        width: 36px;
        height: 20px;
      }

      .premium-switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }

      .switch-slider {
        position: absolute;
        cursor: pointer;
        inset: 0;
        background-color: var(--border-subtle);
        transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border-radius: 34px;
      }

      .switch-slider:before {
        position: absolute;
        content: '';
        height: 14px;
        width: 14px;
        left: 3px;
        bottom: 3px;
        background-color: var(--bg-surface);
        transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border-radius: 50%;
        box-shadow: var(--shadow-xs);
      }

      input:checked + .switch-slider {
        background-color: var(--ds-brand);
      }

      input:checked + .switch-slider:before {
        transform: translateX(16px);
      }

      /* Micro size adjustments for extra small screen widths */
      @media (max-width: 480px) {
        .layout-selector-grid {
          grid-template-columns: 1fr;
          gap: 0.5rem;
        }

        .layout-selector-card {
          flex-direction: row;
          align-items: center;
          padding: 0.5rem 1rem;
          gap: 1rem;
        }

        .layout-mockup-icon {
          width: 80px;
          height: 48px;
          flex-shrink: 0;
        }

        .layout-label {
          text-align: left;
          font-size: 11px;
        }
      }

      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
          transform: scale(1);
        }
        50% {
          opacity: 0.5;
          transform: scale(0.9);
        }
      }
    `,
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

  // Búsqueda de iconos reactiva y categorías estilo móvil
  protected readonly iconSearchQuery = signal<string>('');
  protected readonly selectedCategory = signal<string>('popular');
  protected readonly visibleIconsCount = signal<number>(100);
  protected readonly renderedIcons = computed(() => {
    return this.filteredIcons().slice(0, this.visibleIconsCount());
  });

  protected readonly temaOptions = TEMA_OPTIONS;

  protected readonly courseOptions = computed(() =>
    this.coursesFacade.availableCourses().map((c) => ({
      id: c.id,
      label: `${c.name} (${c.license_class})`,
    })),
  );

  protected readonly iconCategories = [
    { id: 'popular', label: 'Populares', icon: 'star' },
    { id: 'transport', label: 'Transporte', icon: 'car' },
    { id: 'education', label: 'Educación', icon: 'graduation-cap' },
    { id: 'contact', label: 'Contacto', icon: 'phone' },
    { id: 'finance', label: 'Finanzas', icon: 'coins' },
    { id: 'interface', label: 'Interfaz', icon: 'settings' },
    { id: 'all', label: 'Todos', icon: 'list' },
  ];

  private readonly popularIcons = [
    'car',
    'graduation-cap',
    'shield-check',
    'target',
    'map-pin',
    'calendar',
    'credit-card',
    'check-circle',
    'star',
    'users',
    'clock',
    'award',
    'phone',
    'mail',
    'globe',
    'book-open',
    'briefcase',
    'building-2',
    'heart',
    'help-circle',
    'settings',
    'info',
    'lock',
    'tag',
    'bell',
    'alert-circle',
    'file-text',
  ];

  private readonly transportIcons = [
    'car',
    'truck',
    'bus',
    'gauge',
    'map-pin',
    'map',
    'navigation',
    'milestone',
    'route',
    'traffic-cone',
    'compass',
    'wrench',
    'settings',
    'clock',
    'flag',
    'activity',
    'shield-check',
  ];

  private readonly educationIcons = [
    'graduation-cap',
    'book-open',
    'book',
    'scroll',
    'award',
    'brain',
    'pencil',
    'pen-tool',
    'clipboard-list',
    'clipboard-check',
    'file-text',
    'file-badge',
    'notebook',
    'presentation',
    'users',
    'user-check',
  ];

  private readonly contactIcons = [
    'phone',
    'mail',
    'message-circle',
    'message-square',
    'inbox',
    'send',
    'share-2',
    'at-sign',
    'globe',
    'bell',
    'bell-off',
    'video',
    'camera',
    'mic',
  ];

  private readonly financeIcons = [
    'credit-card',
    'coins',
    'banknote',
    'wallet',
    'receipt',
    'landmark',
    'calculator',
    'tag',
    'shopping-bag',
    'shopping-cart',
    'piggy-bank',
    'percent',
    'dollar-sign',
  ];

  private readonly interfaceIcons = [
    'settings',
    'settings-2',
    'trash-2',
    'edit',
    'edit-3',
    'pencil',
    'check',
    'x',
    'plus',
    'minus',
    'plus-circle',
    'minus-circle',
    'chevron-down',
    'chevron-up',
    'chevron-left',
    'chevron-right',
    'info',
    'circle-help',
    'alert-circle',
    'alert-triangle',
    'lock',
    'unlock',
    'eye',
    'eye-off',
    'calendar',
    'clock',
    'history',
    'home',
    'search',
    'filter',
    'upload',
    'download',
    'save',
    'refresh-cw',
    'menu',
  ];

  protected readonly filteredIcons = computed(() => {
    const query = this.iconSearchQuery().trim().toLowerCase();
    const cat = this.selectedCategory();

    let baseList: string[] = [];
    if (cat === 'all') {
      baseList = LUCIDE_ALL_ICONS;
    } else if (cat === 'popular') {
      baseList = this.popularIcons;
    } else if (cat === 'transport') {
      baseList = this.transportIcons;
    } else if (cat === 'education') {
      baseList = this.educationIcons;
    } else if (cat === 'contact') {
      baseList = this.contactIcons;
    } else if (cat === 'finance') {
      baseList = this.financeIcons;
    } else if (cat === 'interface') {
      baseList = this.interfaceIcons;
    }

    if (!query) {
      return baseList;
    }

    // Si hay query, filtra sobre la lista activa
    let matches = baseList.filter((name) => name.includes(query));
    // Si no hay coincidencias y no está buscando en "Todos", busca en toda la base como fallback
    if (matches.length === 0 && cat !== 'all') {
      matches = LUCIDE_ALL_ICONS.filter((name) => name.includes(query));
    }

    return matches.slice(0, 40);
  });

  // Signals
  protected readonly activeTab = signal<ConfigTab>('general');
  protected readonly previewMode = signal<'desktop' | 'mobile'>('desktop');
  protected readonly isUploadingLogo = signal<boolean>(false);
  protected readonly isUploadingFavicon = signal<boolean>(false);
  protected readonly isUploadingOgImage = signal<boolean>(false);
  protected readonly isUploadingHero = signal<boolean>(false);
  protected readonly isUploadingBackground = signal<boolean>(false);
  protected readonly activeHeroSubTab = signal<'edit' | 'preview'>('edit');

  protected showIconDropdown: Record<number, boolean> = {};

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.icon-dropdown-container')) {
      this.showIconDropdown = {};
    }
  }

  protected onIconSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.iconSearchQuery.set(target.value);
  }

  protected clearIconSearch(event: MouseEvent): void {
    event.stopPropagation();
    this.iconSearchQuery.set('');
  }

  protected toggleIconDropdown(index: number, event: MouseEvent): void {
    event.stopPropagation();
    const currentlyOpen = this.showIconDropdown[index];
    this.showIconDropdown = {};
    this.iconSearchQuery.set('');
    this.selectedCategory.set('popular');
    if (!currentlyOpen) {
      this.showIconDropdown[index] = true;
    }
  }

  protected selectCategory(catId: string): void {
    this.selectedCategory.set(catId);
  }

  protected onDropdownScroll(event: Event): void {
    const el = event.target as HTMLElement;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom && this.visibleIconsCount() < this.filteredIcons().length) {
      this.visibleIconsCount.update((c) => c + 60);
    }
  }

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

    // 3. Reset lazy-load count when category or search query changes
    effect(() => {
      this.selectedCategory();
      this.iconSearchQuery();
      untracked(() => {
        this.visibleIconsCount.set(100);
      });
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

  // File Upload Handlers (Logo / OG Image)
  protected async onLogoSelected(file: File): Promise<void> {
    this.isUploadingLogo.set(true);
    try {
      const optimizedFile = await optimizeImage(file, 'logo');
      const url = await this.facade.uploadAsset(this.effectiveBranchId()!, optimizedFile, 'logo');
      this.form.get('brand.logo')?.setValue(url);
      this.form.markAsDirty();
      this.toast.success(
        'Logo subido',
        'El logo se ha optimizado y subido correctamente al storage.',
      );
    } catch (err) {
      // Toast ya lo muestra el facade
    } finally {
      this.isUploadingLogo.set(false);
    }
  }

  protected async onFaviconSelected(file: File): Promise<void> {
    this.isUploadingFavicon.set(true);
    try {
      const optimizedFile = await optimizeImage(file, 'favicon');
      const url = await this.facade.uploadAsset(
        this.effectiveBranchId()!,
        optimizedFile,
        'favicon',
      );
      this.form.get('brand.favicon')?.setValue(url);
      this.form.markAsDirty();
      this.toast.success(
        'Favicon subido',
        'El favicon se ha optimizado y subido correctamente al storage.',
      );
    } catch (err) {
      // Toast ya lo muestra el facade
    } finally {
      this.isUploadingFavicon.set(false);
    }
  }

  protected async onOgSelected(file: File): Promise<void> {
    this.isUploadingOgImage.set(true);
    try {
      const optimizedFile = await optimizeImage(file, 'ogImage');
      const url = await this.facade.uploadAsset(
        this.effectiveBranchId()!,
        optimizedFile,
        'ogImage',
      );
      this.form.get('brand.ogImage')?.setValue(url);
      this.form.markAsDirty();
      this.toast.success(
        'Imagen OG subida',
        'La imagen OG se ha optimizado y subido correctamente al storage.',
      );
    } catch (err) {
      // Toast ya lo muestra el facade
    } finally {
      this.isUploadingOgImage.set(false);
    }
  }

  protected clearLogo(): void {
    const cdnUrl =
      'https://skvekggejikzxhzsjmkz.supabase.co/storage/v1/object/public/website-public/seeds';
    const defaultLogo =
      this.effectiveBranchId()! === 2 ? `${cdnUrl}/roja-logo.svg` : `${cdnUrl}/azul-logo.svg`;
    this.form.get('brand.logo')?.setValue(defaultLogo);
    this.form.markAsDirty();
  }

  protected clearOg(): void {
    const cdnUrl =
      'https://skvekggejikzxhzsjmkz.supabase.co/storage/v1/object/public/website-public/seeds';
    const defaultOg =
      this.effectiveBranchId()! === 2
        ? `${cdnUrl}/roja-og-image.jpg`
        : `${cdnUrl}/azul-og-image.jpg`;
    this.form.get('brand.ogImage')?.setValue(defaultOg);
    this.form.markAsDirty();
  }

  protected async onHeroMediaSelected(file: File): Promise<void> {
    const isVideo = file.type.startsWith('video/');

    if (isVideo && file.size > 5 * 1024 * 1024) {
      this.toast.warning(
        'Video muy pesado',
        'El video supera los 5MB recomendados. Esto podría ralentizar la velocidad de carga de la web en móviles.',
      );
    }

    this.isUploadingHero.set(true);
    try {
      let finalFile = file;
      if (!isVideo) {
        finalFile = await optimizeImage(file, 'hero');
      }

      const url = await this.facade.uploadAsset(this.effectiveBranchId()!, finalFile, 'hero');
      this.form.get('hero.media.url')?.setValue(url);
      this.form.get('hero.media.type')?.setValue(isVideo ? 'video' : 'image');
      this.form.markAsDirty();
      this.toast.success(
        'Media subido',
        `El recurso lateral (${isVideo ? 'Video' : 'Imagen'}) se ha subido correctamente.`,
      );
    } catch (err) {
      // El error ya es gestionado por la fachada
    } finally {
      this.isUploadingHero.set(false);
    }
  }

  protected async onBackgroundMediaSelected(file: File): Promise<void> {
    const isVideo = file.type.startsWith('video/');

    if (isVideo && file.size > 5 * 1024 * 1024) {
      this.toast.warning(
        'Video muy pesado',
        'El video de fondo supera los 5MB. Podría afectar el rendimiento de carga.',
      );
    }

    this.isUploadingBackground.set(true);
    try {
      let finalFile = file;
      if (!isVideo) {
        finalFile = await optimizeImage(file, 'hero');
      }

      const url = await this.facade.uploadAsset(this.effectiveBranchId()!, finalFile, 'hero');
      this.form.get('hero.background.url')?.setValue(url);
      this.form.get('hero.background.type')?.setValue(isVideo ? 'video' : 'image');
      this.form.markAsDirty();
      this.toast.success(
        'Fondo subido',
        `El fondo (${isVideo ? 'Video' : 'Imagen'}) se ha subido correctamente.`,
      );
    } catch (err) {
      // El error ya es gestionado por la fachada
    } finally {
      this.isUploadingBackground.set(false);
    }
  }

  protected clearHeroMedia(): void {
    const cdnUrl =
      'https://skvekggejikzxhzsjmkz.supabase.co/storage/v1/object/public/website-public/seeds';
    const defaultHero =
      this.effectiveBranchId()! === 2
        ? `${cdnUrl}/roja-og-image.jpg`
        : `${cdnUrl}/azul-og-image.jpg`;
    this.form.get('hero.media.url')?.setValue(defaultHero);
    this.form.get('hero.media.type')?.setValue('image');
    this.form.markAsDirty();
  }

  // Dynamic Courses Management
  protected addCourse(): void {
    const nextOrder = this.coursesArray.length + 1;
    this.coursesArray.push(
      this.fb.group({
        course_id: [null as number | null, Validators.required],
        description: ['', Validators.required],
        priceNote: [''],
        duration: ['', Validators.required],
        highlighted: [false],
        badge: [''],
        priceOverride: [null as number | null],
        displayOrder: [nextOrder],
        includes: ['', Validators.required],
      }),
    );
    this.form.markAsDirty();
  }

  /** Devuelve el item del catálogo para un course_id del formulario. */
  protected getCatalogItem(courseId: number | null): CourseCatalogItem | undefined {
    if (courseId == null) return undefined;
    return this.coursesFacade.availableById().get(courseId);
  }

  /** Formatea un número como precio CLP para el template. */
  protected formatCLP(amount: number | null | undefined): string {
    if (amount == null) return '—';
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(amount);
  }

  /** Preview del precio efectivo para la card (usado en la UI de override). */
  protected getOverridePreview(overrideVal: number | null, basePrice: number): string {
    const label = overrideVal === 0 ? 'Gratis' : this.formatCLP(overrideVal);
    return `La landing mostrará ${label} con tachado de ${this.formatCLP(basePrice)}`;
  }

  protected removeCourse(index: number): void {
    this.coursesArray.removeAt(index);
    this.form.markAsDirty();
  }

  // Dynamic FAQs Management
  protected addFaq(): void {
    this.faqsArray.push(
      this.fb.group({
        question: ['', Validators.required],
        answer: ['', Validators.required],
      }),
    );
    this.form.markAsDirty();
  }

  protected removeFaq(index: number): void {
    this.faqsArray.removeAt(index);
    this.form.markAsDirty();
  }

  // Dynamic Hours Management
  protected addHour(): void {
    this.hoursArray.push(
      this.fb.group({
        days: ['', Validators.required],
        time: ['', Validators.required],
      }),
    );
    this.form.markAsDirty();
  }

  protected removeHour(index: number): void {
    this.hoursArray.removeAt(index);
    this.form.markAsDirty();
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
