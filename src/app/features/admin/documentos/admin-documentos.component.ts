import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { DmsFacade } from '@core/facades/dms.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { BranchFacade } from '@core/facades/branch.facade';
import { DocumentContentTemplatesFacade } from '@core/facades/document-content-templates.facade';
import { DmsViewerService } from '@core/services/ui/dms-viewer.service';
import { DmsListContentComponent } from '@shared/components/dms-list-content/dms-list-content.component';
import type { DocumentType } from '@core/models/ui/document-content-template.model';

/**
 * AdminDocumentosComponent — Smart Page del Módulo DMS (Admin).
 * Admin tiene CRUD completo: subir, ver, eliminar documentos.
 * Además orquesta el editor de plantillas (spec 0016-m) — inyecta
 * `DocumentContentTemplatesFacade` acá (no en `DmsListContentComponent`, que sigue siendo Dumb) y
 * resuelve los eventos `template*` que la tab "Plantillas" emite.
 */
@Component({
  selector: 'app-admin-documentos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DmsListContentComponent],
  template: `
    <!-- Contenido principal -->
    <app-dms-list-content
      basePath="/app/admin/documentos"
      [studentsWithDocs]="facade.studentsWithDocs()"
      [recentDocs]="facade.recentDocs()"
      [instructorsWithDocs]="facade.instructorsWithDocs()"
      [schoolDocs]="facade.schoolDocs()"
      [isLoading]="facade.isLoading()"
      [isAdmin]="isAdmin()"
      [showSedeColumn]="showSedeColumn()"
      [templateBranches]="branchFacade.branches()"
      [templateForm]="templatesFacade.form()"
      [templateIsLoading]="templatesFacade.isLoading()"
      [templateIsPublishing]="templatesFacade.isPublishing()"
      [templateIsGeneratingPreview]="templatesFacade.isGeneratingPreview()"
      (uploadStudentDoc)="openUploadStudentDrawer()"
      (uploadInstructorDoc)="openUploadInstructorDrawer()"
      (uploadSchoolDoc)="openUploadSchoolDrawer()"
      (viewStudentDocs)="onViewStudentDocs($event)"
      (viewInstructorDocs)="onViewInstructorDocs($event)"
      (viewDocument)="onViewDocument($event.url, $event.fileName)"
      (deleteStudentDoc)="onDeleteStudentDoc($event)"
      (deleteSchoolDoc)="onDeleteSchoolDoc($event)"
      (templateLoadRequested)="onTemplateLoadRequested($event)"
      (templateSectionChanged)="onTemplateSectionChanged($event)"
      (templatePreviewRequested)="onTemplatePreview()"
      (templateViewPublishedRequested)="onTemplateViewPublished($event)"
      (templatePublishRequested)="onTemplatePublish()"
    />
  `,
})
export class AdminDocumentosComponent {
  readonly facade = inject(DmsFacade);
  readonly templatesFacade = inject(DocumentContentTemplatesFacade);
  readonly branchFacade = inject(BranchFacade);
  private readonly authFacade = inject(AuthFacade);
  private readonly dmsViewer = inject(DmsViewerService);

  // ── Computed ──────────────────────────────────────────────────────────────
  readonly isAdmin = computed(() => this.authFacade.currentUser()?.role === 'admin');
  readonly showSedeColumn = computed(
    () => this.isAdmin() && this.branchFacade.selectedBranchId() === null,
  );

  constructor() {
    effect(() => {
      this.branchFacade.selectedBranchId();
      void this.facade.initialize();
    });
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  openUploadStudentDrawer(studentId?: number): void {
    this.facade.openUpload('student', studentId);
  }

  openUploadInstructorDrawer(instructorId?: number): void {
    this.facade.openUpload('instructor', instructorId);
  }

  openUploadSchoolDrawer(): void {
    this.facade.openUpload('school');
  }

  onViewStudentDocs(event: { studentId: number; enrollmentId: number }): void {
    const row = this.facade
      .studentsWithDocs()
      .find((s) => s.studentId === event.studentId && s.enrollmentId === event.enrollmentId);
    this.facade.openStudentDocsDrawer(event.studentId, event.enrollmentId, row?.name ?? 'Alumno');
  }

  onViewInstructorDocs(instructorId: number): void {
    const row = this.facade.instructorsWithDocs().find((i) => i.instructorId === instructorId);
    this.facade.openInstructorDocsDrawer(instructorId, row?.name ?? 'Instructor');
  }

  onViewDocument(url: string, fileName?: string): void {
    this.facade.openDocument(url, fileName);
  }

  async onDeleteStudentDoc(payload: { id: string; source: string }): Promise<void> {
    const confirmed = await this.facade.confirm({
      title: 'Eliminar documento',
      message:
        '¿Estás seguro de que quieres eliminar este documento? Esta acción no se puede deshacer.',
      severity: 'danger',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
    });
    if (!confirmed) return;
    try {
      await this.facade.deleteStudentDocument(
        payload.id,
        payload.source as 'student_document' | 'digital_contract',
      );
    } catch (err) {
      console.error('Error al eliminar documento:', err);
    }
  }

  async onDeleteSchoolDoc(id: number): Promise<void> {
    const confirmed = await this.facade.confirm({
      title: 'Eliminar documento institucional',
      message: '¿Estás seguro de que quieres eliminar este documento?',
      severity: 'danger',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
    });
    if (!confirmed) return;
    try {
      await this.facade.deleteSchoolDocument(id);
    } catch (err) {
      console.error('Error al eliminar:', err);
    }
  }

  // ── Editor de plantillas (spec 0016-m) ──────────────────────────────────────

  onTemplateLoadRequested(event: { branchId: number; documentType: DocumentType }): void {
    void this.templatesFacade.load(event.branchId, event.documentType);
  }

  onTemplateSectionChanged(event: { sectionId: string; body: string }): void {
    this.templatesFacade.updateSection(event.sectionId, event.body);
  }

  async onTemplatePreview(): Promise<void> {
    const pdfBase64 = await this.templatesFacade.preview();
    this.openPdf(pdfBase64, 'Vista previa');
  }

  async onTemplateViewPublished(event: {
    branchId: number;
    documentType: DocumentType;
  }): Promise<void> {
    const pdfBase64 = await this.templatesFacade.viewPublished(event.branchId, event.documentType);
    this.openPdf(pdfBase64, 'Documento actual');
  }

  async onTemplatePublish(): Promise<void> {
    await this.templatesFacade.publish();
  }

  private openPdf(pdfBase64: string | null, title: string): void {
    if (!pdfBase64) return;
    const bytes = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    this.dmsViewer.open({ url, name: title, type: 'pdf' });
  }
}
