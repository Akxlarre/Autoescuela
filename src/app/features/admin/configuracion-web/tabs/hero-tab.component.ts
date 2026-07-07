import { AbstractControl, FormArray, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  input,
  signal,
  untracked,
  effect,
} from '@angular/core';
import { WebsiteConfigFacade } from '@core/facades/website-config.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { optimizeImage } from '@core/utils/image-optimizer';
import { IconComponent } from '@shared/components/icon/icon.component';
import { MediaUploadControlComponent } from '@shared/components/media-upload-control/media-upload-control.component';
import { LUCIDE_ALL_ICONS } from '@shared/components/icon/lucide-all-icons';

const ICON_CATEGORIES = [
  { id: 'popular', label: 'Populares', icon: 'star' },
  { id: 'transport', label: 'Transporte', icon: 'car' },
  { id: 'education', label: 'Educación', icon: 'graduation-cap' },
  { id: 'contact', label: 'Contacto', icon: 'phone' },
  { id: 'finance', label: 'Finanzas', icon: 'coins' },
  { id: 'interface', label: 'Interfaz', icon: 'settings' },
  { id: 'all', label: 'Todos', icon: 'list' },
];

const POPULAR_ICONS = [
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
const TRANSPORT_ICONS = [
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
const EDUCATION_ICONS = [
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
const CONTACT_ICONS = [
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
const FINANCE_ICONS = [
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
const INTERFACE_ICONS = [
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

@Component({
  selector: 'app-hero-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, IconComponent, MediaUploadControlComponent],
  template: `
    <div [formGroup]="heroGroup()" class="hero-studio-container animate-fade-in">
      <!-- Cabecera de la Pestaña -->
      <div
        class="flex items-center justify-between border-b pb-3 mb-4 flex-wrap gap-3 border-border-subtle"
      >
        <div class="flex flex-col">
          <h3 class="text-base font-bold text-text-primary m-0">Sección Hero (Config Studio)</h3>
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
            <span class="text-2xs text-text-muted"
              >Elige cómo se organizarán las columnas en pantallas grandes.</span
            >

            <div class="layout-selector-grid">
              <!-- Centrado -->
              <div
                class="layout-selector-card"
                [class.active]="heroGroup().get('layoutType')?.value === 'center'"
                (click)="
                  heroGroup().get('layoutType')?.setValue('center'); heroGroup().markAsDirty()
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
                [class.active]="heroGroup().get('layoutType')?.value === 'split-right'"
                (click)="
                  heroGroup().get('layoutType')?.setValue('split-right'); heroGroup().markAsDirty()
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
                [class.active]="heroGroup().get('layoutType')?.value === 'split-left'"
                (click)="
                  heroGroup().get('layoutType')?.setValue('split-left'); heroGroup().markAsDirty()
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

            <div class="flex flex-col gap-1.5 mt-2">
              <label class="field-label">Tipo de Fondo</label>
              <div class="media-type-pills">
                <button
                  type="button"
                  class="media-pill"
                  [class.active]="heroGroup().get('background.type')?.value === 'none'"
                  (click)="
                    heroGroup().get('background.type')?.setValue('none'); heroGroup().markAsDirty()
                  "
                >
                  <app-icon name="palette" [size]="13" />
                  <span>Tema (Degradado)</span>
                </button>
                <button
                  type="button"
                  class="media-pill"
                  [class.active]="heroGroup().get('background.type')?.value === 'color'"
                  (click)="
                    heroGroup().get('background.type')?.setValue('color'); heroGroup().markAsDirty()
                  "
                >
                  <app-icon name="pipette" [size]="13" />
                  <span>Color Personalizado</span>
                </button>
                <button
                  type="button"
                  class="media-pill"
                  [class.active]="heroGroup().get('background.type')?.value === 'image'"
                  (click)="
                    heroGroup().get('background.type')?.setValue('image'); heroGroup().markAsDirty()
                  "
                >
                  <app-icon name="image" [size]="13" />
                  <span>Imagen</span>
                </button>
                <button
                  type="button"
                  class="media-pill"
                  [class.active]="heroGroup().get('background.type')?.value === 'video'"
                  (click)="
                    heroGroup().get('background.type')?.setValue('video'); heroGroup().markAsDirty()
                  "
                >
                  <app-icon name="video" [size]="13" />
                  <span>Video (MP4)</span>
                </button>
              </div>
            </div>

            @if (heroGroup().get('background.type')?.value === 'color') {
              <div class="flex flex-col gap-1.5 mt-4">
                <label class="field-label">Color Sólido *</label>
                <div class="flex items-center gap-3">
                  <div
                    class="relative w-12 h-10 p-1 rounded border cursor-pointer flex items-center justify-center overflow-hidden border-border-default bg-elevated"
                  >
                    <div
                      class="w-full h-full rounded-sm shadow-inner"
                      [style.background-color]="
                        heroGroup().get('background.color')?.value || '#000000'
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
            } @else if (heroGroup().get('background.type')?.value === 'none') {
              <div
                class="p-3.5 rounded-lg border border-dashed text-center mt-3 flex flex-col items-center gap-1.5 bg-subtle border-brand-muted"
              >
                <app-icon name="palette" [size]="20" class="text-brand" />
                <span class="text-xs font-semibold text-text-primary"
                  >Tema Sólido / Degradado Activo</span
                >
                <p class="text-2xs text-text-muted m-0 max-w-xs">
                  Se mostrará un degradado animado acorde al tema visual (<strong>{{
                    heroGroup().root.get('brand.theme')?.value === 'roja'
                      ? 'Rojo profesional'
                      : 'Azul particular'
                  }}</strong
                  >).
                </p>
              </div>
            }

            @if (
              heroGroup().get('background.type')?.value === 'image' ||
              heroGroup().get('background.type')?.value === 'video'
            ) {
              <div class="flex flex-col gap-1.5 mt-4">
                <label class="field-label">Recurso de Fondo *</label>
                <app-media-upload-control
                  formControlName="url"
                  label="URL del Recurso"
                  [buttonLabel]="
                    heroGroup().get('background.type')?.value === 'image'
                      ? 'Subir Imagen'
                      : 'Subir Video'
                  "
                  [buttonIcon]="
                    heroGroup().get('background.type')?.value === 'image' ? 'image' : 'video'
                  "
                  [accept]="
                    heroGroup().get('background.type')?.value === 'image' ? 'image/*' : 'video/mp4'
                  "
                  [previewType]="
                    heroGroup().get('background.type')?.value === 'video' ? 'video' : 'image'
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
                      >{{ heroGroup().get('background.overlayOpacity')?.value }}%</strong
                    ></label
                  >

                  @let opacityVal = heroGroup().get('background.overlayOpacity')?.value ?? 40;
                  <span
                    class="opacity-legibility-badge"
                    [class.poor]="opacityVal < 20 || opacityVal > 80"
                    [class.medium]="
                      (opacityVal >= 20 && opacityVal < 30) || (opacityVal > 60 && opacityVal <= 80)
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
          @if (heroGroup().get('layoutType')?.value !== 'center') {
            <div formGroupName="media" class="studio-card animate-fade-in">
              <span class="studio-card-title">3. Multimedia Lateral (Media)</span>

              <div class="flex flex-col gap-1.5 mt-2">
                <label class="field-label">Tipo de Multimedia</label>
                <div class="media-type-pills">
                  <button
                    type="button"
                    class="media-pill"
                    [class.active]="heroGroup().get('media.type')?.value === 'none'"
                    (click)="
                      heroGroup().get('media.type')?.setValue('none'); heroGroup().markAsDirty()
                    "
                  >
                    <app-icon name="x-circle" [size]="13" />
                    <span>Ninguno</span>
                  </button>
                  <button
                    type="button"
                    class="media-pill"
                    [class.active]="heroGroup().get('media.type')?.value === 'image'"
                    (click)="
                      heroGroup().get('media.type')?.setValue('image'); heroGroup().markAsDirty()
                    "
                  >
                    <app-icon name="image" [size]="13" />
                    <span>Imagen Lateral</span>
                  </button>
                  <button
                    type="button"
                    class="media-pill"
                    [class.active]="heroGroup().get('media.type')?.value === 'video'"
                    (click)="
                      heroGroup().get('media.type')?.setValue('video'); heroGroup().markAsDirty()
                    "
                  >
                    <app-icon name="video" [size]="13" />
                    <span>Video Lateral</span>
                  </button>
                </div>
              </div>

              @if (heroGroup().get('media.type')?.value === 'none') {
                <div
                  class="mt-4 p-4 rounded-xl border border-dashed flex flex-col items-center justify-center text-center gap-2 border-border-default bg-black/[0.02]"
                >
                  <app-icon name="layout" [size]="20" class="text-text-muted opacity-50" />
                  <span class="text-sm font-medium text-text-primary">Sin elemento lateral</span>
                  <span class="text-xs text-text-muted max-w-[280px]">
                    El layout dividido mostrará una tarjeta limpia y desenfocada sin contenido,
                    dándole más protagonismo al texto.
                  </span>
                </div>
              } @else {
                <div class="flex flex-col gap-1.5 mt-4">
                  <label class="field-label">Recurso Lateral *</label>

                  <div
                    class="mb-2 p-3 rounded-lg flex gap-3 items-start bg-elevated border border-border-subtle"
                  >
                    @if (heroGroup().get('media.type')?.value === 'image') {
                      <app-icon name="sparkles" [size]="16" class="text-brand mt-0.5" />
                      <div class="flex flex-col">
                        <span class="text-2xs font-semibold text-text-primary"
                          >Efecto Auto-Glow</span
                        >
                        <span class="text-2xs text-text-muted leading-tight mt-0.5"
                          >Las imágenes con formato vertical (Portrait) generarán un desenfoque de
                          luz ambiental automático a su alrededor.</span
                        >
                      </div>
                    } @else {
                      <app-icon name="film" [size]="16" class="text-brand mt-0.5" />
                      <div class="flex flex-col">
                        <span class="text-2xs font-semibold text-text-primary"
                          >Optimización Recomendada</span
                        >
                        <span class="text-2xs text-text-muted leading-tight mt-0.5"
                          >Sube videos en bucle menores a 5MB, idealmente sin sonido para no
                          interrumpir al usuario. Formato MP4.</span
                        >
                      </div>
                    }
                  </div>

                  <app-media-upload-control
                    formControlName="url"
                    label="URL del Recurso"
                    [buttonLabel]="
                      heroGroup().get('media.type')?.value === 'image'
                        ? 'Subir Imagen'
                        : 'Subir Video'
                    "
                    [buttonIcon]="
                      heroGroup().get('media.type')?.value === 'image' ? 'image' : 'video'
                    "
                    [accept]="
                      heroGroup().get('media.type')?.value === 'image' ? 'image/*' : 'video/mp4'
                    "
                    [previewType]="
                      heroGroup().get('media.type')?.value === 'video' ? 'video' : 'image'
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
              <label class="premium-switch">
                <input type="checkbox" formControlName="enabled" />
                <span class="switch-slider"></span>
              </label>
            </div>

            <div
              class="bento-grid bento-grid--forms mt-3 transition-all duration-300"
              [style.opacity]="heroGroup().get('trustBadge.enabled')?.value ? '1' : '0.3'"
              [style.pointer-events]="
                heroGroup().get('trustBadge.enabled')?.value ? 'auto' : 'none'
              "
            >
              <div class="flex flex-col gap-1.5 bento-wide">
                <label class="field-label">Texto del Badge</label>
                <input
                  type="text"
                  formControlName="text"
                  class="field-input"
                  placeholder="Ej: 4.9/5 en Google Reviews"
                />
              </div>
              <div class="flex flex-col gap-1.5 bento-wide">
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
            <div class="bento-grid bento-grid--forms mt-2">
              <div class="flex flex-col gap-1.5 bento-wide">
                <label class="field-label">Texto del Botón CTA *</label>
                <input
                  type="text"
                  formControlName="text"
                  class="field-input"
                  placeholder="Ej: Consultar Cursos por WhatsApp"
                />
              </div>
              <div class="flex flex-col gap-1.5 bento-wide">
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

            <div formArrayName="features" class="flex flex-col gap-3 mt-3">
              @for (featCtrl of heroFeaturesArray.controls; track $index) {
                <div
                  [formGroupName]="$index"
                  class="flex items-center gap-3 p-2 rounded-xl border border-solid border-border-default bg-elevated transition-colors hover:border-border-strong"
                >
                  <div class="relative w-40 shrink-0 icon-dropdown-container">
                    <button
                      type="button"
                      class="field-input py-1.5 px-2.5 w-full flex items-center justify-between bg-surface cursor-pointer h-[34px]"
                      (click)="toggleIconDropdown($index, $event)"
                    >
                      <div class="flex items-center gap-2">
                        @if (featCtrl.get('icon')?.value) {
                          <app-icon
                            [name]="featCtrl.get('icon')?.value"
                            [size]="16"
                            class="text-brand"
                          />
                        } @else {
                          <span class="text-2xs text-text-muted">Opcional</span>
                        }
                      </div>
                      <app-icon name="chevron-down" [size]="14" class="text-text-muted" />
                    </button>

                    @if (showIconDropdown[$index]) {
                      <div
                        class="absolute left-0 w-64 bg-surface border rounded-lg shadow-xl p-2.5 z-50 flex flex-col gap-1.5 border-border-subtle"
                        [class.top-full]="$index === 0"
                        [class.mt-1]="$index === 0"
                        [class.bottom-full]="$index > 0"
                        [class.mb-1]="$index > 0"
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

                        <!-- Categorías -->
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

                        <!-- Rejilla de iconos -->
                        <div
                          class="grid grid-cols-6 gap-1 max-h-32 overflow-y-auto pr-1"
                          (scroll)="onDropdownScroll($event)"
                        >
                          <button
                            type="button"
                            class="col-span-6 flex items-center justify-center gap-1 py-1 rounded hover:bg-subtle text-[9px] text-text-muted transition-colors cursor-pointer border-none"
                            (click)="
                              featCtrl.get('icon')?.setValue(''); showIconDropdown[$index] = false
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
                                featCtrl.get('icon')?.setValue(iconName);
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

                  <div class="flex-1 relative">
                    <input
                      type="text"
                      formControlName="text"
                      class="w-full bg-transparent border border-transparent rounded-lg py-2 px-3 text-sm text-text-primary outline-none transition-colors hover:bg-base focus:bg-base focus:border-ds-brand"
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
  `,
  styles: `
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
    .hero-studio-container {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      width: 100%;
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
    .layout-mockup-split-right,
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
      font-size: 11px;
      font-weight: 600;
      color: var(--text-primary);
      text-align: center;
    }
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
  `,
})
export class HeroTabComponent {
  private facade = inject(WebsiteConfigFacade);
  private toast = inject(ToastService);

  heroGroup = input.required<FormGroup>();
  branchId = input.required<number>();

  protected readonly isUploadingHero = signal(false);
  protected readonly isUploadingBackground = signal(false);
  protected readonly iconSearchQuery = signal('');
  protected readonly selectedCategory = signal('popular');
  protected readonly visibleIconsCount = signal(100);

  protected showIconDropdown: Record<number, boolean> = {};
  protected readonly iconCategories = ICON_CATEGORIES;

  protected readonly filteredIcons = computed(() => {
    const query = this.iconSearchQuery().trim().toLowerCase();
    const cat = this.selectedCategory();

    let baseList: string[] =
      cat === 'all'
        ? LUCIDE_ALL_ICONS
        : cat === 'popular'
          ? POPULAR_ICONS
          : cat === 'transport'
            ? TRANSPORT_ICONS
            : cat === 'education'
              ? EDUCATION_ICONS
              : cat === 'contact'
                ? CONTACT_ICONS
                : cat === 'finance'
                  ? FINANCE_ICONS
                  : INTERFACE_ICONS;

    if (!query) return baseList;
    const matches = baseList.filter((n) => n.includes(query));
    return matches.length === 0 && cat !== 'all'
      ? LUCIDE_ALL_ICONS.filter((n) => n.includes(query)).slice(0, 40)
      : matches;
  });

  protected readonly renderedIcons = computed(() =>
    this.filteredIcons().slice(0, this.visibleIconsCount()),
  );

  get heroFeaturesArray(): FormArray {
    return this.heroGroup().get('features') as FormArray;
  }

  protected asFormGroup(ctrl: AbstractControl): FormGroup {
    return ctrl as FormGroup;
  }

  constructor() {
    effect(() => {
      this.selectedCategory();
      this.iconSearchQuery();
      untracked(() => this.visibleIconsCount.set(100));
    });
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.icon-dropdown-container')) {
      this.showIconDropdown = {};
    }
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

  protected onIconSearch(event: Event): void {
    this.iconSearchQuery.set((event.target as HTMLInputElement).value);
  }

  protected clearIconSearch(event: MouseEvent): void {
    event.stopPropagation();
    this.iconSearchQuery.set('');
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
      const finalFile = isVideo ? file : await optimizeImage(file, 'hero');
      const url = await this.facade.uploadAsset(this.branchId(), finalFile, 'hero');
      this.heroGroup().get('media.url')?.setValue(url);
      this.heroGroup()
        .get('media.type')
        ?.setValue(isVideo ? 'video' : 'image');
      this.heroGroup().markAsDirty();
      this.toast.success(
        'Media subido',
        `El recurso lateral (${isVideo ? 'Video' : 'Imagen'}) se ha subido correctamente.`,
      );
    } catch {
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
      const finalFile = isVideo ? file : await optimizeImage(file, 'hero');
      const url = await this.facade.uploadAsset(this.branchId(), finalFile, 'hero');
      this.heroGroup().get('background.url')?.setValue(url);
      this.heroGroup()
        .get('background.type')
        ?.setValue(isVideo ? 'video' : 'image');
      this.heroGroup().markAsDirty();
      this.toast.success(
        'Fondo subido',
        `El fondo (${isVideo ? 'Video' : 'Imagen'}) se ha subido correctamente.`,
      );
    } catch {
      // El error ya es gestionado por la fachada
    } finally {
      this.isUploadingBackground.set(false);
    }
  }
}
