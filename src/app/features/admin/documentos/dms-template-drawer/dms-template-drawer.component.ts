import {
  ChangeDetectionStrategy,
  Component,
  computed,
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
import type { TemplateCategory } from '@core/models/ui/dms.model';

/**
 * DmsTemplateDrawerComponent — Contenido para el drawer de nuevas plantillas.
 * Lanzado por LayoutDrawerService.
 */
@Component({
  selector: 'app-dms-template-drawer',
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

        <!-- Nombre -->
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium" style="color: var(--text-primary);">Nombre *</label>
          <input
            type="text"
            [ngModel]="name()"
            (ngModelChange)="name.set($event)"
            placeholder="Ej: Contrato Clase B"
            class="w-full rounded-lg px-3 py-2 text-sm border"
            style="background: var(--bg-subtle); border-color: var(--border-subtle); color: var(--text-primary); outline: none;"
          />
        </div>

        <!-- Descripción -->
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium" style="color: var(--text-secondary);">Descripción</label>
          <textarea
            [ngModel]="description()"
            (ngModelChange)="description.set($event)"
            rows="2"
            placeholder="Descripción breve de la plantilla..."
            class="w-full rounded-lg px-3 py-2 text-sm resize-none border"
            style="background: var(--bg-subtle); border-color: var(--border-subtle); color: var(--text-primary); outline: none;"
          ></textarea>
        </div>

        <!-- Categoría -->
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium" style="color: var(--text-primary);">Categoría *</label>
          <p-select
            [ngModel]="category()"
            (ngModelChange)="category.set($event)"
            [options]="categoryOptions"
            placeholder="Seleccionar categoría..."
            styleClass="w-full"
          />
        </div>

        <!-- Archivo -->
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium" style="color: var(--text-primary);">Archivo *</label>
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
              <app-icon name="file-text" [size]="22" />
            </div>

            @if (selectedFile()) {
              <div>
                <p class="font-semibold text-sm m-0" style="color: var(--text-primary);">{{ selectedFile()!.name }}</p>
                <p class="text-xs m-0 mt-1" style="color: var(--text-secondary);">
                  {{ detectedFormat().toUpperCase() }} · {{ formatFileSize(selectedFile()!.size) }}
                </p>
              </div>
            } @else {
              <div>
                <p class="font-medium text-sm m-0" style="color: var(--text-primary);">Arrastra tu plantilla aquí</p>
                <p class="text-xs m-0 mt-1" style="color: var(--text-secondary);">PDF, DOCX, XLSX — máx. 10 MB</p>
              </div>
            }
          </div>
          <input
            #fileInput
            type="file"
            accept=".pdf,.doc,.docx,.xls,.xlsx"
            class="hidden"
            (change)="onFileChange($event)"
          />
        </div>

        <!-- Éxito -->
        @if (savedOk()) {
          <app-alert-card title="Plantilla creada" severity="success">
            La plantilla se subió correctamente.
          </app-alert-card>
        }
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-end gap-3 pt-4 border-t shrink-0" style="border-color: var(--border-subtle);">
        <button
          type="button"
          class="px-4 py-2 rounded-lg text-sm font-medium border cursor-pointer"
          style="border-color: var(--border-subtle); background: transparent; color: var(--text-primary);"
          (click)="onClose()"
        >Cancelar</button>
        <app-async-btn
          label="Guardar plantilla"
          icon="folder"
          [loading]="isSubmitting()"
          [disabled]="!canSubmit()"
          (click)="onSubmit()"
        ></app-async-btn>
      </div>
    </div>
  `,
})
export class DmsTemplateDrawerComponent {
  private readonly facade = inject(DmsFacade);
  private readonly layoutDrawer = inject(LayoutDrawerService);

  // ── Estado local ─────────────────────────────────────────────────────────
  readonly name = signal('');
  readonly description = signal('');
  readonly category = signal<TemplateCategory | ''>('');
  readonly selectedFile = signal<File | null>(null);
  readonly isSubmitting = signal(false);
  readonly savedOk = signal(false);
  readonly validationError = signal<string | null>(null);
  readonly isDragOver = signal(false);

  // ── Computed ──────────────────────────────────────────────────────────────
  readonly detectedFormat = computed(() => {
    const file = this.selectedFile();
    if (!file) return 'pdf';
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'pdf';
    if (ext === 'docx' || ext === 'doc') return 'docx';
    if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
    return 'pdf';
  });

  readonly canSubmit = computed(
    () => !!this.name().trim() && !!this.category() && !!this.selectedFile(),
  );

  // ── Config ────────────────────────────────────────────────────────────────
  readonly categoryOptions = [
    { label: 'Clase B',           value: 'clase_b' },
    { label: 'Clase Profesional', value: 'clase_profesional' },
    { label: 'Administrativo',    value: 'administrativo' },
    { label: 'General',           value: 'general' },
  ];

  constructor() {
    this.resetForm();
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
    const maxSize = 10 * 1024 * 1024; // 10 MB
    if (file.size > maxSize) {
      this.validationError.set('El archivo no puede superar los 10 MB.');
      return;
    }
    const allowedExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx'];
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (!allowedExts.includes(ext)) {
      this.validationError.set('Solo se permiten archivos PDF, DOCX o XLSX.');
      return;
    }
    this.selectedFile.set(file);
  }

  async onSubmit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.isSubmitting.set(true);
    try {
      await this.facade.uploadTemplate({
        file: this.selectedFile()!,
        name: this.name().trim(),
        description: this.description().trim() || undefined,
        category: this.category() as TemplateCategory,
      });
      this.savedOk.set(true);
      void this.facade.initialize();
      setTimeout(() => {
        this.savedOk.set(false);
        this.onClose();
      }, 1200);
    } catch (err) {
      this.validationError.set(err instanceof Error ? err.message : 'Error al subir la plantilla');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  onClose(): void {
    this.layoutDrawer.close();
  }

  private resetForm(): void {
    this.name.set('');
    this.description.set('');
    this.category.set('');
    this.selectedFile.set(null);
    this.validationError.set(null);
    this.savedOk.set(false);
    this.isDragOver.set(false);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}
