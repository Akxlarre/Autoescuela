import { TooltipModule } from 'primeng/tooltip';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { DmsFacade } from '@core/facades/dms.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { IconComponent } from '@shared/components/icon/icon.component';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';

/**
 * DmsInstructorDocsDrawerComponent — Drawer con la lista de documentos de un instructor
 * (spec 0003-m). Calcado de DmsStudentDocsDrawerComponent. Click en un documento →
 * facade.openDocPreview() apila (push) el visor sobre esta lista; el botón "volver" del
 * header del drawer regresa aquí (LayoutDrawerService.canGoBack).
 */
@Component({
  selector: 'app-dms-instructor-docs-drawer',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TooltipModule,
    SlicePipe,
    IconComponent,
    EmptyStateComponent,
    SkeletonBlockComponent,
    DrawerFormComponent,
  ],
  template: `
    <app-drawer-form [hasFooter]="true">
      @if (facade.instructorDocsLoading()) {
        <div class="flex flex-col gap-3">
          @for (_ of [1, 2, 3, 4]; track $index) {
            <app-skeleton-block variant="rect" width="100%" height="64px" />
          }
        </div>
      } @else {
        @if (facade.instructorDocs().length === 0) {
          <app-empty-state
            message="Sin documentos"
            subtitle="Este instructor aún no tiene documentos."
            icon="file-text"
          />
        } @else {
          <ul class="flex flex-col gap-2 m-0 p-0 list-none">
            @for (doc of facade.instructorDocs(); track doc.id) {
              <li
                class="flex items-center gap-3 p-3 rounded-lg border border-border-subtle transition-colors cursor-pointer hover:bg-subtle"
                data-llm-action="preview-document"
                (click)="onSelectDocument(doc.fileUrl, doc.fileName)"
              >
                <div
                  class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-subtle"
                >
                  <app-icon name="file-text" [size]="18" />
                </div>
                <div class="min-w-0 flex-1">
                  <p
                    class="font-medium text-sm truncate m-0 text-text-primary"
                    [pTooltip]="doc.fileName"
                    tooltipPosition="top"
                  >
                    {{ doc.fileName }}
                  </p>
                  <p class="text-xs m-0 mt-0.5 text-text-secondary">
                    {{ doc.typeLabel }} · {{ doc.documentAt | slice: 0 : 10 }}
                  </p>
                </div>
                @if (isAdmin()) {
                  <button
                    type="button"
                    class="text-xs shrink-0 w-8 h-8 flex items-center justify-center rounded-md cursor-pointer border-0 bg-transparent text-error hover:bg-error/10"
                    pTooltip="Eliminar"
                    data-llm-action="delete-document"
                    (click)="$event.stopPropagation(); onDeleteDoc(doc.id)"
                  >
                    <app-icon name="trash-2" [size]="16" />
                  </button>
                }
              </li>
            }
          </ul>
        }
      }

      <ng-container ngProjectAs="[drawer-form-footer]">
        <button
          type="button"
          class="btn-primary w-full"
          data-llm-action="upload-document"
          (click)="openUploadDrawer()"
        >
          <app-icon name="upload" [size]="14" />
          Subir documento
        </button>
      </ng-container>
    </app-drawer-form>
  `,
})
export class DmsInstructorDocsDrawerComponent {
  readonly facade = inject(DmsFacade);
  private readonly authFacade = inject(AuthFacade);

  readonly isAdmin = computed(() => this.authFacade.currentUser()?.role === 'admin');

  openUploadDrawer(): void {
    const id = this.facade.instructorDetail()?.instructorId ?? null;
    this.facade.openUpload('instructor', id);
  }

  onSelectDocument(path: string | null, fileName: string): void {
    this.facade.openDocPreview(path, fileName);
  }

  async onDeleteDoc(docId: number): Promise<void> {
    const confirmed = await this.facade.confirm({
      title: 'Eliminar documento',
      message: '¿Estás seguro de que quieres eliminar este documento?',
      severity: 'danger',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
    });
    if (!confirmed) return;
    try {
      await this.facade.deleteInstructorDocument(docId);
      const instructorId = this.facade.instructorDetail()?.instructorId;
      if (instructorId) {
        void this.facade.loadInstructorDocuments(instructorId);
      }
    } catch (err) {
      console.error('Error al eliminar:', err);
    }
  }
}
