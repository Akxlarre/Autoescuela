import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { DmsFacade } from '@core/facades/dms.facade';
import { DmsListContentComponent } from '@shared/components/dms-list-content/dms-list-content.component';
import { DmsViewerService } from '@core/services/ui/dms-viewer.service';
import type { TemplateCard } from '@core/models/ui/dms.model';

/**
 * SecretariaDocumentosComponent — Smart Page DMS (Secretaria).
 * Secretaria solo puede subir y ver documentos (sin eliminar, sin nueva plantilla).
 */
@Component({
  selector: 'app-secretaria-documentos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DmsListContentComponent,
  ],
  template: `
    <app-dms-list-content
      basePath="/app/secretaria/documentos"
      [studentsWithDocs]="facade.studentsWithDocs()"
      [recentDocs]="facade.recentDocs()"
      [schoolDocs]="facade.schoolDocs()"
      [templates]="facade.templates()"
      [isLoading]="facade.isLoading()"
      [isAdmin]="false"
      (uploadStudentDoc)="openUploadStudentDrawer()"
      (uploadSchoolDoc)="openUploadSchoolDrawer()"
      (uploadTemplate)="onNoop()"
      (viewStudentDocs)="onViewStudentDocs($event)"
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
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly dmsViewer = inject(DmsViewerService);

  ngOnInit(): void {
    void this.facade.initialize();
  }

  openUploadStudentDrawer(): void {
    this.facade.openUpload('student');
  }

  openUploadSchoolDrawer(): void {
    this.facade.openUpload('school');
  }

  onViewStudentDocs(studentId: number): void {
    void this.router.navigate(['alumnos', studentId], { relativeTo: this.route });
  }

  onViewDocument(url: string, fileName?: string): void {
    this.dmsViewer.openByUrl(url, fileName || 'Documento');
  }

  onDownloadTemplate(template: TemplateCard): void {
    window.open(template.fileUrl, '_blank');
    this.facade.incrementDownload(template.id);
  }

  /** Secretaria no puede eliminar — handler no-op requerido por el tipo del output */
  onNoop(): void {}
}
