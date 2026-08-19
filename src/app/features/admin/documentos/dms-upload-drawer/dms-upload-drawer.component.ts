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
import { ConsentsFacade } from '@core/facades/consents.facade';
import { DmsFacade } from '@core/facades/dms.facade';
import { SkeletonBlockComponent } from '@shared/components/skeleton-block/skeleton-block.component';
import { DrawerContentLoaderComponent } from '@shared/components/drawer-content-loader/drawer-content-loader.component';
import { DrawerFormComponent } from '@shared/components/drawer-form/drawer-form.component';
import { ErrorSanitizerService } from '@core/services/infrastructure/error-sanitizer.service';
import { INSTRUCTOR_DOC_TYPES } from '@core/utils/instructor-doc-types.util';
import { validateDocumentFile } from '@core/utils/document-file-validation.util';

type UploadMode = 'student' | 'school' | 'instructor';

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
    SkeletonBlockComponent,
    DrawerContentLoaderComponent,
    DrawerFormComponent,
  ],
  template: `
    <app-drawer-form>
      <app-drawer-content-loader>
        <ng-template #skeletons>
          <div class="flex flex-col gap-5">
            <!-- Alumno (select, modo student) -->
            <div class="flex flex-col gap-1.5">
              <app-skeleton-block variant="text" width="20%" height="12px" />
              <app-skeleton-block variant="rect" width="100%" height="38px" />
            </div>
            <!-- Tipo de documento -->
            <div class="flex flex-col gap-1.5">
              <app-skeleton-block variant="text" width="40%" height="12px" />
              <app-skeleton-block variant="rect" width="100%" height="38px" />
            </div>
            <!-- Archivo (dropzone) -->
            <div class="flex flex-col gap-1.5">
              <app-skeleton-block variant="text" width="30%" height="12px" />
              <app-skeleton-block variant="rect" width="100%" height="150px" />
            </div>
          </div>
        </ng-template>
        <ng-template #content>
          <div class="flex-1 flex flex-col gap-5">
            <!-- ── Selector alumno (modo student) ── -->
            @if (facade.currentUploadMode() === 'student') {
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-text-primary">Alumno *</label>
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

            <!-- ── Selector matrícula (AC-E2: alumno con 2+ matrículas, elegido desde el dropdown genérico) ── -->
            @if (facade.currentUploadMode() === 'student' && showEnrollmentSelector()) {
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-text-primary">Matrícula *</label>
                <p-select
                  [ngModel]="selectedEnrollmentId()"
                  (ngModelChange)="selectedEnrollmentId.set($event)"
                  [options]="enrollmentOptions()"
                  optionLabel="label"
                  optionValue="enrollmentId"
                  placeholder="Seleccionar matrícula..."
                  styleClass="w-full"
                  appendTo="body"
                  data-llm-description="select which enrollment (matrícula) the document belongs to"
                ></p-select>
              </div>
            }

            <!-- ── Selector instructor (modo instructor) ── -->
            @if (facade.currentUploadMode() === 'instructor') {
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-text-primary">Instructor *</label>
                <p-select
                  [ngModel]="selectedInstructorId()"
                  (ngModelChange)="selectedInstructorId.set($event)"
                  [options]="instructorOptions()"
                  optionLabel="name"
                  optionValue="instructorId"
                  placeholder="Seleccionar instructor..."
                  [filter]="true"
                  filterPlaceholder="Buscar instructor..."
                  styleClass="w-full"
                  appendTo="body"
                ></p-select>
              </div>
            }

            <!-- ── Selector tipo ── -->
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium text-text-primary">Tipo de documento *</label>
              <p-select
                [ngModel]="selectedType()"
                (ngModelChange)="selectedType.set($event)"
                [options]="currentDocTypes()"
                placeholder="Seleccionar tipo..."
                styleClass="w-full"
                appendTo="body"
              ></p-select>
            </div>

            <!-- ── Art. 16: dato sensible de salud (spec 0009-m, AC4) ──
                 Solo para el certificado médico. La ley exige que esta autorización sea
                 expresa y ESPECÍFICA para ese dato: no puede ir implícita en ninguna
                 aceptación previa, ni condicionar la subida de otros documentos. -->
            @if (isMedicalCertificate()) {
              <app-alert-card severity="warning" title="Dato sensible de salud — requiere autorización">
                <p class="m-0">
                  El certificado médico es un dato de salud. Solo puede digitalizarse con la
                  autorización expresa del alumno (Ley 21.719, Art. 16).
                </p>
                <label class="flex items-start gap-3 cursor-pointer group mt-3">
                  <input
                    type="checkbox"
                    class="mt-0.5 shrink-0 w-4 h-4 accent-brand cursor-pointer"
                    [checked]="art16Accepted()"
                    (change)="art16Accepted.set($any($event.target).checked)"
                    data-llm-action="aceptar-art16-certificado-medico"
                  />
                  <span class="text-sm text-text-secondary leading-relaxed">
                    El alumno <strong class="text-text-primary">autoriza expresamente</strong> el
                    tratamiento de su certificado médico con el único fin de acreditar su aptitud,
                    y entiende que no se usará para ninguna otra finalidad.
                  </span>
                </label>
                <p class="text-xs text-text-muted m-0 mt-2">
                  Si no autoriza, usa <strong>"No autoriza"</strong>: queda la constancia y el
                  archivo no se sube.
                </p>
              </app-alert-card>
            }

            <!-- ── Descripción (modo school) ── -->
            @if (facade.currentUploadMode() === 'school') {
              <div class="flex flex-col gap-1.5">
                <label class="text-sm font-medium text-text-primary">Descripción</label>
                <textarea
                  [ngModel]="description()"
                  (ngModelChange)="description.set($event)"
                  rows="2"
                  placeholder="Descripción opcional..."
                  class="w-full rounded-lg px-3 py-2 text-sm resize-none border bg-subtle border-border-subtle text-text-primary outline-none"
                  data-llm-description="input for the school document description"
                ></textarea>
              </div>
            }

            <!-- ── Drag & Drop ── -->
            <div
              class="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 cursor-pointer"
              [style]="
                isDragOver()
                  ? 'border-color: var(--color-primary); background: var(--color-primary-tint);'
                  : 'border-color: var(--border-subtle); background: var(--bg-subtle);'
              "
              (dragover)="onDragOver($event)"
              (dragleave)="isDragOver.set(false)"
              (drop)="onDrop($event)"
              data-llm-action="select-document-file"
              (click)="fileInput.click()"
            >
              <div class="w-12 h-12 rounded-xl flex items-center justify-center bg-surface">
                <app-icon name="upload" [size]="22"></app-icon>
              </div>

              @if (selectedFile()) {
                <div>
                  <p class="item-title m-0">
                    {{ selectedFile()!.name }}
                  </p>
                  <p class="text-xs m-0 mt-1 text-text-secondary">
                    {{ formatFileSize(selectedFile()!.size) }}
                  </p>
                </div>
              } @else {
                <div>
                  <p class="font-medium text-sm m-0 text-text-primary">Arrastra tu archivo aquí</p>
                  <p class="text-xs m-0 mt-1 text-text-secondary">PDF, JPG, PNG — máx. 5 MB</p>
                </div>
              }
            </div>
            <input
              #fileInput
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              class="hidden"
              data-llm-description="hidden file input for the document to upload"
              (change)="onFileChange($event)"
            />

            <!-- ── Error de validación ── -->
            @if (validationError()) {
              <app-alert-card title="Error de archivo" severity="error">
                {{ validationError() }}
              </app-alert-card>
            }
          </div>
        </ng-template>
      </app-drawer-content-loader>

      <ng-container ngProjectAs="[drawer-form-footer]">
        @if (isMedicalCertificate()) {
          <button
            type="button"
            class="btn-secondary"
            data-llm-action="registrar-negativa-art16"
            [disabled]="isSubmitting() || !selectedEnrollmentId()"
            (click)="onRefuseArt16()"
          >
            No autoriza
          </button>
        }
        <button
          type="button"
          class="btn-secondary"
          data-llm-action="cancel-upload-document"
          (click)="onClose()"
        >
          Cancelar
        </button>
        <app-async-btn
          label="Subir documento"
          icon="upload"
          [loading]="isSubmitting()"
          [disabled]="!canSubmit()"
          llmAction="upload-document"
          (click)="onSubmit()"
        ></app-async-btn>
      </ng-container>
    </app-drawer-form>
  `,
})
export class DmsUploadDrawerComponent {
  private readonly sanitizer = inject(ErrorSanitizerService);
  readonly facade = inject(DmsFacade);
  private readonly consents = inject(ConsentsFacade);

