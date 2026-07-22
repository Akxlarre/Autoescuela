import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { WebsiteConfigFacade } from '@core/facades/website-config.facade';
import { ToastService } from '@core/services/ui/toast.service';
import { optimizeImage } from '@core/utils/image-optimizer';
import { MediaUploadControlComponent } from '@shared/components/media-upload-control/media-upload-control.component';
import { SelectModule } from 'primeng/select';

const TEMA_OPTIONS = [
  { value: 'azul', label: 'Azul (Sky/Indigo)' },
  { value: 'roja', label: 'Roja (Red/Orange)' },
];

const CDN_URL =
  'https://skvekggejikzxhzsjmkz.supabase.co/storage/v1/object/public/website-public/seeds';

@Component({
  selector: 'app-general-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, SelectModule, MediaUploadControlComponent],
  template: `
    <div class="flex flex-col gap-6 animate-fade-in">
      <div [formGroup]="brandGroup()" class="flex flex-col gap-6">
        <h3 class="text-base font-bold text-text-primary border-b pb-2 mb-2 border-border-subtle">
          Identidad y Metadatos SEO
        </h3>
        <div class="bento-grid bento-grid--forms bento-grid--forms">
          <div class="flex flex-col gap-1.5 bento-wide">
            <label class="field-label">Nombre Comercial *</label>
            <input
              type="text"
              formControlName="name"
              class="field-input"
              placeholder="Ej: Autoescuela Chillán"
              data-llm-description="input for the commercial school name shown site-wide"
            />
          </div>
          <div class="flex flex-col gap-1.5 bento-wide">
            <label class="field-label">Nombre Corto *</label>
            <input
              type="text"
              formControlName="shortName"
              class="field-input"
              placeholder="Ej: Autoescuela"
              data-llm-description="input for the short brand name"
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
            data-llm-description="input for the SEO main slogan"
          />
        </div>

        <div class="bento-grid bento-grid--forms bento-grid--forms">
          <div class="flex flex-col gap-1.5 bento-wide">
            <label class="field-label">Dominio Web *</label>
            <input
              type="text"
              formControlName="domain"
              class="field-input"
              placeholder="Ej: autoescuelachillan.cl"
              data-llm-description="input for the public website domain"
            />
          </div>
          <div class="flex flex-col gap-1.5 bento-wide">
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

        <!-- Recursos Gráficos del Sitio -->
        <h3
          class="text-base font-bold text-text-primary border-b pb-2 mt-4 mb-2 border-border-subtle"
        >
          Recursos Gráficos del Sitio (Logo y SEO)
        </h3>
        <div class="bento-grid bento-grid--forms bento-grid--forms">
          <!-- Logo -->
          <div
            class="p-4 rounded-xl border flex flex-col gap-4 border-border-default bg-elevated bento-wide"
          >
            <div class="flex flex-col gap-1">
              <span class="text-xs font-bold uppercase tracking-wider text-text-primary"
                >Logo de la Escuela</span
              >
              <span class="text-2xs text-text-muted"
                >Se muestra en el menú y pie de página. Soporta formatos SVG, PNG y WebP.</span
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

          <!-- OG Image -->
          <div
            class="p-4 rounded-xl border flex flex-col gap-4 border-border-default bg-elevated bento-wide"
          >
            <div class="flex flex-col gap-1">
              <span class="text-xs font-bold uppercase tracking-wider text-text-primary"
                >Imagen Open Graph (SEO / Redes)</span
              >
              <span class="text-2xs text-text-muted"
                >Vista previa compartida en WhatsApp/Facebook. Medida ideal: 1200x630px.</span
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

          <!-- Favicon -->
          <div
            class="p-4 rounded-xl border flex flex-col gap-4 border-border-default bg-elevated bento-wide"
          >
            <div class="flex flex-col gap-1">
              <span class="text-xs font-bold uppercase tracking-wider text-text-primary"
                >Favicon (Pestaña del Navegador)</span
              >
              <span class="text-2xs text-text-muted"
                >Icono pequeño para la pestaña del navegador. Soporta .ico, .png, .svg.</span
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

      <div [formGroup]="socialGroup()" class="flex flex-col gap-6">
        <h3
          class="text-base font-bold text-text-primary border-b pb-2 mt-4 mb-2 border-border-subtle"
        >
          Redes Sociales
        </h3>
        <div class="bento-grid bento-grid--forms bento-grid--forms">
          <div class="flex flex-col gap-1.5" data-col-span-md="4" data-col-span="4">
            <label class="field-label">Enlace Facebook</label>
            <input
              type="url"
              formControlName="facebook"
              class="field-input"
              placeholder="https://facebook.com/..."
              data-llm-description="input for the Facebook page URL"
            />
          </div>
          <div class="flex flex-col gap-1.5" data-col-span-md="4" data-col-span="4">
            <label class="field-label">Enlace Instagram</label>
            <input
              type="url"
              formControlName="instagram"
              class="field-input"
              placeholder="https://instagram.com/..."
              data-llm-description="input for the Instagram profile URL"
            />
          </div>
          <div class="flex flex-col gap-1.5" data-col-span-md="4" data-col-span="4">
            <label class="field-label">Enlace TikTok</label>
            <input
              type="url"
              formControlName="tiktok"
              class="field-input"
              placeholder="https://tiktok.com/@..."
              data-llm-description="input for the TikTok profile URL"
            />
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
  `,
})
export class GeneralTabComponent {
  private facade = inject(WebsiteConfigFacade);
  private toast = inject(ToastService);

