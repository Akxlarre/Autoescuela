import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { DmsFacade } from '@core/facades/dms.facade';
import { DmsListContentComponent } from '@shared/components/dms-list-content/dms-list-content.component';
import type { TemplateCard } from '@core/models/ui/dms.model';

/**
 * SecretariaDocumentosComponent — Smart Page DMS (Secretaria).
 * Secretaria solo puede subir y ver documentos (sin eliminar, sin nueva plantilla).
 */
@Component({
  selector: 'app-secretaria-documentos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DmsListContentComponent],
  template: `
    <app-dms-list-content
      basePath="/app/secretaria/documentos"
      [studentsWithDocs]="facade.studentsWithDocs()"
      [recentDocs]="facade.recentDocs()"
      [instructorsWithDocs]="facade.instructorsWithDocs()"
      [schoolDocs]="facade.schoolDocs()"
      [templates]="facade.templates()"
      [isLoading]="facade.isLoading()"
      [isAdmin]="false"
      (uploadStudentDoc)="openUploadStudentDrawer()"
      (uploadInstructorDoc)="openUploadInstructorDrawer()"
      (uploadSchoolDoc)="openUploadSchoolDrawer()"
      (uploadTemplate)="onNoop()"
      (viewStudentDocs)="onViewStudentDocs($event)"
      (viewInstructorDocs)="onViewInstructorDocs($event)"
      (viewDocument)="onViewDocument($event.url, $event.fileName)"
      (deleteStudentDoc)="onNoop()"
      (deleteSchoolDoc)="onNoop()"
      (deleteTemplate)="onNoop()"
      (downloadTemplate)="onDownloadTemplate($event)"
    />
  `,
})
export class SecretariaDocumentosComponent implements OnInit {
  readonly facade = inject(DmsFacade);

  ngOnInit(): void {
    void this.facade.initialize();
  }

  openUploadStudentDrawer(): void {
    this.facade.openUpload('student');
  }

  openUploadInstructorDrawer(): void {
    this.facade.openUpload('instructor');
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

  onDownloadTemplate(template: TemplateCard): void {
    window.open(template.fileUrl, '_blank');
    this.facade.incrementDownload(template.id);
  }

  /** Secretaria no puede eliminar — handler no-op requerido por el tipo del output */
  onNoop(): void {}
}
