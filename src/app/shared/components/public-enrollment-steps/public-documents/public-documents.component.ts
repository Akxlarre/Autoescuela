import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
  viewChild,
  OnDestroy,
  ElementRef,
  effect,
  untracked,
} from '@angular/core';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AsyncBtnComponent } from '@shared/components/async-btn/async-btn.component';
import type { EnrollmentDocumentsData } from '@core/models/ui/enrollment-documents.model';

@Component({
  selector: 'app-public-documents',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, AsyncBtnComponent],
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
          <div class="relative h-16 w-16 shrink-0 rounded-lg overflow-hidden" style="border: 2px solid var(--state-success); background: var(--bg-elevated);">
            <!-- Loader skeleton -->
            @if (!isImageLoaded()) {
              <div class="absolute inset-0 flex items-center justify-center animate-pulse" style="background: var(--bg-inverted-subtle);">
                <app-icon name="loader" [size]="16" class="animate-spin" color="var(--text-muted)" />
              </div>
            }
            <img
              [src]="data().carnetPhoto!.capturedDataUrl"
              alt="Foto carnet subida"
              class="h-full w-full object-cover transition-opacity duration-300"
              [class.opacity-0]="!isImageLoaded()"
              (load)="isImageLoaded.set(true)"
              (error)="isImageLoaded.set(true)"
            />
          </div>
          <div class="flex-1">
            <p class="text-sm font-semibold" style="color: var(--state-success);">Foto subida</p>
            <p class="text-xs" style="color: var(--text-secondary);">
              {{ data().carnetPhoto!.fileName }}
            </p>
          </div>
          <label
            class="text-xs font-semibold cursor-pointer rounded-md px-2 py-1 focus-within:outline focus-within:outline-(--ds-brand) focus-within:outline-offset-2"
            style="color: var(--text-muted);"
            for="pub-carnet-rechange"
          >
            Cambiar
            <button
              type="button"
              class="sr-only"
              id="pub-carnet-rechange"
            ></button>
            <button
              type="button"
              (click)="handleClearPhoto()"
              class="cursor-pointer"
            >
              Cambiar
            </button>
          </label>
        </div>
      } @else {
        <!-- Photo input methods (Tabs) -->
        <div class="flex flex-col gap-3">
          <div
            class="flex gap-2 p-1 rounded-lg"
            style="background: var(--bg-elevated); border: 1px solid var(--border-subtle);"
          >
            <button
              type="button"
              class="flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer"
              [style.background]="activeTab() === 'upload' ? 'var(--bg-surface)' : 'transparent'"
              [style.color]="
                activeTab() === 'upload' ? 'var(--text-primary)' : 'var(--text-secondary)'
              "
              [style.box-shadow]="activeTab() === 'upload' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'"
              (click)="switchTab('upload')"
            >
              Subir archivo
            </button>
            <button
              type="button"
              class="flex-1 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer"
              [style.background]="activeTab() === 'camera' ? 'var(--bg-surface)' : 'transparent'"
              [style.color]="
                activeTab() === 'camera' ? 'var(--text-primary)' : 'var(--text-secondary)'
              "
              [style.box-shadow]="activeTab() === 'camera' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'"
              (click)="switchTab('camera')"
            >
              Usar cámara
            </button>
          </div>

          @if (activeTab() === 'upload') {
            <!-- Upload area -->
            <label
              class="flex flex-col items-center gap-3 rounded-xl px-6 py-8 cursor-pointer transition-all focus-within:outline focus-within:outline-(--ds-brand) focus-within:outline-offset-2"
              [class.opacity-50]="isUploading()"
              [class.pointer-events-none]="isUploading()"
              [style.background]="isDragging() ? 'color-mix(in srgb, var(--ds-brand) 5%, var(--bg-surface))' : 'var(--bg-surface)'"
              [style.border]="isDragging() ? '2px dashed var(--ds-brand)' : '2px dashed var(--border-default)'"
              for="pub-carnet-upload"
              (dragover)="onDragOver($event)"
              (dragleave)="onDragLeave($event)"
              (drop)="onDrop($event)"
              data-llm-description="Carnet photo upload area for driving school enrollment"
            >
              <div
                class="flex h-12 w-12 items-center justify-center rounded-xl"
                style="background: var(--gradient-subtle);"
                aria-hidden="true"
              >
                @if (isUploading()) {
                  <app-icon
                    name="loader"
                    [size]="24"
                    color="var(--ds-brand)"
                    class="animate-spin"
                  />
                } @else {
                  <app-icon name="camera" [size]="24" color="var(--ds-brand)" />
                }
              </div>
              <div class="text-center">
                <p class="text-sm font-semibold" style="color: var(--text-primary);">
                  @if (isUploading()) {
                    Subiendo imagen...
                  } @else {
                    Subir foto carnet
                  }
                </p>
                <p class="text-xs mt-0.5" style="color: var(--text-muted);">
                  JPG o PNG · Máx. 5 MB
                </p>
                <span
                  class="mt-3 inline-flex items-center justify-center rounded-lg px-5 py-2 text-sm font-semibold transition-colors"
                  style="background: color-mix(in srgb, var(--ds-brand) 8%, transparent); color: var(--ds-brand);"
                >
                  Seleccionar foto
                </span>
              </div>
              <input
                id="pub-carnet-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                class="sr-only"
                [disabled]="isUploading()"
                (change)="onFileChange($event)"
              />
            </label>
          } @else {
            <!-- Camera area -->
            <div
              class="flex flex-col items-center gap-3 rounded-xl p-4 overflow-hidden relative"
              style="background: var(--bg-surface); border: 1px solid var(--border-default);"
            >
              <div
                class="w-full rounded-lg overflow-hidden relative"
                style="aspect-ratio: 4/3; background: var(--bg-elevated);"
              >
                <video
                  #videoElement
                  autoplay
                  playsinline
                  class="w-full h-full object-cover"
                  [class.hidden]="!isCameraActive()"
                ></video>

                @if (!isCameraActive()) {
                  <div
                    class="absolute inset-0 flex flex-col items-center justify-center p-4 text-center"
                  >
                    <div
                      class="flex h-12 w-12 items-center justify-center rounded-xl mb-3"
                      style="background: rgba(150,150,150,0.1);"
                    >
                      <app-icon name="camera" [size]="24" color="var(--text-secondary)" />
                    </div>
                    <p class="text-sm font-medium" style="color: var(--text-primary);">
                      La cámara está inactiva
                    </p>
                    <p class="text-xs mt-1 mb-4" style="color: var(--text-muted);">
                      Presiona el botón para solicitar acceso
                    </p>
                    <button
                      type="button"
                      class="btn-primary px-4 py-2 text-xs rounded-lg font-semibold"
                      (click)="startCamera()"
                    >
                      Activar cámara
                    </button>
                  </div>
                }
              </div>

              @if (cameraError()) {
                <p class="text-xs text-center px-2" style="color: var(--state-error);">
                  {{ cameraError() }}
                </p>
              }

              @if (isCameraActive()) {
                <app-async-btn
                  class="w-full"
                  label="Capturar foto"
                  icon="camera"
                  [loading]="isProcessingCapture()"
                  loadingLabel="Procesando..."
                  (click)="capturePhoto()"
                />
              }

              <canvas #canvasElement class="hidden"></canvas>
            </div>
          }
        </div>
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
          class="btn-primary px-7 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2"
          [disabled]="!hasPhoto() || isUploading()"
          data-llm-action="confirm-carnet-photo"
          (click)="!isUploading() && hasPhoto() && next.emit()"
        >
          @if (isUploading()) {
            <app-icon name="loader" [size]="16" class="animate-spin" />
            Subiendo...
          } @else {
            Continuar
          }
        </button>
      </div>
    </div>
  `,
})
export class PublicDocumentsComponent implements OnDestroy {
  readonly data = input.required<EnrollmentDocumentsData>();
  readonly isUploading = input<boolean>(false);
  readonly fileSelected = output<{ type: string; file: File }>();
  readonly next = output<void>();
  readonly back = output<void>();

  protected readonly hasPhoto = computed(() => !!this.data().carnetPhoto);

  protected readonly activeTab = signal<'upload' | 'camera'>('upload');
  protected readonly isCameraActive = signal(false);
  protected readonly isProcessingCapture = signal(false);
  protected readonly cameraError = signal<string | null>(null);
  protected readonly isDragging = signal(false);
  protected readonly isImageLoaded = signal(false);

  protected readonly videoElement = viewChild<ElementRef<HTMLVideoElement>>('videoElement');
  protected readonly canvasElement = viewChild<ElementRef<HTMLCanvasElement>>('canvasElement');

  private mediaStream: MediaStream | null = null;

  constructor() {
    effect(() => {
      const url = this.data().carnetPhoto?.capturedDataUrl;
      if (url) {
        untracked(() => this.isImageLoaded.set(false));
      }
    });
  }

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

  ngOnDestroy(): void {
    this.stopCamera();
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.isUploading()) {
      this.isDragging.set(true);
    }
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    
    if (this.isUploading()) return;
    
    const file = event.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      this.fileSelected.emit({ type: 'id_photo', file });
    }
  }

  switchTab(tab: 'upload' | 'camera'): void {
    if (this.isUploading()) return;

    this.activeTab.set(tab);
    if (tab === 'camera') {
      void this.startCamera();
    } else {
      this.stopCamera();
    }
  }

  handleClearPhoto(): void {
    if (this.isUploading()) return;
    
    this.fileSelected.emit({ type: 'clear', file: null as any });
    
    this.activeTab.set('upload');
    this.stopCamera();
  }

  async startCamera(): Promise<void> {
    this.cameraError.set(null);
    this.isProcessingCapture.set(false);
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
      });
      const video = this.videoElement()?.nativeElement;
      if (video) {
        video.srcObject = this.mediaStream;
        this.isCameraActive.set(true);
      }
    } catch (err) {
      this.cameraError.set(
        'No se pudo acceder a la cámara. Por favor, revisa los permisos del navegador.',
      );
      this.isCameraActive.set(false);
    }
  }

  protected stopCamera(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    this.isCameraActive.set(false);
  }

  protected capturePhoto(): void {
    const video = this.videoElement()?.nativeElement;
    const canvas = this.canvasElement()?.nativeElement;

    if (video && canvas && !this.isProcessingCapture()) {
      this.isProcessingCapture.set(true);
      video.pause(); // Freeze frame to provide immediate visual feedback

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const file = new File([blob], 'foto-carnet-webcam.jpg', { type: 'image/jpeg' });
              this.fileSelected.emit({ type: 'id_photo', file });
              // Do NOT stop camera or change tab yet. The parent will upload and set data().carnetPhoto,
              // which automatically destroys this view and shows the success preview.

              // Fallback timeout in case the upload fails silently or takes too long,
              // to allow the user to try again.
              setTimeout(() => {
                if (this.isProcessingCapture()) {
                  this.isProcessingCapture.set(false);
                  video.play().catch(() => {}); // Resume camera
                }
              }, 5000);
            } else {
              this.isProcessingCapture.set(false);
              video.play().catch(() => {});
            }
          },
          'image/jpeg',
          0.9,
        );
      } else {
        this.isProcessingCapture.set(false);
        video.play().catch(() => {});
      }
    }
  }

  protected onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.fileSelected.emit({ type: 'id_photo', file });
  }
}