  // ── Estado local ─────────────────────────────────────────────────────────
  readonly selectedStudentId = signal<number | null>(null);
  /** Matrícula elegida (o auto-resuelta) para la subida — spec 0007-m, AC3/AC-E2. */
  readonly selectedEnrollmentId = signal<number | null>(null);
  readonly selectedInstructorId = signal<number | null>(null);
  readonly selectedType = signal<string>('');
  readonly description = signal<string>('');
  readonly selectedFile = signal<File | null>(null);
  readonly isSubmitting = signal(false);
  readonly validationError = signal<string | null>(null);
  readonly isDragOver = signal(false);

  // ── Computed ──────────────────────────────────────────────────────────────

  /** Dropdown de alumnos deduplicado por studentId (studentsWithDocs() ahora es 1 fila por matrícula, AC-E2). */
  readonly studentOptions = computed(() => {
    const seen = new Set<number>();
    const unique: { studentId: number; name: string }[] = [];
    for (const row of this.facade.studentsWithDocs()) {
      if (seen.has(row.studentId)) continue;
      seen.add(row.studentId);
      unique.push({ studentId: row.studentId, name: row.name });
    }
    return unique;
  });

  readonly instructorOptions = computed(() => this.facade.instructorsWithDocs());

  /** Todas las matrículas del alumno elegido (AC-E2) — poblado por loadStudentEnrollmentOptions(). */
  readonly enrollmentOptions = computed(() => this.facade.studentEnrollmentOptions());

