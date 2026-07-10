import { TooltipModule } from 'primeng/tooltip';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SlicePipe } from '@angular/common';
import { DmsFacade } from '@core/facades/dms.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { IconComponent } from '@shared/components/icon/icon.component';
import { SafePipe } from '@core/pipes/safe.pipe';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DmsUploadDrawerComponent } from '../dms-upload-drawer/dms-upload-drawer.component';
import { CardHoverDirective } from '@core/directives/card-hover.directive';

/**
 * AdminAlumnoDocsDetalleComponent — Subruta /app/admin/documentos/alumnos/:id
 * Lista todos los documentos de un alumno con breadcrumb de retorno.
 * isAdmin se deriva de AuthFacade, por lo que puede reutilizarse en secretaria.
 */
@Component({
  selector: 'app-admin-alumno-docs-detalle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TooltipModule,
    RouterLink,
    SlicePipe,
    IconComponent,
    EmptyStateComponent,
    SkeletonBlockComponent,
    SafePipe,
    CardHoverDirective,
  ],
  template: `
    <!-- ── SKELETON ── -->
    @if (facade.studentDocsLoading()) {
      <div class="p-6 flex flex-col gap-5">
        <app-skeleton-block variant="rect" width="300px" height="18px" />
        <app-skeleton-block variant="rect" width="100%" height="80px" />
        <app-skeleton-block variant="rect" width="100%" height="300px" />
      </div>
    } @else {
      <div class="p-6 flex flex-col gap-6">
        <!-- Breadcrumb -->
        <nav class="flex items-center gap-2 text-sm text-text-secondary">
          <a
            [routerLink]="isAdmin() ? '/app/admin/documentos' : '/app/secretaria/documentos'"
            class="no-underline hover:underline transition-colors text-text-secondary"
            >Repositorio DMS</a
          >
          <app-icon name="chevron-right" [size]="14" />
          <span class="text-text-secondary">Documentos del alumno</span>
          <app-icon name="chevron-right" [size]="14" />
          <span class="font-medium text-text-primary">
            {{ facade.studentDetail()?.name ?? 'Alumno' }}
          </span>
        </nav>

        <!-- Header -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold m-0 text-text-primary">
              {{ facade.studentDetail()?.name ?? 'Alumno' }}
            </h1>
            <p class="text-sm m-0 mt-1 text-text-secondary">
              {{ facade.studentDetail()?.rut ?? '' }}
            </p>
          </div>
          <button
            type="button"
            class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all duration-150 border-0 bg-brand"
            style="color: var(--color-primary-text)"
            (click)="openUploadDrawer()"
          >
            <app-icon name="upload" [size]="15" />
            Subir documento
          </button>
        </div>

        <!-- Split View Layout -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[600px] lg:h-[700px]">
          <!-- Lista de documentos (Columna Izquierda) -->
          <div class="lg:col-span-4 flex flex-col">
            <div class="bento-card p-0 overflow-hidden flex-1 flex flex-col" appCardHover>
              <div class="px-5 py-4 border-b border-border-subtle bg-surface">
                <h2 class="text-base font-semibold m-0 text-text-primary">
                  Documentos
                  @if (facade.studentDocs().length > 0) {
                    <span
                      class="ml-2 text-xs px-2 py-0.5 rounded-full font-semibold bg-brand-tint text-brand"
                      >{{ facade.studentDocs().length }}</span
                    >
                  }
                </h2>
              </div>

              @if (facade.studentDocs().length === 0) {
                <div class="p-8">
                  <app-empty-state
                    message="Sin documentos"
                    subtitle="Este alumno aún no tiene documentos."
                    icon="file-text"
                    actionLabel="Subir documento"
                    actionIcon="upload"
                    (action)="openUploadDrawer()"
                  />
                </div>
              } @else {
                <ul class="divide-y m-0 p-0 list-none border-border-subtle overflow-y-auto flex-1">
                  @for (doc of facade.studentDocs(); track doc.id) {
                    <li
                      class="flex flex-col px-4 py-4 gap-3 transition-colors border-border-subtle cursor-pointer hover:bg-subtle"
                      [class.bg-brand-tint]="selectedDocPath() === doc.fileUrl"
                      (click)="onSelectDocument(doc.fileUrl!, doc.fileName, doc.type)"
                    >
                      <div class="flex items-center gap-3 min-w-0">
                        <div
                          class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                          [class.bg-white]="selectedDocPath() === doc.fileUrl"
                          [class.shadow-sm]="selectedDocPath() === doc.fileUrl"
                          [class.bg-subtle]="selectedDocPath() !== doc.fileUrl"
                        >
                          <app-icon
                            name="file-text"
                            [size]="18"
                            [class.text-brand]="selectedDocPath() === doc.fileUrl"
                          />
                        </div>
                        <div class="min-w-0 flex-1">
                          <p
                            class="font-medium text-sm truncate m-0"
                            [class.text-brand]="selectedDocPath() === doc.fileUrl"
                            [class.text-text-primary]="selectedDocPath() !== doc.fileUrl"
                            [pTooltip]="doc.fileName"
                            tooltipPosition="top"
                          >
                            {{ doc.fileName }}
                          </p>
                          <p
                            class="text-xs m-0 mt-0.5"
                            [class.text-brand]="selectedDocPath() === doc.fileUrl"
                            [class.text-text-secondary]="selectedDocPath() !== doc.fileUrl"
                          >
                            {{ doc.typeLabel }} · {{ doc.documentAt | slice: 0 : 10 }}
                          </p>
                        </div>
                        @if (isAdmin() && doc.source !== 'enrollment_license') {
                          <button
                            type="button"
                            class="text-xs shrink-0 w-8 h-8 flex items-center justify-center rounded-md cursor-pointer border-0 bg-transparent text-error hover:bg-error/10"
                            pTooltip="Eliminar"
                            (click)="$event.stopPropagation(); onDeleteDoc(doc.id, doc.source)"
                          >
                            <app-icon name="trash-2" [size]="16" />
                          </button>
                        }
                      </div>
                    </li>
                  }
                </ul>
              }
            </div>
          </div>

          <!-- Previsualización (Columna Derecha) -->
          <div class="lg:col-span-8 flex flex-col h-full">
            <div
              class="bento-card p-0 flex-1 flex flex-col overflow-hidden bg-surface"
              appCardHover
            >
              @if (selectedDocLoading()) {
                <div class="flex-1 flex items-center justify-center">
                  <div class="flex flex-col items-center gap-4">
                    <div
                      class="w-10 h-10 rounded-full border-4 border-brand border-t-transparent animate-spin"
                    ></div>
                    <p class="text-text-secondary font-medium m-0">Cargando documento...</p>
                  </div>
                </div>
              } @else if (selectedDoc()) {
                <!-- Header del Preview -->
                <div
                  class="px-5 py-3 border-b border-border-subtle bg-surface flex items-center justify-between shrink-0"
                >
                  <h3 class="font-semibold text-text-primary m-0 truncate pr-4">
                    {{ selectedDoc()?.name }}
                  </h3>
                  <button
                    type="button"
                    class="hidden sm:inline-flex items-center gap-2 h-9 px-3 rounded-lg text-sm font-semibold transition-all duration-150 cursor-pointer border border-border-subtle bg-transparent hover:bg-subtle text-text-primary shrink-0"
                    (click)="onDownloadSelected()"
                  >
                    <app-icon name="download" [size]="14" />
                    Descargar
                  </button>
                </div>

                <!-- Área de contenido del Preview -->
                <div
                  class="flex-1 bg-subtle relative overflow-hidden flex items-center justify-center p-0 lg:p-4 min-h-0"
                >
                  <div class="w-full h-full flex items-center justify-center">
                    @switch (selectedDoc()?.type) {
                      @case ('image') {
                        <img
                          [src]="selectedDoc()?.url"
                          [alt]="selectedDoc()?.name"
                          class="max-w-full max-h-full object-contain rounded shadow-sm border border-border-subtle"
                        />
                      }
                      @case ('pdf') {
                        <iframe
                          [src]="selectedDoc()?.url | safe: 'resourceUrl'"
                          class="w-full h-full border-0 rounded bg-white shadow-sm border border-border-subtle"
                          title="Visor PDF"
                        ></iframe>
                      }
                      @default {
                        <div
                          class="p-8 surface-glass rounded-2xl flex flex-col items-center gap-4 max-w-sm text-center"
                        >
                          <div
                            class="w-16 h-16 rounded-2xl flex items-center justify-center bg-brand-muted shrink-0"
                          >
                            <app-icon name="file-question" [size]="32" class="text-brand" />
                          </div>
                          <h4 class="text-lg font-bold text-text-primary m-0">
                            Formato no soportado
                          </h4>
                          <p class="text-text-secondary text-sm m-0">
                            Este documento debe ser descargado.
                          </p>
                          <button
                            type="button"
                            class="btn-primary w-full mt-4"
                            (click)="onDownloadSelected()"
                          >
                            Descargar para abrir
                          </button>
                        </div>
                      }
                    }
                  </div>
                </div>
              } @else {
                <!-- Empty state de preview -->
                <div class="flex-1 flex items-center justify-center bg-subtle/30">
                  <div class="text-center p-8 max-w-sm">
                    <div
                      class="w-16 h-16 rounded-2xl bg-surface shadow-sm border border-border-subtle flex items-center justify-center mx-auto mb-4 text-text-secondary"
                    >
                      <app-icon name="eye" [size]="24" />
                    </div>
                    <h3 class="text-lg font-semibold text-text-primary m-0 mb-2">
                      Previsualización
                    </h3>
                    <p class="text-text-secondary text-sm m-0">
                      Selecciona un documento de la lista para verlo aquí.
                    </p>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      </div>
    }
    <!-- end @else !loading -->
  `,
})
export class AdminAlumnoDocsDetalleComponent implements OnInit {
  readonly facade = inject(DmsFacade);
  private readonly authFacade = inject(AuthFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly studentId = signal<number | null>(null);
  readonly isAdmin = computed(() => this.authFacade.currentUser()?.role === 'admin');

  readonly selectedDocPath = signal<string | null>(null);
  readonly selectedDoc = signal<{
    url: string;
    name: string;
    type: 'pdf' | 'image' | 'unknown';
  } | null>(null);
  readonly selectedDocLoading = signal(false);

  ngOnInit(): void {
    const id = parseInt(this.route.snapshot.paramMap.get('id') ?? '0', 10);
    if (id > 0) {
      this.studentId.set(id);
      void this.facade.loadStudentDocuments(id);
    }
  }

  openUploadDrawer(): void {
    const id = this.studentId();
    this.facade.openUpload('student', id);
  }

  async onSelectDocument(path: string | null, fileName: string, fileType: string): Promise<void> {
    if (!path) return;

    // Si ya está seleccionado, lo deseleccionamos
    if (this.selectedDocPath() === path) {
      this.selectedDocPath.set(null);
      this.selectedDoc.set(null);
      return;
    }

    this.selectedDocPath.set(path);
    this.selectedDocLoading.set(true);

    try {
      const signedUrl = await this.facade.getSignedDocumentUrl(path);
      if (!signedUrl) throw new Error('No se pudo obtener URL');

      const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
      let type: 'pdf' | 'image' | 'unknown' = 'unknown';
      if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) {
        type = 'image';
      } else if (ext === 'pdf') {
        type = 'pdf';
      }

      this.selectedDoc.set({ url: signedUrl, name: fileName, type });
    } catch {
      this.facade.showError('Error', 'No se pudo cargar la vista previa del documento');
      this.selectedDoc.set(null);
      this.selectedDocPath.set(null);
    } finally {
      this.selectedDocLoading.set(false);
    }
  }

