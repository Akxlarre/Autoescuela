import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { SelectModule } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@shared/components/icon/icon.component';
import { AsyncBtnComponent } from '@shared/components/async-btn/async-btn.component';
import { AlertCardComponent } from '@shared/components/alert-card/alert-card.component';
import { DmsFacade } from '@core/facades/dms.facade';
import { LayoutDrawerService } from '@core/services/ui/layout-drawer.service';

type UploadMode = 'student' | 'school';

/**
 * DmsUploadDrawerComponent — Drawer para subir documentos de alumno o de la escuela.
 * Usa drag & drop nativo + validación tipo/tamaño.
 */
@Component({
  selector: 'app-dms-upload-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IconComponent,
    AsyncBtnComponent,
    AlertCardComponent,
    SelectModule,
    FormsModule,
  ],
  template: `
    <div class="flex flex-col gap-6 h-full py-2">
      <div class="flex-1 flex flex-col gap-5">

        <!-- ── Selector alumno (modo student) ── -->
        @if (facade.currentUploadMode() === 'student') {
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium" style="color: var(--text-primary);">Alumno *</label>
            <p-select
              [ngModel]="selectedStudentId()"
              (ngModelChange)="selectedStudentId.set($event)"
              [options]="studentOptions()"
              optionLabel="name"
              optionValue="studentId"
              placeholder="Seleccionar alumno..."
              [filter]="true"
              filterPlaceholder="Buscar alumno..."
              styleClass="w-full"
              appendTo="body"
            ></p-select>
          </div>
        }

        <!-- ── Selector tipo ── -->
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium" style="color: var(--text-primary);">Tipo de documento *</label>
          <p-select
            [ngModel]="selectedType()"
            (ngModelChange)="selectedType.set($event)"
            [options]="facade.currentUploadMode() === 'student' ? studentDocTypes : schoolDocTypes"
            placeholder="Seleccionar tipo..."
            styleClass="w-full"
            appendTo="body"
          ></p-select>
        </div>

        <!-- ── Descripción (modo school) ── -->
        @if (facade.currentUploadMode() === 'school') {
          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-medium" style="color: var(--text-primary);">Descripción</label>
            <textarea
              [ngModel]="description()"
              (ngModelChange)="description.set($event)"
              rows="2"
              placeholder="Descripción opcional..."
              class="w-full rounded-lg px-3 py-2 text-sm resize-none border"
              style="background: var(--bg-subtle); border-color: var(--border-subtle); color: var(--text-primary); outline: none;"
            ></textarea>
          </div>
        }

        <!-- ── Drag & Drop ── -->
        <div
          class="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 cursor-pointer"
          [style]="isDragOver() ? 'border-color: var(--color-primary); background: var(--color-primary-tint);' : 'border-color: var(--border-subtle); background: var(--bg-subtle);'"
          (dragover)="onDragOver($event)"
          (dragleave)="isDragOver.set(false)"
          (drop)="onDrop($event)"
          (click)="fileInput.click()"
        >
          <div
            class="w-12 h-12 rounded-xl flex items-center justify-center"
            style="background: var(--bg-surface);"
          >
            <app-icon name="upload" [size]="22"></app-icon>
          </div>

          @if (selectedFile()) {
            <div>
              <p class="font-semibold text-sm m-0" style="color: var(--text-primary);">{{ selectedFile()!.name }}</p>
              <p class="text-xs m-0 mt-1" style="color: var(--text-secondary);">{{ formatFileSize(selectedFile()!.size) }}</p>
            </div>
          } @else {
            <div>
              <p class="font-medium text-sm m-0" style="color: var(--text-primary);">Arrastra tu archivo aquí</p>
              <p class="text-xs m-0 mt-1" style="color: var(--text-secondary);">PDF, JPG, PNG — máx. 5 MB</p>
            </div>
          }
        </div>
        <input
          #fileInput
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          class="hidden"
          (change)="onFileChange($event)"
        />

        <!-- ── Error de validación ── -->
        @if (validationError()) {
          <app-alert-card title="Error de archivo" severity="error">
            {{ validationError() }}
          </app-alert-card>
        }

        <!-- ── Banner éxito ── -->
        @if (savedOk()) {
          <app-alert-card title="Documento subido" severity="success">
            El documento se subió correctamente.
          </app-alert-card>
        }
      </div>

      <!-- Footer integrado en el contenido -->
      <div class="flex items-center justify-end gap-3 pt-4 border-t" style="border-color: var(--border-subtle);">
        <button
          type="button"
          class="px-4 py-2 rounded-lg text-sm font-medium border cursor-pointer"
          style="border-color: var(--border-subtle); background: transparent; color: var(--text-primary);"
          (click)="onClose()"
        >Cancelar</button>
        <app-async-btn
          label="Subir documento"
          icon="upload"
          [loading]="isSubmitting()"
          [disabled]="!canSubmit()"
          (click)="onSubmit()"
        ></app-async-btn>
      </div>
    </div>
  `,
})
export class DmsUploadDrawerComponent {
  readonly facade = inject(DmsFacade);
  readonly layoutDrawer = inject(LayoutDrawerService);

