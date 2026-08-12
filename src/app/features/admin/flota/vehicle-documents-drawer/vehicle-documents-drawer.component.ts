import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';

// Facades & Models
import { FlotaFacade } from '@core/facades/flota.facade';
import { LayoutDrawerFacadeService } from '@core/services/ui/layout-drawer.facade.service';
import { DmsViewerService } from '@core/services/ui/dms-viewer.service';
import { ToastService } from '@core/services/ui/toast.service';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { validateDocumentFile } from '@core/utils/document-file-validation.util';
import { VEHICLE_DOC_TYPES } from '@core/utils/vehicle-doc-types.util';
import type { DocStatus } from '@core/models/ui/vehicle-table.model';
import { IconComponent } from '@shared/components/icon/icon.component';
import { BadgeComponent } from '@shared/components/badge/badge.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { DateInputComponent } from '@shared/components/date-input/date-input.component';
import { AsyncBtnComponent } from '@shared/components/async-btn/async-btn.component';

interface VehicleDocRow {
  type: string;
  label: string;
  icon: string;
  expiryDate: string | null;
  status: DocStatus | null;
  filePath: string | null;
}

const DOC_TYPES = VEHICLE_DOC_TYPES.map((t) => ({ type: t.value, label: t.label, icon: t.icon }));

/**
 * VehicleDocumentsDrawerComponent — Contenido dinámico para el LayoutDrawer.
 * Muestra los 4 documentos legales obligatorios de un vehículo (SOAP, Revisión Técnica,
 * Permiso de Circulación, Seguro) y permite cargar/actualizar fecha de vencimiento + adjunto.
 */
