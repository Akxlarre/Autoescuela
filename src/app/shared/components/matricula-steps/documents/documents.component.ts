import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  effect,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AsyncBtnComponent } from '@shared/components/async-btn/async-btn.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { EnrollmentDocumentsData } from '@core/models/ui/enrollment-documents.model';
import type { DocumentType } from '@core/models/ui/enrollment-documents.model';

@Component({
  selector: 'app-documents-step',
  imports: [FormsModule, IconComponent, AsyncBtnComponent, SkeletonBlockComponent],
  templateUrl: './documents.component.html',
  styleUrl: './documents.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsComponent {
  data = input.required<EnrollmentDocumentsData>();
  loading = input<boolean>(false);
  /** Emitido cuando el usuario selecciona un archivo para subir. */
  fileSelected = output<{ type: string; file: File }>();
  /** Emitido al abrir/cerrar el lightbox. null = cerrar. */
  lightboxOpen = output<string | null>();
  next = output<void>();
  back = output<void>();

  activePhotoTab = signal<'camera' | 'upload'>('upload');

  /** true mientras se espera que el Smart suba la foto y devuelva la URL */
  readonly isUploadingPhoto = signal(false);

  constructor() {
    // Cuando llega la URL de la foto (upload completado), apaga el spinner local
    effect(() => {
      if (this.data().carnetPhoto?.capturedDataUrl) {
        this.isUploadingPhoto.set(false);
      }
    });
  }

  setPhotoTab(tab: 'camera' | 'upload'): void {
    this.activePhotoTab.set(tab);
  }

  onFileChange(event: Event, docType: string): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    if (docType === 'id_photo') this.isUploadingPhoto.set(true);
    this.fileSelected.emit({ type: docType, file });
    // Reset so the same file can be selected again (e.g. re-upload after error)
    input.value = '';
  }

  openLightbox(url: string): void {
    this.lightboxOpen.emit(url);
  }

  closeLightbox(): void {
    this.lightboxOpen.emit(null);
  }

  readonly allRequiredUploaded = computed(() => {
    const d = this.data();
    const hasCarnet =
      !!d.carnetPhoto?.capturedDataUrl || d.uploadedDocuments.has('id_photo' as DocumentType);
    if (!hasCarnet) return false;
    return d.requiredDocuments
      .filter((doc: { required: boolean }) => doc.required)
      .every((doc: { type: DocumentType }) => this.isUploaded(doc.type));
  });

  isUploaded(type: DocumentType): boolean {
    return this.data().uploadedDocuments.has(type);
  }

  onNext(): void {
    this.next.emit();
  }

  onBack(): void {
    this.back.emit();
  }
}
