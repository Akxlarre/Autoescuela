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
import { ConfirmModalService } from '@core/services/ui/confirm-modal.service';
import { DmsViewerService } from '@core/services/ui/dms-viewer.service';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DmsUploadDrawerComponent } from '../dms-upload-drawer/dms-upload-drawer.component';

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
    RouterLink,
    SlicePipe,
    IconComponent,
    EmptyStateComponent,
    SkeletonBlockComponent,
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
      <nav class="flex items-center gap-2 text-sm" style="color: var(--text-secondary);">
        <a
          [routerLink]="isAdmin() ? '/app/admin/documentos' : '/app/secretaria/documentos'"
          class="no-underline hover:underline transition-colors"
          style="color: var(--text-secondary);"
        >Repositorio DMS</a>
        <app-icon name="chevron-right" [size]="14" />
        <span style="color: var(--text-secondary);">Documentos del alumno</span>
        <app-icon name="chevron-right" [size]="14" />
        <span class="font-medium" style="color: var(--text-primary);">
          {{ facade.studentDetail()?.name ?? 'Alumno' }}
        </span>
      </nav>

      <!-- Header -->
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 class="text-2xl font-bold m-0" style="color: var(--text-primary);">
            {{ facade.studentDetail()?.name ?? 'Alumno' }}
          </h1>
          <p class="text-sm m-0 mt-1" style="color: var(--text-secondary);">
            {{ facade.studentDetail()?.rut ?? '' }}
          </p>
        </div>
        <button
          type="button"
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition-all duration-150 border-0"
          style="background: var(--color-primary); color: var(--color-primary-text);"
          (click)="openUploadDrawer()"
        >
          <app-icon name="upload" [size]="15" />
          Subir documento
        </button>
      </div>

      <!-- Lista de documentos -->
      <div class="bento-card p-0 overflow-hidden">
        <div class="px-5 py-4 border-b" style="border-color: var(--border-subtle);">
          <h2 class="text-base font-semibold m-0" style="color: var(--text-primary);">
            Documentos
            @if (facade.studentDocs().length > 0) {
              <span
                class="ml-2 text-xs px-2 py-0.5 rounded-full font-semibold"
                style="background: var(--color-primary-tint); color: var(--color-primary);"
              >{{ facade.studentDocs().length }}</span>
            }
          </h2>
        </div>

        @if (facade.studentDocs().length === 0) {
          <div class="p-8">
            <app-empty-state
              message="Sin documentos"
              subtitle="Este alumno aún no tiene documentos en el repositorio."
              icon="file-text"
              actionLabel="Subir primer documento"
              actionIcon="upload"
              (action)="openUploadDrawer()"
            />
          </div>
        } @else {
          <ul class="divide-y m-0 p-0 list-none" style="border-color: var(--border-subtle);">
            @for (doc of facade.studentDocs(); track doc.id) {
              <li class="flex items-center justify-between px-5 py-4 gap-3 transition-colors"
                  style="border-color: var(--border-subtle);"
              >
                <div class="flex items-center gap-3 min-w-0">
                  <div
                    class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style="background: var(--bg-subtle);"
                  >
                    <app-icon name="file-text" [size]="18" />
                  </div>
                  <div class="min-w-0">
                    <p class="font-medium text-sm truncate m-0" style="color: var(--text-primary);">{{ doc.fileName }}</p>
                    <p class="text-xs m-0 mt-0.5" style="color: var(--text-secondary);">
                      {{ doc.typeLabel }} · Subido el {{ doc.documentAt | slice:0:10 }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  @if (doc.fileUrl) {
                    <button
                      type="button"
                      class="text-xs font-medium px-3 py-1.5 rounded-md cursor-pointer border"
                      style="color: var(--text-primary); border-color: var(--border-subtle); background: transparent;"
                      (click)="onViewDocument(doc.fileUrl!, doc.fileName)"
                    >Ver</button>
                  }
                  @if (isAdmin()) {
                    <button
                      type="button"
                      class="text-xs font-medium px-3 py-1.5 rounded-md cursor-pointer border-0 bg-transparent"
                      style="color: var(--state-error);"
                      (click)="onDeleteDoc(doc.id, doc.source)"
                    >Eliminar</button>
                  }
                </div>
              </li>
            }
          </ul>
        }
      </div>
    </div>

    } <!-- end @else !loading -->
  `,
})
export class AdminAlumnoDocsDetalleComponent implements OnInit {
  readonly facade = inject(DmsFacade);
  private readonly authFacade = inject(AuthFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly dmsViewer = inject(DmsViewerService);

  readonly studentId = signal<number | null>(null);
  readonly isAdmin = computed(() => this.authFacade.currentUser()?.role === 'admin');

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

  onViewDocument(url: string, fileName?: string): void {
    this.dmsViewer.openByUrl(url, fileName || 'Documento');
  }

  async onDeleteDoc(docId: string, source: string): Promise<void> {
    const confirmed = await this.confirmModal.confirm({
      title: 'Eliminar documento',
      message: '¿Estás seguro de que quieres eliminar este documento?',
      severity: 'danger',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
    });
    if (!confirmed) return;
    try {
      await this.facade.deleteStudentDocument(docId, source as 'student_document' | 'digital_contract');
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