  /** Segundo selector visible solo cuando hace falta desambiguar (sin preselección, 2+ matrículas). */
  readonly showEnrollmentSelector = computed(
    () => !this.facade.preselectedEnrollmentId() && this.enrollmentOptions().length > 1,
  );

  /**
   * Tipos ya subidos para la matrícula/instructor seleccionado. Se apoya en
   * `facade.studentDetail()`/`studentDocs()` — si el seleccionado no coincide con la entidad ya
   * cargada ahí (caso del selector genérico, sin entrar desde el drawer de lista de esa
   * entidad), el effect del constructor dispara `loadStudentDocuments()`/`loadInstructorDocuments()`
   * para esa entidad, y este computed se re-evalúa cuando la carga resuelve.
   */
  private readonly usedStudentTypes = computed(() => {
    const studentId = this.selectedStudentId();
    const enrollmentId = this.selectedEnrollmentId();
    const detail = this.facade.studentDetail();
    if (
      !studentId ||
      !enrollmentId ||
      detail?.studentId !== studentId ||
      detail?.enrollmentId !== enrollmentId
    ) {
      return new Set<string>();
    }
    // 'contract' es el type que fija v_dms_student_documents para las filas que vienen de
    // digital_contracts (contrato firmado online/presencial) — no de student_documents. Es el
    // mismo concepto de negocio que la opción "Contrato" del selector (value: 'contrato'), así
    // que se normaliza acá para que el filtro los trate como el mismo tipo (DG-038).
    return new Set(
      this.facade.studentDocs().map((d) => (d.type === 'contract' ? 'contrato' : d.type)),
    );
  });

  private readonly usedInstructorTypes = computed(() => {
    const id = this.selectedInstructorId();
    if (!id || id !== this.facade.instructorDetail()?.instructorId) return new Set<string>();
    return new Set(this.facade.instructorDocs().map((d) => d.type));
  });

  readonly currentDocTypes = computed(() => {
    const mode = this.facade.currentUploadMode();
    if (mode === 'student') {
      const used = this.usedStudentTypes();
      return this.studentDocTypes.filter((t) => !used.has(t.value));
    }
    if (mode === 'instructor') {
      const used = this.usedInstructorTypes();
      return this.instructorDocTypes.filter((t) => !used.has(t.value));
    }
    return this.schoolDocTypes;
  });