  brandGroup = input.required<FormGroup>();
  socialGroup = input.required<FormGroup>();
  branchId = input.required<number>();

  protected readonly temaOptions = TEMA_OPTIONS;
  protected readonly isUploadingLogo = signal(false);
  protected readonly isUploadingFavicon = signal(false);
  protected readonly isUploadingOgImage = signal(false);

  protected async onLogoSelected(file: File): Promise<void> {
    this.isUploadingLogo.set(true);
    try {
      const optimizedFile = await optimizeImage(file, 'logo');
      const url = await this.facade.uploadAsset(this.branchId(), optimizedFile, 'logo');
      this.brandGroup().get('logo')?.setValue(url);
      this.brandGroup().markAsDirty();
      this.toast.success(
        'Logo subido',
        'El logo se ha optimizado y subido correctamente al storage.',
      );
    } catch {
      // Toast ya lo muestra el facade
    } finally {
      this.isUploadingLogo.set(false);
    }
  }

  protected async onFaviconSelected(file: File): Promise<void> {
    this.isUploadingFavicon.set(true);
    try {
      const optimizedFile = await optimizeImage(file, 'favicon');
      const url = await this.facade.uploadAsset(this.branchId(), optimizedFile, 'favicon');
      this.brandGroup().get('favicon')?.setValue(url);
      this.brandGroup().markAsDirty();
      this.toast.success(
        'Favicon subido',
        'El favicon se ha optimizado y subido correctamente al storage.',
      );
    } catch {
      // Toast ya lo muestra el facade
    } finally {
      this.isUploadingFavicon.set(false);
    }
  }

  protected async onOgSelected(file: File): Promise<void> {
    this.isUploadingOgImage.set(true);
    try {
      const optimizedFile = await optimizeImage(file, 'ogImage');
      const url = await this.facade.uploadAsset(this.branchId(), optimizedFile, 'ogImage');
      this.brandGroup().get('ogImage')?.setValue(url);
      this.brandGroup().markAsDirty();
      this.toast.success(
        'Imagen OG subida',
        'La imagen OG se ha optimizado y subido correctamente al storage.',
      );
    } catch {
      // Toast ya lo muestra el facade
    } finally {
      this.isUploadingOgImage.set(false);
    }
  }

  protected clearLogo(): void {
    const defaultLogo =
      this.branchId() === 2 ? `${CDN_URL}/roja-logo.svg` : `${CDN_URL}/azul-logo.svg`;
    this.brandGroup().get('logo')?.setValue(defaultLogo);
    this.brandGroup().markAsDirty();
  }

  protected clearOg(): void {
    const defaultOg =
      this.branchId() === 2 ? `${CDN_URL}/roja-og-image.jpg` : `${CDN_URL}/azul-og-image.jpg`;
    this.brandGroup().get('ogImage')?.setValue(defaultOg);
    this.brandGroup().markAsDirty();
  }
}
