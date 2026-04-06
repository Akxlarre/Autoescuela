import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { DmsFacade } from '@core/facades/dms.facade';
import { AuthFacade } from '@core/facades/auth.facade';
import { DmsListContentComponent } from '@shared/components/dms-list-content/dms-list-content.component';
import type { TemplateCard } from '@core/models/ui/dms.model';

/**
 * AdminDocumentosComponent — Smart Page del Módulo DMS (Admin).
 * Admin tiene CRUD completo: subir, ver, eliminar documentos.
 */
@Component({
  selector: 'app-admin-documentos',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DmsListContentComponent,
  ],
  template: `
    <!-- Contenido principal -->
    <app-dms-list-content
      basePath="/app/admin/documentos"
      [studentsWithDocs]="facade.studentsWithDocs()"
      [recentDocs]="facade.recentDocs()"
      [schoolDocs]="facade.schoolDocs()"
      [templates]="facade.templates()"
      [isLoading]="facade.isLoading()"
      [isAdmin]="isAdmin()"
      (uploadStudentDoc)="openUploadStudentDrawer()"
      (uploadSchoolDoc)="openUploadSchoolDrawer()"
      (uploadTemplate)="facade.openTemplate()"
      (viewStudentDocs)="onViewStudentDocs($event)"
      (viewDocument)="onViewDocument($event.url, $event.fileName)"
      (deleteStudentDoc)="onDeleteStudentDoc($event)"
      (deleteSchoolDoc)="onDeleteSchoolDoc($event)"
      (deleteTemplate)="onDeleteTemplate($event)"
      (downloadTemplate)="onDownloadTemplate($event)"
    />
  `,
})
export class AdminDocumentosComponent implements OnInit {
  readonly facade = inject(DmsFacade);
  private readonly authFacade = inject(AuthFacade);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  // ── Computed ──────────────────────────────────────────────────────────────
  readonly isAdmin = computed(() => this.authFacade.currentUser()?.role === 'admin');

  ngOnInit(): void {
    void this.facade.initialize();
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  openUploadStudentDrawer(studentId?: number): void {
    this.facade.openUpload('student', studentId);
  }

  openUploadSchoolDrawer(): void {
    this.facade.openUpload('school');
  }

  onViewStudentDocs(studentId: number): void {
    void this.router.navigate(['alumnos', studentId], { relativeTo: this.route });
  }

  onViewDocument(url: string, fileName?: string): void {
    this.facade.openDocument(url, fileName);
  }

  async onDeleteStudentDoc(payload: { id: string; source: string }): Promise<void> {
    const confirmed = await this.facade.confirm({
      title: 'Eliminar documento',
      message: '¿Estás seguro de que quieres eliminar este documento? Esta acción no se puede deshacer.',
      severity: 'danger',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
    });
    if (!confirmed) return;
    try {
      await this.facade.deleteStudentDocument(payload.id, payload.source as 'student_document' | 'digital_contract');
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

  async onDeleteTemplate(id: number): Promise<void> {
    const confirmed = await this.facade.confirm({
      title: 'Eliminar plantilla',
      message: '¿Estás seguro de que quieres eliminar esta plantilla? (desactivación suave)',
      severity: 'danger',
      confirmLabel: 'Eliminar',
      cancelLabel: 'Cancelar',
    });
    if (!confirmed) return;
    try {
      await this.facade.deleteTemplate(id);
    } catch (err) {
      console.error('Error al eliminar plantilla:', err);
    }
  }

  onDownloadTemplate(template: TemplateCard): void {
    window.open(template.fileUrl, '_blank');
    this.facade.incrementDownload(template.id);
  }
}