  /**
   * El certificado médico es un **dato sensible de salud** (Ley 21.719 Art. 16) y exige
   * autorización expresa y específica para ese dato — no basta ninguna aceptación previa.
   *
   * Este es el ÚNICO punto de la app por donde entra: no se pide en la matrícula, solo
   * llega cuando un alumno justifica inasistencias (confirmado por el dueño, 17-08-2026).
   */
  readonly isMedicalCertificate = computed(
    () => this.facade.currentUploadMode() === 'student' && this.selectedType() === 'certificado_medico',
  );

  /** Casilla del Art. 16. No premarcada: el consentimiento exige un acto afirmativo. */
  readonly art16Accepted = signal<boolean>(false);

  readonly canSubmit = computed(() => {
    if (!this.selectedFile() || !this.selectedType()) return false;
    const mode = this.facade.currentUploadMode();
    if (mode === 'student' && (!this.selectedStudentId() || !this.selectedEnrollmentId())) {
      return false;
    }
    if (mode === 'instructor' && !this.selectedInstructorId()) return false;
    // Sin autorización expresa no se digitaliza el dato de salud (AC4).
    if (this.isMedicalCertificate() && !this.art16Accepted()) return false;
    return true;
  });

  // ── Config selectores ─────────────────────────────────────────────────────
  // Claves alineadas con las que usa el resto del sistema para el mismo documento
  // (matrícula online/presencial, EnrollmentDocumentsFacade, AdminAlumnosFacade) — DG-038.
  // Antes este drawer usaba claves propias ('cedula', 'hoja_vida', 'foto_carnet', 'foto_licencia')
  // que no coincidían con nada más en la app: un documento subido así quedaba "invisible" para
  // cualquier lógica que buscara el tipo real (ej. el check de cédula en la tabla de alumnos).
  readonly studentDocTypes = [
    { label: 'Contrato', value: 'contrato' },
    { label: 'Foto (Carnet)', value: 'id_photo' },
    { label: 'Cédula de Identidad', value: 'cedula_identidad' },
    { label: 'Certificado Médico', value: 'certificado_medico' },
    { label: 'Hoja de Vida del Conductor', value: 'hoja_vida_conductor' },
    { label: 'Autorización Notarial', value: 'autorizacion_notarial' },
    { label: 'Cert. Antecedentes', value: 'certificado_antecedentes' },
  ];

  readonly instructorDocTypes = INSTRUCTOR_DOC_TYPES;

  readonly schoolDocTypes = [
    { label: 'Factura Folios', value: 'factura_folios' },
    { label: 'Resolución MTT', value: 'resolucion_mtt' },
    { label: 'Decreto', value: 'decreto' },
    { label: 'Otro', value: 'otro' },
  ];