  // ── Estado local ─────────────────────────────────────────────────────────
  readonly selectedStudentId = signal<number | null>(null);
  readonly selectedType = signal<string>('');
  readonly description = signal<string>('');
  readonly selectedFile = signal<File | null>(null);
  readonly isSubmitting = signal(false);
  readonly savedOk = signal(false);
  readonly validationError = signal<string | null>(null);
  readonly isDragOver = signal(false);

  // ── Computed ──────────────────────────────────────────────────────────────
  readonly studentOptions = computed(() => this.facade.studentsWithDocs());

  readonly canSubmit = computed(() => {
    if (!this.selectedFile() || !this.selectedType()) return false;
    if (this.facade.currentUploadMode() === 'student' && !this.selectedStudentId()) return false;
    return true;
  });

  // ── Config selectores ─────────────────────────────────────────────────────
  readonly studentDocTypes = [
    { label: 'Contrato',               value: 'contrato' },
    { label: 'Foto Licencia',          value: 'foto_licencia' },
    { label: 'Hoja de Vida',           value: 'hoja_vida' },
    { label: 'Cédula',                 value: 'cedula' },
    { label: 'Cert. Antecedentes',     value: 'certificado_antecedentes' },
    { label: 'Autorización Notarial',  value: 'autorizacion_notarial' },
    { label: 'Foto Carnet',            value: 'foto_carnet' },
  ];

  readonly schoolDocTypes = [
    { label: 'Factura Folios',   value: 'factura_folios' },
    { label: 'Resolución MTT',   value: 'resolucion_mtt' },
    { label: 'Decreto',          value: 'decreto' },
    { label: 'Otro',             value: 'otro' },
  ];

  constructor() {
    this.resetForm();

    // Pre-seleccionar alumno si se recibe desde el facade
    effect(() => {
      const id = this.facade.preselectedStudentId();
      if (id) this.selectedStudentId.set(id);
    });
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragOver.set(false);
    const file = event.dataTransfer?.files[0];
    if (file) this.validateAndSetFile(file);
  }

  onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.validateAndSetFile(file);
  }

  private validateAndSetFile(file: File): void {
    this.validationError.set(null);
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.validationError.set('Solo se permiten archivos PDF, JPG, PNG o WEBP.');
      return;
    }
    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (file.size > maxSize) {
      this.validationError.set('El archivo no puede superar los 5 MB.');
      return;
    }
    this.selectedFile.set(file);
  }

  async onSubmit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.isSubmitting.set(true);
    try {
      if (this.facade.currentUploadMode() === 'student') {
        await this.facade.uploadStudentDocument({
          file: this.selectedFile()!,
          type: this.selectedType(),
          studentId: this.selectedStudentId()!,
        });
      } else {
        await this.facade.uploadSchoolDocument({
          file: this.selectedFile()!,
          type: this.selectedType(),
          description: this.description() || undefined,
        });
      }
      this.savedOk.set(true);
      this.facade.notifyUploadSaved();
      setTimeout(() => {
        this.savedOk.set(false);
        this.onClose();
      }, 1200);
    } catch (err) {
      this.validationError.set(err instanceof Error ? err.message : 'Error al subir el archivo');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  onClose(): void {
    this.layoutDrawer.close();
  }

  private resetForm(): void {
    this.selectedStudentId.set(null);
    this.selectedType.set('');
    this.description.set('');
    this.selectedFile.set(null);
    this.validationError.set(null);
    this.savedOk.set(false);
    this.isDragOver.set(false);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}