  onDownloadSelected(): void {
    const doc = this.selectedDoc();
    if (!doc) return;
    const link = document.createElement('a');
    link.href = doc.url;
    link.download = doc.name;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async onDeleteDoc(docId: string, source: string): Promise<void> {
    const confirmed = await this.facade.confirm({
      title: 'Eliminar documento',
      message: '¿Estás seguro de que quieres eliminar este documento?',
      severity: 'danger',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
    });
    if (!confirmed) return;
    try {
      await this.facade.deleteStudentDocument(
        docId,
        source as 'student_document' | 'digital_contract',
      );
      // Limpiar visor si eliminamos el seleccionado
      const docs = this.facade.studentDocs();
      const deletedDoc = docs.find((d) => d.id === docId);
      if (deletedDoc && deletedDoc.fileUrl === this.selectedDocPath()) {
        this.selectedDocPath.set(null);
        this.selectedDoc.set(null);
      }
      // Recargar lista
      if (this.studentId()) {
        void this.facade.loadStudentDocuments(this.studentId()!);
      }
    } catch (err) {
      console.error('Error al eliminar:', err);
    }
  }

  onDocumentSaved(): void {
    // Recargar lista del alumno actual
    if (this.studentId()) {
      void this.facade.loadStudentDocuments(this.studentId()!);
    }
  }
}