@Component({
  selector: 'app-vehicle-documents-drawer',
  standalone: true,
  imports: [
    CommonModule,
    IconComponent,
    BadgeComponent,
    SkeletonBlockComponent,
    DrawerContentLoaderComponent,
    DrawerFormComponent,
    DateInputComponent,
    AsyncBtnComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-drawer-form>
      <app-drawer-content-loader>
        <ng-template #skeletons>
          <!-- Skeleton Header -->
          <div
            class="shrink-0 px-6 py-4 border-b flex items-center justify-between border-border-subtle"
          >
            <app-skeleton-block variant="text" width="160px" height="20px" />
          </div>
          <!-- Skeleton Body -->
          <div class="flex-1 overflow-y-auto px-6 py-6">
            <div class="grid grid-cols-1 gap-4">
              @for (_ of [1, 2, 3]; track $index) {
                <div class="p-5 rounded-2xl border bg-base flex items-center justify-between">
                  <div class="flex items-center gap-4">
                    <app-skeleton-block
                      variant="rect"
                      width="48px"
                      height="48px"
                      borderRadius="0.75rem"
                    />
                    <div class="flex flex-col gap-1.5">
                      <app-skeleton-block variant="text" width="140px" height="14px" />
                      <app-skeleton-block variant="text" width="90px" height="10px" />
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <app-skeleton-block
                      variant="rect"
                      width="64px"
                      height="20px"
                      borderRadius="999px"
                    />
                    <app-skeleton-block
                      variant="rect"
                      width="32px"
                      height="32px"
                      borderRadius="0.5rem"
                    />
                  </div>
                </div>
              }
            </div>
          </div>
          <!-- Skeleton Footer -->
          <div
            class="shrink-0 p-6 border-t bg-surface flex items-center justify-end border-border-subtle"
          >
            <app-skeleton-block variant="rect" width="140px" height="44px" borderRadius="0.5rem" />
          </div>
        </ng-template>
        <ng-template #content>
          <!-- Header Info -->
          <div class="pb-4 mb-4 border-b border-border-subtle">
            <h3 class="item-title">Documentación Obligatoria</h3>
          </div>

          <!-- Lista de Documentos -->
          <div>
            @if (isLoading()) {
              <div class="grid grid-cols-1 gap-4">
                @for (_ of [1, 2, 3]; track $index) {
                  <div class="p-5 rounded-2xl border bg-base flex items-center justify-between">
                    <div class="flex items-center gap-4">
                      <app-skeleton-block
                        variant="rect"
                        width="48px"
                        height="48px"
                        borderRadius="0.75rem"
                      />
                      <div class="flex flex-col gap-1.5">
                        <app-skeleton-block variant="text" width="140px" height="14px" />
                        <app-skeleton-block variant="text" width="90px" height="10px" />
                      </div>
                    </div>
                    <div class="flex items-center gap-2">
                      <app-skeleton-block
                        variant="rect"
                        width="64px"
                        height="20px"
                        borderRadius="999px"
                      />
                      <app-skeleton-block
                        variant="rect"
                        width="32px"
                        height="32px"
                        borderRadius="0.5rem"
                      />
                    </div>
                  </div>
                }
              </div>
            } @else {
              <div class="grid grid-cols-1 gap-4">
                @for (doc of rows(); track doc.type) {
                  <div
                    class="p-5 rounded-2xl border bg-base transition-all duration-300"
                    [class.border-ds-brand]="editingType() === doc.type"
                  >
                    <div class="flex items-center justify-between group">
                      <div class="flex items-center gap-4">
                        <div
                          class="w-12 h-12 rounded-xl bg-ds-brand-muted flex items-center justify-center text-ds-brand"
                        >
                          <app-icon [name]="doc.icon" [size]="24" />
                        </div>
                        <div>
                          <h4 class="item-title leading-tight mb-0.5">
                            {{ doc.label }}
                          </h4>
                          <p class="text-2xs font-medium text-text-muted uppercase tracking-wider">
                            @if (doc.expiryDate) {
                              Vence: {{ doc.expiryDate | date: 'dd MMM yyyy' }}
                            } @else {
                              Sin fecha de vencimiento registrada
                            }
                          </p>
                        </div>
                      </div>

                      <div class="flex items-center gap-2">
                        @if (doc.status) {
                          <app-badge [variant]="doc.status === 'expired' ? 'error' : 'success'">
                            {{ doc.status === 'expired' ? 'Vencido' : 'Vigente' }}
                          </app-badge>
                        } @else {
                          <app-badge variant="warning">Sin cargar</app-badge>
                        }
                        @if (doc.filePath) {
                          <button
                            class="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-subtle text-text-muted hover:text-ds-brand transition-colors"
                            aria-label="Ver documento"
                            data-llm-action="view-vehicle-document"
                            (click)="onViewDoc(doc)"
                          >
                            <app-icon name="external-link" [size]="14" />
                          </button>
                        }
                        <button
                          class="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-subtle text-text-muted hover:text-ds-brand transition-colors"
                          aria-label="Actualizar documento"
                          data-llm-action="edit-vehicle-document"
                          (click)="onEditDoc(doc)"
                        >
                          <app-icon name="pencil" [size]="14" />
                        </button>
                      </div>
                    </div>

                    @if (editingType() === doc.type) {
                      <div class="mt-4 pt-4 border-t border-border-subtle flex flex-col gap-3">
                        <app-date-input
                          label="Fecha de vencimiento"
                          [required]="true"
                          [value]="editExpiry()"
                          (valueChange)="editExpiry.set($event)"
                        />
                        <div class="flex flex-col gap-1.5">
                          <label class="micro-label block">Adjuntar archivo (opcional)</label>
                          <div class="flex items-center gap-2">
                            <button
                              type="button"
                              class="btn-secondary"
                              data-llm-action="select-vehicle-document-file"
                              (click)="fileInput.click()"
                            >
                              <app-icon name="upload" [size]="13" />
                              {{ editFile()?.name ?? 'Elegir archivo (PDF/JPG/PNG)' }}
                            </button>
                            <input
                              #fileInput
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png,.webp"
                              class="hidden"
                              data-llm-description="hidden file input for vehicle document upload"
                              (change)="onFileChange($event)"
                            />
                          </div>
                        </div>
                        @if (formError()) {
                          <p class="text-xs text-error">{{ formError() }}</p>
                        }
                        <div class="flex items-center justify-end gap-2 mt-1">
                          <button
                            type="button"
                            class="btn-secondary"
                            data-llm-action="cancel-edit-vehicle-document"
                            (click)="onCancelEdit()"
                          >
                            Cancelar
                          </button>
                          <app-async-btn
                            label="Guardar"
                            icon="save"
                            [loading]="isSubmitting()"
                            llmAction="save-vehicle-document"
                            (click)="onSaveDoc(doc)"
                          ></app-async-btn>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            }
          </div>
        </ng-template>
      </app-drawer-content-loader>

      <ng-container ngProjectAs="[drawer-form-footer]">
        <button
          type="button"
          class="btn-primary"
          data-llm-action="close-vehicle-documents"
          (click)="onClose()"
        >
          Cerrar Panel
        </button>
      </ng-container>
    </app-drawer-form>
  `,
})
export class VehicleDocumentsDrawerComponent {
  private readonly flotaFacade = inject(FlotaFacade);
  private readonly layoutDrawer = inject(LayoutDrawerFacadeService);
  private readonly dmsViewer = inject(DmsViewerService);
  private readonly toast = inject(ToastService);
  private readonly sanitizer = inject(ErrorSanitizerService);

  readonly vehicleId = this.flotaFacade.selectedVehicleId;
  readonly documents = signal<
    { type: string; expiryDate: string; status: DocStatus; filePath: string | null }[]
  >([]);
  readonly isLoading = signal(false);

  readonly rows = computed<VehicleDocRow[]>(() =>
    DOC_TYPES.map((cfg) => {
      const doc = this.documents().find((d) => d.type === cfg.type);
      return {
        ...cfg,
        expiryDate: doc?.expiryDate || null,
        status: doc?.status ?? null,
        filePath: doc?.filePath ?? null,
      };
    }),
  );

  readonly editingType = signal<string | null>(null);
  readonly editExpiry = signal<string>('');
  readonly editFile = signal<File | null>(null);
  readonly isSubmitting = signal(false);
  readonly formError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const id = this.vehicleId();
      if (id) {
        this.loadDocuments(id);
      }
    });
  }

  async loadDocuments(vehicleId: number) {
    this.isLoading.set(true);
    // Para simplificar, obtenemos los documentos del vehículo cargado en el Facade
    const vehicle = this.flotaFacade.vehicles().find((v) => v.id === vehicleId);
    if (vehicle?.documents) {
      this.documents.set(vehicle.documents);
    }
    this.isLoading.set(false);
  }

  onEditDoc(doc: VehicleDocRow): void {
    this.editingType.set(doc.type);
    this.editExpiry.set(doc.expiryDate ?? '');
    this.editFile.set(null);
    this.formError.set(null);
  }

  onCancelEdit(): void {
    this.editingType.set(null);
    this.editFile.set(null);
    this.formError.set(null);
  }

  onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const error = validateDocumentFile(file);
    if (error) {
      this.formError.set(error);
      return;
    }
    this.formError.set(null);
    this.editFile.set(file);
  }

  async onSaveDoc(doc: VehicleDocRow): Promise<void> {
    if (!this.editExpiry()) {
      this.formError.set('La fecha de vencimiento es obligatoria.');
      return;
    }
    const vehicleId = this.vehicleId();
    if (!vehicleId) return;

    this.isSubmitting.set(true);
    this.formError.set(null);
    try {
      await this.flotaFacade.upsertVehicleDocument({
        vehicleId,
        type: doc.type,
        expiryDate: this.editExpiry(),
        file: this.editFile(),
        existingFilePath: doc.filePath,
      });
      this.onCancelEdit();
    } catch (err) {
      this.formError.set(
        err instanceof Error
          ? this.sanitizer.sanitize(err).message
          : 'Error al guardar el documento',
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }

  async onViewDoc(doc: VehicleDocRow): Promise<void> {
    if (!doc.filePath) return;
    const url = await this.flotaFacade.getDocumentSignedUrl(doc.filePath);
    if (!url) {
      this.toast.error('No se pudo abrir el documento');
      return;
    }
    this.dmsViewer.openByUrl(url, doc.label);
  }

  onClose() {
    this.layoutDrawer.close();
  }
}
