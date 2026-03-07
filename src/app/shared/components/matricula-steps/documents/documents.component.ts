import { Component, ChangeDetectionStrategy, input, output, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EnrollmentDocumentsData } from '@core/models/ui/enrollment-documents.model';
import type { DocumentType } from '@core/models/ui/enrollment-documents.model';

@Component({
  selector: 'app-documents-step',
  imports: [FormsModule, IconComponent],
  templateUrl: './documents.component.html',
  styleUrl: './documents.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsComponent {
  data = input.required<EnrollmentDocumentsData>();
  /** Emitido cuando el usuario selecciona un archivo para subir. */
  fileSelected = output<{ type: string; file: File }>();
  next = output<void>();
  back = output<void>();

  activePhotoTab = signal<'camera' | 'upload'>('camera');

  setPhotoTab(tab: 'camera' | 'upload'): void {
    this.activePhotoTab.set(tab);
  }

  onFileChange(event: Event, docType: string): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) this.fileSelected.emit({ type: docType, file });
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