  constructor() {
    this.resetForm();

    // Pre-seleccionar alumno + matrícula si se reciben desde el facade (AC3 — abierto desde el
    // detalle de una matrícula específica; ambos selectores quedan resueltos sin mostrarse).
    effect(() => {
      const id = this.facade.preselectedStudentId();
      if (id) this.selectedStudentId.set(id);
    });
    effect(() => {
      const id = this.facade.preselectedEnrollmentId();
      if (id) this.selectedEnrollmentId.set(id);
    });

    // Pre-seleccionar instructor si se recibe desde el facade
    effect(() => {
      const id = this.facade.preselectedInstructorId();
      if (id) this.selectedInstructorId.set(id);
    });

    // Selector genérico (sin preselección): al elegir alumno, cargar TODAS sus matrículas
    // (AC-E2) para el segundo selector, y limpiar la matrícula elegida previamente.
    effect(() => {
      const id = this.selectedStudentId();
      if (this.facade.currentUploadMode() !== 'student' || !id) return;
      if (this.facade.preselectedEnrollmentId()) return;
      this.selectedEnrollmentId.set(null);
      void this.facade.loadStudentEnrollmentOptions(id);
    });

    // Alumno con 1 sola matrícula → se auto-selecciona sin mostrar el segundo selector (AC4/AC-E1).
    effect(() => {
      const options = this.enrollmentOptions();
      if (options.length === 1 && !this.selectedEnrollmentId()) {
        this.selectedEnrollmentId.set(options[0].enrollmentId);
      }
    });

    // Cargar los documentos de la matrícula elegida si no coinciden con los ya cargados en el
    // facade — cubre el selector genérico (sin preselectedId), donde studentDetail()/studentDocs()
    // todavía no tienen la entidad que el usuario acaba de elegir en el dropdown.
    effect(() => {
      const studentId = this.selectedStudentId();
      const enrollmentId = this.selectedEnrollmentId();
      if (this.facade.currentUploadMode() !== 'student' || !studentId || !enrollmentId) return;
      const detail = this.facade.studentDetail();
      if (detail?.studentId === studentId && detail?.enrollmentId === enrollmentId) return;
      void this.facade.loadStudentDocuments(studentId, enrollmentId);
    });

    // Análogo para instructor.
    effect(() => {
      const id = this.selectedInstructorId();
      if (this.facade.currentUploadMode() !== 'instructor' || !id) return;
      if (id === this.facade.instructorDetail()?.instructorId) return;
      void this.facade.loadInstructorDocuments(id);
    });

    // Si el tipo elegido deja de estar disponible (ya se subió, o cambió la entidad
    // seleccionada), limpiar la selección para no dejar un valor fantasma en el p-select.
    effect(() => {
      const types = this.currentDocTypes();
      const selected = this.selectedType();
      if (selected && !types.some((t) => t.value === selected)) {
        this.selectedType.set('');
      }
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
    const error = validateDocumentFile(file);
    this.validationError.set(error);
    if (!error) this.selectedFile.set(file);
  }

  async onSubmit(): Promise<void> {
    if (!this.canSubmit()) return;
    this.isSubmitting.set(true);
    try {
      const mode = this.facade.currentUploadMode();

      // Consentimiento del Art. 16 ANTES de subir: si no se puede registrar, no se
      // digitaliza el dato de salud. Registrar después dejaría una ventana en la que el
      // documento existe sin respaldo.
      if (this.isMedicalCertificate()) {
        const ok = await this.consents.recordMedicalCertificate(this.selectedEnrollmentId()!, true);
        if (!ok) {
          this.validationError.set(
            'No se pudo registrar la autorización del alumno. El certificado no se subió.',
          );
          return;
        }
      }

      if (mode === 'student') {
        await this.facade.uploadStudentDocument({
          file: this.selectedFile()!,
          type: this.selectedType(),
          studentId: this.selectedStudentId()!,
          enrollmentId: this.selectedEnrollmentId()!,
        });
      } else if (mode === 'instructor') {
        await this.facade.uploadInstructorDocument({
          file: this.selectedFile()!,
          type: this.selectedType(),
          instructorId: this.selectedInstructorId()!,
        });
      } else {
        await this.facade.uploadSchoolDocument({
          file: this.selectedFile()!,
          type: this.selectedType(),
          description: this.description() || undefined,
        });
      }
      this.facade.showSuccess('Documento subido', 'El documento se subió correctamente.');
      this.facade.notifyUploadSaved();
      this.onClose();
    } catch (err) {
      this.validationError.set(
        err instanceof Error ? this.sanitizer.sanitize(err).message : 'Error al subir el archivo',
      );
    } finally {
      this.isSubmitting.set(false);
    }
  }

  /**
   * El alumno exhibió el certificado pero NO autoriza digitalizarlo (AC-E1).
   *
   * Deja constancia de la negativa y cierra sin subir el archivo. Sin esto, ese caso sería
   * indistinguible de "nadie le preguntó" — y ante la Agencia son cosas muy distintas.
   */
  async onRefuseArt16(): Promise<void> {
    const enrollmentId = this.selectedEnrollmentId();
    if (!enrollmentId) return;

    this.isSubmitting.set(true);
    try {
      const ok = await this.consents.recordMedicalCertificate(enrollmentId, false);
      if (!ok) {
        this.validationError.set('No se pudo registrar la negativa. Inténtalo de nuevo.');
        return;
      }
      this.facade.showSuccess(
        'Negativa registrada',
        'Quedó constancia de que el alumno no autorizó digitalizar su certificado médico. El documento no se subió.',
      );
      this.onClose();
    } finally {
      this.isSubmitting.set(false);
    }
  }

  onClose(): void {
    this.facade.closeDrawer();
  }

  private resetForm(): void {
    this.selectedStudentId.set(null);
    this.selectedEnrollmentId.set(null);
    this.selectedInstructorId.set(null);
    this.selectedType.set('');
    this.description.set('');
    this.selectedFile.set(null);
    this.validationError.set(null);
    this.isDragOver.set(false);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}
