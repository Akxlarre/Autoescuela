import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import type { EnrollmentDocumentsData } from '@core/models/ui/enrollment-documents.model';

@Component({
  selector: 'app-public-documents',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent],
  template: `
    <div class="space-y-5">
      <div>
        <h2
          class="font-bold mb-1"
          style="font-family: var(--font-display); font-size: 1.3rem; color: var(--text-primary);"
        >
          Foto carnet
        </h2>
        <p class="text-sm" style="color: var(--text-secondary);">
          Necesitamos una foto de tu cara para tu credencial de alumno.
        </p>
      </div>

      <!-- Photo guide (AC12) -->
      <div
        class="rounded-xl p-4 space-y-3"
        style="background: var(--bg-surface); border: 1px solid var(--border-default);"
        role="note"
        aria-label="Guía para la foto carnet"
      >
        <p class="text-xs font-bold uppercase tracking-wider" style="color: var(--text-muted);">
          Requisitos de la foto
        </p>
        <div class="grid grid-cols-2 gap-3">
          <!-- Valid example -->
          <div class="space-y-1.5">
            <div
              class="flex h-24 items-center justify-center rounded-xl"
              style="
                background: color-mix(in srgb, var(--state-success) 8%, var(--bg-surface));
                border: 1.5px solid color-mix(in srgb, var(--state-success) 30%, transparent);
              "
            >
              <div class="flex flex-col items-center gap-1">
                <app-icon name="circle-check" [size]="28" color="var(--state-success)" />
                <span class="text-xs font-medium" style="color: var(--state-success);"
                  >Correcta</span
                >
              </div>
            </div>
            <ul class="space-y-1">
              @for (tip of validTips; track tip) {
                <li class="flex items-center gap-1.5 text-xs" style="color: var(--text-secondary);">
                  <app-icon name="check" [size]="11" color="var(--state-success)" />
                  {{ tip }}
                </li>
              }
            </ul>
          </div>
          <!-- Invalid example -->
          <div class="space-y-1.5">
            <div
              class="flex h-24 items-center justify-center rounded-xl"
              style="
                background: color-mix(in srgb, var(--state-error) 8%, var(--bg-surface));
                border: 1.5px solid color-mix(in srgb, var(--state-error) 30%, transparent);
              "
            >
              <div class="flex flex-col items-center gap-1">
                <app-icon name="circle-x" [size]="28" color="var(--state-error)" />
                <span class="text-xs font-medium" style="color: var(--state-error);"
                  >Incorrecta</span
                >
              </div>
            </div>
            <ul class="space-y-1">
              @for (tip of invalidTips; track tip) {
                <li class="flex items-center gap-1.5 text-xs" style="color: var(--text-secondary);">
                  <app-icon name="x" [size]="11" color="var(--state-error)" />
                  {{ tip }}
                </li>
              }
            </ul>
          </div>
        </div>
      </div>

      <!-- Current photo preview or upload -->
      @if (data().carnetPhoto) {
        <div
          class="flex items-center gap-4 rounded-xl p-4"
          style="
            background: color-mix(in srgb, var(--state-success) 8%, var(--bg-surface));
            border: 1.5px solid color-mix(in srgb, var(--state-success) 30%, transparent);
          "
        >
          <img
            [src]="data().carnetPhoto!.capturedDataUrl"
            alt="Foto carnet subida"
            class="h-16 w-16 rounded-lg object-cover shrink-0"
            style="border: 2px solid var(--state-success);"
          />
          <div class="flex-1">
            <p class="text-sm font-semibold" style="color: var(--state-success);">Foto subida</p>
            <p class="text-xs" style="color: var(--text-secondary);">
              {{ data().carnetPhoto!.fileName }}
            </p>
          </div>
          <label
            class="text-xs font-semibold cursor-pointer"
            style="color: var(--text-muted);"
            for="pub-carnet-rechange"
          >
            Cambiar
            <input
              id="pub-carnet-rechange"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              class="sr-only"
              (change)="onFileChange($event)"
            />
          </label>
        </div>
      } @else {
        <!-- Upload area -->
        <label
          class="flex flex-col items-center gap-3 rounded-xl px-6 py-8 cursor-pointer transition-all"
          style="
            background: var(--bg-surface);
            border: 2px dashed var(--border-default);
          "
          for="pub-carnet-upload"
          data-llm-description="Carnet photo upload area for driving school enrollment"
        >
          <div
            class="flex h-12 w-12 items-center justify-center rounded-xl"
            style="background: var(--gradient-subtle);"
            aria-hidden="true"
          >
            <app-icon name="camera" [size]="24" color="var(--ds-brand)" />
          </div>
          <div class="text-center">
            <p class="text-sm font-semibold" style="color: var(--text-primary);">
              Subir foto carnet
            </p>
            <p class="text-xs mt-0.5" style="color: var(--text-muted);">JPG o PNG · Máx. 5 MB</p>
          </div>
          <input
            id="pub-carnet-upload"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            class="sr-only"
            (change)="onFileChange($event)"
          />
        </label>
      }

      <!-- Nav -->
      <div class="flex justify-between pt-2 border-t" style="border-color: var(--border-subtle);">
        <button
          type="button"
          class="flex items-center gap-1.5 text-sm font-medium cursor-pointer"
          style="color: var(--text-secondary);"
          (click)="back.emit()"
        >
          <app-icon name="arrow-left" [size]="16" />
          Volver
        </button>
        <button
          type="button"
          class="btn-primary px-7 py-2.5 rounded-xl font-semibold text-sm"
          [disabled]="!hasPhoto()"
          data-llm-action="confirm-carnet-photo"
          (click)="hasPhoto() && next.emit()"
        >
          Continuar
        </button>
      </div>
    </div>
  `,
})
export class PublicDocumentsComponent {
  readonly data = input.required<EnrollmentDocumentsData>();
  readonly fileSelected = output<{ type: string; file: File }>();
  readonly next = output<void>();
  readonly back = output<void>();

  protected readonly hasPhoto = computed(() => !!this.data().carnetPhoto);

  protected readonly validTips = [
    'Fondo blanco o claro',
    'Cara completa, centrada',
    'Sin accesorios que cubran el rostro',
  ];

  protected readonly invalidTips = [
    'Foto oscura o borrosa',
    'Cara cortada o de perfil',
    'Lentes de sol o gorra',
  ];

  protected onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.fileSelected.emit({ type: 'id_photo', file });
  }
}
